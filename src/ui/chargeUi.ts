// 꾹 눌러 강타: 모으기 입력 상태기계(누름 -> 220ms 넘으면 모으기 -> 뗌 = 판정), 방 안 도트 게이지, 판정 글자, 안내 말풍선. 점수·콤보는 모르고 app.ts가 onRelease에서 처리한다.
import { CHARGE_HOLD_MS, CHARGE_ZONE_DEFAULT, chargeGrade, chargePos, chargeSpeed, type ChargeGrade, type ChargeZone } from '../logic/charge';
import type { HeatState } from '../logic/heat';
import { formatNumber } from '../logic/format';
import { el } from './dom';
import * as fx from './fx';
import * as heatUi from './heatUi';
import { vibrate } from './prefs';
import { sfx } from './sound';
import { boxAnchor, boxCenter, chargeCrouch, chargeFreeze } from './unpackUi';

const BAR_W = 200;
const STEP_MS = 83;
const HITSTOP_MS = 110;
/** 막대 위 구간 좌표는 2px(1도트) 격자 */
const dotX = (v: number): number => Math.round(v / 2) * 2;

interface Hold {
  kind: 'pointer' | 'key';
  id: number;
  x: number;
  y: number;
  timer: number;
  charging: boolean;
  t0: number;
  step: number;
  lastPerfect: boolean;
  /** 촬영용: 표시를 이 위치에 고정 */
  frozen: number | null;
}

export interface ChargeOpts {
  room: HTMLElement;
  canStart: () => boolean;
  streak: () => number;
  onRelease: (pos: number, x: number, y: number) => void;
}

let opts: ChargeOpts;
let root: HTMLElement;
let markEl: HTMLElement;
let perfEl: HTMLElement;
let goodEl: HTMLElement;
let streakEl: HTMLElement;
let sayEl: HTMLElement | null = null;
let tipEl: HTMLElement;
let tipAnim: Animation | undefined;
let tipTimer = 0;
let tipKind: 'charge' | 'heat' = 'charge';
let hold: Hold | null = null;
let stopping = false;
let markX = -1;
let curZone: ChargeZone = CHARGE_ZONE_DEFAULT;

function place(e: HTMLElement, [a, b]: readonly [number, number]): void {
  const left = dotX(a * BAR_W);
  e.style.left = `${left}px`;
  e.style.width = `${dotX(b * BAR_W) - left}px`;
}

/** 이번 스윙의 정타 구간을 막대에 그리고 판정에도 쓴다 */
export function setZone(z: ChargeZone): void {
  curZone = z;
  place(goodEl, z.good);
  place(perfEl, z.perfect);
}

export function initCharge(o: ChargeOpts): void {
  opts = o;
  root = el('div', { cls: 'charge', attrs: { hidden: '', 'aria-hidden': 'true' } });
  perfEl = el('i', { cls: 'charge-perfect' });
  goodEl = el('i', { cls: 'charge-good' });
  setZone(curZone);
  markEl = el('i', { cls: 'charge-mark' });
  streakEl = el('span', { cls: 'charge-streak', attrs: { hidden: '' } });
  root.append(streakEl, el('div', { cls: 'charge-bar' }, goodEl, perfEl, markEl));
  heatUi.mount(root);
  tipEl = el('div', { cls: 'first-tip charge-tip', attrs: { hidden: '', 'aria-hidden': 'true' } }, el('span', { text: '꾹 눌렀다 떼면 강타!' }), el('i', { cls: 'first-tip-tail' }));
  o.room.append(root, tipEl);
  window.addEventListener('pointerup', (e) => end('pointer', e.pointerId));
  window.addEventListener('pointercancel', () => cancel());
  window.addEventListener('blur', cancel);
  window.addEventListener('contextmenu', (e) => {
    if (hold) e.preventDefault();
  });
}

/** 누른 순간(일반 탭은 이미 나갔다). 220ms 넘게 누르고 있으면 모으기가 시작된다 */
export function press(kind: Hold['kind'], id: number, x: number, y: number): void {
  if (hold || stopping) return;
  const h: Hold = { kind, id, x, y, timer: 0, charging: false, t0: 0, step: -1, lastPerfect: false, frozen: null };
  h.timer = window.setTimeout(() => begin(h), CHARGE_HOLD_MS);
  hold = h;
}

/** 키에서 뗌 */
export function releaseKey(): void {
  end('key', 0);
}

function begin(h: Hold): void {
  if (hold !== h) return;
  if (!opts.canStart()) {
    cancel();
    return;
  }
  h.charging = true;
  h.t0 = performance.now();
  hideTip();
  streakEl.hidden = opts.streak() < 2;
  streakEl.textContent = `연속 ${opts.streak()}`;
  markX = -1;
  vibrate(8);
  sfx.chargeTick(0, false);
}

/** 프레임마다 열기 줄을 그리고, 위젯을 보일지 정한다: 열기가 있거나 누르는 중이면 계속, 판정 글자·배너가 뜨면 숨김 */
export function sync(heat: HeatState): void {
  heatUi.render(heat);
  const charging = isCharging();
  const mark = charging || stopping;
  markEl.hidden = !mark;
  streakEl.hidden = !charging || opts.streak() < 2;
  root.classList.toggle('lower', !!opts.room.querySelector('.first-tip:not([hidden])'));
  root.hidden = !(heat.v > 0 || mark) || fx.bannerActive() || !!document.querySelector('.charge-say, .weak-say');
}

export const isCharging = (): boolean => hold?.charging === true;

/** 촬영·시험용: 모으기를 바로 시작하고 표시를 pos에 고정한다 */
export function holdAt(pos: number): void {
  cancel();
  press('key', 0, 0, 0);
  if (!hold) return;
  window.clearTimeout(hold.timer);
  begin(hold);
  if (hold) hold.frozen = pos;
  frame(performance.now());
}

export function releaseHeld(): void {
  end('key', 0);
}

function currentPos(h: Hold, now: number): number {
  return h.frozen ?? chargePos(now - h.t0, chargeSpeed(opts.streak()));
}

/** 프레임마다(app.ts의 rAF): 표시 위치와 83ms 단위 연출을 갱신한다 */
export function frame(now: number): void {
  const h = hold;
  if (!h || !h.charging || stopping) return;
  const pos = currentPos(h, now);
  const inPerfect = chargeGrade(pos, curZone) === 'perfect';
  const x = dotX(pos * BAR_W);
  if (x !== markX) {
    markX = x;
    markEl.style.translate = `${x - 2}px 0`;
  }
  markEl.classList.toggle('in', inPerfect);
  const step = Math.floor((now - h.t0) / STEP_MS);
  if (step === h.step) return;
  h.step = step;
  if (inPerfect && !fx.isReduced()) perfEl.classList.toggle('hot', step % 2 === 0);
  else perfEl.classList.remove('hot');
  if (inPerfect && !h.lastPerfect) vibrate(6);
  h.lastPerfect = inPerfect;
  chargeCrouch(step);
  if (step % 2 === 0) sfx.chargeTick(pos, inPerfect);
  const c = boxCenter();
  const k = boxAnchor().k;
  fx.suck(c.x, c.y - 30 * k, (60 + Math.min(step, 12) * 2) * k, { n: 2 + Math.min(2, Math.floor(step / 6)), colors: inPerfect ? ['g2', 'k5'] : ['b3', 'b4', 'k5'], size: 4 * k, life: 0.3 });
}

function end(kind: Hold['kind'], id: number): void {
  const h = hold;
  if (!h || h.kind !== kind || h.id !== id) return;
  window.clearTimeout(h.timer);
  if (!h.charging) {
    hold = null;
    return;
  }
  const pos = currentPos(h, performance.now());
  hold = null;
  const go = (): void => {
    stopping = false;
    hideGauge();
    opts.onRelease(pos, h.x, h.y);
  };
  if (chargeGrade(pos, curZone) === 'perfect' && !fx.isReduced()) {
    stopping = true;
    markEl.classList.add('in');
    perfEl.classList.add('hot');
    chargeFreeze();
    window.setTimeout(go, HITSTOP_MS);
  } else go();
}

function hideGauge(): void {
  perfEl.classList.remove('hot');
  chargeCrouch(null);
}

/** 조용히 취소(포인터 취소·창 숨김·이사 시작) */
export function cancel(): void {
  if (!hold) return;
  window.clearTimeout(hold.timer);
  const was = hold.charging;
  hold = null;
  if (was) hideGauge();
}

const SAY: Record<ChargeGrade, { text: string; ms: number }> = {
  perfect: { text: '퍼펙트!', ms: 1100 },
  good: { text: '굿!', ms: 800 },
  miss: { text: '아쉽!', ms: 600 },
};

/** 판정 글자(방 안 위쪽) + 수익 숫자 */
export function say(grade: ChargeGrade, streak: number, gain: number, power = 1): void {
  sayEl?.remove();
  const text = grade === 'perfect' && streak >= 2 ? `퍼펙트 x${streak}!` : SAY[grade].text;
  const e = el('div', { cls: `charge-say ${grade}` }, el('b', { text }), el('i', { text: `+${formatNumber(gain)} P` }, ...(power > 1 ? [el('em', { text: ` 파워 x${power.toFixed(1)}` })] : [])));
  opts.room.append(e);
  sayEl = e;
  const rm = (): void => {
    e.remove();
    if (sayEl === e) sayEl = null;
  };
  if (fx.isReduced()) {
    window.setTimeout(rm, SAY[grade].ms * 0.7);
    return;
  }
  const pop = grade === 'perfect' ? [1.5, 1.3, 1.15, 1.05] : grade === 'good' ? [1.25, 1.1] : [1.1];
  const keep = Math.max(1, Math.round(SAY[grade].ms / STEP_MS) - pop.length - 4);
  const f: Keyframe[] = [...pop.map((s) => ({ scale: String(s), visibility: 'visible' })), ...Array.from({ length: keep }, () => ({ scale: '1', visibility: 'visible' }))];
  for (let i = 0; i < 4; i++) f.push({ scale: '1', visibility: i % 2 ? 'visible' : 'hidden' });
  fx.pxFrames(e, f, STEP_MS).onfinish = rm;
}

/** 과열 글자: 판정 글자와 같은 자리·방식(뜨는 동안 게이지·말풍선이 숨는다) */
export function sayOver(): void {
  sayEl?.remove();
  const e = el('div', { cls: 'charge-say over' }, el('b', { text: '과열!' }));
  opts.room.append(e);
  sayEl = e;
  const rm = (): void => {
    e.remove();
    if (sayEl === e) sayEl = null;
  };
  if (fx.isReduced()) {
    window.setTimeout(rm, 560);
    return;
  }
  const f: Keyframe[] = [1.5, 1.3, 1.15, 1.05].map((s) => ({ scale: String(s), visibility: 'visible' }));
  for (let i = 0; i < 2; i++) f.push({ scale: '1', visibility: 'visible' });
  for (let i = 0; i < 4; i++) f.push({ scale: '1', visibility: i % 2 ? 'visible' : 'hidden' });
  fx.pxFrames(e, f, STEP_MS * 1.2).onfinish = rm;
}

/** 강타 판정의 방 밖 연출(소리·진동·번쩍·흔들림). 상자 타격은 unpackHeavy가 맡는다 */
export function strikeFx(grade: ChargeGrade, streak: number, app: HTMLElement, room: HTMLElement, power = 1): void {
  sfx.strike(grade, streak);
  if (grade === 'perfect') {
    const big = Math.min(streak, 5);
    fx.flash(streak >= 3 ? 'k5' : 'g2', 300 + big * 40);
    fx.shake(app, 8, 420);
    fx.edge(room, 'g2', [1, 0, 1, 0, 1, 1]);
    vibrate([40, 30, 90, 30, 140 + big * 20]);
  } else if (grade === 'good') {
    fx.flash('b3', 200);
    fx.shake(app, 4, 250);
    vibrate([30, 20, 50]);
  } else vibrate(12);
  if (grade !== 'miss' && power >= 2) heatStrikeFx(grade, power, app, room);
}

/** 열기가 찬 강타: 기존 연출 위에 주황·노랑 입자와 고리. 2.4 이상(달아오름에서 친 것)이면 더 많이, 더 크게 흔든다 */
function heatStrikeFx(grade: ChargeGrade, power: number, app: HTMLElement, room: HTMLElement): void {
  const a = boxAnchor();
  const big = power >= 2.4;
  fx.edge(room, 'or', [1, 0, 1, 0, 1]);
  fx.burst(a.x, a.y, { n: big ? 16 : 12, ring: true, colors: ['or', 'g2'], speed: 340 * a.k, gravity: 0, size: 6 * a.k, life: 0.5, clip: true });
  fx.burst(a.x, a.y, { n: big ? 16 : 8, colors: ['or', 'g2', 'g3'], speed: 420 * a.k, size: 4 * a.k, clip: true });
  if (!big) return;
  fx.burst(a.x, a.y, { n: 12, ring: true, colors: ['g2', 'k5'], speed: 560 * a.k, gravity: 0, size: 6 * a.k, life: 0.55, clip: true });
  fx.shake(app, 8, 420);
  if (grade === 'perfect') window.setTimeout(() => fx.shake(app, 4, 250), 480);
}

export function showTip(kind: 'charge' | 'heat' = 'charge'): void {
  const a = boxAnchor();
  tipKind = kind;
  tipEl.firstElementChild!.textContent = kind === 'heat' ? '파워가 찼을 때 강타를 치면 더 세요!' : '꾹 눌렀다 떼면 강타!';
  const r = opts.room.getBoundingClientRect();
  tipEl.hidden = false;
  tipEl.style.left = `${Math.round((r.width / a.k - tipEl.offsetWidth) / 2)}px`;
  tipEl.style.top = '58px';
  tipAnim?.cancel();
  tipAnim = fx.pxFrames(tipEl, [{ translate: '0 0' }, { translate: '0 -2px' }], 400, { iterations: Infinity });
  window.clearTimeout(tipTimer);
  tipTimer = window.setTimeout(hideTip, 7000);
}

export function hideTip(): void {
  if (tipEl.hidden) return;
  tipEl.hidden = true;
  tipAnim?.cancel();
  tipAnim = undefined;
  window.clearTimeout(tipTimer);
}

export const tipShown = (): boolean => !tipEl.hidden;
export const shownTipKind = (): 'charge' | 'heat' => tipKind;
