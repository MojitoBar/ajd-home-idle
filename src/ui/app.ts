import './px/palette.css';
import './px/fonts.css';
import './style.css';
import './px/kit.css';
import './m2.css';
import './m3.css';
import './m4.css';
import './m5.css';
import './col.css';
import './m6-desktop.css';
import './m10-mobile.css';
import './m7-scenes.css';
import './m8-unpack.css';
import './m9-unlock.css';
import './m11-charge.css';
import './m12-weak.css';
import './guide.css';
import './px/room.css';
import { TAP_MILESTONES } from '../data/tap';
import { HOUSES, MOON_STAGE } from '../data/houses';
import {
  buyStrikeUpgrade,
  buyTapUpgrade,
  multBreakdown,
  permMult,
  milestoneMult,
  nextMilestone,
  strikeCost,
  tapCost,
  strikeMult,
  tapGate,
  initialTapGate,
  type TapGateState,
  tapValue,
  tick,
} from '../logic/economy';
import type { SpecialBox } from '../data/unpack';
import { heavyHit, rollSalt, rushTap, specialAt, tapAndHit, type BoxBurst } from '../logic/unpack';
import { featureOpen, finishedGuide, guideAt, guideEnded, guideEvent, GUIDE_STEPS, type GuideEvent, type GuideFeature, type GuideResult } from '../logic/guide';
import { ROOM_ITEMS, RUSH_RATE } from '../data/unpack';
import { addEarned, comboAdd, comboBonus, comboExpired, comboHit, comboMultOf, comboTier, comboWindowMs, initialCombo, type ComboState } from '../logic/combo';
import * as comboUi from './comboUi';
import * as chargeUi from './chargeUi';
import * as weakUi from './weakUi';
import { movePerkBoxes, perkEffects } from '../logic/perks';
import { buyGear, gearEffects, gearLevel, initialShield, resolveStreak, type ShieldState } from '../logic/gear';
import { streakMult } from '../logic/charge';
import { createGearCards, GEAR_ICON, syncGearCards, type GearCard } from './gearUi';
import { gearDef, type GearId } from '../data/gear';
import { advanceWeak, hitWeak, initialWeak, weakVisible, type WeakState } from '../logic/weak';
import { chargeTaps, chargeZoneAt, releaseCharge, rollChargeZone, type ChargeZone, CHARGE_ZONE_DEFAULT } from '../logic/charge';
import { advanceHeat, heatAdd, heatDamped, heatStrikeMult, heatTap, heatTapMult, heatZone, HEAT_WEAK, initialHeat, ventHeat, type HeatAdd, type HeatState } from '../logic/heat';
import * as heatUi from './heatUi';
import * as guideFx from './guideFx';
import { formatNumber } from '../logic/format';
import { applyOffline } from '../logic/offline';
import { houseInfo, move, moveProgress, moveStatus, permMultAfterMove } from '../logic/prestige';
import { exportString, importString, parseSave, serialize } from '../logic/save';
import type { GameState } from '../logic/state';
import { defaultState } from '../logic/state';
import { houseIcon, iconImg, preloadIcons, setLabel, type IconName } from './icons';
import { desktopMq, el, glyph, openModal, setDisabled, setText, toggleClass } from './dom';
import { initKeys } from './keys';
import { clearSave, readSave, writeBackup, writeSave } from './storage';
import * as fx from './fx';
import { sfx } from './sound';
import { getPrefs, hapticsSupported, setPrefs, vibrate } from './prefs';
import { boxAnchor, boxCenter, chainVisible, dockToolEl, initUnpack, makeToolEl, roomStrip, syncUnpack, chainInfo, chainPlaying, unpackHeavy, unpackHit, unpackRush } from './unpackUi';
import { textBoxes } from './clutter';
import { fresh, markFresh, type UiCtx } from './collectUi';
import { row as guideRow, syncGuide } from './guideUi';
import { initGuidePoint, syncGuidePoint } from './guidePoint';
import { canBuyBox, canBuyPerkBoxUi, initBox, openBtn as boxOpenBtn, perkBuyBtn, panel as boxPanel, playGifts, updateBox } from './box';
import { initDex, panel as dexPanel, renderDex, updateDex } from './dex';
import { badge as feverBadge, gauge as feverGauge, initFever, syncFever } from './feverUi';
import { initRush, syncRush } from './rushUi';
import { initParcel, syncParcel } from './parcelUi';
import { dropTapNumber, tapEffect } from './tapFx';
import * as strat from './strategyUi';
import { homePanel, syncHome } from './homeUi';
import { clearNewTabDot, hasNewTabDot, initUnlock, markTabDot, syncUnlock, tabOpen } from './unlockUi';

preloadIcons();

type TabId = 'tap' | 'home' | 'box' | 'dex';

let state: GameState = defaultState();
let activeTab: TabId = 'tap';
let tapGateState: TapGateState = initialTapGate();
let closeModal: (() => void) | null = null;
let moving = false;
let snapNext = true;
let pendingReward = 0;
let combo: ComboState = initialCombo();
/** 이 콤보가 시작될 때의 최고 기록(정산 때 넘겼는지 가리는 기준) */
let comboBest0 = 0;
/** 연속 퍼펙트 수(저장하지 않는 실행 중 상태) */
let chargeStreak = 0;
/** 안전모 실드(저장하지 않음). 불러오기·이사 때 가득 찬다. shieldMax는 마지막으로 맞춘 칸 수 */
let shield: ShieldState = initialShield(0);
let shieldMax = 0;
/** 지금 게이지에 그린 퍼펙트 반폭(수평계가 바뀌면 구간을 새 폭으로 다시 그린다) */
let zoneHalf = -1;
let chargeTipDone = false;
let weak: WeakState = initialWeak(Math.random);
let lastTapMs = 0;
let weakTipDone = false;
/** 디버그: 가이드를 시험하는 중인가(?debug&guide 또는 __ajd.guide). 아니면 디버그 상태는 가이드 완료로 넣는다 */
const debugMode = location.search.includes('debug');
let guideDebug = debugMode && new URLSearchParams(location.search).has('guide');
const asDebug = (s: GameState): GameState => (debugMode && !guideDebug ? { ...s, guide: finishedGuide() } : s);
let guideTickAcc = 0;
/** 디버그: 급소가 저절로 뜨지 않게(기본 꺼짐, __ajd.weakAuto(true)로 켠다) / 띄운 급소의 시간을 멈춘다 */
let weakAuto = !location.search.includes('debug');
let weakPin = false;
/** 열기·이번 스윙의 정타 구간(저장하지 않음). 디버그에서는 열기가 오르지 않고 구간이 고정(기본 꺼짐, __ajd.heatAuto/zoneAuto(true)로 켠다) */
let heat: HeatState = initialHeat();
let chargeZone: ChargeZone = CHARGE_ZONE_DEFAULT;
let heatTipPending = false;
let heatAuto = !location.search.includes('debug');
let zoneAuto = !location.search.includes('debug');
let lastReady: boolean | null = null;
const lastPointer = { x: 195, y: 420 };
window.addEventListener('pointerdown', (e) => {
  lastPointer.x = e.clientX;
  lastPointer.y = e.clientY;
}, { capture: true, passive: true });

const refs = {
  topIco: el('span', { cls: 'top-ico' }),
  houseName: el('span', { cls: 'house-name' }),
  badgeVal: el('span', { cls: 'badge-val' }),
  badge: el('button', { cls: 'badge', attrs: { type: 'button', 'aria-label': '배율 내역' } }),
  speedVal: el('span'),
  speed: el('div', { cls: 'speed-num' }),
  points: el('div', { cls: 'points' }),
  ptsMain: el('span', { cls: 'pts-main' }),
  ptsRate: el('span', { cls: 'pts-rate' }),
  room: el('div', { cls: 'room' }),
  phone: el('button', { cls: 'phone', attrs: { 'aria-label': '상담 전화 받기' } }),
  miniPhone: el('button', { cls: 'dock-phone', attrs: { 'aria-label': '상담 전화 받기(독 버튼)' } }, dockToolEl),
  dockPts: el('span', { cls: 'dock-pts-main' }),
  dockRate: el('span', { cls: 'dock-pts-rate' }),
  tapHint: el('div', { cls: 'tap-hint' }),
  tip: el('div', { cls: 'first-tip', attrs: { hidden: '', 'aria-hidden': 'true' } }, el('span', { cls: 'first-tip-t' }), el('i', { cls: 'first-tip-tail' })),
  barFill: el('div', { cls: 'bar-fill' }),
  barText: el('div', { cls: 'bar-text' }),
  moveBtn: el('button', { cls: 'btn primary move-btn', text: '이사' }),
  panel: el('main', { cls: 'panel' }),
  toast: el('div', { cls: 'toasts', attrs: { 'aria-live': 'polite' } }),
};

const rollBadge = fx.roller(refs.badgeVal, (v) => `x${formatNumber(v)}`, { flashRatio: 1.2, flashMin: 0.5 });
const rollSpeed = fx.roller(refs.speedVal, formatNumber, { flashRatio: 1.5, flashMin: 0.4 });
/** 포인트가 모이는 목표: 모바일은 독의 포인트, PC는 왼쪽 단 머리 */
function ptsTarget(): Element {
  return refs.dockPts.getBoundingClientRect().width > 0 ? refs.dockPts : refs.ptsMain;
}
const rollPoints = fx.roller(refs.ptsMain, (v) => `${formatNumber(v)} P`, { flashRatio: 1.6, flashMin: 100 });
const rollRate = fx.roller(refs.ptsRate, (v) => `+${formatNumber(v)}/초`);
const rollDockPts = fx.roller(refs.dockPts, (v) => `${formatNumber(v)} P`, { flashRatio: 1.6, flashMin: 100 });
const rollDockRate = fx.roller(refs.dockRate, (v) => `+${formatNumber(v)}/초`);
let barKey = '';
let barOpts: string[] = [];
/** 이사 줄 글자는 폭이 모자라면 짧은 문구로 단계적으로 줄인다 */
function fitBarText(): void {
  const t = refs.barText;
  for (const o of barOpts) {
    t.textContent = o;
    if (t.scrollWidth <= t.clientWidth) return;
  }
}
/** 방향 조사: 받침 없음·ㄹ받침은 '로', 그 밖의 받침은 '으로' */
function withRo(name: string): string {
  const c = name.charCodeAt(name.length - 1) - 0xac00;
  if (c < 0 || c > 11171) return '로';
  const jong = c % 28;
  return jong === 0 || jong === 8 ? '로' : '으로';
}
function setBarOptions(opts: string[]): void {
  const key = opts.join('\n');
  if (key === barKey) return;
  barKey = key;
  barOpts = opts;
  fitBarText();
}
new ResizeObserver(fitBarText).observe(refs.barText);
/** 집 이름이 아이콘 때문에 잘릴 때만 머리 집 아이콘을 숨긴다 */
function fitHead(): void {
  const top = refs.houseName.parentElement;
  if (!top) return;
  top.classList.remove('no-ico');
  if (refs.houseName.scrollWidth > refs.houseName.clientWidth) top.classList.add('no-ico');
}
new ResizeObserver(fitHead).observe(refs.houseName);

const tabBtns = new Map<TabId, HTMLButtonElement>();
const tabDots = new Map<TabId, HTMLElement>();
const multBtn = el('button', { cls: 'info-btn', attrs: { type: 'button', 'aria-label': '배율 내역 보기', title: '배율 내역 보기' } });
const tapPanel = el('div', { cls: 'panel-inner' });
const tapRefs = {
  lv: el('div', { cls: 'card-lv' }),
  info: el('div', { cls: 'card-info key' }),
  next: el('div', { cls: 'card-info dim' }),
  msLabel: el('span', { cls: 'ms-label' }),
  msFill: el('div', { cls: 'ms-fill' }),
  buyHead: el('span', { cls: 'buy-h' }),
  buyPrice: el('span', { cls: 'buy-p fb' }),
};
const tapBtn = el('button', { cls: 'btn buy fb' }, tapRefs.buyHead, tapRefs.buyPrice);
const strikeRefs = {
  lv: el('div', { cls: 'card-lv' }),
  info: el('div', { cls: 'card-info key' }),
  best: el('div', { cls: 'card-info dim' }),
  buyHead: el('span', { cls: 'buy-h' }),
  buyPrice: el('span', { cls: 'buy-p fb' }),
};
const strikeBtn = el('button', { cls: 'btn buy fb' }, strikeRefs.buyHead, strikeRefs.buyPrice);
let gearCards: GearCard[] = [];
const gearNext = el('p', { cls: 'note dim tool-note gear-next', attrs: { hidden: '' } });
let gearOpenSeen: Set<GearId> | null = null;

function button(cls: string, text: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', { cls, text });
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

const HOLD_DELAY_MS = 400;
const HOLD_STEP_MS = 125;
const HOLD_SLOP_PX = 10;

/** 클릭은 1회 구매, 400ms 이상 누르면 초당 8회 반복. 돈이 모자라거나 손가락이 10px 넘게 움직이면 멈춘다. */
function onBuy(btn: HTMLButtonElement, act: (repeat: boolean) => boolean): void {
  let held = false;
  let delay = 0;
  let timer = 0;
  let sx = 0;
  let sy = 0;
  const stop = (): void => {
    clearTimeout(delay);
    clearInterval(timer);
    delay = 0;
    timer = 0;
    window.removeEventListener('pointerup', stop);
    window.removeEventListener('pointercancel', stop);
    window.removeEventListener('pointermove', move);
  };
  const move = (e: PointerEvent): void => {
    if (Math.hypot(e.clientX - sx, e.clientY - sy) > HOLD_SLOP_PX) stop();
  };
  btn.addEventListener('pointerdown', (e) => {
    if (btn.disabled || !e.isPrimary) return;
    held = false;
    sx = e.clientX;
    sy = e.clientY;
    stop();
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('pointermove', move, { passive: true });
    delay = window.setTimeout(() => {
      held = true;
      timer = window.setInterval(() => {
        if (!act(true)) stop();
      }, HOLD_STEP_MS);
      if (!act(true)) stop();
    }, HOLD_DELAY_MS);
  });
  btn.addEventListener('pointerleave', stop);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  btn.addEventListener('click', (e) => {
    if (held && e.detail > 0) {
      held = false;
      return;
    }
    act(false);
  });
}

function build(): void {
  const app = document.getElementById('app')!;
  const settingsBtn = button('btn icon-btn', '', openSettings);
  settingsBtn.append(iconImg('ui-settings', { size: 32 }));
  settingsBtn.setAttribute('aria-label', '설정');
  multBtn.append(glyph('i'));
  settingsBtn.title = '설정';
  const header = el('header', { cls: 'top' }, refs.topIco, refs.houseName, refs.badge, strat.perkBtn, settingsBtn);

  refs.phone.type = 'button';
  refs.phone.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    doTap(e.clientX, e.clientY);
    chargeUi.press('pointer', e.pointerId, e.clientX, e.clientY);
  });
  refs.phone.addEventListener('contextmenu', (e) => e.preventDefault());
  refs.miniPhone.addEventListener('contextmenu', (e) => e.preventDefault());
  refs.phone.addEventListener('click', (e) => {
    if (e.detail === 0) {
      const r = refs.phone.getBoundingClientRect();
      doTap(r.left + r.width / 2, r.top + r.height / 2);
    }
  });
  refs.phone.setAttribute('aria-label', '상자 치기');
  refs.miniPhone.type = 'button';
  refs.miniPhone.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    doTap(e.clientX, e.clientY, refs.miniPhone);
    chargeUi.press('pointer', e.pointerId, e.clientX, e.clientY);
  });
  refs.miniPhone.addEventListener('click', (e) => {
    if (e.detail === 0) {
      const r = refs.miniPhone.getBoundingClientRect();
      doTap(r.left + r.width / 2, r.top + r.height / 2, refs.miniPhone);
    }
  });
  refs.points.append(iconImg('coin', { size: 32, cls: 'pts-coin' }), refs.ptsMain, refs.ptsRate, feverBadge);
  refs.room.append(refs.phone, refs.tapHint, refs.tip);
  initFever(refs.room, refs.phone);
  initRush(refs.room);
  initUnpack({ room: refs.room, tapHint: refs.tapHint, toast: showToast });
  comboUi.attach(refs.room, refs.phone, document.getElementById('app')!);
  chargeUi.initCharge({
    room: refs.room,
    canStart: () => featureOpen(state, 'charge') && !moving && !chainPlaying() && document.visibilityState === 'visible' && !document.querySelector('.overlay, .box-scene, .move-scene'),
    streak: () => (featureOpen(state, 'streak') ? chargeStreak : 0),
    onRelease: applyCharge,
  });
  weakUi.initWeak({ room: refs.room, onHit: applyWeak });
  chargeUi.setZone(chargeZone);

  setLabel(refs.moveBtn, 'ui-move', 32, '이사');
  refs.moveBtn.type = 'button';
  refs.moveBtn.addEventListener('click', openMoveConfirm);
  const infoBtn = button('btn step-btn', '집 단계', openHouseTable);
  infoBtn.setAttribute('aria-label', '집 단계 표');
  infoBtn.title = '집 단계 표';
  const moveRow = el(
    'section',
    { cls: 'move-row' },
    el('div', { cls: 'bar' }, refs.barFill, refs.barText),
    infoBtn,
    refs.moveBtn,
  );
  const moveBlock = el('div', { cls: 'move-block' }, moveRow, strat.moveExtra);

  const tabs = el('div', { cls: 'dock-tabs' });
  const tabsL = el('div', { cls: 'tab-grp' });
  const tabsR = el('div', { cls: 'tab-grp' });
  const defs: [TabId, string, HTMLElement][] = [
    ['tap', '공구 강화', iconImg('ui-tools', { size: 48 })],
    ['home', '살림', iconImg('perk-home_boost', { size: 32 })],
    ['box', '상자', iconImg('box-closed', { size: 32 })],
    ['dex', '도감', iconImg('ui-dex', { size: 32 })],
  ];
  for (const [id, label, icon] of defs) {
    const b = button('tab', '', () => selectTab(id));
    const dot = el('i', { cls: 'dot', attrs: { hidden: '' } });
    b.append(el('span', { cls: 'tab-ico' }, icon, dot), el('span', { cls: 'tab-lbl', text: label }));
    tabDots.set(id, dot);
    tabBtns.set(id, b);
    if (id !== 'tap') b.dataset.ux = id;
    const grp = id === 'tap' || id === 'home' ? tabsL : tabsR;
    grp.append(b);
    if (id !== 'tap') grp.append(el('span', { cls: 'tab-lock', attrs: { 'aria-hidden': 'true', 'data-lock': id } }));
  }
  tabs.append(tabsL, el('span', { cls: 'tab-gap', attrs: { 'aria-hidden': 'true' } }), tabsR, refs.miniPhone);
  const dock = el('nav', { cls: 'dock', attrs: { 'aria-label': '메뉴' } }, el('div', { cls: 'dock-band' }, el('div', { cls: 'dock-pts' }, iconImg('coin', { size: 32, alt: '', cls: 'pts-coin' }), el('span', { cls: 'dock-pts-txt' }, refs.dockPts, refs.dockRate))), tabs);

  buildTapPanel();
  const uiCtx: UiCtx = {
    get: () => state,
    set: (s) => {
      state = s;
    },
    update,
    save,
    goto: selectTab,
    showModal,
    dismissModal,
    guide: guideSay,
  };
  initUnlock({ ctx: uiCtx, toast: showToast, isActiveTab: (id) => activeTab === id });
  initBox(uiCtx);
  initGuidePoint({
    state: () => state,
    activeTab: () => activeTab,
    tab: (id) => tabBtns.get(id),
    panel: refs.panel,
    tapBtn,
    strikeBtn,
    multBtn,
    moveBtn: refs.moveBtn,
    boxBtn: boxOpenBtn,
    canBuyBox,
    perkBtn: perkBuyBtn,
    canBuyPerkBox: canBuyPerkBoxUi,
    gears: () => gearCards.map((c) => ({ id: c.id, btn: c.btn })),
    boxAt: boxAnchor,
    holding: () => guideRow.classList.contains('done'),
  });
  initDex(uiCtx);
  initParcel(refs.room, ptsTarget, uiCtx);
  strat.initStrategy({ ctx: uiCtx });
  refs.speed.append(el('span', { cls: 'speed-pre', text: '탭 1회 ' }), refs.speedVal);
  refs.badge.append(refs.badgeVal);
  refs.badge.addEventListener('click', () => strat.toggleMult(refs.points));
  for (const n of [refs.speed, refs.ptsRate, multBtn]) n.addEventListener('click', () => strat.toggleMult(refs.points));
  if (location.search.includes('debug')) (window as unknown as { __ajd: unknown }).__ajd = { v9: showV9Notice, returnToast: () => { returnRush = true; announceReturn(); }, textBoxes, special: debugSpecial, rush: (sec: number) => { state = { ...state, unpack: { ...state.unpack, rushSec: sec } }; update(); }, say: (g: 'perfect' | 'good' | 'miss', streak = 0, gain = 1234, power = 1, chain = 0) => chargeUi.say(g, streak, gain, power, chain), fever: () => { state = { ...state, fever: { gauge: 0, activeSec: 10, cooldownSec: 0 } }; update(); }, particles: fx.particleCount, toast: showToast, get: () => state, set: (s: GameState) => { state = asDebug(s); }, guideEv: (ev: GuideEvent) => guideSay(ev), guide: (step: number | 'done') => { guideDebug = true; state = { ...state, guide: step === 'done' ? finishedGuide() : { step: step - 1, n: 0, done: false } }; update(); }, combo: (n: number) => { combo = { n, lastMs: performance.now(), earned: n * 100 }; comboBest0 = state.bestCombo; }, getCombo: () => combo, chain: (n: number) => { const r = refs.room.getBoundingClientRect(); applyCharge(0.5, r.left + r.width / 2, r.top + r.height / 2, n); }, getChain: chainInfo, holdAt: chargeUi.holdAt, release: chargeUi.releaseHeld, charge: (pos: number) => { chargeUi.holdAt(pos); chargeUi.releaseHeld(); }, streak: (n: number) => { chargeStreak = n; }, tip: chargeUi.showTip, keep: () => { if (combo.n) combo = { ...combo, lastMs: performance.now() }; }, weak: showWeakAt, weakHit: () => { const r = document.querySelector('.weak:not([hidden])')?.getBoundingClientRect(); if (r) applyWeak(r.left + r.width / 2, r.top + r.height / 2); }, weakAuto: (on: boolean) => { weakAuto = on; }, weakTip: () => weakUi.showTip(), getWeak: () => weak, heatAuto: (on: boolean) => { heatAuto = on; }, zoneAuto: (on: boolean) => { zoneAuto = on; }, heat: (v: number) => setHeat(v >= 100 ? heatAdd(initialHeat(), 100) : { heat: { v, overMs: 0 }, overheated: false }), getHeat: () => heat, zone: (center: number) => { chargeZone = chargeZoneAt(center, zoneHalf); chargeUi.setZone(chargeZone); }, home: (id: string | number, lv: number) => { const i = typeof id === 'number' ? id : ROOM_ITEMS.findIndex((x) => x.id === id); state = { ...state, homeLv: state.homeLv.map((x, j) => (j === i ? lv : x)) }; update(); }, gear: (id: GearId, lv: number) => { state = { ...state, gear: { ...state.gear, [id]: lv } }; update(); }, shield: (n: number, toNext = shield.toNext) => { shield = { n, toNext }; chargeUi.syncShield(shieldMax, shield); }, save: () => chargeUi.shieldSave(Math.max(0, shield.n - 1), streakMult(chargeStreak, perkEffects(state).streakBonus), refs.room, true), getZone: () => chargeZone };

  const keyHint = el('p', { cls: 'key-hint' });
  for (const [keys, label] of [[['Space'], '상자 치기 · 꾹 강타'], [['1~4'], '탭 전환'], [['Esc'], '닫기']] as [string[], string][]) {
    keyHint.append(el('span', { cls: 'kh' }, el('span', {}, ...keys.map((k) => el('kbd', { text: k }))), label));
  }
  const colPlay = el('div', { cls: 'col-play' }, header, el('section', { cls: 'hero' }, el('div', { cls: 'speed-wrap' }, refs.speed, multBtn), refs.points), refs.room, feverGauge, ...(roomStrip() ? [roomStrip()!] : []), chargeUi.stripEl(), guideRow, moveBlock, keyHint);
  const colList = el('div', { cls: 'col-list' }, refs.panel);
  const page = el('div', { cls: 'page' }, colPlay, colList);
  app.append(
    page,
    refs.toast,
    dock,
  );
  const placeDock = (): void => {
    if (desktopMq.matches) colList.prepend(dock);
    else app.append(dock);
  };
  placeDock();
  desktopMq.addEventListener('change', placeDock);
  initKeys({
    tap: () => {
      const c = boxCenter();
      doTap(c.x, c.y);
      chargeUi.press('key', 0, c.x, c.y);
    },
    release: () => chargeUi.releaseKey(),
    tab: (n) => {
      const id = (['tap', 'home', 'box', 'dex'] as TabId[])[n];
      if (tabOpen(id)) selectTab(id);
    },
  });
  selectTab('tap');
}

function buildTapPanel(): void {
  tapBtn.type = 'button';
  onBuy(tapBtn, (repeat) => {
    const before = state.tapLevel;
    const next = buyTapUpgrade(state);
    if (!next) return false;
    state = next;
    guideSay({ type: 'upgrade' });
    update();
    sfx.buy();
    vibrate(repeat ? 6 : 12);
    fx.bounce(tapBtn.closest('.card')!, repeat ? 0.98 : 0.95);
    fx.pop(tapRefs.lv, 1.5);
    if (!repeat) {
      fx.burst(lastPointer.x, lastPointer.y, { n: 5, size: 6 });
      fx.bounce(refs.phone, 0.84);
    }
    checkMilestone('공구 강화', before, state.tapLevel, TAP_MILESTONES);
    return true;
  });
  const card = el(
    'div',
    { cls: 'card tap-card' },
    el('div', { cls: 'card-icon' }, makeToolEl()),
    el(
      'div',
      { cls: 'card-main' },
      el('div', { cls: 'card-title' }, el('span', { cls: 'card-name', text: '공구 강화' }), tapRefs.lv),
      el('div', { cls: 'tap-info-row' }, tapRefs.info, el('span', { cls: 'i-chip', attrs: { 'aria-hidden': 'true' } }, glyph('i', 8))),
      tapRefs.next,
      tapRefs.msLabel,
      el('div', { cls: 'ms-bar' }, tapRefs.msFill),
    ),
    tapBtn,
  );
  strikeBtn.type = 'button';
  onBuy(strikeBtn, (repeat) => {
    const next = buyStrikeUpgrade(state);
    if (!next) return false;
    state = next;
    guideSay({ type: 'upgrade' });
    update();
    sfx.buy();
    vibrate(repeat ? 6 : 12);
    fx.bounce(strikeBtn.closest('.card')!, repeat ? 0.98 : 0.95);
    fx.pop(strikeRefs.lv, 1.5);
    if (!repeat) {
      fx.burst(lastPointer.x, lastPointer.y, { n: 5, size: 6 });
      fx.bounce(refs.phone, 0.84);
    }
    return true;
  });
  const strikeCard = el(
    'div',
    { cls: 'card tap-card strike-card' },
    el('div', { cls: 'card-icon' }, iconImg('tool/sledge', { size: 48 })),
    el('div', { cls: 'card-main' }, el('div', { cls: 'card-title' }, el('span', { cls: 'card-name', text: '오함마' }), strikeRefs.lv), strikeRefs.info, strikeRefs.best),
    strikeBtn,
  );
  const tapRow = tapRefs.info.parentElement!;
  tapRow.setAttribute('role', 'button');
  tapRow.setAttribute('aria-label', '탭 수익 내역 보기');
  tapRow.addEventListener('click', () => strat.toggleMult(tapRefs.info));
  gearCards = createGearCards((c) =>
    onBuy(c.btn, (repeat) => {
      const before = state;
      const next = buyGear(state, c.id);
      if (!next) return false;
      state = next;
      guideSay({ type: 'gearBuy' });
      update();
      sfx.buy();
      vibrate(repeat ? 6 : 12);
      fx.bounce(c.card, repeat ? 0.98 : 0.95);
      fx.pop(c.lv, 1.5);
      if (!repeat) {
        fx.burst(lastPointer.x, lastPointer.y, { n: 5, size: 6 });
        fx.bounce(refs.phone, 0.84);
      }
      if (c.id === 'level' || c.id === 'helmet') chargeUi.gearBuy(c.id, gearLevel(before, c.id) + 1);
      return true;
    }),
  );
  tapPanel.append(
    card,
    strikeCard,
    ...gearCards.map((c) => c.card),
    gearNext,
    el('p', { cls: 'note dim tool-note', text: '상자를 치면 포인트가 들어와요. 강화하면 한 번 칠 때 수익이 늘어요.' }),
    el('p', { cls: 'note dim tool-note', text: '탭 1회 줄을 누르면 내역이 보여요.' }),
  );
}

function selectTab(id: TabId): void {
  activeTab = id;
  clearNewTabDot(id);
  const panels: Record<TabId, HTMLElement> = { tap: tapPanel, home: homePanel, box: boxPanel, dex: dexPanel };
  refs.panel.replaceChildren(panels[id]);
  toggleClass(refs.panel, 'surface', id === 'box' || id === 'dex');
  const top = refs.panel.getBoundingClientRect().top + window.scrollY - 8;
  if (!desktopMq.matches && window.scrollY > top) window.scrollTo(0, top);
  if (id === 'dex') renderDex(true);
  update();
}

/** PC(900px 이상)에서는 왼쪽 단(.col-play) 가운데, 모바일은 화면 가운데 */
function playCenterX(): string;
function playCenterX(px: true): number;
function playCenterX(px?: true): string | number {
  const col = window.innerWidth >= 900 ? document.querySelector('.col-play') : null;
  const r = col?.getBoundingClientRect();
  const x = r ? r.left + r.width / 2 : window.innerWidth / 2;
  return px ? x : r ? `${x}px` : '50%';
}

function checkMilestone(label: string, before: number, after: number, list: readonly number[], card?: HTMLElement): void {
  const a = milestoneMult(before, list);
  const b = milestoneMult(after, list);
  if (b <= a) return;
  const isTap = list === TAP_MILESTONES;
  fx.banner(isTap ? `기본 탭 수익 x${formatNumber(b / a)}` : `x${formatNumber(b / a)}!`, { sub: isTap ? `${label} Lv ${formatNumber(after)} 달성` : `${label} Lv ${formatNumber(after)} 마일스톤`, tone: 'gold', ms: 1700 });
  fx.confetti(playCenterX(true), window.innerHeight * 0.42, 80);
  fx.shake(document.getElementById('app')!, 7, 400);
  if (card) fx.milestoneCard(card, `x${formatNumber(b / a)}`);
  sfx.milestone();
  vibrate([20, 30, 40]);
}

/** 이사 목표 달성: 반짝이가 `이사` 버튼 테두리 위에서 태어나 바깥으로 나간다(버튼 ±16px 안에서만 그림, 두 물결 16개씩) */
function moveBorderSparks(): void {
  const wave = (): void => {
    const r = refs.moveBtn.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const bounds = { left: r.left - 16, right: r.right + 16, top: r.top - 16, bottom: r.bottom + 16 };
    const pts: [number, number, number][] = [
      [r.left, r.top, -Math.PI * 0.75],
      [cx, r.top, -Math.PI / 2],
      [r.right, r.top, -Math.PI * 0.25],
      [r.right, cy, 0],
      [r.right, r.bottom, Math.PI * 0.25],
      [cx, r.bottom, Math.PI / 2],
      [r.left, r.bottom, Math.PI * 0.75],
      [r.left, cy, Math.PI],
    ];
    for (const [x, y, dir] of pts) fx.burst(x, y, { n: 2, kind: 'star', colors: ['#ffc83d', '#ffeaa0', '#ffffff'], size: 8, speed: 56, gravity: 0, lift: 0, life: 0.5, dir, bounds });
  };
  wave();
  window.setTimeout(wave, 166);
}

/** 콤보 정산: 보너스를 포인트에 더한다. quiet이면 연출·대기 없이 더하기만(숨김·이사), 아니면 코인이 포인트 표시로 날아가 도착할 때 숫자가 오른다 */
function settleCombo(c: ComboState, quiet: boolean): void {
  if (c.n <= 0) return;
  if (!featureOpen(state, 'combo')) {
    comboUi.hide();
    return;
  }
  const bonus = comboBonus(c);
  if (comboTier(c.n) === 0 || !(bonus > 0)) {
    if (!quiet) comboUi.hide();
    return;
  }
  state = { ...state, points: state.points + bonus, earned: state.earned + bonus, stats: { ...state.stats, totalEarned: state.stats.totalEarned + bonus } };
  if (quiet) {
    comboUi.hide();
    return;
  }
  pendingReward += bonus;
  let done = false;
  const release = (): void => {
    if (done) return;
    done = true;
    pendingReward = Math.max(0, pendingReward - bonus);
    update();
  };
  window.setTimeout(release, 2500);
  comboUi.settle({ n: c.n, bonus, best: c.n >= 25 && c.n > comboBest0, pointsEl: ptsTarget(), onArrive: release });
}

/** 진행 중 콤보를 정산하고 끝낸다(숨김·이사 시작) */
function endComboQuiet(): void {
  const c = combo;
  combo = initialCombo();
  settleCombo(c, true);
}

function resetCombo(): void {
  combo = initialCombo();
  comboUi.hide();
}

/** 강타·급소 공통: 만료된 콤보를 정산하고, roll이 낸 묵직한 한 방을 상태·콤보에 반영한다(tapGate는 거치지 않는다) */
function applyHeavy<T extends { state: GameState; gain: number; comboAdd: number }>(x: number, y: number, roll: (mult: number) => T): { r: T; wasFever: boolean } {
  const nowMs = performance.now();
  lastTapMs = nowMs;
  const wasFever = state.fever.activeSec > 0;
  if (comboExpired(combo, nowMs, comboWindowMs(wasFever))) {
    const c = combo;
    combo = initialCombo();
    settleCombo(c, false);
  }
  if (combo.n === 0) comboBest0 = state.bestCombo;
  const r = roll(comboMultOf(state, combo.n));
  state = r.state;
  const h = comboAdd(combo, nowMs, r.comboAdd);
  combo = addEarned(h.combo, r.gain);
  if (combo.n > state.bestCombo) state = { ...state, bestCombo: combo.n };
  if (r.comboAdd > 0 && featureOpen(state, 'combo')) comboUi.hit({ n: combo.n, tierUp: h.tierUp, damped: false, x, y });
  return { r, wasFever };
}

/** 꾹 눌러 강타: 떼는 순간의 표시 위치 pos로 판정한다 */
function applyCharge(pos: number, x: number, y: number, only?: number): void {
  if (moving || chainPlaying() || document.visibilityState !== 'visible') return;
  let power = 1;
  let saved = false;
  let savedAt = 0;
  const before = state;
  const { r, wasFever } = applyHeavy(x, y, (mult) => {
    const c = only ? debugChain(only, mult, (g) => (power = heatStrikeMult(heat, g))) : releaseCharge(state, () => Math.random(), pos, chargeStreak, mult, (g) => (power = heatStrikeMult(heat, g)), chargeZone);
    const sr = resolveStreak(chargeStreak, c.grade, shield, shieldMax);
    saved = sr.saved;
    savedAt = shield.n;
    chargeStreak = featureOpen(state, 'streak') ? sr.streak : 0;
    shield = sr.shield;
    c.streak = chargeStreak;
    return c;
  });
  guideHit(before, r.bursts, [...(r.grade !== 'miss' ? [{ type: 'strike' } as const] : []), { type: 'perfect', value: r.streak }]);
  heat = ventHeat(heat);
  if (zoneAuto) {
    chargeZone = rollChargeZone(Math.random, chargeZone, gearEffects(state).perfectHalf);
    chargeUi.setZone(chargeZone);
  }
  chargeUi.say(r.grade, r.streak, r.gain, power, r.bursts.length, saved ? streakMult(chargeStreak, perkEffects(state).streakBonus) : 0);
  chargeUi.strikeFx(r.grade, r.streak, document.getElementById('app')!, refs.room, power, r.bursts.length);
  if (saved) chargeUi.shieldSave(savedAt - 1, streakMult(chargeStreak, perkEffects(state).streakBonus), refs.room);
  unpackHeavy({ x, y, grade: r.grade, streak: r.streak, gain: r.gain, bursts: r.bursts, prize: r.prize, pointsEl: ptsTarget(), fever: wasFever });
  const c = boxCenter();
  const r2 = ptsTarget().getBoundingClientRect();
  fx.absorb({ x: c.x, y: c.y }, ptsTarget(), r.grade === 'perfect' ? 6 : r.grade === 'good' ? 3 : 1, { offset: { x: 0, y: r2.height / 2 + 12 } });
  if (r.grade !== 'miss' && !getPrefs().chargeDone) setPrefs({ chargeDone: true });
  if (r.grade !== 'miss' && power >= 2 && !getPrefs().heatDone) setPrefs({ heatDone: true });
  update();
}

/** 디버그: 지금 상자에서 offset번째 상자가 kind가 되는 salt를 찾아 바꾼다(null이면 앞 8개 안에 특별 상자가 없는 salt). more는 {offset: 종류} 추가 조건. 처음 20개에는 특별 상자가 없어 box 20 이상에서만 된다. 찾았으면 true */
function debugSpecial(kind: SpecialBox | null, offset = 0, more: Record<number, SpecialBox> = {}): boolean {
  const k = state.unpack.box;
  const want: Array<[number, SpecialBox]> = [...(kind ? ([[offset, kind]] as Array<[number, SpecialBox]>) : []), ...Object.entries(more).map(([o, v]): [number, SpecialBox] => [Number(o), v])];
  for (let salt = 1; salt < 400000; salt++) {
    const ok = kind ? want.every(([o, v]) => specialAt(salt, k + o) === v) : Array.from({ length: 8 }, (_, i) => specialAt(salt, k + i)).every((x) => x === null);
    if (!ok) continue;
    state = { ...state, unpack: { ...state.unpack, salt } };
    update();
    return true;
  }
  return false;
}

/** 디버그: 지금 상태에서 상자 n개가 터지는 퍼펙트 강타. 로직 규칙은 그대로 두고 heavyHit에 넘기는 탭 수만 맞춘다 */
function debugChain(n: number, mult: number, showPower: (g: 'perfect' | 'good' | 'miss') => void): ReturnType<typeof releaseCharge> {
  const rng = (): number => 0.999;
  let taps = 1;
  while (taps < 20000 && heavyHit(state, rng, taps, mult).chain < n) taps = Math.ceil(taps * 1.1) + 1;
  let lo = Math.max(1, Math.floor(taps / 1.1) - 1);
  while (lo < taps && heavyHit(state, rng, lo, mult).chain < n) lo++;
  const base = chargeTaps('perfect', chargeStreak, perkEffects(state).streakBonus) * strikeMult(state.strikeLevel);
  return releaseCharge(state, rng, 0.5, chargeStreak, mult, (g) => (showPower(g), lo / base), chargeZoneAt(0.5));
}

/** 급소 노리기: 과녁을 눌렀다. 묵직한 한 방(8탭 몫) + 콤보 +5. (x, y)는 과녁 중심 화면 좌표 */
function applyWeak(x: number, y: number): void {
  if (moving || chainPlaying() || document.visibilityState !== 'visible' || !weakVisible(weak)) return;
  const w = weak;
  const before = state;
  const { r, wasFever } = applyHeavy(x, y, (mult) => {
    const h = hitWeak(state, () => Math.random(), w, mult);
    weak = h.weak;
    return h;
  });
  weakPin = false;
  guideHit(before, r.bursts, [{ type: 'weak' }]);
  if (heatAuto) setHeat(heatAdd(heat, HEAT_WEAK));
  weakUi.hitFx(x, y, r.gain, document.getElementById('app')!, r.bursts.length);
  unpackHeavy({ x, y, grade: 'perfect', streak: 0, gain: r.gain, bursts: r.bursts, prize: r.prize, pointsEl: ptsTarget(), fever: wasFever });
  const c = boxCenter();
  const r2 = ptsTarget().getBoundingClientRect();
  fx.absorb({ x: c.x, y: c.y }, ptsTarget(), 6, { offset: { x: 0, y: r2.height / 2 + 12 } });
  if (!getPrefs().weakDone) setPrefs({ weakDone: true });
  update();
}

/** 열기를 바꾸고, 과열 시작·달아오름 진입이면 연출 훅을 부른다 */
function setHeat(a: HeatAdd): void {
  const was = heatZone(heat);
  heat = a.heat;
  if (a.overheated) {
    heatUi.over();
    chargeUi.sayOver();
  } else if (was !== 'hot' && heatZone(heat) === 'hot') {
    heatUi.hot();
    if (!getPrefs().heatDone && guideEnded(state)) heatTipPending = true;
  }
}

function stepHeat(dtMs: number): void {
  if (!heatAuto && heat.overMs <= 0) return;
  const a = advanceHeat(heat, dtMs, chargeUi.isCharging());
  heat = a.heat;
  if (a.recovered) heatUi.recovered();
}

function showWeakAt(u: number, v: number): void {
  weak = { nextInMs: 9999, remainMs: 1800, u, v };
  weakPin = true;
  presentWeak();
}

/** 급소가 막 떴다: 과녁을 띄우고, 처음이면 안내 말풍선(강타 안내와 겹치지 않게) */
function presentWeak(): void {
  weakUi.show(weak.u, weak.v);
  // 가이드 중에는 6단계(급소)에서만, 급소가 뜰 때마다(맞힐 때까지) 안내한다. 머리글이 떠 있으면 건너뛴다
  if (!guideEnded(state)) {
    if (guideAt(state, 'weak') && !fx.headBusy() && !chainVisible() && !chargeUi.tipShown()) weakUi.showTip();
    return;
  }
  if (weakTipDone || getPrefs().weakDone || chargeUi.tipShown() || !refs.tip.hidden) return;
  weakTipDone = true;
  weakUi.showTip();
}

function resetWeak(): void {
  weak = initialWeak(Math.random);
  weakPin = false;
  weakUi.clear();
}

/** 급소를 띄워도 되는 때: 최근 2초 안에 탭, 모으는 중 아님, 창·이사 연출 없음, 칠 상자 있음 */
function weakActive(nowMs: number): boolean {
  return weakAuto && featureOpen(state, 'weak') && nowMs - lastTapMs < 2000 && !chargeUi.isCharging() && !moving && !document.querySelector('.overlay, .box-scene, .move-scene') && weakUi.hasBox();
}

function stepWeak(nowMs: number, dtMs: number): void {
  if (weakPin) {
    weakUi.frame(weak.remainMs);
    return;
  }
  const a = advanceWeak(weak, dtMs, weakActive(nowMs), Math.random, gearEffects(state).weakDelayMult);
  weak = a.weak;
  if (a.appeared) presentWeak();
  else if (a.vanished) weakUi.vanish();
  else if (weakVisible(weak)) weakUi.frame(weak.remainMs);
}

/** 가이드 중 방 안 말풍선은 지금 단계의 행동 안내 하나뿐이다: 5단계 강타, 9단계 퍼펙트(첫 성공까지). 6단계 급소 안내는 presentWeak가 띄운다. 머리글·창·장면이 있거나 모으는 중이면 숨긴다 */
function syncGuideTip(): void {
  const want = guideAt(state, 'strike') && state.guide.n < 1 ? 'charge' : guideAt(state, 'streak') && state.guide.n < 1 ? 'perfect' : null;
  const quiet = fx.headBusy() || chainVisible() || chargeUi.isCharging() || !!document.querySelector('.overlay, .box-scene, .move-scene, .un-home-say');
  if (weakUi.tipShown() && (quiet || !guideAt(state, 'weak'))) weakUi.hideTip();
  if (chargeUi.tipShown() && (quiet || chargeUi.shownTipKind() !== want)) chargeUi.hideTip();
  if (want && !quiet && !chargeUi.tipShown() && refs.tip.hidden) chargeUi.showTip(want, true);
}

/** 탭을 어느 정도 친 뒤 한 번만 알려 준다. 강타에 성공한 적이 있으면 다시 안 뜬다 */
function syncChargeTip(): void {
  if (!guideEnded(state)) {
    syncGuideTip();
    return;
  }
  if (fx.headBusy() || chainVisible()) {
    if (chargeUi.tipShown()) {
      if (chargeUi.shownTipKind() === 'heat') heatTipPending = true;
      else chargeTipDone = false;
      chargeUi.hideTip();
    }
    if (weakUi.tipShown()) {
      weakUi.hideTip();
      weakTipDone = false;
    }
    return;
  }
  const busy = !refs.tip.hidden || chargeUi.tipShown() || weakUi.tipShown() || !!document.querySelector('.overlay, .box-scene, .move-scene');
  if (heatTipPending) {
    if (getPrefs().heatDone || heatZone(heat) !== 'hot') heatTipPending = false;
    else if (!busy) {
      heatTipPending = false;
      chargeUi.showTip('heat');
    }
    return;
  }
  if (!featureOpen(state, 'charge') || chargeTipDone || getPrefs().chargeDone || state.stats.totalTaps < 20 || !refs.tip.hidden || chargeUi.tipShown() || weakUi.tipShown() || document.querySelector('.overlay, .box-scene, .move-scene')) return;
  chargeTipDone = true;
  chargeUi.showTip();
}

function doTap(x: number, y: number, via: HTMLElement = refs.phone): void {
  if (chainPlaying()) return;
  const nowMs = performance.now();
  lastTapMs = nowMs;
  const gate = tapGate(tapGateState, nowMs);
  tapGateState = { recent: gate.recent, tokens: gate.tokens, lastMs: gate.lastMs };
  if (!gate.ok) return;
  const before = state;
  const wasFever = state.fever.activeSec > 0;
  const h = comboHit(combo, nowMs, comboWindowMs(wasFever), gate.damped);
  if (h.ended) settleCombo(h.ended, false);
  if (h.combo.n === 1) comboBest0 = state.bestCombo;
  const r = tapAndHit(state, () => Math.random(), gate.damped || heatDamped(heat), comboMultOf(state, h.combo.n) * heatTapMult(heat));
  if (heatAuto && featureOpen(state, 'charge')) setHeat(heatTap(heat));
  heatUi.tap(heat);
  state = r.state;
  combo = addEarned(h.combo, r.gain);
  if (combo.n > state.bestCombo) state = { ...state, bestCombo: combo.n };
  const comboOpen = featureOpen(state, 'combo');
  if (comboOpen) comboUi.hit({ n: combo.n, tierUp: h.tierUp, damped: gate.damped, x, y });
  fx.bounce(via, 0.86);
  tapEffect({ x, y, gain: r.gain, crit: r.crit, damped: r.damped, fever: wasFever, combo: comboOpen ? combo.n : 0, lite: true, noNumber: r.bursts.length >= 2, anchor: boxAnchor(), pointsEl: ptsTarget(), phone: refs.phone, app: document.getElementById('app')! });
  unpackHit({ x, y, crit: r.crit, damped: r.damped, burst: r.burst, bursts: r.bursts, gain: r.gain, prize: r.prize, fever: wasFever, pointsEl: ptsTarget() });
  if (h.tierUp >= 2 && comboOpen) dropTapNumber();
  guideHit(before, r.bursts, [{ type: 'tap' }, { type: 'combo', value: combo.n }]);
  update();
}

/** 토스트: 일반 = k1 면, 보상(gold) = g2 면, 열림(icon) = k1 면 + or 테두리. 글자 폭 칩, 방 윗변 4px 아래 가운데. 아래로 쌓고 최대 2개 */
function showToast(msg: string, gold = false, icon?: IconName): void {
  fx.whenHeadQuiet(() => putToast(msg, gold, icon));
}

function putToast(msg: string, gold: boolean, icon?: IconName): void {
  const t = el('div', { cls: `toast show${gold ? ' gold' : icon ? ' open' : ''}`, attrs: { role: 'status' } });
  if (icon) t.append(iconImg(icon, { size: 24, cls: 'toast-ico' }), el('span', { text: msg }));
  else t.textContent = msg;
  while (refs.toast.children.length >= 2) refs.toast.firstElementChild?.remove();
  refs.toast.append(t);
  const room = refs.room.getBoundingClientRect();
  refs.toast.style.left = `${Math.round(room.left)}px`;
  refs.toast.style.width = `${Math.round(room.width)}px`;
  refs.toast.style.top = `${Math.round(room.top + 4)}px`;
  window.setTimeout(() => {
    t.classList.add('out');
    window.setTimeout(() => t.remove(), 170);
  }, 2200);
}

/** 가이드에 사건을 알린다. 단계를 끝내면 state에 반영하고 완료 처리(onGuideStep)를 한다. 끝난 가이드에는 아무 일도 없다 */
function guideSay(ev: GuideEvent): void {
  if (state.guide.done) return;
  const r = guideEvent(state, ev);
  if (r.state === state) return;
  state = r.state;
  if (r.completed) onGuideStep(r);
}

/** 탭·강타·급소 한 번의 결과를 가이드에 알린다: lead 사건 뒤에 터진 상자(살림·연쇄·특별 상자)와 막 시작된 피버. before는 그 전 상태 */
function guideHit(before: GameState, bursts: BoxBurst[], lead: GuideEvent[]): void {
  if (guideEnded(state)) return;
  for (const ev of lead) guideSay(ev);
  if (bursts.some((b) => b.item !== undefined)) guideSay({ type: 'unbox' });
  if (bursts.length > 0) guideSay({ type: 'chain', value: bursts.length });
  if (bursts.some((b) => b.special)) guideSay({ type: 'special' });
  if (before.fever.activeSec <= 0 && state.fever.activeSec > 0) guideSay({ type: 'fever' });
}

/** 가이드 연출(guideFx.ts)이 쓰는 화면 연결 */
const guideFxHost: guideFx.GuideFxHost = {
  room: refs.room,
  pts: ptsTarget,
  toast: showToast,
  tabDot: markTabDot,
  gifts: (results, title, onClose) => playGifts(results, { title, onClose }),
};
/** 첫 이사로 가이드가 끝났다: 이사 연출이 끝나면 끝 머리글을 띄운다 */
let guideEndPending = false;

/** 가이드 한 단계를 끝냈다(보상은 이미 state에 반영됨). 완료 연출과 화면 갱신을 한곳에서 처리한다 */
function onGuideStep(r: GuideResult): void {
  r.boxResults.forEach(markFresh);
  if (r.step?.id === 'move') {
    guideEndPending = true;
    update();
    return;
  }
  guideFx.stepDone(guideFxHost, r, r.step ? GUIDE_STEPS.indexOf(r.step) + 1 : 0, update);
}

const GUIDE_FEATURES: GuideFeature[] = ['combo', 'charge', 'weak', 'fever', 'chain', 'streak', 'special', 'gear'];
/** 가이드가 아직 열지 않은 요소는 body 클래스(g-no-<요소>, guide.css)로 접고, 가이드 줄을 그린다 */
function syncGuideUi(): void {
  for (const f of GUIDE_FEATURES) toggleClass(document.body, `g-no-${f}`, !featureOpen(state, f));
  syncGuide(state);
  toggleClass(document.body, 'guiding', !guideRow.hidden);
}

const RATE_WINDOW_MS = 5000;
const RATE_STEP_MS = 250;
let rateSamples: { t: number; earned: number }[] = [];
/** 최근 5초 실제 수익(초당): 화면에서 earned 차이를 재는 이동평균. 이사로 earned가 줄면 다시 잰다. 0.25초 간격으로만 표본을 쌓는다 */
function recentRate(earned: number, reset: boolean): number {
  const now = performance.now();
  const last = rateSamples[rateSamples.length - 1];
  if (reset || (last && earned < last.earned)) rateSamples = [];
  if (!rateSamples.length || now - rateSamples[rateSamples.length - 1].t >= RATE_STEP_MS) rateSamples.push({ t: now, earned });
  while (rateSamples.length > 2 && now - rateSamples[1].t >= RATE_WINDOW_MS) rateSamples.shift();
  const first = rateSamples[0];
  const dt = (now - first.t) / 1000;
  return dt >= 1 ? Math.max(0, (earned - first.earned) / Math.min(dt, RATE_WINDOW_MS / 1000)) : 0;
}

/** 수평계·안전모 레벨에 맞춰 게이지 구간 폭과 실드 칸을 맞춘다(구매·디버그 set·불러오기 모두 여기로 모인다). 칸이 늘면 늘어난 만큼 채운다 */
function syncGearState(): void {
  const e = gearEffects(state);
  if (e.perfectHalf !== zoneHalf) {
    zoneHalf = e.perfectHalf;
    chargeZone = chargeZoneAt((chargeZone.perfect[0] + chargeZone.perfect[1]) / 2, e.perfectHalf);
    chargeUi.setZone(chargeZone);
  }
  if (e.shieldMax !== shieldMax) {
    shield = { n: Math.min(e.shieldMax, shield.n + Math.max(0, e.shieldMax - shieldMax)), toNext: shield.toNext };
    shieldMax = e.shieldMax;
  }
  chargeUi.syncShield(shieldMax, shield);
}

/** 총 배율(영구 × 살림 × 도감·세트 × 탭 특전, 피버 제외) */
function totalMult(st: GameState): number {
  const b = multBreakdown(st, 'tap');
  return b.total / b.fever;
}

/** 배율 돌파: 총 배율이 2의 거듭제곱 계단을 넘는 순간. 불러오기·이사 직후는 기준값만 맞추고, 1.5초 안에 또 넘으면 쉬었다가 그때 가장 높은 계단 하나만 알린다 */
let tierBase: number | null = null;
let tierMoves = -1;
let tierAt = 0;
const TIER_GAP_MS = 1500;
function checkTier(total: number): void {
  const tier = total >= 2 ? Math.floor(Math.log2(total) + 1e-9) : 0;
  if (snapNext || tierBase === null || state.moves !== tierMoves) {
    tierBase = tier;
    tierMoves = state.moves;
    return;
  }
  if (tier <= tierBase) {
    tierBase = tier;
    return;
  }
  const now = performance.now();
  if (now - tierAt < TIER_GAP_MS) return;
  tierAt = now;
  tierBase = tier;
  breakSay(2 ** tier);
}

function breakSay(m: number): void {
  const text = `배율 x${formatNumber(m)} 돌파!`;
  sfx.breakthrough();
  vibrate([30, 20, 50]);
  const r = refs.badge.getBoundingClientRect();
  if (!fx.isReduced() && r.width > 0) {
    fx.pxFrames(refs.badge, [{ scale: '1.6', background: 'var(--or)', color: 'var(--k0)' }, { scale: '1.3', background: 'var(--k5)', color: 'var(--k0)' }, { scale: '1.15', background: 'var(--or)', color: 'var(--k0)' }, { scale: '1.05', background: 'var(--k5)', color: 'var(--k0)' }, { scale: '1' }], 83);
    fx.burst(r.left + r.width / 2, r.top + r.height / 2, { n: 10, kind: 'star', colors: ['#ff8a1f', '#ffc83d', '#ffffff'], size: 8, speed: 220, gravity: 0, life: 0.5 });
  }
  fx.headline('notice', (end) => {
    const room = refs.room;
    const k = room.offsetWidth ? room.getBoundingClientRect().width / room.offsetWidth : 1;
    const e = el('div', { cls: 'un-home-say' }, el('b', { text }));
    e.style.top = `${fx.headTop(room, k)}px`;
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
    const f: Keyframe[] = [1.5, 1.35, 1.2, 1.1].map((sc) => ({ scale: String(Math.min(sc, fit)), visibility: 'visible' }));
    for (let i = 0; i < 24; i++) f.push({ scale: '1', visibility: 'visible' });
    for (let i = 0; i < 4; i++) f.push({ scale: '1', visibility: i % 2 ? 'visible' : 'hidden' });
    fx.pxFrames(e, f, 40).onfinish = rm;
    return () => e.remove();
  }, { maxWait: 8000, tag: 'break', data: text });
}

/** 옛 저장(v8) 안내 창: 시작할 때 한 번. 닫으면 notice를 지우고 저장한다 */
function showV9Notice(boxes: number): void {
  const body = [p('서비스가 사라지고, 상자를 까서 살림과 공구를 키워요.')];
  if (boxes > 0) body.push(p(`쓰던 서비스는 선물 상자 ${boxes}개로 바꿔 드렸어요.`));
  body.push(p('자리를 비운 동안의 수익은 없지만, 돌아오면 15초 동안 자동으로 쳐 줘요.'));
  showModal('집 키우기가 바뀌었어요', body, [
    {
      label: '확인',
      primary: true,
      onClick: () => {
        const { notice: _n, ...rest } = state;
        state = rest;
        save();
        dismissModal();
        announceReturn();
      },
    },
  ], { noClose: true });
}

/** 돌아오면 러시 알림: 한 번만 */
let returnRush = false;
function announceReturn(): void {
  if (!returnRush || state.notice) return;
  returnRush = false;
  showToast('다녀오셨어요! 15초 동안 자동으로 쳐 줘요', true);
}

function update(): void {
  if (!tabOpen(activeTab)) {
    selectTab('tap');
    return;
  }
  syncGearState();
  const house = houseInfo(state.moves);
  document.body.dataset.theme = house.theme;
  if (refs.houseName.textContent !== house.name) {
    refs.houseName.textContent = house.name;
    fitHead();
  }
  if (refs.topIco.dataset.theme !== house.theme) {
    refs.topIco.dataset.theme = house.theme;
    refs.topIco.replaceChildren(iconImg(houseIcon(house.theme), { size: 48, alt: '' }));
  }
  fx.setReduced(state.settings.reduceMotion);
  const shownPoints = Math.max(0, state.points - pendingReward);
  const tapNow = tapValue(state);
  const rate = recentRate(state.earned - pendingReward, snapNext);
  const total = totalMult(state);
  checkTier(total);
  if (snapNext) {
    rollBadge.snap(total);
    rollSpeed.snap(tapNow);
    rollPoints.snap(shownPoints);
    rollRate.snap(rate);
    rollDockPts.snap(shownPoints);
    rollDockRate.snap(rate);
  } else {
    rollBadge.set(total);
    rollSpeed.set(tapNow);
    rollPoints.set(shownPoints);
    rollRate.set(rate);
    rollDockPts.set(shownPoints);
    rollDockRate.set(rate);
  }
  syncGuideUi();
  syncGuidePoint();
  syncFever(state);
  syncRush(state);
  syncParcel(state);
  syncUnpack(state);
  setText(refs.tapHint, `탭 +${formatNumber(tapValue(state))}`);
  syncTip();
  syncChargeTip();

  const prog = moveProgress(state);
  const mst = moveStatus(state);
  const ready = mst.ok;
  refs.barFill.style.width = `${(prog * 100).toFixed(1)}%`;
  toggleClass(refs.barFill, 'full', prog >= 1);
  const pct = Math.floor(prog * 100);
  const goal = `이사 목표 ${pct}% · ${formatNumber(house.target)} P`;
  // 가장 넓은 문구에는 다음 집 이름을 넣어 처음 온 사람도 다음 집이 있다는 걸 알게 한다(마지막 집이면 넣지 않는다)
  const nextName = state.moves < HOUSES.length - 1 ? houseInfo(state.moves + 1).name : '';
  const wide = nextName ? [`${nextName}${withRo(nextName)} 이사 ${pct}% · ${formatNumber(house.target)} P`, `${nextName}${withRo(nextName)} 이사 ${pct}%`] : [];
  setBarOptions(ready ? ['이사할 수 있어요'] : [...wide, goal, `이사 목표 ${pct}%`, `이사 ${pct}%`]);
  setDisabled(refs.moveBtn, !ready);
  toggleClass(refs.moveBtn, 'ready', ready);
  if (lastReady === false && ready && !moving) {
    fx.banner('이사 목표 달성!', { sub: '이사 버튼을 눌러 주세요', tone: 'gold', ms: 1700 });
    fx.thump(refs.moveBtn);
    fx.btnFlash(refs.moveBtn);
    moveBorderSparks();
    sfx.ready();
    vibrate([15, 30, 15]);
  }
  lastReady = ready;
  strat.sync(state);
  chargeUi.setStreakBonus(perkEffects(state).streakBonus);
  snapNext = false;

  for (const [id, b] of tabBtns) toggleClass(b, 'active', id === activeTab);

  if (activeTab === 'tap') updateTapPanel();
  else if (activeTab === 'home') syncHome(state);
  else if (activeTab === 'box') updateBox();
  else if (activeTab === 'dex') updateDex();

  const dots: [TabId, boolean][] = [
    ['tap', activeTab !== 'tap' && hasNewTabDot('tap')],
    ['home', activeTab !== 'home' && hasNewTabDot('home')],
    ['box', activeTab !== 'box' && (canBuyBox() || canBuyPerkBoxUi() || hasNewTabDot('box'))],
    ['dex', activeTab !== 'dex' && (fresh.size > 0 || hasNewTabDot('dex'))],
  ];
  for (const [id, on] of dots) {
    const d = tabDots.get(id)!;
    if (d.hidden === on) d.hidden = !on;
  }
  syncUnlock();
}

/** 핵심 값 줄: 앞말(12px k2) + 숫자(15px 색) + 단위(12px k2). textContent는 이어 붙인 한 줄과 같다 */
function setVal(node: HTMLElement, pre: string, num: string, unit: string): void {
  const key = `${pre}|${num}|${unit}`;
  if (node.dataset.v === key) return;
  node.dataset.v = key;
  node.replaceChildren(el('span', { cls: 'v-u', text: pre }), el('span', { cls: 'v-n', text: num }), el('span', { cls: 'v-u', text: unit }));
}

let tipAnim: Animation | undefined;
/** 첫 탭 전(누적 탭 0)에만 방 안 상자 위에 뜨는 안내 말풍선 */
function syncTip(): void {
  const tip = refs.tip;
  // 방 안 큰 머리글이 떠 있는 동안은 숨겨 글자가 겹치지 않게 한다
  if (state.stats.totalTaps > 0 || fx.headBusy()) {
    if (!tip.hidden) {
      tip.hidden = true;
      tipAnim?.cancel();
      tipAnim = undefined;
    }
    return;
  }
  if (tip.hidden) {
    tip.hidden = false;
    tipAnim = fx.pxFrames(tip, [{ translate: '0 0' }, { translate: '0 -2px' }], 400, { iterations: Infinity });
  }
  setText(tip.firstElementChild as HTMLElement, desktopMq.matches ? 'Space나 클릭으로 열어요' : '상자를 눌러서 열어요');
  placeTip();
}

function placeTip(): void {
  const tip = refs.tip;
  const a = boxAnchor();
  const r = refs.room.getBoundingClientRect();
  if (a.x === 0 && a.y === 0) return;
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  tip.style.left = `${Math.round((a.x - r.left) / a.k - w / 2)}px`;
  tip.style.top = `${Math.round((a.y - a.half - r.top) / a.k - h - 12)}px`;
}

let firstToolHinted = false;

function updateTapPanel(): void {
  const lv = state.tapLevel;
  const cost = tapCost(lv);
  const can = cost <= state.points;
  const nm = nextMilestone(lv, TAP_MILESTONES);
  setText(tapRefs.lv, `Lv ${formatNumber(lv)}`);
  const now = tapValue(state);
  setVal(tapRefs.info, '탭 1회 ', `+${formatNumber(now)}`, ' P');
  setText(tapRefs.next, `→ +${formatNumber(tapValue({ ...state, tapLevel: lv + 1 }))} P`);
  setText(tapRefs.msLabel, nm ? `x2까지 ${formatNumber(nm - lv)}레벨` : '마일스톤 모두 달성');
  const prevTapMs = TAP_MILESTONES.filter((m) => m <= lv).pop() ?? 0;
  tapRefs.msFill.style.transform = `scaleX(${nm ? Math.min(1, (lv - prevTapMs) / (nm - prevTapMs)).toFixed(3) : 1})`;
  setText(tapRefs.buyHead, '강화');
  setText(tapRefs.buyPrice, `${formatNumber(cost)} P`);
  setDisabled(tapBtn, !can);
  toggleClass(tapBtn.closest('.card') as Element, 'affordable', can);
  if (can && !firstToolHinted && lv === 0) {
    firstToolHinted = true;
    fx.edge(tapBtn, 'or', [1, 0, 1, 0, 1, 1]);
  }

  (strikeBtn.closest('.card') as HTMLElement).hidden = !featureOpen(state, 'chain');
  const sl = state.strikeLevel;
  const sCost = strikeCost(sl);
  const sCan = sCost <= state.points;
  setText(strikeRefs.lv, `Lv ${formatNumber(sl)}`);
  setVal(strikeRefs.info, '강타·급소 ', `x${formatNumber(strikeMult(sl))}`, ` → x${formatNumber(strikeMult(sl + 1))}`);
  strikeRefs.best.hidden = state.bestChain < 2;
  setText(strikeRefs.best, `최고 ${formatNumber(state.bestChain)}연쇄`);
  setText(strikeRefs.buyHead, '강화');
  setText(strikeRefs.buyPrice, `${formatNumber(sCost)} P`);
  setDisabled(strikeBtn, !sCan);
  toggleClass(strikeBtn.closest('.card') as Element, 'affordable', sCan);

  const nx = syncGearCards(gearCards, state);
  gearNext.hidden = !nx || !featureOpen(state, 'gear');
  if (nx) setText(gearNext, `상자 ${formatNumber(Math.max(1, nx.left))}개 더 열면 · ${nx.name}`);
  announceGear();
}

/** 공구가 새로 열린 순간 토스트 한 번(불러오기 직후 처음 맞춤은 조용히). 한꺼번에 여러 개면(첫 이사) 한 줄로 */
function announceGear(): void {
  const open = new Set(gearCards.filter((c) => !c.card.hidden).map((c) => c.id));
  const seen = gearOpenSeen;
  gearOpenSeen = open;
  if (!seen) return;
  const fresh = [...open].filter((id) => !seen.has(id));
  if (fresh.length === 1) showToast(`새로 열렸어요 · ${gearDef(fresh[0]).name}`, false, GEAR_ICON[fresh[0]]);
  else if (fresh.length > 1) showToast(`공구 ${fresh.length}종이 열렸어요`, false, GEAR_ICON[fresh[0]]);
}

function dismissModal(): void {
  closeModal?.();
  closeModal = null;
}

function showModal(title: string, body: Node[], actions: Parameters<typeof openModal>[2], opts?: Parameters<typeof openModal>[3]): void {
  dismissModal();
  closeModal = openModal(title, body, actions, opts);
}

function p(text: string, cls = ''): HTMLElement {
  return el('p', { cls, text });
}

function openMoveConfirm(): void {
  if (!moveStatus(state).ok) return;
  const cur = permMult(state.moves);
  const next = permMultAfterMove(state);
  const target = houseInfo(state.moves + 1);
  showModal(
    '이사 갈까요?',
    [
      p('포인트와 공구 강화가 처음으로 돌아가요.'),
      el(
        'div',
        { cls: 'mv-box pf' },
        iconImg(houseIcon(target.theme), { size: 48, alt: '' }),
        el('div', { cls: 'mv-main' }, el('b', { cls: 'fb', text: `다음 집: ${target.name}` }), el('span', {}, '영구 배율은 ', el('b', { cls: 'nowrap mv-num', text: `x${formatNumber(cur)} → x${formatNumber(next)}` }), '가 돼요.')),
      ),
      p(`보상으로 특전 상자 ${movePerkBoxes(state.moves)}개를 받아요.`),
    ],
    [
      { label: '취소', onClick: dismissModal },
      { label: '이사하기', primary: true, onClick: doMove },
    ],
    { icon: iconImg('ui-move', { size: 32, cls: 'title-ico' }) },
  );
}

function doMove(): void {
  if (moving || !moveStatus(state).ok) return;
  moving = true;
  chargeUi.cancel();
  resetWeak();
  heat = initialHeat();
  endComboQuiet();
  dismissModal();
  const toName = houseInfo(state.moves + 1).name;
  fx.moveScene({
    fromName: houseInfo(state.moves).name,
    toName,
    theme: houseInfo(state.moves + 1).theme,
    fromTheme: houseInfo(state.moves).theme,
    fromMult: permMult(state.moves),
    toMult: permMultAfterMove(state),
    onSwap: () => {
      const next = move(state, () => Math.random());
      if (next) state = next;
      guideSay({ type: 'move' });
      shield = initialShield(gearEffects(state).shieldMax);
      shieldMax = shield.n;
      snapNext = true;
      lastReady = false;
      save();
      update();
    },
    onDone: () => {
      moving = false;
      const after = state.moves === MOON_STAGE ? openMoonPopup : strat.afterMove;
      if (guideEndPending) {
        // 가이드 끝 머리글을 먼저 보여 주고, 창·특전 고르기는 그 뒤에
        guideEndPending = false;
        guideFx.guideEnd(guideFxHost);
        window.setTimeout(after, 2400);
      } else after();
    },
  });
}

function receiveReward(): void {
  fx.coinShower({ x: lastPointer.x, y: lastPointer.y }, ptsTarget(), 28);
  vibrate([10, 20, 10]);
  window.setTimeout(() => {
    pendingReward = 0;
  }, 450);
  dismissModal();
}

function openMoonPopup(): void {
  const mult = el('span', { cls: 'nowrap', text: `x${formatNumber(permMult(state.moves - 1))}` });
  showModal(
    '달 기지 도착!',
    [p('지구가 작게 보여요. 이제 우리 집은 달 위에 있어요.'), el('p', { cls: 'dim' }, '영구 배율 ', mult)],
    [{ label: '좋아요', reward: true, onClick: () => { receiveReward(); strat.afterMove(); } }],
    { chip: '보상', noClose: true, icon: iconImg('ui-rocket', { size: 32, cls: 'title-ico' }) },
  );
  const target = permMult(state.moves);
  fx.countUp(mult, target, 900, (v) => `x${formatNumber(v)}`);
  sfx.reward();
  fx.confetti(window.innerWidth / 2, window.innerHeight * 0.6, 50);
}

function openHouseTable(): void {
  const rows: HTMLElement[] = [];
  const shown = Math.max(9, state.moves + 2);
  for (let s = 0; s < shown; s++) {
    const h = houseInfo(s);
    const cls = s === state.moves ? 'house-row pf current' : s < state.moves ? 'house-row pf done' : 'house-row pf';
    const name = el('b', { cls: 'fb', text: h.name });
    if (s === state.moves) name.append(document.createTextNode(' '), el('span', { cls: 'tag', text: '지금' }));
    rows.push(
      el(
        'div',
        { cls },
        iconImg(houseIcon(h.theme), { size: 48, alt: '' }),
        el('div', { cls: 'hr-main' }, name, el('span', { cls: 'hr-goal' }, '이사 목표 ', el('b', { text: `${formatNumber(h.target)} P` }))),
        el('div', { cls: 'hr-mult' }, el('b', { text: `x${formatNumber(permMult(s))}` }), el('span', { text: '영구 배율' })),
      ),
    );
  }
  showModal('집 단계', [p('목표 포인트를 모으면 이사할 수 있어요.', 'dim'), el('div', { cls: 'house-table' }, ...rows)], [{ label: '닫기', onClick: dismissModal }], { icon: iconImg(houseIcon(houseInfo(state.moves).theme), { size: 32, cls: 'title-ico' }) });
}

function settingRow(label: string, on: boolean, onChange: (v: boolean) => void, disabled = false): HTMLElement {
  const box = el('input', { attrs: { type: 'checkbox' } });
  box.checked = on;
  box.disabled = disabled;
  return settingLabel(label, box, onChange);
}

function settingLabel(label: string, box: HTMLInputElement, onChange: (v: boolean) => void): HTMLElement {
  const st = el('span', { cls: 'setting-state' });
  const sync = (): void => { st.textContent = box.disabled ? '' : box.checked ? '켜짐' : '꺼짐'; };
  sync();
  box.addEventListener('change', () => { sync(); onChange(box.checked); });
  return el('label', { cls: 'setting-row' }, el('span', { cls: 'setting-name', text: label }), box, st);
}

function openSettings(): void {
  const box = el('textarea', { cls: 'textbox', attrs: { rows: '3', spellcheck: 'false', 'aria-label': '저장 문자열', placeholder: '백업 코드를 여기에 붙여 넣어요' } });
  const msg = el('div', { cls: 'note dim' });
  const motion = el('input', { attrs: { type: 'checkbox' } });
  motion.checked = state.settings.reduceMotion;
  const exportBtn = button('btn', '내보내기', () => {
    box.value = exportString(state, Date.now());
    box.select();
    msg.textContent = '위 문자열을 복사해 두면 돼요.';
  });
  const importBtn = button('btn', '불러오기', () => {
    const r = importString(box.value);
    if (r.kind !== 'ok') {
      msg.textContent = r.kind === 'future' ? '더 새로운 버전의 저장 데이터예요.' : '저장 문자열이 올바르지 않아요.';
      return;
    }
    resetCombo();
    resetWeak();
    state = { ...r.state, savedAt: Date.now() };
    snapNext = true;
    save();
    dismissModal();
    update();
    showToast('짐을 전부 옮겨 왔어요');
  });
  const resetBtn = button('btn danger reset-btn', '초기화', () => {
    showModal(
      '정말 초기화할까요?',
      [p('모든 진행이 사라지고 되돌릴 수 없어요.')],
      [
        { label: '취소', onClick: dismissModal },
        {
          label: '초기화',
          danger: true,
          onClick: () => {
            clearSave();
            resetCombo();
            resetWeak();
            snapNext = true;
            state = asDebug(defaultState(Date.now(), rollSalt(Math.random)));
            save();
            dismissModal();
            update();
          },
        },
      ],
      { icon: iconImg('ui-settings', { size: 32, cls: 'title-ico' }) },
    );
  });
  showModal(
    '설정',
    [
      settingLabel('움직임 줄이기', motion, (v) => {
        state = { ...state, settings: { ...state.settings, reduceMotion: v } };
        save();
      }),
      settingRow('효과음', getPrefs().sound, (v) => setPrefs({ sound: v })),
      settingRow(hapticsSupported ? '진동' : '진동 (지원하지 않는 기기예요)', getPrefs().haptics, (v) => setPrefs({ haptics: v }), !hapticsSupported),
      el('div', { cls: 'backup-zone' }, el('span', { cls: 'backup-chip', text: '저장 백업' }), p('복사해 두면 다른 기기에서 이어서 해요', 'backup-hint'), box, el('div', { cls: 'row' }, exportBtn, importBtn), msg),
      p('모든 금액·요금·사은품은 허구이며 실제와 무관해요.', 'dim small'),
      p('글꼴: 갈무리(SIL OFL 1.1)', 'dim small'),
      el('div', { cls: 'row reset-zone' }, resetBtn),
    ],
    [{ label: '닫기', onClick: dismissModal }],
    { icon: iconImg('ui-settings', { size: 32, cls: 'title-ico' }) },
  );
}

function save(): void {
  const now = Date.now();
  state = { ...state, savedAt: now };
  writeSave(serialize(state, now));
}

function load(): void {
  const now = Date.now();
  const raw = readSave();
  const r = parseSave(raw);
  if (r.kind === 'future' && raw) {
    writeBackup(raw);
    showToast('더 새로운 버전의 저장 데이터라 불러오지 않았어요. 따로 보관해 뒀어요.');
  }
  if (r.kind === 'corrupt' && raw) writeBackup(raw);
  const base = r.kind === 'ok' ? r.state : defaultState(now, rollSalt(Math.random));
  const out = applyOffline({ ...base, savedAt: base.savedAt || now }, now);
  state = asDebug(out.state);
  returnRush = out.rush;
}

function onVisibility(): void {
  if (document.visibilityState === 'hidden') {
    chargeUi.cancel();
    resetWeak();
    endComboQuiet();
    save();
    return;
  }
  const out = applyOffline(state, Date.now());
  state = out.state;
  if (out.rush) {
    returnRush = true;
    announceReturn();
  }
  lastFrame = performance.now();
  update();
}

/** 시계 상자 러시: 남은 시간이 있는 동안 초당 RUSH_RATE번 자동 탭(한 프레임 최대 3번, 밀린 시간은 버림). 강타 연쇄가 재생되는 동안은 쉰다 */
let rushAcc = 0;
function rushFrame(dt: number): void {
  if (!(state.unpack.rushSec > 0) || chainPlaying()) {
    rushAcc = 0;
    return;
  }
  rushAcc += dt;
  const n = Math.min(3, Math.floor(rushAcc * RUSH_RATE));
  rushAcc = Math.min(rushAcc - n / RUSH_RATE, 1 / RUSH_RATE);
  for (let i = 0; i < n; i++) {
    const wasFever = state.fever.activeSec > 0;
    const r = rushTap(state, () => Math.random(), comboMultOf(state, combo.n));
    state = r.state;
    const c = boxCenter();
    unpackRush({ x: c.x, y: c.y, crit: false, damped: false, burst: r.burst, bursts: r.bursts, gain: r.gain, prize: r.prize, fever: wasFever, pointsEl: ptsTarget() });
    sfx.rushTick();
  }
}

let lastFrame = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - lastFrame) / 1000, 0.25);
  lastFrame = now;
  if (document.visibilityState === 'visible') {
    const nowMs = performance.now();
    chargeUi.frame(nowMs);
    stepWeak(nowMs, dt * 1000);
    stepHeat(dt * 1000);
    chargeUi.sync(heat);
    if (combo.n > 0) {
      const win = comboWindowMs(state.fever.activeSec > 0);
      if (chargeUi.isCharging() || chainPlaying() || state.unpack.rushSec > 0) combo = { ...combo, lastMs: nowMs };
      else if (comboExpired(combo, nowMs, win)) {
        const c = combo;
        combo = initialCombo();
        settleCombo(c, false);
      } else comboUi.tick(nowMs, combo, win);
    }
    rushFrame(dt);
    state = tick(state, dt, () => Math.random());
    guideTickAcc += dt;
    if (guideTickAcc >= 0.5) {
      guideTickAcc = 0;
      guideSay({ type: 'tick' });
    }
    update();
  }
  requestAnimationFrame(frame);
}

build();
load();
snapNext = true;
lastReady = null;
update();
if (state.notice?.kind === 'v9') showV9Notice(state.notice.boxes);
else announceReturn();
document.addEventListener('visibilitychange', onVisibility);
window.addEventListener('beforeunload', save);
setInterval(save, 10_000);
requestAnimationFrame(frame);
