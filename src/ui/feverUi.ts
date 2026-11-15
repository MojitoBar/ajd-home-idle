// 피버 게이지(방 아래 가로 한 줄)·발동 연출·발동 중 분위기. 상태는 읽기만 한다.
import { FEVER_MULT, feverRatio } from '../logic/fever';
import type { GameState } from '../logic/state';
import { el, setText, toggleClass } from './dom';
import { iconImg } from './icons';
import * as fx from './fx';
import { sfx } from './sound';
import { vibrate } from './prefs';

const SEG = 20;
const cells = Array.from({ length: SEG }, () => el('i', { cls: 'fv-cell' }));

/** 방 그림과 아래 띠 사이 가로 게이지 한 줄: `피버` 라벨 + 20칸 틀(8px). 0%여도 틀은 항상 보인다 */
export const gauge = el('div', { cls: 'fever-gauge', attrs: { 'aria-hidden': 'true' } });
const gaugeBar = el('div', { cls: 'fv-bar' });
gaugeBar.append(...cells);
gauge.append(el('span', { cls: 'fv-lbl', text: '피버' }), gaugeBar);
const tagFire = iconImg('fever', { size: 16, cls: 'tag-fire' });
tagFire.hidden = true;
const tagTxt = el('span');
export const tag = el('div', { cls: 'fever-tag', attrs: { 'aria-live': 'off' } }, tagFire, tagTxt);
export const badge = el('span', { cls: 'x3-badge', text: 'x3', attrs: { hidden: '' } });
const frame = el('div', { cls: 'fever-frame', attrs: { 'aria-hidden': 'true' } });

let wasActive = false;
let lastSeg = -1;
let lastGauge = 0;
let tagHoldUntil = 0;
/** 게이지 칩은 마지막 탭 뒤 이 시간 동안 유지한 뒤 사라진다 */
const TAG_HOLD_MS = 1500;
let phoneEl: HTMLElement;

export function initFever(room: HTMLElement, phone: HTMLElement): void {
  phoneEl = phone;
  room.append(tag);
  document.body.append(frame);
}

export function syncFever(state: GameState): void {
  const f = state.fever;
  const active = f.activeSec > 0;
  const lock = !active && f.cooldownSec > 0;
  const ratio = feverRatio(state);
  const near = !active && !lock && ratio >= 0.8;
  const now = performance.now();
  if (f.gauge > lastGauge && !active) tagHoldUntil = now + TAG_HOLD_MS;
  lastGauge = f.gauge;

  const seg = lock ? 0 : active ? Math.min(SEG, Math.ceil(ratio * SEG)) : Math.round(ratio * SEG);
  if (seg !== lastSeg) {
    lastSeg = seg;
    cells.forEach((c, i) => c.classList.toggle('on', i < seg));
  }
  toggleClass(gauge, 'near', near);
  toggleClass(phoneEl, 'near', near);
  toggleClass(document.body, 'fever-end', active && f.activeSec <= 3);
  toggleClass(document.body, 'reduce-motion', fx.isReduced());

  if (tagFire.hidden === active) tagFire.hidden = !active;
  if (active) setText(tagTxt, `피버 x${FEVER_MULT} · ${Math.ceil(f.activeSec)}초`);
  else if (lock) setText(tagTxt, `재충전 ${f.cooldownSec.toFixed(1)}초`);
  else if (now < tagHoldUntil && Math.floor(ratio * 100) > 0) setText(tagTxt, `피버 ${Math.floor(ratio * 100)}%`);
  else setText(tagTxt, '');
  toggleClass(tag, 'blank', !tagTxt.textContent);
  toggleClass(tag, 'near', near);
  toggleClass(tag, 'active', active);
  toggleClass(tag, 'lock', lock);
  if (badge.hidden === active) badge.hidden = !active;

  if (active && !wasActive) start();
  else if (!active && wasActive) end();
  wasActive = active;
}

function start(): void {
  document.body.classList.add('fever');
  sfx.setPitch(1.5);
  fx.banner('피버!', { tone: 'red', ms: 600 });
  fx.flash('#ff8a1f', 450);
  const r = document.querySelector('.room')?.getBoundingClientRect();
  if (r) fx.confetti(r.left + r.width / 2, r.top + r.height * 0.6, 40, { clip: true });
  else fx.confetti(window.innerWidth / 2, window.innerHeight * 0.42, 40);
  if (r) fx.burst(r.left + r.width / 2, r.top + r.height / 2, { n: 12, kind: 'star', colors: ['or', 'g2', 'g3', 'k5'], speed: 280, gravity: 0, size: 8, clip: true });
  fx.shake(document.getElementById('app')!, 4, 400);
  sfx.feverStart();
  vibrate([30, 30, 60, 30, 90]);
}

function end(): void {
  document.body.classList.remove('fever', 'fever-end');
  sfx.setPitch(1);
  sfx.feverEnd();
}
