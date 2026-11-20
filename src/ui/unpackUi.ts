// 이삿짐 상자 풀기 화면: 방 한가운데 상자·대기 상자·살림 칸·내구도 막대·도구 연출. 로직은 모르고 state와 터짐 결과만 받는다.
import { ROOMS, roomFor, SHELF_ICON_DROP, SHELF_TOOL_DROP, shelfSlots } from '../data/rooms';
import { featureOpen } from '../logic/guide';
import { houseInfo } from '../logic/house';
import { CHAIN_PRIZES, GOLD_GAIN_MULT, ROOM_BOXES, ROOM_ITEMS, TOOLS, type BoxKind, type SpecialBox, type ToolDef } from '../data/unpack';
import { formatNumber } from '../logic/format';
import type { GameState } from '../logic/state';
import { gearEffects, gearLevel } from '../logic/gear';
import { homeMult } from '../logic/economy';
import type { GearId } from '../data/gear';
import { boxCondition, boxKind, nextCareSlot, roomProgress, specialAt, tierOf, toolOf, type BoxBurst } from '../logic/unpack';
import { el, setText } from './dom';
import * as fx from './fx';
import { vibrate } from './prefs';
import { playFree } from './box';
import { sfx } from './sound';
import { markTabDot } from './unlockUi';
import { dropTapNumber } from './tapFx';
import { artUrl, dim, DOT, preload, pxImg } from './px/art';

/** 지금 집 테마의 방(배경·살림·전화 자리). 선반·상자 자리는 모든 방이 같다 */
let ONE_ROOM = roomFor('blue');
let roomTheme = 'blue';
const STAGES: Record<BoxKind, number> = { small: 3, normal: 3, big: 4 };
const boxArt = (kind: BoxKind, stage = 0, special: SpecialBox | null = null): string => (special ? `box/${special}-${kind}-${stage + 1}` : `box/${kind}-${stage + 1}`);
const openArt = (kind: BoxKind, special: SpecialBox | null): string => (special ? `box/${special}-${kind}-open` : `box/${kind}-open`);
const SPECIALS: SpecialBox[] = ['gold', 'bomb', 'clock'];
const SPECIAL_NAME: Record<SpecialBox, string> = { gold: '황금 상자', bomb: '폭탄 상자', clock: '시계 상자' };
/** 폭탄 그림의 심지 자리(그림 크기 대비 비율): 작은·보통 */
const FUSE: Record<'small' | 'normal', { x: number; y: number }> = { small: { x: 0.61, y: 0.6 }, normal: { x: 0.27, y: 0.57 } };
/** 상자 크기는 그림 자연 크기 x 2 */
const boxPx = (kind: BoxKind): number => dim(boxArt(kind)).w * DOT;

/** 방 확대 배율(PC 큰 화면 2, 그 밖 1): 방 안 style은 확대 전 px, getBoundingClientRect는 확대 후 px */
const rs = (): number => (room && room.offsetWidth ? room.getBoundingClientRect().width / room.offsetWidth : 1);
/** 상자 파편은 상자 바닥선에 닿으면 사라진다 */
const debrisFloor = (): number | undefined => (boxes[0] ? boxes[0].root.getBoundingClientRect().bottom : undefined);
/** 입자는 화면 좌표라 방 배율만큼 크기·속도를 키운다 */
const pburst = (x: number, y: number, o: Parameters<typeof fx.burst>[2] = {}): void => {
  const k = rs();
  fx.burst(x, y, { floor: debrisFloor(), ...o, size: (o.size ?? 4) * k, speed: o.speed === undefined ? undefined : o.speed * k, gravity: o.gravity === undefined ? undefined : o.gravity * k });
};
/** 대기 상자(뒤 두 칸)는 큰 상자여도 보통 상자 그림 크기로만 그린다. 큰 그림은 가운데 차례에만 */
const shownKind = (kind: BoxKind, pos: number): BoxKind => (kind === 'big' && pos > 0 ? 'normal' : kind);
/** 내구도 비율에서 그림 단계: 작은·보통은 3등분(67·34%), 큰 상자는 4등분 */
const stageOf = (kind: BoxKind, ratio: number): number => {
  const n = STAGES[kind];
  return Math.min(n - 1, Math.floor(((100 - Math.ceil(ratio * 100 - 1e-9)) * n) / 100));
};
/** 살림 그림 단계 접미(기본·은·금·무지개). 반짝 단계는 무지개 그림 + 반짝 입자 */
const TIER_SUFFIX = ['', '-silver', '-gold', '-rainbow'];
export const tierArt = (i: number, lv: number): string => ROOM_ITEMS[i].image + TIER_SUFFIX[Math.min(tierOf(lv), 3)];
const TIER_COLS = [['g2'], ['k5', 'k4', 'k3'], ['g2', 'g3', 'g1'], ['or', 'g2', 'gn', 'b3'], ['g3', 'k5', 'p1', 'pk']];
const TIER_GIFT = ['', '은빛', '금빛', '무지갯빛', '반짝'];
const TIER_TOAST = ['', '은빛이 됐어요', '금빛이 됐어요', '무지갯빛이 됐어요', '반짝이게 됐어요'];
const PX_ART = [
  ...Object.values(ROOMS).map((r) => r.bg),
  'ui/wall-phone',
  'icon/parcel',
  'box/small-open',
  'box/normal-open',
  'box/big-open',
  'box/flat',
  ...TOOLS.map((t) => t.icon),
  'tool/sledge',
  'tool/level',
  'tool/hardhat',
  'tool/crowbar',
  'tool/awl',
  'tool/magnifier',
  ...(['small', 'normal', 'big'] as BoxKind[]).flatMap((k) => Array.from({ length: STAGES[k] }, (_, i) => boxArt(k, i))),
  ...SPECIALS.flatMap((sp) => (['small', 'normal'] as BoxKind[]).flatMap((k) => [...Array.from({ length: STAGES[k] }, (_, i) => boxArt(k, i, sp)), openArt(k, sp)])),
  ...ROOM_ITEMS.flatMap((i) => TIER_SUFFIX.map((x) => i.image + x)),
];
/** 짐 더미 자리(도트): 열 가운데 x, 상자 바닥 y. 1단 왼·오. 상자 윗변(92-32=60)이 창문 아랫변(60)보다 위로 올라가지 않는다 */
const PILE = [{ c: 74, b: 92 }, { c: 106, b: 92 }];
/** 남은 짐으로 정하는 더미 수(0~2). 손질 단계(80개 뒤)는 1개 고정 */
const pileCount = (k: number): number => (k >= ROOM_BOXES ? 1 : Math.max(0, Math.min(2, Math.ceil((ROOM_BOXES - k - 3) / 40))));
/** 가운데 뒤에서 기다리는 상자 수(0~2). 마지막 두 상자에서는 비어 보인다 */
const waitCount = (k: number): number => (k >= ROOM_BOXES ? 2 : Math.max(0, Math.min(2, ROOM_BOXES - k - 1)));
let pileEls: HTMLElement[] = [];
/** 지금 상자들을 만든 salt(바뀌면 특별 상자 자리가 달라지니 다시 만든다) */
let shownSalt = -1;
let artReady = false;
const LIVE_CAP = 30;

interface BoxEl {
  root: HTMLElement;
  body: HTMLElement;
  imgs: HTMLImageElement[];
  /** 큰 상자가 대기할 때 보여 줄 보통 상자 그림 */
  waitImgs: HTMLImageElement[];
  k: number;
  kind: BoxKind;
  /** 특별 상자 종류(황금·폭탄·시계). 일반 상자는 null */
  special: SpecialBox | null;
  stage: number;
}

let room: HTMLElement;
let stage: HTMLElement;
let toolEl: HTMLElement;
let barFill: HTMLElement;
let barEl: HTMLElement;
let chip: HTMLElement;
let doneChip: HTMLElement;
let wall: HTMLElement;
let boxes: BoxEl[] = [];
const slots: { root: HTMLElement; col: HTMLElement; img: HTMLElement; pic: HTMLImageElement; fill: number; rows?: number; tier?: number }[] = [];
/** 단계가 바뀌는 착지를 기다리는 살림 칸(그림을 아직 바꾸지 않는다) */
const tierHold = new Map<number, number>();
let sparkTimer = 0;
let sparkN = 0;
const held = new Map<number, number>();
const toolSpans: HTMLElement[] = [];
let shelfInit = false;
let lastState: GameState | null = null;
let live = 0;
let squashAnim: Animation | undefined;
let timing: { k: number; t0: number; taps: number } | null = null;
let shownBar = -1;
let lastTool = '';
let lastMin = -1;
let toast: (msg: string, gold?: boolean) => void = () => {};
let glint: HTMLElement;
let strip: HTMLElement | null = null;
let pxCount: HTMLElement;
let pxMain: HTMLElement;
let pxItem: HTMLElement;
let stripKey = '';
/** 방 띠: 막대는 최소 96px. 모자라면 낱말을 줄이지 않고 곁가지(품목 이름 → 탭 수치)를 차례로 뺀다 */
function fitStrip(): void {
  if (!strip) return;
  const key = `${strip.clientWidth}|${pxMain.textContent}${pxItem.textContent}|${doneChip.textContent}|${doneChip.hidden}|${strip.querySelector('.tap-hint')?.textContent ?? ''}`;
  if (key === stripKey) return;
  stripKey = key;
  strip.classList.remove('short', 'tiny');
  if (strip.scrollWidth > strip.clientWidth) strip.classList.add('short');
  if (strip.scrollWidth > strip.clientWidth) strip.classList.add('tiny');
}
const shelfEls = new Map<number, HTMLElement>();
let shelfKey = '';
let shelf: HTMLElement;

/** 방 띠(방 바로 아래 붙은 줄). 도트 스킨이 아니면 null */
export const roomStrip = (): HTMLElement | null => strip;
/** 도트 선반 위 서비스 i의 칸(날아가는 아이콘 도착점). 선반에 없으면 null */
export const shelfItemEl = (i: number): HTMLElement | null => shelfEls.get(i) ?? null;

const josa = (w: string, a: string, b: string): string => {
  const c = w.charCodeAt(w.length - 1);
  return w + (c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0 ? a : b);
};

export const dockToolEl = el('span', { cls: 'un-dock-tool', attrs: { 'aria-hidden': 'true' } });
toolSpans.push(dockToolEl);

/** 탭 강화 카드 등에 넣는 현재 도구 그림 */
export function makeToolEl(cls = ''): HTMLElement {
  const s = el('span', { cls: `un-tool-ico ${cls}`.trim(), attrs: { 'aria-hidden': 'true' } });
  toolSpans.push(s);
  return s;
}

function setTool(s: HTMLElement, t: ToolDef): void {
  s.dataset.tool = t.id;
  s.replaceChildren(pxImg(t.icon));
}

function makeBox(k: number, pos: number): BoxEl {
  const kind = boxKind(k);
  const special = specialAt(lastState?.unpack.salt ?? 0, k, lastState ? gearEffects(lastState).specialRate : undefined);
  const body = el('div', { cls: 'un-body' });
  // 단계 그림은 전부 미리 얹어 두고 켜고 끈다(그림 교체 때 깜빡임 없음)
  const imgs = Array.from({ length: STAGES[kind] }, (_, i) => pxImg(boxArt(kind, i, special), `un-box-img${i === 0 ? ' on' : ''}`));
  const waitImgs = kind === 'big' ? Array.from({ length: STAGES.normal }, (_, i) => pxImg(boxArt('normal', i), 'un-box-img')) : [];
  body.append(...imgs, ...waitImgs);
  const root = el('div', { cls: 'un-box', attrs: { 'data-kind': kind, 'data-stage': '0', 'data-pos': String(pos) } }, body);
  const b: BoxEl = { root, body, imgs, waitImgs, k, kind, special, stage: 0 };
  setBoxPos(b, pos);
  return b;
}

/** 자리(가운데·대기)에 맞는 그림 묶음과 크기를 고른다 */
function setBoxPos(b: BoxEl, pos: number): void {
  b.root.dataset.pos = String(pos);
  const waiting = b.kind === 'big' && pos > 0;
  b.root.style.setProperty('--b', String(boxPx(shownKind(b.kind, pos))));
  b.imgs.forEach((im, i) => im.classList.toggle('on', !waiting && i === b.stage));
  b.waitImgs.forEach((im, i) => im.classList.toggle('on', waiting && i === Math.min(b.stage, b.waitImgs.length - 1)));
}

function setBoxStage(b: BoxEl, stage: number): void {
  b.stage = stage;
  b.root.dataset.stage = String(stage);
  setBoxPos(b, Number(b.root.dataset.pos));
}

/** 대기 상자 2개를 가운데 상자 양옆으로 벌린다: 겹침은 두 상자 중 작은 폭의 1/3 이하(그림 가장자리 여백을 고려해 1/5로 잡는다) */
function layoutWait(): void {
  const c = boxes[0];
  if (!c) return;
  const cw = dim(boxArt(c.kind)).w;
  boxes.forEach((b, i) => {
    if (i === 0) return;
    const w = dim(boxArt(shownKind(b.kind, i))).w;
    const dx = Math.max(Math.abs(ONE_ROOM.box.wait[i - 1].dx), Math.ceil(cw / 2 + w / 2 - Math.min(cw, w) / 5));
    b.root.style.setProperty('--wx', `${(i === 1 ? -dx : dx) * DOT}px`);
  });
}

function rebuild(k: number): void {
  settle();
  shownSalt = lastState?.unpack.salt ?? 0;
  for (const b of boxes) b.root.remove();
  boxes = Array.from({ length: 1 + waitCount(k) }, (_, i) => makeBox(k + i, i));
  for (const b of boxes) b.root.style.visibility = '';
  syncPile(k);
  for (let i = boxes.length - 1; i >= 0; i--) stage.append(boxes[i].root);
  layoutWait();
  setStageVar();
}

/** 대기 상자 뒤 짐 더미(box/small-1 그림 4자리 중 count개) */
function syncPile(k: number): void {
  if (!pileEls.length) {
    pileEls = PILE.map((p) => {
      const e = el('div', { cls: 'un-pile' }, pxImg('box/small-1'));
      e.style.left = `${(p.c - ONE_ROOM.box.x) * DOT - 32}px`;
      e.style.top = `${(p.b - ONE_ROOM.box.y) * DOT - 64}px`;
      stage.prepend(e);
      return e;
    });
  }
  const n = pileCount(k);
  pileEls.forEach((e, i) => {
    e.style.visibility = i < n ? 'visible' : 'hidden';
  });
}

function setStageVar(): void {
  if (boxes[0]) stage.style.setProperty('--b0', String(boxPx(boxes[0].kind)));
}

export function initUnpack(o: { room: HTMLElement; tapHint?: HTMLElement; toast: (msg: string, gold?: boolean) => void }): void {
  room = o.room;
  toast = o.toast;
  glint = el('i', { cls: 'un-glint un-only', attrs: { 'aria-hidden': 'true' } });
  document.body.classList.add('un-mode');
  stage = el('div', { cls: 'un-stage un-only', attrs: { 'aria-hidden': 'true' } });
  toolEl = el('span', { cls: 'un-swing' });
  stage.append(toolEl);
  toolSpans.push(toolEl);
  window.setInterval(ambient, 160);
  fx.setShardAvoid(() => {
    return { behind: boxes[0] ? [boxes[0].root.getBoundingClientRect()] : [] };
  });

  const mk = (from: number, side: string): HTMLElement => {
    const g = el('div', { cls: `un-slots un-only ${side}` });
    for (let i = from; i < from + 4; i++) {
      const it = ROOM_ITEMS[i];
      const pxUrl = artUrl(it.image);
      const sil = el('i', { cls: 'un-sil' });
      sil.style.maskImage = sil.style.webkitMaskImage = `url(${pxUrl})`;
      // 아래부터 자르는 칸은 clip-path(흐린 가장자리가 생김) 대신 높이를 줄인 상자(overflow hidden)로 자른다
      const pic = el('img', { attrs: { src: pxUrl, alt: '', draggable: 'false' } });
      const col = el('div', { cls: 'un-colw' }, pic);
      const root = el('div', { cls: 'un-slot', attrs: { title: it.name, 'data-id': it.id } }, el('span', { cls: 'un-silw' }, sil), col);
      slots[i] = { root, col, img: sil, pic, fill: -1 };
      g.append(root);
    }
    return g;
  };
  barFill = el('i', { cls: 'un-bar-fill' });
  barEl = el('div', { cls: 'un-bar' }, barFill);
  chip = el('span', { cls: 'un-chip' });
  doneChip = el('span', { cls: 'un-chip gold', text: '살림 Lv 0' });
  doneChip.hidden = true;
  const meta = el('div', { cls: 'un-meta un-only' }, chip, doneChip, barEl);

  wall = el('span', { cls: 'un-wall un-only' }, pxImg('ui/wall-phone', 'un-wall-a'));
  room.append(stage, mk(0, 'l'), mk(4, 'r'), meta, wall, glint);
  initPixel(o.tapHint);
}

function initPixel(tapHint?: HTMLElement): void {
  const sh = ONE_ROOM.shelf;
  const pl = el('i', { cls: 'px-pl' }, el('i', { cls: 'px-plank' }), el('i', { cls: 'px-sup l' }), el('i', { cls: 'px-sup r' }));
  shelf = el('div', { cls: 'px-shelf un-only', attrs: { 'aria-hidden': 'true' } }, pl);
  shelf.style.setProperty('--x', String(((sh.p0 + sh.x1) / 2 - ONE_ROOM.w / 2) * DOT));
  shelf.style.setProperty('--w', String((sh.x1 - sh.p0) * DOT));
  shelf.style.setProperty('--y', String(sh.y * DOT));
  room.append(shelf);
  stage.style.setProperty('--wy', `${ONE_ROOM.box.wait[0].dy * DOT}px`);
  document.documentElement.style.setProperty('--px-floor', `${ONE_ROOM.box.y * DOT}px`);
  // 방 띠: 방 아래 붙은 종이 띠(상자 n/80 · 막대 · 탭 +N). 방 안의 진행 칩·탭 칩은 옮긴다
  pxMain = el('span');
  pxItem = el('span', { cls: 'px-item' });
  pxCount = el('span', { cls: 'px-count' }, pxMain, pxItem);
  strip = el('div', { cls: 'px-strip un-only' }, pxCount, doneChip, barEl);
  if (tapHint) strip.append(tapHint);
  doneChip.className = 'px-done';
  chip.remove();
  room.querySelector('.un-meta')?.remove();
  preload(PX_ART).then(() => {
    artReady = true;
    if (lastState) applyTheme(lastState);
    layoutPixel();
    if (lastState) {
      syncUnpack(lastState);
    }
  });
}

/** 그림 자연 크기가 정해진 뒤 한 번: 살림·전화·상자 대기 자리를 도트 표에서 px로 옮긴다 */
function layoutPixel(): void {
  const cx = ONE_ROOM.w / 2;
  ROOM_ITEMS.forEach((it, i) => {
    const pl = ONE_ROOM.items[it.id];
    const d = dim(it.image);
    const r = slots[i].root;
    r.dataset.on = pl.on;
    r.style.left = `calc(50% + ${(pl.x - Math.floor(d.w / 2) - cx) * DOT}px)`;
    r.style.top = `${(pl.y - d.h) * DOT}px`;
    r.style.width = `${d.w * DOT}px`;
    r.style.height = `${d.h * DOT}px`;
    r.style.setProperty('--h', `${d.h * DOT}px`);
  });
  const wp = ONE_ROOM.wallPhone;
  const wd = dim('ui/wall-phone');
  wall.style.left = `calc(50% + ${(wp.x - Math.floor(wd.w / 2) - cx) * DOT}px)`;
  wall.style.top = `${wp.y * DOT}px`;
  wall.classList.toggle('short', !!wp.short);
}

/** 선반에 올릴 공구 그림 7칸(없으면 null): 공구·오함마는 항상, 새 5종은 Lv 1부터. [그림, 아래 투명 행] */
function shelfIcons(state: GameState): ([string, number] | null)[] {
  const tool = toolOf(state.tapLevel);
  const gear = (id: GearId, art: string, drop: number): [string, number] | null => (gearLevel(state, id) > 0 ? [art, drop] : null);
  return [
    [tool.icon, SHELF_TOOL_DROP[tool.id] ?? 0],
    // 오함마 카드는 가이드 연쇄 단계에서 열린다. 그 전에는 자리만 비워 둔다
    featureOpen(state, 'chain') ? ['tool/sledge', SHELF_ICON_DROP[1]] : null,
    gear('level', 'tool/level', SHELF_ICON_DROP[2]),
    gear('helmet', 'tool/hardhat', SHELF_ICON_DROP[3]),
    gear('crowbar', 'tool/crowbar', SHELF_ICON_DROP[4]),
    gear('awl', 'tool/awl', SHELF_ICON_DROP[5]),
    gear('loupe', 'tool/magnifier', SHELF_ICON_DROP[6]),
  ];
}

/** 선반: 가진 공구(24도트)를 고정 자리(shelfSlots)에, 불투명 바닥을 판자 윗면에 맞춘다. 숫자는 없다. 공구 칸 그림이 단계마다 바뀌면 다시 놓는다 */
function syncPixelShelf(state: GameState): void {
  if (!artReady) return;
  const pos = shelfSlots(ONE_ROOM.w);
  const icons = shelfIcons(state);
  const owned = icons.map((n) => (n ? n[0] : '0')).join(',');
  if (owned === shelfKey) return;
  const prev = shelfKey.split(',');
  shelfKey = owned;
  shelfEls.clear();
  shelf.querySelectorAll('.px-svc').forEach((n) => n.remove());
  icons.forEach((it, i) => {
    if (!it) return;
    const [name, drop] = it;
    const d = dim(name);
    const box = el('span', { cls: 'px-svc' }, pxImg(name));
    box.style.left = `calc(50% + ${(pos[i].x - ONE_ROOM.w / 2) * DOT}px)`;
    box.style.top = `${-(d.h - drop) * DOT}px`;
    box.style.width = `${d.w * DOT}px`;
    box.style.height = `${d.h * DOT}px`;
    shelfEls.set(i, box);
    shelf.append(box);
    // 새로 올라온 순간만: 2px 단위로 톡 내려앉는다
    if (shelfInit && (prev[i] ?? '0') === '0' && !fx.isReduced()) box.animate([{ translate: `0 ${-6 * DOT}px` }, { translate: '0 0' }], { duration: 240, easing: 'steps(6, end)' });
  });
  shelfInit = true;
}

/** 터짐·탭 연출이 기준으로 삼는 상자 중심 화면 좌표 */
export function boxCenter(): { x: number; y: number } {
  const r = stage.getBoundingClientRect();
  const h = boxes[0] ? (boxPx(boxes[0].kind) / 2) * rs() : 0;
  return { x: r.left, y: r.top - h };
}

/** 서비스 아이콘·수치 칩 줄의 아랫변. 터짐·치명타 글자는 이 선 아래에 머문다 */
function chipsBottom(): number {
  return room.getBoundingClientRect().top + (ONE_ROOM.shelf.y + 6) * DOT * rs();
}

/** 숫자·치명타 글자가 터짐 숫자 자리를 피하도록 알려 주는 상자 중심과 반폭, 칩 줄 아랫변 */
export function boxAnchor(): { x: number; y: number; half: number; minTop: number; k: number; gainBottom: number } {
  const c = boxCenter();
  const gain = scene.gain?.isConnected ? scene.gain.getBoundingClientRect().bottom : 0;
  return { x: c.x, y: c.y, half: boxes[0] ? (boxPx(boxes[0].kind) / 2) * rs() : 0, minTop: Math.max(chipsBottom(), fx.headBottom() + 4 * rs()), k: rs(), gainBottom: gain };
}

function applySlots(): void {
  const st = lastState;
  if (!st) return;
  const p = roomProgress(st);
  slots.forEach((s, i) => {
    if (held.has(i)) return;
    s.root.classList.toggle('cur', i === p.slotsDone && !p.complete);
    const fill = i < p.slotsDone ? 1 : i === p.slotsDone && !p.complete ? p.slotFill : 0;
    if (s.fill === fill) return;
    // 아래부터 정수 도트 행. 행 수 = max(이전+1, round(h x fill)), 완성 순간만 1행씩 steps로 차오른다
    const h = dim(ROOM_ITEMS[i].image).h;
    const prev = s.rows ?? 0;
    const rows = fill >= 1 ? h : fill <= 0 ? 0 : fill < s.fill ? Math.round(h * fill) : Math.min(h, Math.max(prev + 1, Math.round(h * fill)));
    s.fill = fill;
    s.col.style.transition = fill >= 1 && rows > prev && s.rows !== undefined && !fx.isReduced() ? `height ${Math.min((rows - prev) * 20, 400)}ms steps(${rows - prev}, end)` : 'none';
    s.rows = rows;
    s.col.style.height = `${rows * DOT}px`;
    s.root.classList.toggle('done', fill >= 1);
  });
}

/** 살림 그림·받침 색을 homeLv 단계에 맞춘다. 날아오는 중인 칸은 착지 때까지 그대로 둔다 */
function applyTiers(): void {
  const st = lastState;
  if (!st || !artReady) return;
  const care = st.unpack.box >= ROOM_BOXES;
  const next = care ? nextCareSlot(st) : -1;
  const doneN = roomProgress(st).slotsDone;
  slots.forEach((s, i) => {
    s.root.classList.toggle('nc', i === next);
    if (held.has(i) || tierHold.has(i)) return;
    const lv = st.homeLv[i] ?? 0;
    const placed = care || st.unpack.roomDone || i < doneN;
    const t = lv > 0 && placed ? Math.min(tierOf(lv), 4) : -1;
    if (s.tier === t) return;
    s.tier = t;
    s.pic.src = artUrl(tierArt(i, lv));
    if (t >= 0) s.root.dataset.tier = String(t);
    else delete s.root.dataset.tier;
    s.root.querySelectorAll('.un-tw').forEach((n) => n.remove());
    if (t >= 4) {
      const spots = [[18, 14], [72, 26], [38, 58], [78, 78]];
      [spots[i % 4]].forEach(([x, y]) => {
        const w = el('i', { cls: 'un-tw' });
        w.style.left = `${x}%`;
        w.style.top = `${y}%`;
        w.style.animationDelay = `${-0.1 * ((i * 3) % 8)}s`;
        s.root.append(w);
      });
    }
  });
  armSparkle();
}

/** 반짝 단계(4+) 살림이 있으면 방 하나에 타이머 1개: 4초마다, 단계가 ×4 오를 때마다 주기가 절반(최소 0.5초) */
function armSparkle(): void {
  const st = lastState;
  if (!st || sparkTimer || fx.isReduced()) return;
  const top = Math.max(...st.homeLv.map(tierOf));
  if (top < 4) return;
  const period = Math.max(500, 4000 / 2 ** (top - 4));
  sparkTimer = window.setTimeout(() => {
    sparkTimer = 0;
    if (!document.hidden) {
      slots.forEach((s, i) => {
        if ((s.tier ?? -1) < 4 || held.has(i) || tierHold.has(i)) return;
        const r = s.root.getBoundingClientRect();
        const a = (sparkN + i) % 3;
        fx.twinkle(r.left + r.width * (0.25 + 0.25 * a), r.top + r.height * (0.15 + 0.2 * ((sparkN + 2 * i) % 3)), 'g3', 8 * rs(), 0.04);
      });
      sparkN++;
    }
    armSparkle();
  }, period);
}

/** 살림 단계가 오른 순간의 머리글 "살림 xA → xB"(주황). 살림 탭을 안 보고 있어도 탭 버튼에 알림 점이 한 번 찍힌다 */
function homeSay(care: NonNullable<BoxBurst['care']>, delay: number): void {
  const st = lastState;
  if (!st) return;
  markTabDot('home');
  const at = (lv: number): number => homeMult({ ...st, homeLv: st.homeLv.map((x, i) => (i === care.slot ? lv : x)) });
  const text = `살림 x${formatNumber(at(care.lv - 1))} → x${formatNumber(at(care.lv))}`;
  // 연쇄 덩어리(판정·숫자·합계)가 보이는 동안은 그 자리를 쓰지 않도록 사라질 때까지 기다린다(최대 3초)
  const go = (tries: number): void => {
    if (chainVisible() && tries < 30) {
      window.setTimeout(() => go(tries + 1), 100);
      return;
    }
    fx.headline('now', (end) => {
      // 같은 순간에 뜰 배율 돌파가 있으면 한 머리글로 합쳐 부제 칩으로 보인다
      const brk = fx.headDrop('break');
      const e = el('div', { cls: 'un-home-say' }, el('b', { text }), ...(brk ? [el('i', { text: brk })] : []));
      e.style.top = `${fx.headTop(room, rs())}px`;
      room.append(e);
      const fit = fx.fitHead(e, 'un-home-say', ['', 'long', 'xl'], room);
      const rm = (): void => {
        e.remove();
        end();
      };
      if (fx.isReduced()) {
        window.setTimeout(rm, 1100);
        return () => e.remove();
      }
      const f: Keyframe[] = [1.5, 1.3, 1.15, 1.05].map((s) => ({ scale: String(Math.min(s, fit)), visibility: 'visible' }));
      for (let i = 0; i < 24; i++) f.push({ scale: '1', visibility: 'visible' });
      for (let i = 0; i < 4; i++) f.push({ scale: '1', visibility: i % 2 ? 'visible' : 'hidden' });
      fx.pxFrames(e, f, 40).onfinish = rm;
      return () => e.remove();
    });
  };
  window.setTimeout(() => go(0), delay);
}

/** 손질 착지: 칸이 통통 튀고 Lv N이 뜬다. 단계가 오르면 흰 1프레임 뒤 새 그림 + 색종이 + 토스트 */
function careLand(burst: BoxBurst, reduced: boolean, showLv: boolean, inRoom = false): void {
  const care = burst.care;
  if (!care) return;
  const release = (): void => {
    const n = (tierHold.get(care.slot) ?? 1) - 1;
    if (n <= 0) tierHold.delete(care.slot);
    else tierHold.set(care.slot, n);
    applyTiers();
  };
  const name = ROOM_ITEMS[care.slot].name;
  const say = (): void => {
    if (!care.tierUp) return;
    homeSay(care, burst.roomDone ? 5700 : 0);
    const msg = `${josa(name, '이', '가')} ${TIER_TOAST[Math.min(tierOf(care.lv), 4)]}`;
    window.setTimeout(() => toast(msg, true), burst.roomDone ? 5700 : 0);
  };
  if (reduced) {
    release();
    say();
    return;
  }
  const root = slots[care.slot].root;
  const sr = root.getBoundingClientRect();
  if (inRoom && !care.tierUp) {
    release();
    if (showLv) lvText(slots[care.slot], care.lv);
    return;
  }
  if (!inRoom) pburst(sr.left + sr.width / 2, sr.bottom - 4 * rs(), { n: 4, colors: ['p2', 'p1', 'w2'], speed: 90, gravity: 300, size: 4, up: true });
  const hop = (white: boolean): Keyframe[] => [
    { translate: '0 -6px', filter: white ? WHITE : 'none' },
    { translate: '0 0', filter: 'none' },
    { translate: '0 -2px', filter: 'none' },
    { translate: '0 0', filter: 'none' },
  ];
  fx.pxFrames(root, care.tierUp ? [{ filter: WHITE }, { filter: 'none' }, { filter: WHITE }, { filter: 'none' }, ...hop(true)] : hop(true), 40);
  if (showLv && care.lv > 0) lvText(slots[care.slot], care.lv);
  if (care.tierUp) {
    window.setTimeout(() => {
      release();
      fx.confetti(sr.left + sr.width / 2, sr.top + sr.height / 2, 24);
      pburst(sr.left + sr.width / 2, sr.top + sr.height / 2, { n: 14, colors: TIER_COLS[Math.min(tierOf(care.lv), 4)], speed: 300, gravity: 200, size: 6 });
      fx.twinkle(sr.left + sr.width * 0.2, sr.top + sr.height * 0.2, 'g3', 12 * rs(), 0.12);
      fx.twinkle(sr.left + sr.width * 0.8, sr.top + sr.height * 0.35, 'k5', 12 * rs(), 0.12);
      fx.shake(room, 4, 200);
      sfx.reward();
    }, 40);
    say();
  } else release();
}

const opaqueTops = new Map<string, number>();
/** 그림에서 처음 색이 나오는 줄의 비율(투명 여백 건너뛰기). 못 읽으면 0 */
function opaqueTop(pic: HTMLImageElement): number {
  const hit = opaqueTops.get(pic.src);
  if (hit !== undefined) return hit;
  let v = 0;
  try {
    const w = pic.naturalWidth;
    const h = pic.naturalHeight;
    if (w > 0 && h > 0) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const cx = c.getContext('2d')!;
      cx.drawImage(pic, 0, 0);
      const d = cx.getImageData(0, 0, w, h).data;
      let y = 0;
      outer: for (; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 0) break outer;
      v = y / h;
      opaqueTops.set(pic.src, v);
    }
  } catch {
    v = 0;
  }
  return v;
}

/** 살림 바로 위(그림 윗변에서 2도트 위, 가로 중앙, 방 안)에 Lv N: 15px, 2단계로 4px 오르고 600ms */
function lvText(slot: (typeof slots)[number], lv: number): void {
  const o = stageOrigin();
  const r = slot.root.getBoundingClientRect();
  const sr = room.getBoundingClientRect();
  const e = el('i', { cls: 'un-lv', text: `Lv ${formatNumber(lv)}` });
  const k = rs();
  const cx = Math.min(Math.max(r.left + r.width / 2, sr.left + 32 * k), sr.right - 32 * k);
  const topY = r.top + opaqueTop(slot.pic) * r.height;
  e.style.left = `${g10((cx - o.left) / k - 60)}px`;
  const roomTop = (room.getBoundingClientRect().top - o.top) / k;
  e.style.top = `${Math.max(g10(roomTop + 4), g10((topY - o.top) / k + 8))}px`;
  stage.append(e);
  const rm = (): void => e.remove();
  if (fx.isReduced()) {
    window.setTimeout(rm, 600);
    return;
  }
  fx.pxFrames(e, [{ translate: '0 0' }, { translate: '0 -2px' }, { translate: '0 -4px' }, { translate: '0 -4px' }, { translate: '0 -4px' }, { translate: '0 -4px', visibility: 'hidden' }], 100).onfinish = rm;
}

/** 집이 바뀌면 방 배경을 갈아 끼우고 살림·전화 자리를 그 방 좌표로 다시 놓는다 */
function applyTheme(state: GameState): void {
  const theme = houseInfo(state.moves).theme;
  if (theme === roomTheme) return;
  roomTheme = theme;
  ONE_ROOM = roomFor(theme);
  room.style.backgroundImage = `url('${artUrl(ONE_ROOM.bg)}')`;
  room.style.setProperty('--plank', ONE_ROOM.plank ? `var(--${ONE_ROOM.plank})` : 'var(--w1)');
  if (artReady) layoutPixel();
}

export function syncUnpack(state: GameState): void {
  lastState = state;
  applyTheme(state);
  const tool = toolOf(state.tapLevel);
  if (tool.id !== lastTool) {
    // 저장 불러오기 직후의 레벨 점프는 획득이 아니다
    const upgrade = lastTool !== '' && tool.minLevel > lastMin && performance.now() > 800;
    const prev = TOOLS.find((t) => t.id === lastTool) ?? TOOLS[0];
    lastTool = tool.id;
    lastMin = tool.minLevel;
    for (const s of toolSpans) if (!(upgrade && s === dockToolEl)) setTool(s, tool);
    if (upgrade) toolSwap(prev, tool);
    else dockToolEl.parentElement?.setAttribute('data-tool', tool.id);
    dockToolEl.parentElement?.setAttribute('aria-label', `${tool.name}으로 상자 치기`);
  }
  if (!artReady || chainRun) return;
  const k = state.unpack.box;
  if (boxes[0]?.k !== k || shownSalt !== state.unpack.salt) rebuild(k);
  const cur = boxes[0];
  const c = boxCondition(state);
  const stg = stageOf(cur.kind, c.ratio);
  if (cur.stage !== stg) {
    const swap = cur.stage < stg && !fx.isReduced();
    setBoxStage(cur, stg);
    // 그림이 바뀌는 순간 2px 단위 흔들림
    if (swap) {
      fx.pxFrames(cur.body, [{ translate: '2px 0' }, { translate: '-2px 0' }, { translate: '2px 0' }, { translate: '-2px 0' }], 40);
      const c = boxCenter();
      const h = cur.root.offsetWidth / 2;
      pburst(c.x, c.y - h * 0.9 * rs(), { n: 2, kind: 'chip', colors: ['p2', 'w1'], speed: 150, gravity: 900, size: 8, up: true });
    }
  }
  barEl.classList.toggle('care', k >= ROOM_BOXES);
  const ratio = k >= ROOM_BOXES ? roomProgress(state).careStep / 10 : Math.round(c.ratio * 200) / 200;
  if (ratio !== shownBar) {
    barFill.style.transition = shownBar >= 0 && ratio < shownBar ? '' : 'none';
    shownBar = ratio;
    barFill.style.setProperty('--r', String(ratio));
    barEl.title = k >= ROOM_BOXES ? `손질 ${roomProgress(state).careStep}/10` : `${formatNumber(Math.max(0, c.hp - c.damage))} / ${formatNumber(c.hp)}`;
  }
  const rp = roomProgress(state);
  const care = k >= ROOM_BOXES;
  setText(pxMain, care ? `손질 ${rp.careStep + 1}/10` : `상자 ${rp.opened + 1}/${rp.total}`);
  setText(pxItem, (care ? ` · ${ROOM_ITEMS[nextCareSlot(state)].name}` : '') + (cur.special ? ` · ${SPECIAL_NAME[cur.special]}` : ''));
  setText(doneChip, `살림 Lv ${formatNumber(rp.lvSum)}`);
  doneChip.hidden = !care;
  fitStrip();
  syncPixelShelf(state);
  applySlots();
  applyTiers();
}

export interface UnpackHitInput {
  x: number;
  y: number;
  crit: boolean;
  damped: boolean;
  burst: BoxBurst | null;
  /** 이번 탭으로 터진 상자 전부(순서대로). 폭탄 상자가 터지면 2개 이상이다. burst는 그중 마지막 */
  bursts: BoxBurst[];
  /** 탭 자체의 수익(연쇄 합계는 이 값에 터진 상자 몫을 더해 올린다) */
  gain: number;
  /** 연쇄 상금(5·10·20개 이상). 없으면 null */
  prize: HeavyHitInput['prize'];
  /** 동전이 날아갈 포인트 표시 */
  pointsEl: Element;
  fever: boolean;
}

export function unpackHit(i: UnpackHitInput): void {
  const now = performance.now();
  const kCur = boxes[0]?.k ?? lastState?.unpack.box ?? 0;
  const bk = i.bursts[0] ? i.bursts[0].k : kCur;
  if (!timing || timing.k !== bk) timing = { k: bk, t0: now, taps: 0 };
  timing.taps++;
  if (i.burst) {
    console.debug('[unpack]', i.burst.k, i.burst.kind, ((now - timing.t0) / 1000).toFixed(1), timing.taps);
    timing = null;
  }
  if (!boxes[0]) return;
  const cur = boxes[0];
  const reduced = fx.isReduced();
  const half = i.damped ? 0.5 : 1;
  if (!i.burst) squash(cur, i, reduced);
  if (!reduced) {
    chips(i, i.crit ? 8 : i.damped ? 2 : i.fever ? 6 : 5);
    if (!i.damped) fx.twinkle(Math.max(boxCenter().x - 40 * rs(), Math.min(boxCenter().x + 40 * rs(), i.x)), i.y, 'k5', 8 * rs(), 0.04);
    swing(half);
    if (i.crit) {
      fx.shake(room, 4, 250);
      stars(cur);
    }
  }
  if (i.bursts.length >= 2) {
    // 폭탄이 휩쓴 연쇄: 강타와 같은 "다라라락" 연출. 판정 글자 자리에는 `폭발!`
    setChainJudge('폭발!', 'blast', '');
    playBursts({ x: i.x, y: i.y, grade: 'good', streak: 0, gain: i.gain, bursts: i.bursts, pointsEl: i.pointsEl, fever: i.fever, prize: i.prize });
    return;
  }
  if (i.burst) boom(cur, i.burst, i.pointsEl, reduced);
}

/** 시계 상자 러시의 한 번 탭(초당 10번): 타격 숫자 없이 상자 타격 프레임과 파랑·흰 작은 입자만. 둘 이상 터지면(폭탄) 연쇄 재생 대신 한꺼번에 터뜨려 러시가 끊기지 않는다 */
export function unpackRush(i: UnpackHitInput): void {
  const cur = boxes[0];
  if (!cur) return;
  const reduced = fx.isReduced();
  if (!i.burst) squash(cur, i, reduced);
  if (!reduced) {
    if (fx.particleCount() < 56) {
      const c = boxCenter();
      const w = cur.root.offsetWidth * rs();
      pburst(c.x + (Math.random() - 0.5) * w * 0.6, c.y - w * 0.2, { n: 3, colors: ['b3', 'k5', 'b4'], speed: 220, gravity: 500, size: 4, up: true, life: 0.35 });
    }
    swing(1);
  }
  const n = i.bursts.length;
  if (n >= 2) {
    const hi: HeavyHitInput = { x: i.x, y: i.y, grade: 'good', streak: 0, gain: i.gain, bursts: i.bursts, pointsEl: i.pointsEl, fever: i.fever, prize: i.prize };
    const cum = cumGain(hi);
    setChainJudge('폭발!', 'blast', '');
    startChain();
    i.bursts.forEach((b, j) => {
      const box = boxes[0];
      if (box) boom(box, b, i.pointsEl, reduced, { j, n, instant: true });
    });
    if (lastState) syncUnpack(lastState);
    chainShow(n, cum[n - 1]);
    chainEnd(i.bursts, i.prize, i.pointsEl, reduced, cum[n - 1]);
    return;
  }
  if (i.burst) boom(cur, i.burst, i.pointsEl, reduced);
}

/** 모으는 동안 상자가 웅크린다: 83ms 프레임으로 움찔움찔, 오래 모을수록 깊게. null이면 원래대로 */
export function chargeCrouch(step: number | null): void {
  const b = boxes[0];
  if (!b) return;
  if (step === null || fx.isReduced()) {
    b.body.style.translate = '';
    b.body.style.scale = '';
    return;
  }
  const deep = Math.min(2, Math.floor(step / 8));
  const jit = step % 2;
  b.body.style.translate = `${jit ? 2 : -2}px ${(2 + deep * 2) + (jit ? 0 : 2)}px`;
  b.body.style.scale = `${1.03 + deep * 0.02} ${0.96 - deep * 0.02}`;
}

/** 퍼펙트 직전 멈춤: 상자가 흰색으로 굳는다 */
export function chargeFreeze(): void {
  const b = boxes[0];
  if (!b) return;
  b.body.style.translate = '0 4px';
  b.body.style.scale = '1.08 0.88';
  b.body.style.filter = WHITE;
}

export interface HeavyHitInput {
  x: number;
  y: number;
  grade: 'perfect' | 'good' | 'miss';
  streak: number;
  /** 강타 자체의 수익(탭 몫). 연쇄 합계는 이 값에 터진 상자 몫을 더해 올린다 */
  gain: number;
  /** 이번 강타로 터진 상자(순서대로). 없을 수 있다 */
  bursts: BoxBurst[];
  pointsEl: Element;
  fever: boolean;
  /** 연쇄 상금(5·10·20개 이상). 없으면 null */
  prize: { tier: 0 | 1 | 2; n: number; gain: number } | null;
}

/** 강타 연출: 판정이 클수록 크게 맞는다. 상자가 여러 개 터지면 각각 터짐 연출을 이어서 낸다 */
export function unpackHeavy(i: HeavyHitInput): void {
  const cur = boxes[0];
  if (!cur) return;
  cur.body.style.translate = '';
  cur.body.style.scale = '';
  cur.body.style.filter = '';
  const reduced = fx.isReduced();
  const perfect = i.grade === 'perfect';
  const good = i.grade === 'good';
  const hit: UnpackHitInput = { x: i.x, y: i.y, crit: perfect || good, damped: !perfect && !good, burst: null, bursts: [], gain: i.gain, prize: null, pointsEl: i.pointsEl, fever: i.fever };
  if (i.bursts.length === 0) squash(cur, hit, reduced);
  if (!reduced) {
    const c = boxCenter();
    chips({ ...hit, x: c.x, y: c.y }, perfect ? 16 : good ? 10 : 3);
    swing(1);
    if (perfect) {
      stars(cur);
      const ring = (n: number, speed: number, life: number, kind: 'dot' | 'star'): void =>
        pburst(c.x, c.y - cur.root.offsetWidth * 0.2 * rs(), { n, kind, colors: i.streak >= 2 ? ['g2', 'k5', 'or', 'pk'] : ['g2', 'g3', 'k5'], speed, gravity: 0, size: kind === 'star' ? 8 : 6, ring: true, life });
      ring(14 + Math.min(i.streak, 4), 300, 0.5, 'dot');
      ring(16, 480, 0.55, 'star');
    } else if (good) {
      pburst(boxCenter().x, boxCenter().y - cur.root.offsetWidth * 0.2 * rs(), { n: 10, colors: ['b3', 'b4', 'k5'], speed: 280, gravity: 0, size: 6, ring: true, life: 0.45 });
    }
  }
  playBursts(i);
}

/** 터진 상자들을 재생한다: 하나면 그냥 터짐, 둘 이상이면 연쇄(움직임 줄이기면 한꺼번에) */
function playBursts(i: HeavyHitInput): void {
  const reduced = fx.isReduced();
  const n = i.bursts.length;
  if (n < 2) {
    for (const b of i.bursts) {
      const box = boxes[0];
      if (box) boom(box, b, i.pointsEl, reduced);
    }
    return;
  }
  if (reduced) {
    skipBursts(i.bursts, 0, n - 1, i.pointsEl, n);
    const last = boxes[0];
    if (last) boom(last, i.bursts[n - 1], i.pointsEl, true, { j: n - 1, n });
    startChain();
    chainShow(n, cumGain(i)[n - 1]);
    chainEnd(i.bursts, i.prize, i.pointsEl, true, cumGain(i)[n - 1]);
    return;
  }
  playChain(i);
}

/** 연쇄 재생 중이면 일반 탭·러시 탭을 로직에 넣지 않는다(app이 확인). 꾹 누르기(차징)는 막지 않고, 뗀 강타만 chainFinish로 연쇄 마무리 뒤에 실행한다 */
export const chainPlaying = (): boolean => chainRun !== null;
/** 연쇄를 서둘러 끝내는 중이다(그 뒤 예약된 강타가 곧 나간다): 이때 새로 모으기를 시작하지 않는다 */
export const chainFinishing = (): boolean => chainAfter !== null;
/** 재생 중인 연쇄의 남은 칸을 CHAIN_FAST_TICKS틱(약 0.07초)에 몰아 처리하고 chainEnd(합계·상금·보상)까지 평소대로 마친 뒤, 합계가 보이도록 CHAIN_FAST_HOLD_MS 머물렀다가 cb를 부른다. 재생 중이 아니면 바로 cb. 화면만 서두르고 로직(이미 반영됨)·chainEnd 처리는 그대로다 */
export function chainFinish(cb: () => void): void {
  if (!chainRun) return cb();
  if (chainAfter) return;
  chainAfter = cb;
  chainHurry();
}
/** 연쇄의 남은 칸을 서둘러 넘기기 시작한다(뗀 순간 호출: 예약은 chainFinish가 따로 건다). 이미 서두르는 중이거나 재생 중이 아니면 아무것도 안 한다 */
export function chainHurry(): void {
  if (!chainRun || !chainStep || chainFast > 0) return;
  chainFast = CHAIN_FAST_TICKS;
  chainHurried = true;
  window.clearTimeout(chainRun.timer);
  chainStep();
}

/** 디버그: 재생 중 여부와 마지막으로 올라간 연쇄 숫자 */
export const chainInfo = (): { playing: boolean; n: number; total: number } => ({ playing: chainRun !== null, n: chainN, total: chainTotal });

interface ChainMeta {
  j: number;
  n: number;
  /** 러시 중 한꺼번에 터뜨리는 연쇄: 걸음 소리·흔들림을 겹쳐 내지 않는다 */
  instant?: boolean;
  /** 묶음 연쇄에서 그림 없이 상태만 넘기는 칸: 날아가는 점수 같은 부수 효과도 뺀다 */
  skip?: boolean;
  /** 묶음 연쇄에서 이 틱에 묶인 칸 수(점수 날림 개수를 늘린다) */
  sz?: number;
}
/** 연쇄 문턱: 10·50·100·500·1000단을 넘을 때마다 한 단계(1~5)씩 오른다. 단계가 오르면 파편 상한·흔들림·소리가 커진다 */
const CHAIN_TIERS = [10, 50, 100, 500, 1000];
const chainTierOf = (n: number): number => CHAIN_TIERS.filter((t) => n >= t).length;
let chainTier = 0;
/** 이번 칸에서 문턱을 넘었다: 연쇄 숫자가 평소보다 크게 튄다 */
let chainBoostPop = false;
/** 폭탄 정지(0.08초)로 다음 칸을 미룰 ms. 연쇄 하나에 세 번까지 */
let bombStopMs = 0;
let bombStops = 0;
let lastQuakeAt = 0;
const QUAKE_AMP = [4, 4, 6, 8, 10, 12];
const SHARD_COLS: Record<string, string[]> = {
  normal: ['#fff3d6', '#ecd3a0', '#d08a4a', '#8a4f24'],
  gold: ['#ffc83d', '#ffeaa0', '#c98a00', '#ffffff'],
  clock: ['#5b9bff', '#bcd6ff', '#145ce6', '#ffffff'],
  bomb: ['#16224a', '#ff8a1f', '#ffc83d', '#8a96b8'],
};
const appEl = (): HTMLElement => document.getElementById('app') ?? room;
let chainRun: { timer: number } | null = null;
/** 서둘러 끝내기: 남은 빠른 틱 수(0이면 평소 속도), 끝난 뒤 부를 예약, 다음 틱을 당겨 부를 함수 */
let chainFast = 0;
let chainHurried = false;
let chainAfter: (() => void) | null = null;
let chainStep: (() => void) | null = null;
const CHAIN_FAST_TICKS = 2;
const CHAIN_FAST_HOLD_MS = 90;
let chainN = 0;
/** 연쇄가 끝난 시각: 사은품 장면이 합계·상금 표시를 바로 덮지 않게 1.6초 기다린다 */
let chainEndAt = -1e9;
let chainTotal = 0;
let chainBox: HTMLElement | null = null;
let chainJudge: { text: string; tone: string; power: string } | null = null;
let chainJudgePop = false;
let chainPop: Animation | null = null;
let chainSumPop: Animation | null = null;
let chainOff = 0;
/** 이번 연쇄에 시계 상자가 있어 러시 칩이 도중에 뜬다 */
let chainClock = false;

/** 2연쇄 이상으로 터질 때 판정 글자(`퍼펙트!`·`급소!`) + 있으면 파워 배율: 큰 글자 대신 연쇄 숫자 바로 위 24px 한 줄로 보인다. 다음 연쇄 시작 때 쓴다 */
export function setChainJudge(text: string, tone: string, power: string): void {
  chainJudge = { text, tone, power };
}
/** 연쇄 덩어리가 보이는 중이다(게이지·말풍선이 비켜 줄 때 쓴다) */
export const chainVisible = (): boolean => !!chainBox && !chainBox.hidden;

/** 연쇄 시작: 머리글을 붙잡고(떠 있던 것은 치움) 판정 줄을 채운다 */
function startChain(): void {
  window.clearTimeout(chainOff);
  window.clearTimeout(sweepTimer);
  chainTier = 0;
  bombStops = 0;
  bombStopMs = 0;
  sfx.chainReset();
  fx.headHold(true);
  const j = chainJudge;
  chainJudge = null;
  const judge = chainEl().lastElementChild as HTMLElement;
  judge.className = `un-chain-judge${j ? ` ${j.tone}` : ''}`;
  judge.replaceChildren(...(j ? [document.createTextNode(j.text), ...(j.power ? [el('em', { text: ` ${j.power}` })] : [])] : []));
  chainJudgePop = !!j;
}

/** 묶음 안에서 그림 없이 넘기는 칸 중 따로 처리해야 하는 칸: 살림 놓기·방 완성·사은품·단계 상승은 알림·선물이 걸려 있다 */
const skipNeeds = (b: BoxBurst): boolean => b.slot !== undefined || b.roomDone || b.freeBoxes.length > 0 || !!b.care?.tierUp;

/** 그림 없이 넘기는 칸(bs[from..to))을 한꺼번에 처리한다. 칸마다 상자를 만들고 지우고 위치를 재던 것(연쇄 수에 비례, 7만 연쇄에 7초 멈춤·노드 40만)을
 * 대기열을 마지막 칸 기준으로 한 번만 다시 짓는 것으로 바꾼다. 알림·선물이 걸린 칸(skipNeeds)만 기존대로 boom을 거친다 */
function skipBursts(bs: BoxBurst[], from: number, to: number, pointsEl: Element, n: number): void {
  if (to <= from) return;
  dropTapNumber();
  squashAnim?.cancel();
  shownBar = -1;
  if (from === 0) vibrate([18, 30, 40]);
  let big = false;
  let care = false;
  for (let j = from; j < to; j++) {
    const b = bs[j];
    if (b.kind === 'big') big = true;
    if (b.care) care = true;
    if (!skipNeeds(b)) continue;
    if (boxes[0]?.k !== b.k) rebuild(b.k);
    const b0 = boxes[0];
    if (b0) boom(b0, b, pointsEl, true, { j, n, instant: true, skip: true });
  }
  if (big) sfx.boxBurst(1);
  if (care) applyTiers();
  const next = bs[to - 1].k + 1;
  if (boxes[0]?.k !== next) rebuild(next);
}

/** 하나씩 터뜨리는 연쇄의 끝(이 수까지는 한 칸에 한 번씩, 간격 clamp(900/n, 35, 90)ms를 평균으로 뒤로 갈수록 빨라진다) */
const CHAIN_SOLO = 40;
const CHAIN_TICK_MS = 35;
/** 눈에 띄어야 하는 칸의 순위(묶음 안에서 이 칸까지 끊어 제대로 보여 준다). 0이면 평범 */
function chainWeight(b: BoxBurst): number {
  if (b.special === 'gold') return 5;
  if (b.special === 'clock') return 4;
  if (b.special === 'bomb' || b.roomDone) return 3;
  if (b.care?.tierUp) return 2;
  return 0;
}
/** 긴 연쇄(CHAIN_SOLO 초과)의 전체 시간: 40연쇄 1.3초에서 시작해 10배마다 0.4초씩만 늘고 2.4초에서 멈춘다 */
const chainTotalMs = (n: number): number => Math.min(2400, 1300 + 400 * Math.log10(n / CHAIN_SOLO));

/** 연쇄 연출: 40연쇄까지는 하나씩(간격 평균 clamp(900/n, 35, 90)ms, 뒤로 갈수록 빨라짐). 그보다 길면 전체 시간(chainTotalMs)에 맞춰 35ms 틱마다 여러 칸을 묶어 넘기고 뒤로 갈수록 묶음이 커진다(누적 칸 수 ∝ 제곱).
 * 묶음 안 앞 칸들은 그림 없이 상태만 처리(boom reduced + skip)하고, 마지막 칸만 제대로 터뜨린다. 묶음에 특별 상자·방 완성 같은 칸이 있으면 그 칸까지로 묶음을 끊어 그 칸을 보여 준다(끊김은 마지막 틱에서만 시간을 늘리므로 최대 T/8틱까지). 끝나면 보상 표시 */
function playChain(i: HeavyHitInput): void {
  const bs = i.bursts;
  const n = bs.length;
  chainClock = bs.some((b) => b.special === 'clock');
  const grouped = n > CHAIN_SOLO;
  const base = Math.max(35, Math.min(90, 900 / n));
  const ticks = grouped ? Math.max(2, Math.round(chainTotalMs(n) / CHAIN_TICK_MS)) : n;
  const cum = cumGain(i);
  let at = 0;
  let t = 0;
  const step = (): void => {
    const box = boxes[0];
    let cut = at + 1;
    if (chainFast > 0) {
      cut = chainFast <= 1 ? n : Math.min(n, at + Math.ceil((n - at) / chainFast));
      chainFast--;
    } else if (grouped) {
      const last = t >= ticks - 1;
      cut = last ? n : Math.min(n, Math.max(at + 1, Math.round(n * ((t + 1) / ticks) ** 2)));
      if (cut - at > 1 && (!last || t - (ticks - 1) < Math.ceil(ticks / 8))) {
        let best = 0;
        let at2 = cut;
        for (let q = at; q < cut - 1; q++) {
          const w = chainWeight(bs[q]);
          if (w > best) {
            best = w;
            at2 = q + 1;
          }
        }
        cut = at2;
      }
    }
    let crossed = false;
    try {
      if (at === 0) startChain();
      const nt = chainTierOf(cut);
      if (nt > chainTier) {
        chainTier = nt;
        crossed = true;
      }
      if (box) {
        skipBursts(bs, at, cut - 1, i.pointsEl, n);
        const b1 = boxes[0];
        if (b1) boom(b1, bs[cut - 1], i.pointsEl, false, { j: cut - 1, n, sz: cut - at });
      }
      chainBoostPop = crossed && !fx.isReduced();
      chainShow(cut, cum[cut - 1], cum[n - 1], n);
      chainBoostPop = false;
      if (crossed) chainBoost(chainTier);
    } catch (e) {
      chainRun = null;
      chainStep = null;
      chainFast = 0;
      chainHurried = false;
      chainAfter = null;
      fx.headHold(false);
      throw e;
    }
    at = cut;
    t++;
    if (at < n) {
      const hold = bombStopMs;
      bombStopMs = 0;
      chainRun = { timer: window.setTimeout(step, hold + (grouped || chainFast > 0 ? CHAIN_TICK_MS : Math.max(35, base * (1.3 - (0.6 * at) / n)))) };
      return;
    }
    chainRun = null;
    chainStep = null;
    chainFast = 0;
    const hurried = chainHurried;
    chainHurried = false;
    chainEndAt = performance.now();
    if (lastState) syncUnpack(lastState);
    chainEnd(bs, i.prize, i.pointsEl, false, cum[n - 1]);
    if (hurried) {
      // 서둘러 끝낸 연쇄는 뗀 강타가 곧 이어지니, 합계가 보이도록 잠깐 머문다(그동안 chainRun을 잡아 탭·러시가 끼지 않게). 강타가 머무는 중에 오면 chainAfter에 걸린다
      chainRun = {
        timer: window.setTimeout(() => {
          chainRun = null;
          const after = chainAfter;
          chainAfter = null;
          after?.();
        }, CHAIN_FAST_HOLD_MS),
      };
    }
  };
  chainRun = { timer: 0 };
  chainStep = step;
  step();
}

/** 방 안 연쇄 표시 칸: 숫자 / 합계 / 상금 칩이 위에서 아래로 쌓인다. 판정 글자 아래 */
function chainEl(): HTMLElement {
  if (!chainBox) {
    chainBox = el('div', { cls: 'un-chain' }, el('b'), el('i'), el('span', { cls: 'un-chain-judge' }));
    room.append(chainBox);
  }
  return chainBox;
}

/** 상자가 터질 때마다 올라가는 누적 수익: 강타 몫 + 지금까지 터진 상자 몫 */
function cumGain(i: HeavyHitInput): number[] {
  let t = i.gain;
  return i.bursts.map((b) => (t += b.gain));
}

/** 연쇄 줄 팝: 자리 계산(sumLayout)이 정한 만큼만 부푼다 */
function popFrames(e: HTMLElement, scales: number[]): Animation {
  const f = Number(e.dataset.pf ?? 1);
  return fx.pxFrames(e, scales.map((v) => ({ scale: String(Math.round((1 + (v - 1) * f) * 100) / 100) })), 40);
}

/** 연쇄 덩어리 줄(판정·숫자·합계)을 콤보 위젯·피버 칩 자리·방 테두리와 겹치지 않게 놓는다. 줄마다 가운데 → 비는 자리로 밀기 → 한 단계 작은 글자로 같은 순서(판정 줄은 크기 그대로, 안 들어가면 파워 배율을 뺀다). 끝 숫자·끝 자리 기준이라 올라가는 동안 자리는 그대로다(콤보 위젯이 늦게 뜨는 첫 칸만 다시 잰다) */
function sumLayout(box: HTMLElement, sum: HTMLElement, finalText: string, finalN: number, judgeFresh: boolean): void {
  const [b, , judge] = Array.from(box.children) as HTMLElement[];
  b.textContent = `${finalN}연쇄!`;
  sum.textContent = finalText;
  const k = rs();
  const rr = room.getBoundingClientRect();
  const gap = 4 * k;
  const obs = Array.from(document.querySelectorAll<HTMLElement>('.combo, .fever-tag, .rush-tag'))
    .filter((e) => !e.hidden && e.getClientRects().length > 0)
    .map((e) => e.getBoundingClientRect());
  // 피버 칩은 연쇄 도중 늦게 뜨고 폭이 바뀌니, 뜨기 전에도 오른쪽 아래 자리(여백 8·6px, 폭 72·높이 32px)를 비운다
  obs.push(new DOMRect(rr.right - 80 * k, rr.bottom - 38 * k, 72 * k, 32 * k));
  // 러시 칩(피버 칩 바로 위)도 같은 이유로, 러시 중이면 뜨기 전에도 비운다
  if ((lastState && lastState.unpack.rushSec > 0) || chainClock) obs.push(new DOMRect(rr.right - 80 * k, rr.bottom - 76 * k, 72 * k, 34 * k));
  const dodge = (e: HTMLElement, classes: string[], pop: number, shrink?: () => void): void => {
    let dx = 0;
    let pf = 1;
    for (let c = 0; c < classes.length; c++) {
      e.style.translate = '';
      e.className = classes[c];
      let r = e.getBoundingClientRect();
      const span = (q: DOMRect): { lo: number; hi: number } => {
        let lo = rr.left + gap;
        let hi = rr.right - gap;
        const vy = (q.height * (pop - 1)) / 2;
        for (const o of obs) {
          if (q.bottom + vy <= o.top || q.top - vy >= o.bottom) continue;
          if (o.left + o.right < rr.left + rr.right) lo = Math.max(lo, o.right + gap);
          else hi = Math.min(hi, o.left - gap);
        }
        return { lo, hi };
      };
      let { lo, hi } = span(r);
      const last = c === classes.length - 1;
      if (r.width > hi - lo && last && shrink) {
        shrink();
        r = e.getBoundingClientRect();
        ({ lo, hi } = span(r));
      }
      // 팝(최대 pop배)이 이웃을 덮지 않을 만큼만 부푼다: 빈 폭이 모자라면 팝을 줄이고, 절반 아래면 한 단계 작은 글자로
      pf = Math.max(0, Math.min(1, (hi - lo - r.width) / (r.width * (pop - 1))));
      const pad = (r.width * (pop - 1) * pf) / 2;
      const left = Math.max(lo + pad, Math.min(r.left, hi - pad - r.width));
      dx = Math.ceil((left - r.left) / k / 2) * 2 * k;
      if (pf >= 0.5 || (last && r.width <= hi - lo)) break;
    }
    e.dataset.pf = String(pf);
    e.style.translate = dx ? `${dx / k}px 0` : '';
  };
  dodge(b, finalN >= 10 ? ['x3', 'x2', 'x1'] : finalN >= 5 ? ['x2', 'x1'] : ['x1'], 1.4);
  dodge(sum, ['', 'sm'], 1.5);
  if (judgeFresh && judge.textContent) dodge(judge, [judge.className], 1.4, () => judge.querySelector('em')?.remove());
}

/** `N연쇄!` 숫자 + 누적 합계: 바뀔 때마다 steps() 팝. 2~4는 24px, 5~9는 36px, 10 이상은 48px */
function chainShow(n: number, total: number, finalTotal = total, finalN = n): void {
  const box = chainEl();
  window.clearTimeout(chainOff);
  chainPop?.cancel();
  chainSumPop?.cancel();
  chainN = n;
  chainTotal = total;
  box.hidden = false;
  box.style.visibility = 'visible';
  const [b, sum] = Array.from(box.children) as HTMLElement[];
  b.textContent = `${n}연쇄!`;
  b.className = n >= 10 ? 'x3' : n >= 5 ? 'x2' : 'x1';
  sumLayout(box, sum, `+${formatNumber(finalTotal)} P`, finalN, chainJudgePop);
  b.textContent = `${n}연쇄!`;
  sum.textContent = `+${formatNumber(total)} P`;
  if (chainJudgePop) {
    chainJudgePop = false;
    if (!fx.isReduced()) popFrames(box.lastElementChild as HTMLElement, [1.4, 1.2, 1.1, 1]);
  }
  if (!fx.isReduced()) {
    chainPop = popFrames(b, chainBoostPop ? [2, 1.7, 1.4, 1.2, 1.1, 1] : [1.4, 1.2, 1.1, 1]);
    chainSumPop = popFrames(sum, [1.2, 1.1, 1]);
  }
}

/** 상금 칩: 알림 머리글로, 자리가 비면(연쇄가 끝난 0.6초 뒤, 줄 맨 앞) 뜬다 */
function chainPrizeChip(text: string, tier: number, pointsEl: Element, reduced: boolean): void {
  fx.headline(
    'notice',
    (end) => {
      const chip = el('div', { cls: 'un-chain-prize', text });
      chip.style.top = `${Math.max(72, fx.headTop(room, rs()))}px`;
      room.append(chip);
      const fit = fx.fitHead(chip, 'un-chain-prize', [''], room);
      const rm = (): void => {
        chip.remove();
        end();
      };
      if (reduced) {
        window.setTimeout(rm, 800);
        return () => chip.remove();
      }
      const c = boxCenter();
      const f: Keyframe[] = [1.3, 1.15, 1].map((s) => ({ scale: String(Math.min(s, fit)), visibility: 'visible' }));
      for (let i = 0; i < 20; i++) f.push({ scale: '1', visibility: 'visible' });
      for (let i = 0; i < 4; i++) f.push({ scale: '1', visibility: i % 2 ? 'visible' : 'hidden' });
      fx.pxFrames(chip, f, 40).onfinish = rm;
      fx.absorb({ x: c.x, y: c.y }, pointsEl, 6 + tier * 5, { delay: 0.06, offset: { x: 0, y: 0 } });
      fx.confetti(c.x, c.y - 40 * rs(), 14 + tier * 8, { clip: true });
      return () => chip.remove();
    },
    { first: true },
  );
}

/** 연쇄가 끝난 1.5초 뒤: 0.9초 넘게 남은 조각·납작 상자 DOM을 치우고 살아 있는 수를 다시 센다(연쇄 중 settle이 가로채거나 애니메이션이 멈춰 지우지 못한 것). 막 만든 것은 둔다 */
let sweepTimer = 0;
function sweepStage(): void {
  if (chainRun || scene.adv || scene.land) return;
  const now = performance.now();
  for (const e of Array.from(stage.querySelectorAll<HTMLElement>('.un-bit, .un-flat'))) {
    if (now - Number(e.dataset.t ?? 0) > 900) e.remove();
  }
  live = stage.querySelectorAll('.un-bit').length;
}

/** 문턱 돌파: 방 배경 번쩍(흰 → 연노랑 → 노랑 → 주황 → 흰+주황) + 화면 테두리 깜빡 + 네모 고리 + 흔들림 + 한 단계 오른 소리 */
const TIER_FLASH = [[], ['#ffffff'], ['#ffeaa0'], ['#ffc83d'], ['#ff8a1f'], ['#ffffff', '#ff8a1f']];
const TIER_EDGE = ['', '#ffffff', '#ffeaa0', '#ffc83d', '#ff8a1f', '#ff8a1f'];
function chainBoost(t: number): void {
  if (fx.isReduced()) return;
  fx.layerFlash(room, TIER_FLASH[t]);
  fx.edge(room, TIER_EDGE[t], t >= 4 ? [1, 0, 1, 0, 1, 1] : [1, 0, 1, 1, 0]);
  const c = boxCenter();
  const k = rs();
  if (t >= 2) fx.ring(c.x, c.y - 24 * k, [40 * k, 96 * k, 160 * k], [TIER_EDGE[t], TIER_EDGE[t], '#ffffff'], 0.05);
  fx.quake(appEl(), 6 + t * 2, 200);
  sfx.chainTier(t);
  vibrate([20, 20, 30 + t * 10]);
}

/** 끝: 합계 한 줄 + 상금 칩 + 마무리 연출. 0.6초쯤 머문 뒤 깜빡이며 사라진다 */
function chainEnd(bs: BoxBurst[], prize: HeavyHitInput['prize'], pointsEl: Element, reduced: boolean, total: number): void {
  const box = chainEl();
  const sum = box.children[1] as HTMLElement;
  sum.textContent = `+${formatNumber(total)} P`;
  const n = bs.length;
  const tier = prize ? prize.tier + 1 : n >= 10 ? 1 : 0;
  const c = boxCenter();
  if (!reduced) {
    chainSumPop?.cancel();
    chainSumPop = popFrames(sum, [1.5, 1.3, 1.15, 1]);
    sfx.chainEnd(tier);
    fx.shake(document.getElementById('app') ?? room, tier >= 2 ? 8 : 6, tier >= 1 ? 400 : 320);
    if (n >= 10) {
      const k = rs();
      pburst(c.x, c.y - 24 * k, { n: 16 + tier * 4, kind: 'star', colors: ['g2', 'g3', 'k5', 'or'], speed: 520 + tier * 60, gravity: 0, size: 8, ring: true, life: 0.6 });
      pburst(c.x, c.y - 24 * k, { n: 20 + tier * 4, colors: ['g2', 'or', 'k5'], speed: 340 + tier * 40, gravity: 0, size: 6, ring: true, life: 0.5 });
    }
    vibrate([30, 40, 60]);
  }
  // 마침: 연쇄가 길수록(최대 40개) 꼬리 단 금 점이 번 돈 숫자로 날아가 꽂히고 숫자가 눌렸다 튄다
  const dots = reduced ? 0 : fx.finale({ x: c.x, y: c.y }, pointsEl, Math.min(40, 4 + Math.round(Math.log10(n) * 11)));
  if (!dots) fx.absorb({ x: c.x, y: c.y }, pointsEl, Math.min(12, 3 + tier * 3), { delay: 0.06, offset: { x: 0, y: 0 } });
  if (prize) {
    chainPrizeChip(`${CHAIN_PRIZES[prize.tier].n}연쇄 상금 +${formatNumber(prize.gain)} P`, prize.tier, pointsEl, reduced);
  }
  const off = (): void => {
    // 덩어리가 사라지면 붙잡아 둔 알림(상금 칩이 가장 먼저)을 푼다
    const hide = (): void => {
      if (chainRun) return;
      box.hidden = true;
      fx.headHold(false);
    };
    if (reduced) return hide();
    fx.pxFrames(box, Array.from({ length: 4 }, (_, k) => ({ visibility: k % 2 ? 'visible' : 'hidden' })), 40).onfinish = hide;
  };
  chainOff = window.setTimeout(off, 600);
  window.clearTimeout(sweepTimer);
  sweepTimer = window.setTimeout(sweepStage, 1500);
}

const WHITE = 'brightness(0) invert(1)';
let lastHitAt = 0;

/** A1: 40ms 프레임. 0ms에 바로 반응한다 */
function squash(b: BoxEl, i: UnpackHitInput, reduced: boolean): void {
  const now = performance.now();
  const white = i.crit || (!i.damped && now - lastHitAt >= 120);
  lastHitAt = now;
  squashAnim?.cancel();
  const none = 'none';
  let f: Keyframe[];
  if (reduced) f = [{ filter: WHITE }, { filter: none }];
  else if (i.crit) {
    f = [
      { filter: WHITE, translate: '0 6px', scale: '1.12 0.84' },
      { filter: WHITE, translate: '0 6px', scale: '1.12 0.84' },
      { filter: none, translate: '0 -2px', scale: '0.96 1.04' },
      { filter: none, translate: '0 0', scale: '1 1' },
    ];
  } else if (i.damped) f = [{ filter: none, translate: '0 2px', scale: '1 1' }, { filter: none, translate: '0 0', scale: '1 1' }];
  else {
    f = [
      { filter: white ? WHITE : none, translate: '0 4px', scale: '1.06 0.9' },
      { filter: none, translate: '0 -2px', scale: '0.96 1.04' },
      { filter: none, translate: '0 0', scale: '1 1' },
    ];
  }
  squashAnim = fx.pxFrames(b.body, f, 40);
}

/** A1: 내려치고(0ms) 튕기고(40ms) 들어 올리고(80ms) 숨긴다(120ms) */
function swing(half: number): void {
  toolEl.getAnimations().forEach((a) => a.cancel());
  const v = 'visible';
  const x = half < 1 ? -2 : 0;
  fx.pxFrames(
    toolEl,
    [
      { visibility: v, translate: `${x}px -4px` },
      { visibility: v, translate: `${x + 6}px -8px` },
      { visibility: v, translate: `${x - 12}px -14px` },
      { visibility: 'hidden', translate: `${x - 12}px -14px` },
    ],
    40,
  );
}

function bit(cls: string, text?: string): HTMLElement | null {
  if (live >= LIVE_CAP) return null;
  live++;
  const e = el('i', { cls, text });
  e.dataset.t = String(performance.now());
  stage.append(e);
  return e;
}

function stars(b: BoxEl): void {
  const c = boxCenter();
  pburst(c.x, c.y - b.root.offsetWidth * 0.1 * rs(), { n: 4, kind: 'star', colors: ['g2', 'k5'], speed: 150, gravity: 0, size: 8 });
}

/** 골판지 조각(w2·w1·p2 사각)이 맞은 자리에서 포물선으로 튄다 */
function chips(i: UnpackHitInput, n: number): void {
  const c = boxCenter();
  const s = boxes[0].root.offsetWidth * rs();
  const x = Math.max(c.x - s * 0.4, Math.min(c.x + s * 0.4, i.x));
  const y = Math.max(c.y - s * 0.4, Math.min(c.y + s * 0.1, i.y));
  pburst(x, y, { n, kind: 'chip', colors: i.fever ? ['p2', 'w1', 'p1', 'or'] : ['p2', 'w1', 'p1'], speed: i.crit ? 340 : 270, gravity: 900, size: 6, up: true });
}

function toolSwap(prev: ToolDef, next: ToolDef): void {
  const btn = dockToolEl.parentElement;
  const msg = `${josa(next.name, '을', '를')} 손에 넣었어요. 상자가 두 배로 잘 뜯겨요`;
  if (fx.isReduced() || !btn) {
    setTool(dockToolEl, next);
    btn?.setAttribute('data-tool', next.id);
    toast(msg);
    return;
  }
  dockToolEl.style.visibility = 'hidden';
  const old = el('span', { cls: 'un-dock-tool un-tool-out', attrs: { 'aria-hidden': 'true' } }, pxImg(prev.icon));
  btn.append(old);
  const a = old.animate([{ visibility: 'visible', translate: '0 0' }, { visibility: 'hidden', translate: '0 -32px' }], { duration: 250, easing: 'steps(4, end)', fill: 'forwards' });
  a.onfinish = () => old.remove();
  window.setTimeout(() => {
    setTool(dockToolEl, next);
    btn.setAttribute('data-tool', next.id);
    dockToolEl.style.visibility = '';
    dockToolEl.animate([{ translate: '0 -8px' }, { translate: '0 0' }], { duration: 240, easing: 'steps(4, end)' });
    const ring = el('i', { cls: 'un-ring', attrs: { 'aria-hidden': 'true' } });
    btn.append(ring);
    fx.pxFrames(ring, [{ visibility: 'visible' }, { visibility: 'hidden' }, { visibility: 'visible' }, { visibility: 'hidden' }], 83).onfinish = () => ring.remove();
    sfx.newItem();
    vibrate([15, 20, 30]);
  }, 250);
  window.setTimeout(() => toast(msg), 600);
}

/** 큰 상자가 등장할 때: 위에서 떨어져 쾅 */
function dropIn(b: BoxEl): void {
  b.root.animate([{ translate: '0 -190px' }, { translate: '0 0' }], { duration: 250, easing: 'steps(5, end)' });
  window.setTimeout(() => {
    fx.shake(room, 4, 250);
    sfx.slam();
    vibrate([30, 20, 20]);
  }, 250);
}

// ---------- 터짐 장면(A2·A3): 한 번에 하나만 "진행 중"이고, 새 터짐이 오면 정리(settle)한다 ----------
const scene = {
  els: [] as HTMLElement[],
  adv: null as null | { id: number; run: (fast: boolean) => void },
  land: null as null | { id: number; run: (fast: boolean) => void },
  anims: [] as Animation[],
  fin: [] as (() => void)[],
  gain: null as HTMLElement | null,
};

function dustAt(e: Element, n = 4): void {
  const r = e.getBoundingClientRect();
  pburst(r.left + r.width / 2, r.bottom - 4 * rs(), { n, colors: ['p2', 'w2', 'p1'], speed: 90, gravity: 300, size: 4, up: true });
}

/** 이전 터짐을 끝낸다: 예약된 단계는 바로 실행하고, 열린·납작 상자는 먼지와 함께 지운다. 날아가는 조각·살림은 그대로 둔다 */
function settle(): void {
  for (const key of ['adv', 'land'] as const) {
    const p = scene[key];
    if (!p) continue;
    window.clearTimeout(p.id);
    scene[key] = null;
    p.run(true);
  }
  for (const a of scene.anims) a.cancel();
  scene.anims = [];
  for (const f of scene.fin) f();
  scene.fin = [];
  for (const e of scene.els) {
    if (e.isConnected) dustAt(e);
    e.remove();
  }
  scene.els = [];
  scene.gain?.remove();
  scene.gain = null;
}

const g10 = (v: number): number => Math.round(v / 2) * 2;

/** (x0,y0)에서 (x1,y1)로 n프레임 포물선(2px 격자). 첫 프레임은 출발점에서 한 걸음 뒤 */
function arc(x0: number, y0: number, x1: number, y1: number, n: number, h: number): Keyframe[] {
  return Array.from({ length: n }, (_, i) => {
    const p = (i + 1) / n;
    return { translate: `${g10(x0 + (x1 - x0) * p)}px ${g10(y0 + (y1 - y0) * p - 4 * h * p * (1 - p))}px` };
  });
}

/** 손질 별: 지나간 자리에 4px 점이 2프레임 남는다(1프레임·2프레임 늦게 따라오는 점 둘) */
const STAR_COLS = ['cg2', 'cg2', 'cg3'];
function starTail(path: Keyframe[], lag: number, col: string): void {
  const t = bit(`un-bit sd s4 ${col}`);
  if (!t) return;
  t.style.top = '0';
  t.style.visibility = 'hidden';
  const frames: Keyframe[] = Array.from({ length: path.length + lag }, (_, j) =>
    j < lag ? { visibility: 'hidden' } : { visibility: 'visible', translate: path[j - lag].translate },
  );
  frames[path.length + lag - 1] = { visibility: 'hidden' };
  fx.pxFrames(t, frames, 40).onfinish = () => {
    t.remove();
    live--;
  };
}

/** 도착: 살림 둘레에 반짝 십자 4개 */
function sparkCross(to: DOMRect): void {
  const cx = to.left + to.width / 2;
  const cy = to.top + to.height / 2;
  const dx = to.width / 2 + 4 * rs();
  const dy = to.height / 2 + 4 * rs();
  for (const [x, y] of [[cx, cy - dy], [cx, cy + dy], [cx - dx, cy], [cx + dx, cy]]) fx.twinkle(x, y, 'g3', 8 * rs(), 0.12);
}

const stageOrigin = (): DOMRect => stage.getBoundingClientRect();
const GAIN_PX: Record<BoxKind, number> = { small: 24, normal: 30, big: 36 };

/** 터짐 숫자: 상자 윗변 -8px에서 8px 2단계로 오르고 600ms. 이전 숫자는 settle이 지운다 */
function gainText(burst: BoxBurst, s: number, reduced: boolean): void {
  const gold = burst.special === 'gold';
  const fs = gold ? 36 : GAIN_PX[burst.kind];
  const e = el('i', { cls: `un-gain${gold ? ' gold' : ''}`, text: `+${formatNumber(burst.gain)} P` });
  if (gold) e.append(el('em', { text: ` x${GOLD_GAIN_MULT}` }));
  e.style.fontSize = `${fs}px`;
  e.style.lineHeight = `${fs}px`;
  const minTop = (chipsBottom() - stageOrigin().top) / rs() + 4;
  const say = room.querySelector<HTMLElement>('.charge-say, .weak-say');
  // 판정 글자는 가운데 기준으로 커졌다 줄어드니(최대 배율) 부푼 아랫변 + 외곽선 2px + 숫자가 4px 오르는 몫을 비운다
  const peak = say ? Math.max(1, ...say.getAnimations().flatMap((a) => (a.effect as KeyframeEffect).getKeyframes().map((k) => parseFloat(String(k.scale ?? 1))))) : 1;
  const belowSay = say ? (room.getBoundingClientRect().top + (say.offsetTop + say.offsetHeight * (1 + (peak - 1) / 2)) * rs() - stageOrigin().top) / rs() + 12 : -Infinity;
  const belowHead = (fx.headBottom() - stageOrigin().top) / rs() + 12;
  e.style.top = `${g10(Math.max(-s - 8 - fs, minTop, belowSay, belowHead))}px`;
  stage.append(e);
  scene.gain = e;
  const rm = (): void => {
    e.remove();
    if (scene.gain === e) scene.gain = null;
  };
  if (reduced) {
    window.setTimeout(rm, 600);
    return;
  }
  fx.pxFrames(e, [{ translate: '0 0' }, { translate: '0 -2px' }, { translate: '0 -4px' }, { translate: '0 -4px' }, { translate: '0 -4px' }, { translate: '0 -4px', visibility: 'hidden' }], 100).onfinish = rm;
}

/** 맨 앞 특별 상자 둘레의 입자(글자 없이 눈에 띄게): 황금 반짝·폭탄 불꽃·시계 째깍. 160ms마다 한 번, 동시에 3~4개 */
let ambTick = 0;
function ambient(): void {
  const b = boxes[0];
  if (!b?.special || fx.isReduced() || chainRun || document.visibilityState !== 'visible' || !room.getClientRects().length || fx.particleCount() > 60) return;
  const r = b.root.getBoundingClientRect();
  if (r.width === 0) return;
  const t = ambTick++;
  const k = rs();
  const at = (u: number, v: number): { x: number; y: number } => ({ x: r.left + r.width * u, y: r.top + r.height * v });
  if (b.special === 'gold') {
    const p = at(0.2 + Math.random() * 0.6, 0.3 + Math.random() * 0.5);
    fx.twinkle(p.x, p.y, ['g2', 'g3', 'k5'][t % 3], 8 * k, 0.5);
  } else if (b.special === 'bomb') {
    const f = FUSE[b.kind === 'small' ? 'small' : 'normal'];
    const p = at(f.x, f.y);
    fx.burst(p.x, p.y, { n: t % 2 ? 2 : 1, colors: t % 2 ? ['or', 'g2'] : ['g2', 'g3'], speed: 70 * k, gravity: 140 * k, size: 4 * k, up: true, life: 0.4 });
  } else if (t % 3 === 0) {
    const p = at((t / 3) % 2 ? 0.12 : 0.88, 0.25);
    fx.burst(p.x, p.y, { n: 2, colors: ['b3', 'k5', 'b4'], speed: 50 * k, gravity: 0, size: 4 * k, up: true, life: 0.5 });
  }
}

/** 황금(`황금 상자!`)·시계(`자동 연타!`) 상자가 혼자 터질 때 머리글: 노랑 글자 + 남색 외곽선, 부제 없음. 짧게 */
export function goldHead(text = '황금 상자!'): void {
  fx.headline('now', (end) => {
    const t = el('div', { cls: 'un-gold-head', text });
    t.style.top = `${Math.max(72, fx.headTop(room, rs()))}px`;
    room.append(t);
    const fit = fx.fitHead(t, 'un-gold-head', [''], room);
    const rm = (): void => {
      t.remove();
      end();
    };
    const f: Keyframe[] = [1.3, 1.15, 1].map((v) => ({ scale: String(Math.min(v, fit)), visibility: 'visible' }));
    for (let i = 0; i < 12; i++) f.push({ scale: '1', visibility: 'visible' });
    for (let i = 0; i < 4; i++) f.push({ scale: '1', visibility: i % 2 ? 'visible' : 'hidden' });
    fx.pxFrames(t, f, 40).onfinish = rm;
    return () => t.remove();
  });
}

/** 황금·폭탄·시계가 터지는 입자·플래시·흔들림·소리(글자는 부르는 쪽이 정한다). 연쇄 안이면 흔들림·두 번째 고리를 뺀다 */
function specialBurst(sp: SpecialBox, c: { x: number; y: number }, s: number, inChain: boolean, blast: boolean): void {
  const k = rs();
  const y = c.y - s * 0.25 * k;
  const app = document.getElementById('app') ?? room;
  if (sp === 'gold') {
    fx.flash('#ffc83d', 450);
    pburst(c.x, y, { n: 12, kind: 'coin', colors: ['g2', 'g3'], speed: 500, gravity: 700, size: 6, up: true, life: 0.8 });
    pburst(c.x, y, { n: 16, colors: ['g2', 'g3', 'k5'], speed: 520, gravity: 0, size: 8, ring: true, life: 0.55 });
    pburst(c.x, y, { n: 16, colors: ['g2', 'g3', 'k5'], speed: 380, gravity: 500, size: 6, life: 0.7 });
    if (!inChain) window.setTimeout(() => pburst(c.x, y, { n: 12, kind: 'star', colors: ['g3', 'k5'], speed: 300, gravity: 0, size: 8, ring: true, life: 0.5 }), 90);
    sfx.goldBurst();
    return;
  }
  if (sp === 'clock') {
    // 시계: 파랑 테두리 플래시 + 파랑·흰 정사각형이 사방으로(흔들림 없음)
    fx.edge(room, '#5b9bff', [1, 0, 1, 1, 0, 1]);
    pburst(c.x, y, { n: 16, colors: ['b3', 'k5', 'b4'], speed: 520, gravity: 0, size: 8, ring: true, life: 0.55 });
    pburst(c.x, y, { n: 16, colors: ['b2', 'b3', 'k5'], speed: 380, gravity: 400, size: 6, life: 0.7 });
    if (!inChain) window.setTimeout(() => pburst(c.x, y, { n: 12, colors: ['b4', 'k5'], speed: 300, gravity: 0, size: 6, ring: true, life: 0.45 }), 90);
    sfx.clockBurst();
    vibrate([20, 30, 20]);
    return;
  }
  // 폭탄: 흰 테두리 → 0.08초 정지 → 주황·노랑 네모 고리 + 큰 파편 사방으로 + 방 흔들림 + 연기
  fx.edge(room, '#ffffff', [1, 0, 0]);
  fx.edge(room, '#ff8a1f', [0, 1, 1, 0, 1]);
  const stop = !blast && !chainHurried && bombStops < 3 && fx.hitStop(80);
  const go = (): void => {
    if (fx.isReduced()) return;
    const k2 = rs();
    if (!blast) {
      fx.quake(room, 10, 360);
      fx.quake(app, 8, 360);
      fx.layerFlash(room, ['#ffffff', '#ff8a1f']);
      fx.ring(c.x, y, [48 * k2, 104 * k2, 168 * k2], ['#ff8a1f', '#ff8a1f', '#ffc83d'], 0.05);
      fx.ring(c.x, y, [28 * k2, 68 * k2, 120 * k2], ['#ffc83d', '#ffeaa0', '#ffeaa0'], 0.05);
      fx.debris(c.x, y, { n: 28, colors: ['#ff8a1f', '#ffc83d', '#16224a', '#8a4f24', '#ffffff'], size: 8 * k2, speed: 560 * k2, gravity: 900 * k2, floor: debrisFloor(), cap: 280, up: false, life: 1 });
      fx.smoke(c.x, y - 12 * k2, { n: 10, size: 8 * k2 });
    }
    pburst(c.x, y, { n: 16, colors: ['or', 'g2', 'k1'], speed: 560, gravity: 0, size: 8, ring: true, life: 0.5 });
    pburst(c.x, y, { n: 16, colors: ['or', 'g2', 'k1', 'g3'], speed: 420, gravity: 300, size: 6, life: 0.7 });
    if (!inChain) window.setTimeout(() => pburst(c.x, y, { n: 12, colors: ['g2', 'g3', 'or'], speed: 300, gravity: 0, size: 6, ring: true, life: 0.45 }), 80);
    sfx.bombBlast();
    vibrate([40, 30, 70]);
  };
  if (stop) {
    bombStops++;
    bombStopMs = 80;
    window.setTimeout(go, 80);
  } else go();
}

/** 까지는 상자의 파편: 상자 색 네모 조각이 위로 튀어 바닥에서 한 번 튄다. 연쇄 단계가 오를수록 칸마다 더 많이, 화면에 더 많이 떠 있는다(전체 상한은 fx.DEBRIS_CAP) */
const SHARD_N = [5, 7, 9, 11, 14, 18];
function boxShards(burst: BoxBurst, c: { x: number; y: number }, s: number, chain?: ChainMeta): void {
  const k = rs();
  const tier = chain ? chainTier : 0;
  const n = chain ? SHARD_N[tier] + Math.min(8, Math.floor((chain.sz ?? 1) / 6)) : 8;
  const cols = SHARD_COLS[burst.special ?? 'normal'];
  const y = c.y - s * 0.28 * k;
  const floor = debrisFloor();
  fx.debris(c.x, y, { n, colors: cols, size: 6 * k, speed: (280 + tier * 40) * k, gravity: 1100 * k, floor, cap: fx.DEBRIS_CAP[tier] });
  if (burst.special === 'gold') fx.twinkle(c.x + (Math.random() - 0.5) * s * k * 0.6, y - 8 * k, '#ffeaa0', 8 * k, 0.3);
  if (!chain || chain.j % 2 === 0) pburst(c.x, (floor ?? c.y) - 4 * k, { n: 3, colors: ['p2', 'w2', 'p1'], speed: 100, gravity: 260, size: 4, up: true });
}

function boom(b: BoxEl, burst: BoxBurst, pointsEl: Element, reduced: boolean, chain?: ChainMeta): void {
  settle();
  dropTapNumber();
  const s = boxPx(b.kind);
  const c = boxCenter();
  const big = burst.kind === 'big';
  const old = boxes.shift()!;
  squashAnim?.cancel();
  // 로직은 이미 다음 상자: 대기열을 채운다(새 상자는 240ms에 나타난다)
  const oldK = burst.k;
  const newK = burst.k + 1;
  const want = 1 + waitCount(newK);
  const fresh: BoxEl[] = [];
  while (boxes.length < want) {
    const nb = makeBox(newK + boxes.length, boxes.length);
    nb.root.style.visibility = 'hidden';
    stage.prepend(nb.root);
    boxes.push(nb);
    fresh.push(nb);
  }
  const mover = boxes[0];
  const moverStart = { x: parseFloat(mover.root.style.getPropertyValue('--wx')) || 0, y: ONE_ROOM.box.wait[0].dy * DOT };
  setStageVar();
  shownBar = -1;
  if (big) sfx.boxBurst(1);
  else if (!chain) sfx.parcelCatch();
  if (chain && !reduced && !chain.instant) sfx.chainStep(chain.j);

  const slot = burst.slot;
  const item = big && slot !== undefined ? ROOM_ITEMS[slot] : null;
  const careSlot = slot === undefined ? burst.care?.slot : undefined;
  if (burst.care) tierHold.set(burst.care.slot, (tierHold.get(burst.care.slot) ?? 0) + 1);
  if (slot !== undefined) held.set(slot, (held.get(slot) ?? 0) + 1);
  const release = (landing: boolean): void => {
    if (slot === undefined) return;
    const n = (held.get(slot) ?? 1) - 1;
    if (n <= 0) held.delete(slot);
    else held.set(slot, n);
    applySlots();
    if (reduced) return;
    const sr = slots[slot].root.getBoundingClientRect();
    if (landing) {
      fx.pxFrames(slots[slot].root, [{ translate: '0 -6px' }, { translate: '0 0' }, { translate: '0 -2px' }, { translate: '0 0' }], 40);
      pburst(sr.left + sr.width / 2, sr.bottom - 4 * rs(), { n: 4, colors: ['p2', 'p1', 'w2'], speed: 90, gravity: 300, size: 4, up: true });
    }
    fx.twinkle(sr.left + sr.width * 0.75, sr.top + sr.height * 0.2, 'g3', 8 * rs(), 0.04);
  };

  if (!chain && burst.special === 'gold' && !reduced) goldHead();
  if (!chain && burst.special === 'clock' && !reduced) goldHead('자동 연타!');
  if (!chain) gainText(burst, s, reduced);
  if (burst.special && !reduced) specialBurst(burst.special, c, s, !!chain, burst.blast);
  if (!chain?.skip) fx.absorb({ x: c.x, y: c.y }, pointsEl, burst.special === 'gold' ? (chain ? 4 : 10) : chain ? 1 + Math.min(3, Math.floor((chain.sz ?? 1) / 12)) : 3, { delay: 0.04, offset: { x: 0, y: 0 } });
  if (!chain || chain.j === 0) vibrate([18, 30, 40]);
  if (chain && !reduced && !chain.instant) {
    const now = performance.now();
    if (chainTier === 0 ? chain.j % 3 === 2 : now - lastQuakeAt > 70) {
      lastQuakeAt = now;
      fx.quake(appEl(), QUAKE_AMP[chainTier], 160);
    }
  }
  if (!reduced) boxShards(burst, c, s, chain);
  if (chain && !reduced && !chain.instant) swing(1);
  if (burst.roomDone) roomDone();
  if (burst.freeBoxes.length >= 2) {
    window.setTimeout(() => fx.banner('사은품 상자 도착!', { sub: `${burst.freeBoxes.length - 1}개 더 와요`, tone: 'gold', ms: 1000 }), burst.roomDone ? 1900 : 150);
  }
  burst.freeBoxes.forEach((f, i) => {
    const roomGift = burst.roomDone && i === 0;
    const title = roomGift ? `${lastState ? houseInfo(lastState.moves).name : '방'} 완성 선물` : burst.care ? `${ROOM_ITEMS[burst.care.slot].name} ${TIER_GIFT[Math.min(tierOf(burst.care.lv), 4)]} 선물` : undefined;
    const onClose = roomGift ? (): void => void window.setTimeout(() => toast('이제 살림을 손질해요'), 300) : undefined;
    giftSoon(f, roomGift ? 3000 : 1200 + i * 3000, { title, onClose }, 0);
  });

  const pileDec = newK < ROOM_BOXES && pileCount(newK) < pileCount(oldK);
  const hop = pileDec ? pileEls[pileCount(oldK) - 1] : null;

  if (reduced) {
    old.root.remove();
    layoutWait();
    boxes.forEach((nb, i) => {
      nb.root.style.visibility = '';
      setBoxPos(nb, i);
    });
    syncPile(newK);
    if (item && !burst.care?.tierUp) toast(`${josa(item.name, '을', '를')} 놓았어요`);
    release(true);
    careLand(burst, true, false);
    return;
  }

  // 0ms: 흰 1프레임 + 아래 4px, 40ms: 열린 상자 그림 + 위로 4px
  const openImg = pxImg(openArt(old.kind, old.special), 'un-box-img open');
  old.body.append(openImg);
  const closed = Array.from(old.body.querySelectorAll<HTMLElement>('.un-box-img.on'));
  fx.pxFrames(openImg, [{ visibility: 'hidden' }, { visibility: 'visible' }], 40, { fill: 'forwards' });
  for (const im of closed) fx.pxFrames(im, [{ visibility: 'visible' }, { visibility: 'hidden' }], 40, { fill: 'forwards' });
  fx.pxFrames(old.body, [{ filter: WHITE, translate: '0 4px' }, { filter: 'none', translate: '0 -4px' }, { filter: 'none', translate: '0 0' }], 40);
  scene.els.push(old.root);
  window.setTimeout(() => {
    if (!old.root.isConnected) return;
    lids(c, s);
    if (!chain || chain.j % 2 === 0 || chain.j === chain.n - 1) {
      fluff(c, s);
      planks(c, s);
    }
  }, 40);

  // 40~240ms: 조각 줄이 칸으로(작은·보통) / 살림이 솟아 칸으로(큰 상자)
  const st0 = (): { x: number; y: number } => ({ x: 0, y: -s * 0.6 });
  if ((slot !== undefined && !item) || careSlot !== undefined) {
    const target = (slot ?? careSlot)!;
    const care = careSlot !== undefined;
    const N = care ? 6 : 3;
    for (let n = 0; n < N; n++) {
      window.setTimeout(() => {
        const col = STAR_COLS[n % STAR_COLS.length];
        const p = bit(care ? `un-bit sd ${n % 2 ? 's4' : 's6'} ${col}` : 'un-bit sq');
        if (!p) {
          if (care && n === N - 1) careLand(burst, false, true);
          return;
        }
        const o = stageOrigin();
        const to = slots[target].root.getBoundingClientRect();
        const a = st0();
        if (care) a.y = -s * 0.3;
        if (care && scene.gain?.isConnected) a.y = Math.max(a.y, (scene.gain.getBoundingClientRect().bottom - o.top) / rs() + 12);
        const tx = (to.left + to.width / 2 - o.left) / rs();
        const ty = (to.top + to.height * 0.5 - o.top) / rs();
        p.style.top = '0';
        const path = arc(a.x, a.y, tx, ty, care ? 11 : 7, care ? 12 : 28);
        if (care) for (const lag of [1, 2]) starTail(path, lag, col);
        fx.pxFrames(p, path, 40, { fill: 'forwards' }).onfinish = () => {
          p.remove();
          live--;
          if (care) {
            if (n === N - 1) {
              careLand(burst, false, true);
              sparkCross(to);
            } else fx.twinkle(to.left + to.width * 0.5, to.top + to.height * 0.3, 'g3', 8 * rs(), 0.04);
          } else if (n === 0) release(false);
          else fx.twinkle(to.left + to.width * 0.5, to.top + to.height * 0.3, 'g3', 8 * rs(), 0.04);
        };
      }, 40 + n * (care ? 60 : 120));
    }
  } else if (item) {
    const d = dim(item.image);
    const w = d.w * DOT;
    const h = d.h * DOT;
    window.setTimeout(() => {
      const p = bit('un-bit item');
      if (!p) {
        release(true);
        return;
      }
      p.style.backgroundImage = `url(${artUrl(burst.care ? tierArt(slot!, burst.care.lv) : item.image)})`;
      p.style.width = `${w}px`;
      p.style.height = `${h}px`;
      p.style.left = `${-w / 2}px`;
      p.style.marginTop = `${-h / 2}px`;
      p.style.top = '0';
      p.style.zIndex = '2';
      // 방 안쪽(좌우 8px 여백, 위는 칩 줄 아래)에 머문다. 솟는 자리는 터짐 숫자 옆(칸이 있는 쪽)이라 숫자와 겹치지 않는다
      const o0 = stageOrigin();
      const rr = room.getBoundingClientRect();
      const minX = (rr.left - o0.left) / rs() + 8 + w / 2;
      const maxX = (rr.right - o0.left) / rs() - 8 - w / 2;
      const minY = (chipsBottom() - o0.top) / rs() + 4 + h / 2;
      const to0 = slots[slot!].root.getBoundingClientRect();
      const tx = Math.max(minX, Math.min(maxX, (to0.left + to0.width / 2 - o0.left) / rs()));
      const side = tx < 0 ? -1 : 1;
      const hx = Math.max(minX, Math.min(maxX, side * ((scene.gain?.offsetWidth ?? 150) / 2 + 8 + w / 2)));
      const y0 = -s * 0.5 - h / 2;
      const y1 = Math.max(-s - 8 - h / 2, minY);
      const rise = Array.from({ length: 5 }, (_, i) => ({ translate: `${g10((hx * (i + 1)) / 5)}px ${g10(y0 + ((y1 - y0) * (i + 1)) / 5)}px` }));
      fx.pxFrames(p, rise, 40, { fill: 'forwards' });
      window.setTimeout(() => {
        p.style.zIndex = '5';
        const o = stageOrigin();
        fx.confetti(o.left + hx * rs(), o.top + y1 * rs(), 12);
      }, 240 - 40);
      window.setTimeout(() => {
        const o = stageOrigin();
        const to = slots[slot!].root.getBoundingClientRect();
        const ty = (to.top + to.height / 2 - o.top) / rs();
        const peak = Math.max(0, Math.min(48, (y1 + ty) / 2 - minY));
        fx.pxFrames(p, arc(hx, y1, tx, ty, 9, peak), 40, { fill: 'forwards' }).onfinish = () => {
          p.remove();
          live--;
          release(true);
          if (burst.care?.tierUp) careLand(burst, false, true, true);
          else {
            toast(`${josa(item.name, '을', '를')} 놓았어요`);
            careLand(burst, false, (burst.care?.lv ?? 0) > 1, true);
          }
        };
      }, 440 - 40);
    }, 40);
  }

  // 240ms: 납작 상자, 다음 상자 출발, 새 대기 상자 등장
  const adv = (fast: boolean): void => {
    scene.els = scene.els.filter((e) => e !== old.root);
    old.root.remove();
    const flat = el('div', { cls: 'un-flat' }, pxImg('box/flat'));
    flat.dataset.t = String(performance.now());
    stage.append(flat);
    scene.els.push(flat);
    // 연쇄 중(다음 칸이 곧 와서 서둘러 넘어오는 경우)에도 대기 상자가 당겨져 들어오고 먼지가 난다
    const pull = fast && !!chain && !chain.instant && !chain.skip;
    if (!fast || (pull && chain.j % 2 === 0)) dustAt(flat);
    layoutWait();
    const bigMover = mover.kind === 'big';
    boxes.forEach((nb, i) => {
      if (i === 0) {
        if (bigMover) {
          nb.root.style.visibility = 'hidden';
          setBoxPos(nb, 0);
        } else if (fresh.includes(nb)) {
          nb.root.style.visibility = '';
          if (!fast) fx.pxFrames(nb.root, slideIn(), 40);
          else if (pull) scene.anims.push(fx.pxFrames(nb.root, [{ translate: '110px 0' }, { translate: '36px 0' }], 40));
        } else {
          nb.root.classList.add('jump');
          setBoxPos(nb, 0);
          if (!fast || pull) {
            const fr = (pull ? [2, 3] : [1, 2, 3]).map((k) => {
              const p = k / 4;
              return { translate: `${g10(moverStart.x * (1 - p))}px ${g10(moverStart.y * (1 - p) - 32 * p * (1 - p))}px` };
            });
            fr.push({ translate: '0 2px' });
            scene.anims.push(fx.pxFrames(nb.root, fr, 40));
          }
          scene.fin.push(() => nb.root.classList.remove('jump'));
          window.setTimeout(() => nb.root.classList.remove('jump'), 300);
        }
        return;
      }
      setBoxPos(nb, i);
      if (pull && !fresh.includes(nb)) scene.anims.push(fx.pxFrames(nb.root, [{ translate: '18px 0' }, { translate: '6px 0' }], 40));
      if (!fresh.includes(nb)) return;
      nb.root.style.visibility = '';
      if (newK >= ROOM_BOXES) {
        if (!fast) fx.pxFrames(nb.root, slideIn(), 40);
      } else if (hop && i === boxes.length - 1) {
        if (!fast) {
          const wx = parseFloat(nb.root.style.getPropertyValue('--wx')) || 0;
          const wy = ONE_ROOM.box.wait[0].dy * DOT;
          const pc = PILE[pileCount(oldK) - 1];
          const px0 = (pc.c - ONE_ROOM.box.x) * DOT;
          const py0 = (pc.b - ONE_ROOM.box.y) * DOT;
          const fr = Array.from({ length: 5 }, (_, k) => {
            const p = k / 5;
            return { visibility: 'visible', translate: `${g10((wx - px0) * p)}px ${g10((wy - py0) * p - 16 * 4 * p * (1 - p))}px` };
          });
          scene.anims.push(fx.pxFrames(hop, fr, 40));
          scene.anims.push(fx.pxFrames(nb.root, [{ visibility: 'hidden' }], 200));
        }
      } else if (!fast) nb.root.animate([{ translate: '0 8px' }, { translate: '0 0' }], { duration: 240, easing: 'steps(2, end)' });
    });
    syncPile(newK);
    if (fresh.length) setStageVar();
    if (!scene.land) scene.land = { id: window.setTimeout(() => runLand(false), 400 - 240), run: runLand };
  };
  // 400ms: 큰 상자는 위에서 떨어져 등장, 납작 상자는 2프레임 깜빡 후 제거(480)
  const runLand = (fast: boolean): void => {
    scene.land = null;
    if (mover.kind === 'big') {
      mover.root.style.visibility = '';
      if (!fast) dropIn(mover);
    }
    const flat = scene.els.find((e) => e.classList.contains('un-flat'));
    if (flat && !fast) {
      fx.pxFrames(flat, [{ visibility: 'hidden' }, { visibility: 'visible' }], 40).onfinish = () => {
        flat.remove();
        scene.els = scene.els.filter((e) => e !== flat);
      };
    }
  };
  scene.adv = {
    id: window.setTimeout(() => {
      scene.adv = null;
      adv(false);
    }, 240),
    run: adv,
  };
}

/** 사은품 장면이 떠 있으면 1초 뒤 다시 시도(최대 20번, 연쇄 중 기다림은 세지 않음). 끝내 못 띄우면 닫힘 뒤 할 일을 바로 한다 */
function giftSoon(f: Parameters<typeof playFree>[0], ms: number, o: Parameters<typeof playFree>[1], tries: number): void {
  window.setTimeout(() => {
    // 연쇄가 도는 동안과 끝난 직후엔 장면을 띄우지 않고 기다린다(압축된 긴 연쇄에서 사은품 장면이 연쇄 숫자·합계를 덮지 않게)
    if (chainRun || performance.now() - chainEndAt < 1600) return giftSoon(f, 300, o, tries);
    if (playFree(f, o)) return;
    if (tries >= 20) o?.onClose?.();
    else giftSoon(f, 1000, o, tries + 1);
  }, ms);
}

function slideIn(): Keyframe[] {
  return [220, 184, 148, 110, 74, 36].map((x) => ({ translate: `${x}px 0` }));
}

function roomDone(): void {
  window.setTimeout(() => {
    // 노란 테두리: 끊기지 않게 100ms 간격으로 2.4초
    fx.pxFrames(glint, Array.from({ length: 24 }, (_, i) => ({ visibility: i % 2 ? 'hidden' : 'visible' })), 100, { fill: 'forwards' }).onfinish = () => {
      glint.style.visibility = 'hidden';
    };
    const gr = glint.getBoundingClientRect();
    fx.confetti(gr.left + gr.width / 2, gr.top + gr.height * 0.5, 30);
    fx.rain(20, undefined, { clip: true });
    sfx.reward();
    doneBanner();
    // 살림 8점이 차례로 반짝
    slots.forEach((sl, i) => {
      window.setTimeout(() => {
        const r = sl.root.getBoundingClientRect();
        fx.pxFrames(sl.root, [{ translate: '0 -6px', filter: WHITE }, { translate: '0 0', filter: 'none' }, { translate: '0 -2px', filter: 'none' }, { translate: '0 0', filter: 'none' }], 40);
        fx.twinkle(r.left + r.width * 0.5, r.top + r.height * 0.25, 'g3', 12 * rs(), 0.1);
        fx.twinkle(r.left + r.width * 0.8, r.top + r.height * 0.6, 'k5', 8 * rs(), 0.1);
      }, 150 + i * 160);
    });
  }, 800);
  const houseName = lastState ? houseInfo(lastState.moves).name : '방';
  window.setTimeout(() => toast(`${houseName} 정리 끝. 사은품 상자를 받았어요`, true), 1000);
}

/** 방 안 큰 글자 `방 완성!`: 배너 자리 규칙(fx.banner)을 따른다 */
function doneBanner(): void {
  fx.banner('방 완성!', { tone: 'gold', ms: 1600 });
}

/** 40ms: 뚜껑 조각 4개(좌우 위로) */
function lids(c: { x: number; y: number }, s: number): void {
  for (const side of [-1, 1]) pburst(c.x + side * s * 0.25 * rs(), c.y - s * 0.4 * rs(), { n: 2, kind: 'chip', colors: ['p2', 'w1'], speed: 300, gravity: 900, size: 8, up: true });
}

/** 40ms: 완충재 8개 */
function fluff(c: { x: number; y: number }, s: number): void {
  pburst(c.x, c.y - s * 0.15 * rs(), { n: 8, colors: ['p1', 'p2', 'k5'], speed: 280, gravity: 800, size: 6, up: true });
}

/** 40ms: 판자 조각 12개(6~8px 정사각, k0 1px 테두리, 크림·나무 면) */
function planks(c: { x: number; y: number }, s: number): void {
  pburst(c.x, c.y - s * 0.3 * rs(), { n: 12, kind: 'chip', colors: ['p1', 'p2', 'w1'], speed: 340, gravity: 900, size: 7, up: true, life: 0.7 });
}
