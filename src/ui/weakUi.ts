// 급소 노리기: 상자 위에 잠깐 뜨는 도트 과녁, 맞힌 연출, 안내 말풍선. 판정·수익은 app.ts가 처리한다.
import { formatNumber } from '../logic/format';
import { el } from './dom';
import * as fx from './fx';
import { vibrate } from './prefs';
import { sfx } from './sound';
import { boxAnchor, setChainJudge } from './unpackUi';

const STEP_MS = 83;
/** 누르는 영역(방 안 px). 그림은 32px(16도트) */
const HIT = 44;
const SAY_MS = 1000;

let room: HTMLElement;
let onHit: (x: number, y: number) => void;
let root: HTMLButtonElement;
let dotEl: HTMLElement;
let canvas: HTMLCanvasElement;
let tipEl: HTMLElement;
let tipAnim: Animation | undefined;
let tipTimer = 0;
let anim: Animation | undefined;
let shown = false;
let fast = false;
let appearing = false;
let u = 0.5;
let v = 0.5;

const cssVar = (n: string): string => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/** 16x16 도트 과녁: 남색 외곽 / 흰 고리 / 남색 선 / 주황 안쪽 / 흰 점 */
function paint(): void {
  const c = canvas.getContext('2d');
  if (!c) return;
  const col = { k0: cssVar('--k0'), k5: cssVar('--k5'), or: cssVar('--or') };
  c.clearRect(0, 0, 16, 16);
  for (let j = 0; j < 16; j++) {
    for (let i = 0; i < 16; i++) {
      const d = Math.hypot(i - 7.5, j - 7.5);
      const f = d <= 1 ? col.k5 : d <= 3.6 ? col.or : d <= 4.6 ? col.k0 : d <= 6.3 ? col.k5 : d <= 7.6 ? col.k0 : '';
      if (!f) continue;
      c.fillStyle = f;
      c.fillRect(i, j, 1, 1);
    }
  }
}

export function initWeak(o: { room: HTMLElement; onHit: (x: number, y: number) => void }): void {
  room = o.room;
  onHit = o.onHit;
  canvas = el('canvas', { cls: 'weak-art', attrs: { width: '16', height: '16' } });
  dotEl = el('i', { cls: 'weak-dot' }, canvas);
  root = el('button', { cls: 'weak', attrs: { type: 'button', hidden: '', 'aria-label': '급소' } }, dotEl) as HTMLButtonElement;
  root.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!shown) return;
    const r = root.getBoundingClientRect();
    onHit(r.left + r.width / 2, r.top + r.height / 2);
  });
  root.addEventListener('contextmenu', (e) => e.preventDefault());
  tipEl = el('div', { cls: 'first-tip weak-tip', attrs: { hidden: '', 'aria-hidden': 'true' } }, el('span', { text: '반짝이는 급소를 누르면 큰 타격!' }), el('i', { cls: 'first-tip-tail' }));
  room.append(root, tipEl);
}

/** 칠 상자가 있어 급소를 띄울 수 있다 */
export const hasBox = (): boolean => boxAnchor().half > 0;
export const isShown = (): boolean => shown;
export const tipShown = (): boolean => !tipEl.hidden;

/** 상자 그림 사각형 안 (u, v)의 방 안 좌표(확대 전 px). 방 밖으로 나가지 않게 가둔다 */
function place(): void {
  const a = boxAnchor();
  if (a.half <= 0) {
    root.hidden = true;
    return;
  }
  root.hidden = false;
  const r = room.getBoundingClientRect();
  const k = a.k;
  const w = r.width / k;
  const h = r.height / k;
  const m = HIT / 2;
  const cx = Math.min(w - m, Math.max(m, (a.x + (u - 0.5) * 2 * a.half - r.left) / k));
  const cy = Math.min(h - m, Math.max(m, (a.y + (v - 0.5) * 2 * a.half - r.top) / k));
  root.style.left = `${Math.round(cx - m)}px`;
  root.style.top = `${Math.round(cy - m)}px`;
}

function blink(): void {
  anim?.cancel();
  if (fx.isReduced()) return;
  const on = { visibility: 'visible' };
  const off = { visibility: 'hidden' };
  anim = fast ? fx.pxFrames(dotEl, [on, on, off], 40, { iterations: Infinity }) : fx.pxFrames(dotEl, [on, on, on, off], 100, { iterations: Infinity });
}

export function show(nu: number, nv: number): void {
  u = nu;
  v = nv;
  paint();
  shown = true;
  fast = false;
  appearing = false;
  place();
  sfx.weakAppear();
  anim?.cancel();
  if (fx.isReduced()) return;
  appearing = true;
  anim = fx.pxFrames(dotEl, [{ scale: '1.7' }, { scale: '1.35' }, { scale: '1' }], 50);
  anim.onfinish = () => {
    appearing = false;
    if (shown) blink();
  };
}

/** 프레임마다: 상자를 따라 자리를 갱신하고, 남은 시간이 500ms 아래면 더 빨리 깜빡인다 */
export function frame(remainMs: number): void {
  if (!shown) return;
  place();
  if (!fast && remainMs < 500 && remainMs > 0) {
    fast = true;
    if (!appearing) blink();
  }
}

function kill(): void {
  shown = false;
  anim?.cancel();
  anim = undefined;
  root.hidden = true;
}

/** 놓침: 두 프레임 줄어들며 조용히 사라진다 */
export function vanish(): void {
  if (!shown) return;
  shown = false;
  anim?.cancel();
  if (fx.isReduced()) {
    kill();
    return;
  }
  anim = fx.pxFrames(dotEl, [{ scale: '0.75', visibility: 'visible' }, { scale: '0.5', visibility: 'visible' }], 50);
  anim.onfinish = kill;
}

/** 조용히 없앤다(불러오기·초기화·이사·화면 숨김) */
export function clear(): void {
  kill();
  hideTip();
}

export function showTip(): void {
  const r = room.getBoundingClientRect();
  const k = boxAnchor().k;
  const w = r.width / k;
  tipEl.hidden = false;
  const left = Math.round((w - tipEl.offsetWidth) / 2);
  const tx = parseFloat(root.style.left || '0');
  const ty = parseFloat(root.style.top || '0');
  const tw = tipEl.offsetWidth;
  const th = tipEl.offsetHeight;
  const clear = (top: number): boolean => left + tw + 8 < tx || left - 8 > tx + HIT || top + th + 12 < ty || top - 8 > ty + HIT;
  const top = [58, 148, 204, 260].find(clear) ?? 58;
  tipEl.style.left = `${left}px`;
  tipEl.style.top = `${top}px`;
  tipAnim?.cancel();
  tipAnim = fx.pxFrames(tipEl, [{ translate: '0 0' }, { translate: '0 -2px' }], 400, { iterations: Infinity });
  window.clearTimeout(tipTimer);
  tipTimer = window.setTimeout(hideTip, 3600);
}

export function hideTip(): void {
  if (tipEl.hidden) return;
  tipEl.hidden = true;
  tipAnim?.cancel();
  tipAnim = undefined;
  window.clearTimeout(tipTimer);
}

/** 맞힘: 과녁이 터지고 `급소!` 글자 + 수익, 번쩍·흔들림·소리·진동 */
export function hitFx(x: number, y: number, gain: number, app: HTMLElement, chain = 0): void {
  kill();
  hideTip();
  const k = boxAnchor().k;
  sfx.weakHit();
  vibrate([30, 20, 60, 20, 110]);
  fx.flash('pk', 260);
  fx.shake(app, 8, 380);
  fx.edge(room, 'pk', [1, 0, 1, 0, 1]);
  fx.burst(x, y, { n: 14, ring: true, colors: ['pk', 'k5', 'or'], speed: 320 * k, gravity: 0, size: 6 * k, life: 0.5 });
  fx.burst(x, y, { n: 10, ring: true, kind: 'star', colors: ['pk', 'k5'], speed: 520 * k, gravity: 0, size: 8 * k, life: 0.55 });
  if (chain >= 2) {
    setChainJudge('급소!', 'weakhit', '');
    return;
  }
  fx.headline('now', (end) => {
    const e = el('div', { cls: 'weak-say' }, el('b', { text: '급소!' }), el('i', { text: `+${formatNumber(gain)} P` }));
    e.style.top = `${fx.headTop(room, k)}px`;
    room.append(e);
    const rm = (): void => {
      e.remove();
      end();
    };
    if (fx.isReduced()) {
      window.setTimeout(rm, SAY_MS * 0.7);
      return () => e.remove();
    }
    const keep = Math.max(1, Math.round(SAY_MS / STEP_MS) - 4 - 4);
    const f: Keyframe[] = [1.6, 1.35, 1.15, 1.05].map((s) => ({ scale: String(s), visibility: 'visible' }));
    for (let i = 0; i < keep; i++) f.push({ scale: '1', visibility: 'visible' });
    for (let i = 0; i < 4; i++) f.push({ scale: '1', visibility: i % 2 ? 'visible' : 'hidden' });
    fx.pxFrames(e, f, STEP_MS).onfinish = rm;
    return () => e.remove();
  });
}
