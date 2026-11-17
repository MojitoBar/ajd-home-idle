// 꾹 눌러 강타: 모으기 입력 상태기계(누름 -> 220ms 넘으면 모으기 -> 뗌 = 판정), 방 안 도트 게이지, 판정 글자, 안내 말풍선. 점수·콤보는 모르고 app.ts가 onRelease에서 처리한다.
import { CHARGE_HOLD_MS, CHARGE_ZONE_DEFAULT, chargeGrade, chargePos, chargeSpeed, streakMult, type ChargeGrade, type ChargeZone } from '../logic/charge';
import type { HeatState } from '../logic/heat';
import { formatNumber } from '../logic/format';
import { el } from './dom';
import { pxImg } from './px/art';
import * as fx from './fx';
import * as heatUi from './heatUi';
import { vibrate } from './prefs';
import { sfx } from './sound';
import { boxAnchor, boxCenter, chargeCrouch, chargeFreeze, chainVisible, goldHead, setChainJudge } from './unpackUi';

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
let chipEl: HTMLElement;
let chipStreak = 0;
let chipBreaking = false;
let shieldEl: HTMLElement;
let shieldBar: HTMLElement;
let shieldFill: HTMLElement;
let cells: HTMLElement[] = [];
let shieldN = 0;
let shieldMaxSeen = 0;
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
  chipEl = el('span', { cls: 'streak-chip', attrs: { hidden: '', 'aria-hidden': 'true' } });
  root.append(streakEl, el('div', { cls: 'charge-bar' }, goodEl, perfEl, markEl));
  heatUi.mount(root);
  shieldFill = el('i', { cls: 'sh-fill' });
  shieldBar = el('div', { cls: 'sh-bar', attrs: { hidden: '' } }, shieldFill);
  shieldEl = el('div', { cls: 'shield', attrs: { hidden: '', 'aria-hidden': 'true' } });
  tipEl = el('div', { cls: 'first-tip charge-tip', attrs: { hidden: '', 'aria-hidden': 'true' } }, el('span', { text: '꾹 눌렀다 떼면 강타!' }), el('i', { cls: 'first-tip-tail' }));
  o.room.append(root, el('div', { cls: 'guard-row' }, chipEl, shieldEl), tipEl);
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
  syncChip(opts.streak(), charging);
  root.classList.toggle('lower', !!opts.room.querySelector('.first-tip:not([hidden])'));
  root.hidden = !(heat.v > 0 || mark) || fx.headBusy() || chainVisible();
}

/** 배수 글자: 정수면 x3, 아니면 소수 한 자리 x2.5 */
export const multText = (m: number): string => `x${Number.isInteger(m) ? m : m.toFixed(1)}`;

/** 다음 퍼펙트에 적용될 배수 칩: 누르는 중엔 게이지 옆, 아니면 방 왼쪽 위에 계속. 오르면 톡 튀고, 1.5 이상에서 끊기면 깨진다 */
function syncChip(s: number, charging: boolean): void {
  if (s !== chipStreak) {
    const prev = chipStreak;
    chipStreak = s;
    if (s > prev) popChip();
    else if (s === 0 && prev >= 1) breakChip(prev);
  }
  if (chipBreaking) return;
  const text = multText(streakMult(s));
  if (chipEl.textContent !== text) chipEl.textContent = text;
  if (streakEl.textContent !== text) streakEl.textContent = text;
  chipEl.hidden = s < 1 || charging;
  streakEl.hidden = s < 1 || !charging;
}

function popChip(): void {
  if (fx.isReduced()) return;
  for (const e of [chipEl, streakEl]) fx.pxFrames(e, [{ scale: '1.6' }, { scale: '1.3' }, { scale: '1.1' }, { scale: '1' }], 60);
}

/** 칩이 흰색으로 한 프레임 번쩍 -> 남색·주황 정사각형 조각으로 흩어짐 */
function breakChip(prev: number): void {
  chipEl.textContent = multText(streakMult(prev));
  chipEl.hidden = false;
  chipEl.classList.add('flash');
  chipBreaking = true;
  sfx.streakBreak();
  window.setTimeout(() => {
    const r = chipEl.getBoundingClientRect();
    const k = boxAnchor().k;
    fx.burst(r.left + r.width / 2, r.top + r.height / 2, { n: 8, colors: ['k0', 'or'], speed: 200 * k, gravity: 500 * k, size: 6 * k, life: 0.5, clip: true });
    chipEl.classList.remove('flash');
    chipEl.hidden = true;
    chipBreaking = false;
  }, STEP_MS);
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

/** 판정 글자(방 안 위쪽) + 수익 숫자. 2연쇄 이상이면 큰 글자 대신 연쇄 숫자 위의 24px 한 줄로 넘긴다 */
export function say(grade: ChargeGrade, streak: number, gain: number, power = 1, chain = 0, savedMult = 0): void {
  const applied = streakMult(streak - 1);
  const text = savedMult > 0 ? `연속 지킴! ${multText(savedMult)}` : grade === 'perfect' && applied > 1 ? `퍼펙트 ${multText(applied)}!` : SAY[grade].text;
  const kind = savedMult > 0 ? 'save' : grade;
  if (chain >= 2) {
    setChainJudge(text, savedMult > 0 ? 'blast' : grade, power > 1 ? `파워 x${power.toFixed(1)}` : '');
    return;
  }
  fx.headline('now', (end) => {
    const e = el('div', { cls: `charge-say ${kind}${text.length >= 10 ? ' long' : ''}` }, el('b', { text }), el('i', { text: `+${formatNumber(gain)} P` }, ...(power > 1 ? [el('em', { text: ` 파워 x${power.toFixed(1)}` })] : [])));
    e.style.top = `${fx.headTop(opts.room, boxAnchor().k)}px`;
    opts.room.append(e);
    const rm = (): void => {
      e.remove();
      end();
    };
    if (fx.isReduced()) {
      window.setTimeout(rm, (savedMult > 0 ? 1100 : SAY[grade].ms) * 0.7);
      return () => e.remove();
    }
    const pop = grade === 'perfect' || savedMult > 0 ? [1.5, 1.3, 1.15, 1.05] : grade === 'good' ? [1.25, 1.1] : [1.1];
    const keep = Math.max(1, Math.round((savedMult > 0 ? 1100 : SAY[grade].ms) / STEP_MS) - pop.length - 4);
    const f: Keyframe[] = [...pop.map((s) => ({ scale: String(s), visibility: 'visible' })), ...Array.from({ length: keep }, () => ({ scale: '1', visibility: 'visible' }))];
    for (let i = 0; i < 4; i++) f.push({ scale: '1', visibility: i % 2 ? 'visible' : 'hidden' });
    fx.pxFrames(e, f, STEP_MS).onfinish = rm;
    return () => e.remove();
  });
}

/** 과열 글자: 판정 글자와 같은 자리·방식(뜨는 동안 게이지·말풍선이 숨는다) */
export function sayOver(): void {
  fx.headline('now', (end) => {
    const e = el('div', { cls: 'charge-say over' }, el('b', { text: '과열!' }));
    e.style.top = `${fx.headTop(opts.room, boxAnchor().k)}px`;
    opts.room.append(e);
    const rm = (): void => {
      e.remove();
      end();
    };
    if (fx.isReduced()) {
      window.setTimeout(rm, 560);
      return () => e.remove();
    }
    const f: Keyframe[] = [1.5, 1.3, 1.15, 1.05].map((s) => ({ scale: String(s), visibility: 'visible' }));
    for (let i = 0; i < 2; i++) f.push({ scale: '1', visibility: 'visible' });
    for (let i = 0; i < 4; i++) f.push({ scale: '1', visibility: i % 2 ? 'visible' : 'hidden' });
    fx.pxFrames(e, f, STEP_MS * 1.2).onfinish = rm;
    return () => e.remove();
  });
}

/** 고비: 이번 퍼펙트에 적용된 배수가 3, 5, 10, 이후 5 단위 */
export const isStreakMilestone = (applied: number): boolean => applied === 3 || applied === 5 || (applied >= 10 && applied % 5 === 0);

/** 강타 판정의 방 밖 연출(소리·진동·번쩍·흔들림). 상자 타격은 unpackHeavy가 맡는다. streak은 이번 판정 반영 후 연속 수, chain은 터진 상자 수 */
export function strikeFx(grade: ChargeGrade, streak: number, app: HTMLElement, room: HTMLElement, power = 1, chain = 0): void {
  sfx.strike(grade, streak);
  if (grade === 'perfect') {
    const big = Math.min(streak, 12);
    const a = boxAnchor();
    fx.flash(streak >= 3 ? 'k5' : 'g2', 300 + big * 40);
    fx.shake(app, 8, 420);
    for (let i = 1; i <= Math.floor(big / 4); i++) window.setTimeout(() => fx.shake(app, 8, 420), i * 260);
    if (big >= 6) window.setTimeout(() => fx.flash('g2', 300 + big * 40), 380);
    fx.edge(room, 'g2', [1, 0, 1, 0, 1, 1, ...Array.from({ length: big >> 1 }, (_, i) => (i % 2 ? 1 : 0))]);
    fx.burst(a.x, a.y, { n: Math.min(16, 4 + big), colors: ['g2', 'g3', 'k5', 'or'], speed: (260 + big * 30) * a.k, size: 4 * a.k, clip: true });
    if (big >= 6) fx.burst(a.x, a.y, { n: 12, ring: true, colors: ['g2', 'k5'], speed: 400 * a.k, gravity: 0, size: 6 * a.k, life: 0.5, clip: true });
    vibrate([40, 30, 90, 30, 140 + big * 20]);
    const applied = streakMult(streak - 1);
    if (isStreakMilestone(applied)) milestoneFx(applied, room, chain >= 2);
  } else if (grade === 'good') {
    fx.flash('b3', 200);
    fx.shake(app, 4, 250);
    vibrate([30, 20, 50]);
  } else vibrate(12);
  if (grade !== 'miss' && power >= 2) heatStrikeFx(grade, power, app, room);
}

/** 고비 퍼펙트: 방 테두리 노랑 -> 흰색 + 방 전체 노랑·주황 입자 폭발 + 머리글 `배수 x5!`(연쇄가 재생되면 머리글은 뺀다. 판정 글자를 읽을 틈을 두고 띄운다) */
function milestoneFx(applied: number, room: HTMLElement, chain: boolean): void {
  fx.edge(room, 'g2', [1, 0, 1, 0, 1]);
  window.setTimeout(() => fx.edge(room, 'k5', [1, 0, 1, 1]), 140);
  const r = room.getBoundingClientRect();
  const k = boxAnchor().k;
  for (const [u, v] of [[0.2, 0.3], [0.8, 0.3], [0.5, 0.5], [0.2, 0.75], [0.8, 0.75]]) {
    fx.burst(r.left + r.width * u, r.top + r.height * v, { n: 14, colors: ['g2', 'g3', 'or'], speed: 320 * k, gravity: 300 * k, size: 6 * k, life: 0.7, clip: true });
  }
  if (!chain) window.setTimeout(() => goldHead(`배수 ${multText(applied)}!`), 520);
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

// ---------- 안전모(실드) ----------

function makeCell(): HTMLElement {
  return el('span', { cls: 'sh-cell' }, pxImg('tool/hardhat-s', 'sh-full'), pxImg('tool/hardhat-s-empty', 'sh-empty'), pxImg('tool/hardhat-s-flash', 'sh-flash'));
}

function cellCenter(c: HTMLElement): { x: number; y: number } {
  const r = c.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function cellFlash(c: HTMLElement, steps = 2): void {
  c.classList.add('flash');
  window.setTimeout(() => c.classList.remove('flash'), STEP_MS * steps);
}

/** 연속 배수 칩 오른쪽 가로 한 줄의 작은 안전모 칸: 찬 칸은 그림, 빈 칸은 외곽선, 다음 칸까지의 퍼펙트는 줄 아래 얇은 막대(8칸). 안전모 Lv0이면 아무것도 안 보인다. 칸이 같은데 수가 늘면 작게 반짝 */
export function syncShield(max: number, sh: { n: number; toNext: number }): void {
  if (!shieldEl) return;
  if (cells.length !== max) {
    cells = Array.from({ length: max }, makeCell);
    shieldEl.replaceChildren(...cells, shieldBar);
  }
  const gained = max === shieldMaxSeen && sh.n > shieldN;
  cells.forEach((c, i) => {
    const on = i < sh.n;
    c.classList.toggle('on', on);
    if (gained && i === sh.n - 1 && !fx.isReduced()) {
      cellFlash(c);
      const p = cellCenter(c);
      fx.twinkle(p.x, p.y, 'g3', 8 * boxAnchor().k, 0.3);
      sfx.shieldGain();
    }
  });
  shieldN = sh.n;
  shieldMaxSeen = max;
  shieldEl.hidden = max === 0;
  const full = sh.n >= max;
  shieldBar.hidden = full;
  shieldFill.style.width = `${Math.max(0, Math.min(8, 8 - sh.toNext)) * 12.5}%`;
}

/** 수평계·안전모를 산 순간: 새로 생긴 안전모 칸이 번쩍 */
export function gearBuy(id: 'level' | 'helmet', lv: number): void {
  if (id !== 'helmet' || fx.isReduced()) return;
  const c = cells[lv - 1];
  if (!c) return;
  cellFlash(c, 3);
  const p = cellCenter(c);
  const k = boxAnchor().k;
  fx.burst(p.x, p.y, { n: 8, colors: ['g2', 'g3', 'k5'], speed: 200 * k, gravity: 300 * k, size: 4 * k, life: 0.5, clip: true });
  sfx.shieldGain();
}

/** 실드가 연속을 막은 순간: 안전모 한 칸이 흰색으로 번쩍하며 커졌다가 깨져 조각이 튀고, 방 테두리 주황 + 흔들림 + 쿵 소리. idx는 깨지는 칸(0부터) */
export function shieldSave(idx: number, mult: number, room: HTMLElement, force = false): void {
  sfx.shieldSave();
  vibrate([60, 30, 120]);
  const app = document.getElementById('app') ?? room;
  const k = boxAnchor().k;
  const c = cells[idx];
  fx.shake(app, 8, 420);
  fx.edge(room, 'or', [1, 0, 1, 0, 1, 1]);
  const a = boxAnchor();
  fx.burst(a.x, a.y, { n: 12, ring: true, colors: ['or', 'g2'], speed: 380 * a.k, gravity: 0, size: 6 * a.k, life: 0.5, clip: true });
  if (force) say('good', 0, 1234, 1, 0, mult);
  if (!c) return;
  c.classList.add('flash');
  if (!fx.isReduced()) fx.pxFrames(c, [{ scale: '1.6' }, { scale: '1.4' }, { scale: '1.2' }], STEP_MS / 2);
  window.setTimeout(() => {
    const p = cellCenter(c);
    c.classList.remove('flash');
    if (!fx.isReduced()) fx.pxFrames(c, [{ translate: '0 -4px' }, { translate: '0 2px' }, { translate: '0 0' }], STEP_MS / 2);
    fx.burst(p.x, p.y, { n: 16, colors: ['g2', 'g3', 'or', 'k5', 'k0'], speed: 340 * k, gravity: 800 * k, size: 6 * k, life: 0.7, clip: true });
    fx.burst(p.x, p.y, { n: 8, ring: true, colors: ['or', 'k5'], speed: 260 * k, gravity: 0, size: 4 * k, life: 0.4, clip: true });
    if (force) c.classList.toggle('on', false);
  }, STEP_MS);
}
