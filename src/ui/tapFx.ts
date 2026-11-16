// 탭 한 번의 연출: 일반 숫자(합치기·퍼뜨리기·개수 상한), 치명타, 피버 색. 로직은 모르고 결과만 받는다.
import { formatNumber } from '../logic/format';
import * as fx from './fx';
import { sfx } from './sound';
import { vibrate } from './prefs';
import { COMBO_TIERS, comboTier } from '../logic/combo';

const MERGE_MS = 180;
const MAX_LIVE = 6;
const FEVER_COLORS = ['#ffc83d', '#ff8a1f', '#ffeaa0', '#ffffff'];
const TIER_COLOR = ['#5b9bff', '#ffc83d', '#ff8a1f', '#ff6fb0', '#8d5cf6', '#ffffff'];
/** 탭 음 계단: 단계마다 3칸, 단계 안에서 0~2칸. 상한은 sfx가 둔다 */
export function comboStep(n: number): number {
  const t = comboTier(n);
  const from = t === 0 ? 0 : COMBO_TIERS[t - 1].at;
  const to = t >= COMBO_TIERS.length ? from + 100 : COMBO_TIERS[t].at;
  return t * 3 + Math.min(2, Math.floor(((n - from) / (to - from)) * 3));
}
const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

export interface TapFxInput {
  x: number;
  y: number;
  gain: number;
  crit: boolean;
  /** 초당 6회 초과 탭: 기본값 몫만 받아서 작고 흐리게 보여 준다 */
  damped: boolean;
  fever: boolean;
  /** 상자 화면: 손가락 위치 입자는 생략(상자 먼지가 대신한다) */
  lite?: boolean;
  /** 상자 화면: 상자 중심 좌표. 숫자·치명타 글자가 터짐 숫자 자리를 피해 흩어진다 */
  anchor?: { x: number; y: number; half: number; minTop: number; k: number; gainBottom?: number };
  combo: number;
  pointsEl: Element;
  phone: HTMLElement;
  app: HTMLElement;
}

const pending = { sum: 0, n: 0, x: 0, y: 0, fever: false, pointsEl: null as Element | null, anchor: undefined as TapFxInput['anchor'] };
let lastShow = 0;
let flushTimer = 0;
let live = 0;
let side = 1;
let tapCount = 0;
let lastCritFlash = 0;

function clampX(x: number, pad: number): number {
  return Math.max(pad, Math.min(window.innerWidth - pad, x));
}

function showPending(tier: number): void {
  flushTimer = 0;
  if (!pending.n || live >= MAX_LIVE) return;
  const n = pending.n;
  const big = Math.min(n - 1, 8);
  side = -side;
  const a = pending.anchor;
  const x = clampX(a ? pending.x + rnd(28, 64) : pending.x + side * rnd(25, 115), 48);
  const y = a ? Math.max(pending.y - rnd(16, 32), a.y - a.half * 0.6) : pending.y + rnd(-15, 25);
  const scale = (1 + big * 0.11 + tier * 0.16) * (pending.fever ? 1.3 : 1) * (a?.k ?? 1);
  fx.floatText(x, y, `+${formatNumber(pending.sum)}`, { scale, spread: 25, ms: 800, cls: [pending.fever ? 'fever' : '', tier > 0 ? `t${tier}` : ''].filter(Boolean).join(' ') || undefined });
  live++;
  window.setTimeout(() => {
    live--;
  }, 800);
  lastShow = performance.now();
  pending.sum = 0;
  pending.n = 0;
}

function queueNumber(x: number, y: number, gain: number, fever: boolean, tier: number, anchor?: TapFxInput['anchor']): void {
  pending.anchor = anchor;
  pending.sum += gain;
  pending.n++;
  pending.x = x;
  pending.y = y;
  pending.fever = pending.fever || fever;
  const wait = lastShow + MERGE_MS - performance.now();
  if (wait <= 0 && live < MAX_LIVE) {
    pending.fever = fever;
    showPending(tier);
    pending.fever = false;
  } else if (!flushTimer) {
    flushTimer = window.setTimeout(() => {
      showPending(tier);
      pending.fever = false;
    }, Math.max(40, wait));
  }
}

const SINGLE_MS = 300;
const one = { el: null as HTMLElement | null, sum: 0, n: 0, last: 0, damped: false };

/** A5: 탭 숫자는 동시에 1개. 300ms 안의 연타는 같은 글자에 값을 더하고 1프레임 튄다. 자리는 상자 오른쪽 위 고정 */
function singleNumber(i: TapFxInput, tier: number): void {
  const a = i.anchor!;
  const now = performance.now();
  if (one.el?.isConnected && now - one.last < SINGLE_MS && one.damped === i.damped) {
    one.sum += i.gain;
    one.n++;
    one.el.textContent = `+${formatNumber(one.sum)}`;
    if (!fx.isReduced()) fx.pxFrames(one.el, [{ scale: '1.25' }, { scale: '1' }], 40);
    one.last = now;
    return;
  }
  one.el?.remove();
  const big = Math.min(i.damped ? 0 : tier, 5);
  const scale = (i.damped ? 0.7 : (1 + big * 0.16) * (i.fever ? 1.3 : 1)) * a.k;
  const cls = [i.damped ? 'damped' : '', !i.damped && i.fever ? 'fever' : '', !i.damped && tier > 0 ? `t${tier}` : ''].filter(Boolean).join(' ') || undefined;
  const x = clampX(a.x + a.half * 0.85 + 12, 48);
  const below = a.gainBottom ? a.gainBottom + 24 * a.k : 0;
  const y = Math.max(a.y - a.half * 0.85, a.minTop + 36, below);
  one.el = fx.floatText(x, y, `+${formatNumber(i.gain)}`, { scale, spread: 0, ms: 800, cls, minY: Math.max(a.minTop + 28, below - 8 * a.k) });
  one.sum = i.gain;
  one.n = 1;
  one.last = now;
  one.damped = i.damped;
}

/** 터짐 탭: 이 탭의 숫자는 생략한다(터짐 숫자가 대신한다) */
export function dropTapNumber(): void {
  one.el?.remove();
  one.el = null;
}

function critEffect(i: TapFxInput): void {
  const a = i.anchor;
  if (a) {
    const x = clampX(a.x, 128 * a.k);
    const text = (): void => {
      fx.floatText(x, Math.max(a.y - a.half * 1.1 - 12 * a.k, a.minTop + 36), `쾅! 치명타 +${formatNumber(i.gain)}`, { scale: 1.2, k: a.k, spread: 6, ms: 830, minY: a.minTop + 28, cls: i.fever ? 'crit fever' : 'crit' });
    };
    // 배너(단계 오름 등)가 떠 있으면 글자만 배너가 사라진 뒤로 미룬다. 번쩍·흔들림·소리는 그대로
    if (fx.bannerActive()) {
      const t0 = performance.now();
      const wait = window.setInterval(() => {
        if (fx.bannerActive() && performance.now() - t0 < 2500) return;
        window.clearInterval(wait);
        text();
      }, 100);
    } else text();
    fx.shake(i.app, 4, 250);
    sfx.crit();
    vibrate([35, 25, 60]);
    return;
  }
  const x = clampX(i.x, 110);
  fx.floatText(x, i.y - 40, `치명타! +${formatNumber(i.gain)}`, { scale: 1.8, spread: 18, ms: 1150, cls: i.fever ? 'crit fever' : 'crit' });
  fx.burst(i.x, i.y, { n: 6, kind: 'star', colors: ['#ffc83d', '#ffeaa0', '#ffffff'], speed: 320, size: 8 });
  fx.burst(i.x, i.y, { n: 10, colors: ['#ffc83d', '#ffeaa0', '#ff8a1f'], speed: 300, size: 6 });
  fx.shake(i.app, 4, 400);
  const now = performance.now();
  if (now - lastCritFlash > 400) {
    lastCritFlash = now;
    fx.flash('#ffc83d', 260);
    fx.popIcon('crit', x, i.y - 120, { size: 64, ms: 900, rise: 30 });
    if (!fx.isReduced()) {
      i.phone.classList.remove('crit-flash');
      void i.phone.offsetWidth;
      i.phone.classList.add('crit-flash');
    }
  }
  sfx.crit();
  vibrate([35, 25, 60]);
}

export function tapEffect(i: TapFxInput): void {
  tapCount++;
  const tier = comboTier(i.combo);
  if (i.crit) {
    critEffect(i);
  } else if (i.anchor) {
    singleNumber(i, tier);
    if (!i.damped) vibrate(tier >= 2 ? 14 : 7);
  } else if (i.damped) {
    if (live < MAX_LIVE) {
      live++;
      window.setTimeout(() => {
        live--;
      }, 500);
      fx.floatText(clampX(i.x + rnd(-40, 40), 40), i.y + rnd(-10, 15), `+${formatNumber(i.gain)}`, { scale: 0.7, spread: 20, ms: 500, cls: 'damped' });
    }
    if (!i.lite) fx.burst(i.x, i.y, { n: 3, colors: ['#ffffff'], speed: 160, size: 4 });
  } else {
    queueNumber(i.x, i.y, i.gain, i.fever, tier, i.anchor);
    const colors = i.fever ? FEVER_COLORS : ['#ffc83d', '#ffeaa0', TIER_COLOR[Math.min(tier, 5)], '#ffffff'];
    if (!i.lite) fx.burst(i.x, i.y, {
      n: Math.round((4 + tier * 2.4) * (i.fever ? 1.5 : 1)),
      colors,
      kind: Math.random() < 0.25 || i.fever ? 'star' : 'dot',
      speed: 240 + tier * 45 + (i.fever ? 60 : 0),
      size: i.fever ? 8 : 6,
    });
    vibrate(tier >= 2 ? 14 : 7);
  }
  sfx.tap(comboStep(i.combo));
  if (tapCount % 3 === 0 || performance.now() - lastShow > 400) {
    const r = i.pointsEl.getBoundingClientRect();
    fx.absorb({ x: i.x, y: i.y }, i.pointsEl, i.crit ? 4 : 1 + (tier >= 2 ? 1 : 0), { offset: { x: 0, y: r.height / 2 + 12 } });
  }
  if (!i.crit && tier >= 2) fx.shake(i.app, Math.min(tier, 4) * 2, 160);
}
