// 콤보 화면: 방 안 표시(숫자·배율 칩·남은 시간 막대), 단계 오름·유지·정산 연출. 상태는 app.ts가 갖고 여기는 그리기만 한다.
import { formatNumber } from '../logic/format';
import { COMBO_TIERS, comboNext, comboTier, type ComboState } from '../logic/combo';
import * as fx from './fx';
import { sfx } from './sound';
import { vibrate } from './prefs';

/** 0~5단계 색(팔레트 토큰). 5단계는 무지개(CSS가 돌린다) */
const TIER_TOKEN = ['k5', 'g2', 'or', 'pk', 'pu', 'g2'];
const RAINBOW = ['g2', 'or', 'gn', 'b3', 'pu', 'pk'];
const BAR_DOTS = 48;
const STEP_MS = 83;

let host: HTMLElement;
let phone: HTMLElement;
let app: HTMLElement;
let root: HTMLElement;
let numEl: HTMLElement;
let labelEl: HTMLElement;
let chipEl: HTMLElement;
let barEl: HTMLElement;
let fillEl: HTMLElement;
let nextEl: HTMLElement;
let heatEl: HTMLElement;
let hideTimer = 0;
let barW = -1;
let barLow = false;
let heatPhase = -1;

export function attach(room: HTMLElement, phoneEl: HTMLElement, appEl: HTMLElement): void {
  host = room;
  phone = phoneEl;
  app = appEl;
  root = document.createElement('div');
  root.className = 'combo';
  numEl = Object.assign(document.createElement('b'), { className: 'combo-n' });
  labelEl = Object.assign(document.createElement('span'), { className: 'combo-l', textContent: '콤보' });
  chipEl = Object.assign(document.createElement('span'), { className: 'combo-chip' });
  fillEl = document.createElement('i');
  barEl = Object.assign(document.createElement('div'), { className: 'combo-bar' });
  barEl.append(fillEl);
  nextEl = Object.assign(document.createElement('div'), { className: 'combo-next' });
  root.append(Object.assign(document.createElement('div'), { className: 'combo-row' }), chipEl, barEl, nextEl);
  root.firstElementChild!.append(numEl, labelEl);
  heatEl = document.createElement('i');
  heatEl.className = 'fx-edgebox combo-heat';
  heatEl.hidden = true;
  host.append(root, heatEl);
}

const tierColor = (t: number): string => TIER_TOKEN[Math.min(t, 5)];

function center(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** 진행 중 콤보를 화면에서 정산 없이 지운다(저장 불러오기·초기화) */
export function hide(): void {
  window.clearTimeout(hideTimer);
  root.classList.remove('on', 'end');
  heatEl.hidden = true;
  heatPhase = -1;
}

export interface ComboHitView {
  n: number;
  /** 이번 탭으로 오른 단계(0이면 안 오름) */
  tierUp: number;
  /** 감쇠 탭이면 숫자가 오르지 않는다 */
  damped: boolean;
  x: number;
  y: number;
}

export function hit(v: ComboHitView): void {
  const t = comboTier(v.n);
  window.clearTimeout(hideTimer);
  root.classList.remove('end');
  if (v.n < 3) {
    root.classList.remove('on');
    return;
  }
  const mult = t === 0 ? 1 : COMBO_TIERS[t - 1].mult;
  root.dataset.tier = String(t);
  root.classList.add('on');
  numEl.textContent = String(v.n);
  labelEl.textContent = '콤보';
  chipEl.hidden = t === 0;
  chipEl.textContent = `탭 x${mult}`;
  const nx = comboNext(v.n);
  nextEl.textContent = nx ? `다음 x${nx.mult}까지 ${nx.remain}` : '';
  nextEl.hidden = !nx;
  if (v.damped) return;
  if (!fx.isReduced()) {
    fx.pxFrames(numEl, [{ translate: `0 ${-4 - Math.min(t, 4) * 2}px` }, { translate: '0 0' }], STEP_MS);
    if (v.tierUp === 0 && t >= 2) {
      fx.burst(v.x, v.y, { n: 2 + t, colors: [tierColor(t), 'k5'], speed: 200 + t * 40, size: 6, clip: true });
    }
  }
  if (v.tierUp > 0) tierUpFx(v.tierUp, v.n, mult);
}

function tierUpFx(t: number, n: number, mult: number): void {
  const c = center(phone);
  const col = tierColor(t);
  if (!fx.isReduced()) fx.pxFrames(chipEl, [{ background: 'var(--cc)', color: 'var(--k0)' }, { background: 'var(--k1)', color: 'var(--k5)' }, { background: 'var(--cc)', color: 'var(--k0)' }, { background: 'var(--k1)', color: 'var(--k5)' }], STEP_MS);
  if (!fx.isReduced()) fx.pxFrames(numEl, [{ color: 'var(--k5)' }, { color: 'var(--cc)' }, { color: 'var(--k5)' }, { color: 'var(--cc)' }], STEP_MS);
  fx.burst(c.x, c.y, { n: 8, colors: [col, 'k5'], speed: 230, size: 6, ring: true, clip: true, gravity: 0, life: 0.5 });
  sfx.comboUp(t);
  if (t === 1) {
    vibrate(18);
    return;
  }
  if (!fx.bannerActive()) fx.banner(`${n} 콤보!`, { sub: `탭 x${mult}`, tone: 'gold', ms: 1000 + t * 120, color: col, cls: t === 5 ? 'rb' : undefined });
  fx.flash(t === 5 ? 'k5' : col, 300 + t * 60);
  fx.edge(host, col, [1, 0, 1, 0, 1, 1]);
  fx.burst(c.x, c.y, { n: 12 + t, colors: [col, 'k5', 'g2'], speed: 330, size: 6, ring: true, clip: true, gravity: 0, life: 0.6 });
  fx.burst(c.x, c.y, { n: 16, colors: [col, 'k5'], speed: 430, size: 8, ring: true, kind: 'star', clip: true, gravity: 0, life: 0.5 });
  fx.shake(app, 2 + t * 2, 280);
  vibrate(t >= 4 ? [30, 20, 50, 20, 90] : [24, 16, 44]);
  if (t >= 4) fx.confetti(c.x, c.y + 20, 36, { clip: true, colors: [...RAINBOW, 'k5'] });
  if (t >= 5) {
    fx.rain(36, RAINBOW, { clip: true });
    window.setTimeout(() => fx.edge(host, 'pk', [1, 0, 1, 0, 1, 1]), 400);
  }
}

/** 프레임마다: 남은 시간 막대(도트 단위)와 높은 단계의 달아오른 테두리 */
export function tick(now: number, c: ComboState, windowMs: number): void {
  if (!root.classList.contains('on') || root.classList.contains('end')) return;
  const ratio = Math.max(0, Math.min(1, 1 - (now - c.lastMs) / windowMs));
  const w = Math.ceil(ratio * BAR_DOTS) * 2;
  if (w !== barW) {
    barW = w;
    fillEl.style.width = `${w}px`;
  }
  const low = ratio < 0.3;
  if (low !== barLow) {
    barLow = low;
    barEl.classList.toggle('low', low);
  }
  const t = comboTier(c.n);
  if (t >= 3) {
    const ph = Math.floor(now / STEP_MS);
    if (ph !== heatPhase) {
      heatPhase = ph;
      heatEl.hidden = false;
      if (t === 3) {
        heatEl.style.borderColor = `var(--pk)`;
        heatEl.style.visibility = ph % 2 ? 'visible' : 'hidden';
      } else if (t === 4) {
        heatEl.style.borderColor = ph % 2 ? 'var(--pu)' : 'var(--pk)';
        heatEl.style.visibility = 'visible';
      } else {
        heatEl.style.borderColor = `var(--${RAINBOW[ph % RAINBOW.length]})`;
        heatEl.style.visibility = 'visible';
      }
    }
  } else if (!heatEl.hidden) {
    heatEl.hidden = true;
  }
}

export interface SettleView {
  n: number;
  bonus: number;
  /** 25 이상이면서 이 콤보 전의 최고 기록을 넘음 */
  best: boolean;
  pointsEl: Element;
  onArrive: () => void;
}

/** 10 이상 콤보가 끝났을 때. 10 미만은 조용히 `hide`만 부른다 */
export function settle(v: SettleView): void {
  const t = comboTier(v.n);
  const col = tierColor(t);
  heatEl.hidden = true;
  heatPhase = -1;
  window.clearTimeout(hideTimer);
  root.dataset.tier = String(t);
  root.classList.add('on', 'end');
  numEl.textContent = String(v.n);
  labelEl.textContent = '콤보!';
  const c = center(root);
  if (!fx.isReduced()) {
    fx.pxFrames(numEl, [{ translate: '0 -10px' }, { translate: '0 6px' }, { translate: '0 0' }, { translate: '0 2px' }, { translate: '0 0' }], STEP_MS);
    fx.shake(app, 4, 250);
  }
  fx.burst(c.x, c.y, { n: 10, colors: [col, 'g2', 'k5'], speed: 280, size: 6, kind: 'star', clip: true });
  fx.banner(`정산 +${formatNumber(v.bonus)} P`, { sub: v.best ? '최고 기록!' : `${v.n} 콤보`, tone: 'gold', ms: 1500, color: 'g2', subGold: v.best });
  sfx.comboEnd(t);
  vibrate([20, 20, 40]);
  fx.coinShower(c, v.pointsEl, 12, v.onArrive);
  hideTimer = window.setTimeout(() => root.classList.remove('on', 'end'), 900);
}
