// 떠다니는 택배 상자: 방 영역을 가로질러 8초 동안 떠다니고, 잡으면 보상 연출. 상태는 로직(catchParcel)이 바꾼다.
import { PARCEL_STAY_SEC } from '../logic/fever';
import { formatNumber } from '../logic/format';
import { catchParcel, parcelVisible } from '../logic/variety';
import type { GameState } from '../logic/state';
import { pxImg } from './px/art';
import { el, toggleClass } from './dom';
import * as fx from './fx';
import { sfx } from './sound';
import { vibrate } from './prefs';
import { playFree } from './box';
import type { UiCtx } from './collectUi';

const box = el('button', { cls: 'parcel', attrs: { type: 'button', hidden: '', 'aria-label': '떠다니는 택배 상자 잡기' } }, el('span', { cls: 'parcel-emoji' }, pxImg('icon/parcel')));
let ctx: UiCtx;
let roomEl: HTMLElement;
let pointsOf: () => Element;
let shown = false;
let dir = 1;
let width = 360;
let lastT = '';

export function initParcel(room: HTMLElement, points: () => Element, c: UiCtx): void {
  ctx = c;
  roomEl = room;
  pointsOf = points;
  room.append(box);
  box.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    grab();
  });
  box.addEventListener('click', (e) => {
    if (e.detail === 0) grab();
  });
}

function center(): { x: number; y: number } {
  const r = box.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function grab(): void {
  const out = catchParcel(ctx.get(), () => Math.random());
  if (!out) return;
  const at = center();
  ctx.set(out.state);
  hide();
  sfx.parcelCatch();
  vibrate([15, 20, 30]);
  fx.burst(at.x, at.y, { n: 24, kind: 'star', colors: ['#c8924a', '#ffd9a0', '#ffc83d', '#ffffff'], speed: 320, size: 7 });
  const reward = out.reward;
  if (reward.kind === 'points') {
    fx.floatText(Math.max(150, Math.min(window.innerWidth - 150, at.x)), roomEl.getBoundingClientRect().top + 135, `+${formatNumber(reward.gain)}`, { scale: 1, spread: 12, ms: 1500, cls: 'parcel-gain' });
    const pointsEl = pointsOf();
    const h = pointsEl.getBoundingClientRect().height;
    fx.coinShower(at, pointsEl, 26, undefined, { x: 0, y: h / 2 + 12 });
  } else {
    fx.banner('사은품 상자 도착!', { sub: '무료 상자를 받았어요', tone: 'gold', ms: 1400 });
    fx.confetti(window.innerWidth / 2, window.innerHeight * 0.42, 70);
    sfx.reward();
    window.setTimeout(() => playFree(reward.result), 1150);
  }
  ctx.save();
  ctx.update();
}

function hide(): void {
  shown = false;
  box.hidden = true;
  box.classList.remove('blink');
}

export function syncParcel(state: GameState): void {
  const visible = parcelVisible(state);
  if (!visible) {
    if (shown) hide();
    return;
  }
  if (!shown) {
    shown = true;
    dir = Math.random() < 0.5 ? 1 : -1;
    width = roomEl.clientWidth || 360;
    box.hidden = false;
    sfx.parcelAppear();
    lastT = '';
  }
  const remain = state.parcel.remainSec;
  const u = Math.min(1, Math.max(0, 1 - remain / PARCEL_STAY_SEC));
  toggleClass(box, 'blink', remain < 3 && !fx.isReduced());
  let t: string;
  if (fx.isReduced()) {
    t = `translate(${width - 84}px, 8px)`;
  } else {
    const x = dir > 0 ? -40 + u * (width + 80) : width + 40 - u * (width + 80);
    const floor = Math.max(40, (roomEl.clientHeight || 160) - 76);
    const hop = Math.abs(Math.sin(u * Math.PI * 5));
    const y = floor - hop * Math.min(80, floor - 6);
    const sq = hop < 0.14 ? 1 - (0.14 - hop) * 1.6 : 1;
    t = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(Math.sin(u * 31) * 10).toFixed(1)}deg) scale(${(2 - sq).toFixed(2)}, ${sq.toFixed(2)})`;
  }
  if (t !== lastT) {
    lastT = t;
    box.style.transform = t;
  }
}
