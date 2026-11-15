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
import './px/room.css';
import { SERVICES, SERVICE_MILESTONES, TAP_MILESTONES } from '../data/services';
import { MOON_STAGE } from '../data/houses';
import {
  buyService,
  buyTapUpgrade,
  bulkCost,
  permMult,
  isUnlocked,
  maxAffordable,
  milestoneMult,
  nextMilestone,
  pps,
  nextTapRatio,
  serviceProd,
  tapCost,
  tapGate,
  initialTapGate,
  type TapGateState,
  tapRatio,
  tapValue,
  tick,
} from '../logic/economy';
import { tapAndHit } from '../logic/unpack';
import { formatDuration, formatNumber, speedTitle } from '../logic/format';
import { applyOffline, offlineCapSec, type OfflineResult } from '../logic/offline';
import { houseInfo, move, moveProgress, moveStatus, permMultAfterMove } from '../logic/prestige';
import { exportString, importString, parseSave, serialize } from '../logic/save';
import type { GameState } from '../logic/state';
import { defaultState } from '../logic/state';
import { houseIcon, iconImg, iconUrl, preloadIcons, setLabel, svcIcon, type IconName } from './icons';
import { desktopMq, el, glyph, openModal, setDisabled, setText, toggleClass } from './dom';
import { initKeys } from './keys';
import { clearSave, readSave, writeBackup, writeSave } from './storage';
import * as fx from './fx';
import { sfx } from './sound';
import { getPrefs, hapticsSupported, setPrefs, vibrate } from './prefs';
import { boxAnchor, boxCenter, dockToolEl, initUnpack, makeToolEl, roomStrip, shelfItemEl, syncUnpack, unpackHit } from './unpackUi';
import { fresh, type UiCtx } from './collectUi';
import { canBuyBox, initBox, panel as boxPanel, updateBox } from './box';
import { initDex, panel as dexPanel, renderDex, updateDex } from './dex';
import { badge as feverBadge, gauge as feverGauge, initFever, syncFever } from './feverUi';
import { initParcel, syncParcel } from './parcelUi';
import { tapEffect } from './tapFx';
import * as strat from './strategyUi';
import { nextUnlock, UNLOCK_NAME } from '../logic/unlock';
import { clearNewTabDot, hasNewTabDot, initUnlock, syncUnlock, tabOpen } from './unlockUi';
import { badgeEl as eventBadge, callBtn as eventCall, initEvent, syncEvent } from './eventUi';

type BuyMode = 1 | 10 | 'max';
preloadIcons();

type TabId = 'services' | 'tap' | 'box' | 'dex';

let state: GameState = defaultState();
let buyMode: BuyMode = 1;
let activeTab: TabId = 'services';
let tapGateState: TapGateState = initialTapGate();
let closeModal: (() => void) | null = null;
let moving = false;
let snapNext = true;
let pendingReward = 0;
let lastTitle = '';
let lastP = 0;
let lastReady: boolean | null = null;
const lastPointer = { x: 195, y: 420 };
window.addEventListener('pointerdown', (e) => {
  lastPointer.x = e.clientX;
  lastPointer.y = e.clientY;
}, { capture: true, passive: true });

const refs = {
  topIco: el('span', { cls: 'top-ico' }),
  houseName: el('span', { cls: 'house-name' }),
  badge: el('span', { cls: 'badge' }),
  speedVal: el('span'),
  speed: el('div', { cls: 'speed-num' }),
  speedTitle: el('div', { cls: 'speed-title' }),
  points: el('div', { cls: 'points' }),
  ptsMain: el('span', { cls: 'pts-main' }),
  ptsRate: el('span', { cls: 'pts-rate' }),
  room: el('div', { cls: 'room' }),
  phone: el('button', { cls: 'phone', attrs: { 'aria-label': '상담 전화 받기' } }),
  miniPhone: el('button', { cls: 'dock-phone', attrs: { 'aria-label': '상담 전화 받기(독 버튼)' } }, dockToolEl),
  dockPts: el('span', { cls: 'dock-pts-main' }),
  dockRate: el('span', { cls: 'dock-pts-rate' }),
  seg: el('div', { cls: 'seg', attrs: { role: 'group', 'aria-label': '구매 수량' } }),
  tapHint: el('div', { cls: 'tap-hint' }),
  tip: el('div', { cls: 'first-tip', attrs: { hidden: '', 'aria-hidden': 'true' } }, el('span', { cls: 'first-tip-t' }), el('i', { cls: 'first-tip-tail' })),
  barFill: el('div', { cls: 'bar-fill' }),
  barText: el('div', { cls: 'bar-text' }),
  moveBtn: el('button', { cls: 'btn primary move-btn', text: '이사' }),
  panel: el('main', { cls: 'panel' }),
  toast: el('div', { cls: 'toasts', attrs: { 'aria-live': 'polite' } }),
};

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

const prevCan: (boolean | undefined)[] = [];
const lastSpark: number[] = [];

interface ServiceRow {
  card: HTMLElement;
  msFill: HTMLElement;
  msLabel: HTMLElement;
  icon: HTMLElement;
  name: HTMLElement;
  lv: HTMLElement;
  info: HTMLElement;
  btn: HTMLButtonElement;
  buyHead: HTMLElement;
  buyPrice: HTMLElement;
  chips: HTMLElement;
}
const serviceRows: ServiceRow[] = [];
let cardListEl: HTMLElement | null = null;
const modeBtns = new Map<BuyMode, HTMLButtonElement>();
const tabBtns = new Map<TabId, HTMLButtonElement>();
const tabDots = new Map<TabId, HTMLElement>();
const multBtn = el('button', { cls: 'info-btn', attrs: { type: 'button', 'aria-label': '배율 내역 보기', title: '배율 내역 보기' } });
const servicesPanel = el('div', { cls: 'panel-inner' });
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
  const header = el('header', { cls: 'top' }, refs.topIco, refs.houseName, refs.badge, eventBadge, strat.perkBtn, settingsBtn);

  refs.phone.type = 'button';
  refs.phone.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    doTap(e.clientX, e.clientY);
  });
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
  });
  refs.miniPhone.addEventListener('click', (e) => {
    if (e.detail === 0) {
      const r = refs.miniPhone.getBoundingClientRect();
      doTap(r.left + r.width / 2, r.top + r.height / 2, refs.miniPhone);
    }
  });
  refs.points.append(iconImg('coin', { size: 32, cls: 'pts-coin' }), refs.ptsMain, refs.ptsRate, feverBadge);
  refs.room.append(refs.phone, refs.tapHint, eventCall, refs.tip);
  initFever(refs.room, refs.phone);
  initUnpack({ room: refs.room, eventCall, tapHint: refs.tapHint, toast: showToast });
  fx.combo.attach(refs.room);

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
    ['services', '서비스', iconImg('svc-internet', { size: 48 })],
    ['tap', '공구 강화', iconImg('ui-tools', { size: 48 })],
    ['box', '상자', iconImg('box-closed', { size: 32 })],
    ['dex', '도감', iconImg('ui-dex', { size: 32 })],
  ];
  for (const [id, label, icon] of defs) {
    const b = button('tab', '', () => selectTab(id));
    const dot = el('i', { cls: 'dot', attrs: { hidden: '' } });
    b.append(el('span', { cls: 'tab-ico' }, icon, dot), el('span', { cls: 'tab-lbl', text: label }));
    tabDots.set(id, dot);
    tabBtns.set(id, b);
    if (id !== 'services') b.dataset.ux = id;
    const grp = id === 'services' || id === 'tap' ? tabsL : tabsR;
    grp.append(b);
    if (id !== 'services') grp.append(el('span', { cls: 'tab-lock', attrs: { 'aria-hidden': 'true', 'data-lock': id } }));
  }
  tabs.append(tabsL, el('span', { cls: 'tab-gap', attrs: { 'aria-hidden': 'true' } }), tabsR, refs.miniPhone);
  const modes: [BuyMode, string][] = [
    [1, 'x1'],
    [10, 'x10'],
    ['max', 'MAX'],
  ];
  for (const [m, label] of modes) {
    const b = button('chip fb', label, () => {
      buyMode = m;
      update();
    });
    modeBtns.set(m, b);
    refs.seg.append(b);
  }
  const dock = el('nav', { cls: 'dock', attrs: { 'aria-label': '메뉴' } }, el('div', { cls: 'dock-band' }, el('div', { cls: 'dock-pts' }, iconImg('coin', { size: 32, alt: '', cls: 'pts-coin' }), el('span', { cls: 'dock-pts-txt' }, refs.dockPts, refs.dockRate)), refs.seg), tabs);

  buildServicesPanel();
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
  };
  initUnlock({ ctx: uiCtx, toast: showToast, isActiveTab: (id) => activeTab === id });
  initBox(uiCtx);
  initDex(uiCtx);
  initEvent(uiCtx);
  initParcel(refs.room, ptsTarget, uiCtx);
  strat.initStrategy({
    ctx: uiCtx,
    card: (i) => serviceRows[i]?.card ?? null,
    icon: (i) => serviceRows[i]?.icon ?? null,
    servicesVisible: () => activeTab === 'services',
    toast: showToast,
    buyCount,
  });
  refs.speed.append(refs.speedVal, el('span', { cls: 'speed-unit', text: ' Mbps' }));
  for (const n of [refs.speed, refs.ptsRate, multBtn]) n.addEventListener('click', () => strat.toggleMult(refs.points));
  if (location.search.includes('debug')) (window as unknown as { __ajd: unknown }).__ajd = { particles: fx.particleCount, toast: showToast, get: () => state, set: (s: GameState) => { state = s; } };

  const keyHint = el('p', { cls: 'key-hint' });
  for (const [keys, label] of [[['Space'], '상자 치기'], [['1~4'], '탭 전환'], [['Q', 'W', 'E'], '수량'], [['Esc'], '닫기']] as [string[], string][]) {
    keyHint.append(el('span', { cls: 'kh' }, el('span', {}, ...keys.map((k) => el('kbd', { text: k }))), label));
  }
  const colPlay = el('div', { cls: 'col-play' }, header, el('section', { cls: 'hero' }, el('div', { cls: 'speed-wrap' }, refs.speed, multBtn), refs.speedTitle, refs.points), refs.room, feverGauge, ...(roomStrip() ? [roomStrip()!] : []), moveBlock, keyHint);
  const colList = el('div', { cls: 'col-list' }, refs.panel);
  const page = el('div', { cls: 'page' }, colPlay, colList);
  app.append(
    page,
    refs.toast,
    dock,
  );
  const placeDock = (): void => {
    if (desktopMq.matches) {
      colList.prepend(dock);
      strat.topBar.firstElementChild?.append(refs.seg);
    } else {
      app.append(dock);
      dock.querySelector('.dock-band')?.append(refs.seg);
    }
    servicesPanel.prepend(strat.topBar);
  };
  placeDock();
  desktopMq.addEventListener('change', placeDock);
  initKeys({
    tap: () => {
      const c = boxCenter();
      doTap(c.x, c.y);
    },
    tab: (n) => {
      const id = (['services', 'tap', 'box', 'dex'] as TabId[])[n];
      if (tabOpen(id)) selectTab(id);
    },
    mode: (m) => {
      buyMode = m;
      update();
    },
  });
  selectTab('services');
}

const nextText = el('span', { cls: 'next-unlock-t' });
const nextLine = el('div', { cls: 'next-unlock', attrs: { hidden: '' } });

function buildServicesPanel(): void {
  const cardList = el('div', { cls: 'card-list' });
  cardListEl = cardList;
  servicesPanel.append(strat.topBar, cardList);
  nextLine.append(nextText);
  cardList.after(nextLine);
  SERVICES.forEach((def, i) => {
    const icon = el('div', { cls: 'card-icon' }, iconImg(svcIcon(def.id), { size: 48, alt: def.name }));
    icon.style.setProperty('--ic', `url(${iconUrl(svcIcon(def.id))})`);
    const name = el('span', { cls: 'card-name', text: def.name });
    const lv = el('span', { cls: 'card-lv' });
    const info = el('div', { cls: 'card-info key' });
    const buyHead = el('span', { cls: 'buy-h' });
    const buyPrice = el('span', { cls: 'buy-p fb' });
    const btn = el('button', { cls: 'btn buy fb' }, buyHead, buyPrice);
    btn.type = 'button';
    onBuy(btn, (repeat) => buyServiceClick(i, repeat));
    const msFill = el('div', { cls: 'ms-fill' });
    const msLabel = el('span', { cls: 'ms-label' });
    const ms = el('div', { cls: 'ms-bar' }, msFill);
    const ex = strat.buildCardExtras(i);
    const card = el(
      'div',
      { cls: 'card' },
      el('div', { cls: 'card-lead' }, icon, ex.chips),
      el('div', { cls: 'card-main' }, el('div', { cls: 'card-title' }, name, lv), info, ex.hint, msLabel, ms),
      el('div', { cls: 'card-side' }, btn, ex.contractBtn),
    );
    serviceRows.push({ card, msFill, msLabel, icon, name, lv, info, btn, buyHead, buyPrice, chips: ex.chips });
    cardList.append(card);
  });
}

function buildTapPanel(): void {
  tapBtn.type = 'button';
  onBuy(tapBtn, (repeat) => {
    const before = state.tapLevel;
    const next = buyTapUpgrade(state);
    if (!next) return false;
    state = next;
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
  const tapRow = tapRefs.info.parentElement!;
  tapRow.setAttribute('role', 'button');
  tapRow.setAttribute('aria-label', '탭 수익 내역 보기');
  tapRow.addEventListener('click', () => strat.toggleMult(tapRefs.info, 'tap'));
  tapPanel.append(
    card,
    el('p', { cls: 'note dim tool-note', text: '상자를 치면 포인트가 들어와요. 강화하면 한 번 칠 때 수익이 늘어요.' }),
    el('p', { cls: 'note dim tool-note', text: '탭 1회 줄을 누르면 내역이 보여요.' }),
  );
}

function selectTab(id: TabId): void {
  activeTab = id;
  clearNewTabDot(id);
  const panels: Record<TabId, HTMLElement> = { services: servicesPanel, tap: tapPanel, box: boxPanel, dex: dexPanel };
  refs.panel.replaceChildren(panels[id]);
  strat.topBar.hidden = id !== 'services';
  toggleClass(refs.panel, 'surface', id === 'box' || id === 'dex');
  const top = refs.panel.getBoundingClientRect().top + window.scrollY - 8;
  if (!desktopMq.matches && window.scrollY > top) window.scrollTo(0, top);
  if (id === 'dex') renderDex(true);
  update();
}

function buyCount(i: number): number {
  const lv = state.services[i];
  if (buyMode === 'max') return Math.max(1, maxAffordable(i, lv, state.points));
  return buyMode;
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

let lastBuyGain = 0;
/** 구매 때 뜨는 +N/초: 항상 자기 카드 안. 기본은 생산량 글자 오른쪽에서 떠오르고, 이름·Lv 칩·"Lv N에서 x2"·막대·버튼·아이콘의 칸(2px 여유)과 겹치는 떠오름 폭은 줄여서(최소 6px) 비킨다. 그래도 자리가 없으면 구매 버튼 왼쪽 4px 앞에 붙인다 */
function buyGainText(row: ServiceRow, text: string): void {
  const place = (w: number, h: number): { x: number; y: number; rise: number } => {
    const textBox = (n: Element): DOMRect => {
      const rg = document.createRange();
      rg.selectNodeContents(n);
      const r = rg.getBoundingClientRect();
      return r.width > 0 ? r : n.getBoundingClientRect();
    };
    const cr = row.card.getBoundingClientRect();
    const tr = textBox(row.info);
    const ir = row.info.getBoundingClientRect();
    const btnL = row.btn.getBoundingClientRect().left;
    const obs: DOMRect[] = [row.name, row.lv, row.icon, row.chips, row.btn.parentElement!].map((n) => n.getBoundingClientRect());
    for (const c of Array.from(row.info.parentElement?.children ?? [])) if (c !== row.info && c !== row.name.parentElement) obs.push(textBox(c));
    const gap = 2;
    const hit = (l: number, t: number, r: number, b: number): boolean => obs.some((o) => o.width > 0 && o.height > 0 && l < o.right + gap && r > o.left - gap && t < o.bottom + gap && b > o.top - gap);
    const midY = ir.top + ir.height / 2 - h / 2;
    const xs = [tr.right + 8, btnL - 4 - w];
    let pos: { x: number; y: number; rise: number } | null = null;
    search: for (const x of xs) {
      if (x + w > btnL - 4 || x < cr.left + 2) continue;
      for (let dy = 0; dy <= 40; dy += 2) {
        for (const sy of dy ? [midY + dy, midY - dy] : [midY]) {
          if (sy + h > cr.bottom - 2) continue;
          for (let rise = 12; rise >= 6; rise -= 2) {
            if (sy - rise < cr.top + 2) continue;
            if (!hit(x, sy - rise, x + w, sy + h)) {
              pos = { x, y: sy, rise };
              break search;
            }
          }
        }
      }
    }
    const x = pos ? pos.x : Math.max(cr.left + 2, btnL - 4 - w);
    const y = pos ? pos.y : Math.min(Math.max(midY, cr.top + 14), cr.bottom - 2 - h);
    return { x, y, rise: pos ? pos.rise : 12 };
  };
  fx.floatText(0, 0, text, { scale: 1, ms: 900, cls: 'buy-gain', left: true, at: place });
}
function buyServiceClick(i: number, repeat = false): boolean {
  const before = state.services[i];
  const ppsBefore = pps(state);
  const next = buyService(state, i, buyCount(i));
  if (!next) return false;
  state = next;
  update();
  const row = serviceRows[i];
  const now = performance.now();
  if (!repeat || now - lastBuyGain > 320) {
    lastBuyGain = now;
    const dp = pps(state) - ppsBefore;
    if (dp > 0) buyGainText(row, `+${formatNumber(dp)}/초`);
  }
  sfx.buy();
  vibrate(repeat ? 6 : 12);
  fx.bounce(row.card, repeat ? 0.98 : 0.95);
  fx.pop(row.lv, 1.5);
  if (!repeat) buyFlourish(i, row);
  checkMilestone(SERVICES[i].name, before, state.services[i], SERVICE_MILESTONES, row.card);
  return true;
}

/** 서비스 목록(스크롤 영역) 윗변: 구매 연출은 이 위로 올라가지 않는다 */
function listTop(): number {
  if (window.innerWidth >= 900) {
    const head = document.querySelector<HTMLElement>('.strat-line');
    if (head && head.offsetParent) return head.getBoundingClientRect().bottom + 8;
  }
  let e: HTMLElement | null = cardListEl;
  while (e && e !== document.body) {
    const oy = getComputedStyle(e).overflowY;
    if (oy === 'auto' || oy === 'scroll') return e.getBoundingClientRect().top;
    e = e.parentElement;
  }
  return cardListEl ? cardListEl.getBoundingClientRect().top : 0;
}

function buyFlourish(i: number, row: ServiceRow): void {
  const bp = row.btn.getBoundingClientRect();
  fx.burst(bp.left + bp.width / 2, bp.top - 4, { n: 5, size: 6, colors: ['g2', 'g3', 'k5'], gravity: 400, up: true, avoid: bp, top: listTop() });
  fx.wobble(row.icon);
  const item = shelfItemEl(i);
  fx.flyIcon(svcIcon(SERVICES[i].id), row.icon, item ?? refs.room, {
    onArrive: () => {
      const it = shelfItemEl(i);
      if (!it) return;
      fx.wobble(it);
      const r = it.getBoundingClientRect();
      fx.burst(r.left + r.width / 2, r.top + r.height / 2, { n: 8, kind: 'star', colors: ['#ffc83d', '#ffffff'], speed: 160, size: 5 });
    },
  });
}

function doTap(x: number, y: number, via: HTMLElement = refs.phone): void {
  const gate = tapGate(tapGateState, performance.now());
  tapGateState = { recent: gate.recent, tokens: gate.tokens, lastMs: gate.lastMs };
  if (!gate.ok) return;
  const wasFever = state.fever.activeSec > 0;
  const r = tapAndHit(state, () => Math.random(), gate.damped);
  state = r.state;
  const c = fx.combo.hit();
  fx.bounce(via, 0.86);
  tapEffect({ x, y, gain: r.gain, crit: r.crit, damped: r.damped, fever: wasFever, combo: c, lite: true, anchor: boxAnchor(), pointsEl: ptsTarget(), phone: refs.phone, app: document.getElementById('app')! });
  unpackHit({ x, y, crit: r.crit, damped: r.damped, burst: r.burst, fever: wasFever, pointsEl: ptsTarget() });
  update();
}

/** 토스트: 일반 = k1 면, 보상(gold) = g2 면, 열림(icon) = k1 면 + or 테두리. 글자 폭 칩, 방 윗변 4px 아래 가운데. 아래로 쌓고 최대 2개 */
function showToast(msg: string, gold = false, icon?: IconName): void {
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

function update(): void {
  if (activeTab !== 'services' && !tabOpen(activeTab)) {
    selectTab('services');
    return;
  }
  const house = houseInfo(state.moves);
  const p = pps(state);

  document.body.dataset.theme = house.theme;
  if (refs.houseName.textContent !== house.name) {
    refs.houseName.textContent = house.name;
    fitHead();
  }
  if (refs.topIco.dataset.theme !== house.theme) {
    refs.topIco.dataset.theme = house.theme;
    refs.topIco.replaceChildren(iconImg(houseIcon(house.theme), { size: 48, alt: '' }));
  }
  setText(refs.badge, `영구 x${formatNumber(permMult(state.moves))}`);
  fx.setReduced(state.settings.reduceMotion);
  const shownPoints = Math.max(0, state.points - pendingReward);
  if (snapNext) {
    rollSpeed.snap(p);
    rollPoints.snap(shownPoints);
    rollRate.snap(p);
    rollDockPts.snap(shownPoints);
    rollDockRate.snap(p);
  } else {
    rollSpeed.set(p);
    rollPoints.set(shownPoints);
    rollRate.set(p);
    rollDockPts.set(shownPoints);
    rollDockRate.set(p);
  }
  const title = speedTitle(p);
  if (lastTitle && title !== lastTitle && p > lastP && !snapNext) {
    fx.flash('#5b92ff', 600);
    fx.banner(title, { sub: '회선 등급이 올라갔어요', tone: 'gold', ms: 1800 });
    sfx.title();
    vibrate([20, 40, 20]);
  }
  lastTitle = title;
  lastP = p;
  setText(refs.speedTitle, title);
  syncFever(state);
  syncParcel(state);
  syncUnpack(state);
  setText(refs.tapHint, `탭 +${formatNumber(tapValue(state))}`);
  syncTip();

  const prog = moveProgress(state);
  const mst = moveStatus(state);
  const ready = mst.ok;
  refs.barFill.style.width = `${(prog * 100).toFixed(1)}%`;
  toggleClass(refs.barFill, 'full', prog >= 1);
  const special = strat.moveBarText(state, '');
  const pct = Math.floor(prog * 100);
  const goal = `이사 목표 ${pct}% · ${formatNumber(house.target)} P`;
  refs.barText.parentElement?.classList.toggle('warn', !!special);
  setBarOptions(special ? [special, special.replace(/^이사할 수 있어요 · /, '')] : ready ? ['이사할 수 있어요'] : [goal, `이사 목표 ${pct}%`, `이사 ${pct}%`]);
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
  strat.sync(state, snapNext);
  snapNext = false;

  refs.seg.hidden = activeTab !== 'services';
  for (const [m, b] of modeBtns) toggleClass(b, 'active', m === buyMode);
  for (const [id, b] of tabBtns) toggleClass(b, 'active', id === activeTab);

  if (activeTab === 'services') updateServices();
  else if (activeTab === 'tap') updateTapPanel();
  else if (activeTab === 'box') updateBox();
  else updateDex();

  const dots: [TabId, boolean][] = [
    ['tap', activeTab !== 'tap' && hasNewTabDot('tap')],
    ['box', activeTab !== 'box' && (canBuyBox() || hasNewTabDot('box'))],
    ['dex', activeTab !== 'dex' && (fresh.size > 0 || hasNewTabDot('dex'))],
  ];
  for (const [id, on] of dots) {
    const d = tabDots.get(id)!;
    if (d.hidden === on) d.hidden = !on;
  }
  syncEvent();
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
  if (state.stats.totalTaps > 0) {
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

let firstBuyHinted = false;

function updateNextLine(): void {
  const n = nextUnlock(state);
  nextLine.hidden = n === null;
  if (n) setText(nextText, `다음: ${UNLOCK_NAME[n.id]} · ${n.cond}`);
}

function updateServices(): void {
  updateNextLine();
  const firstLocked = SERVICES.findIndex((_, i) => !isUnlocked(state, i));
  SERVICES.forEach((def, i) => {
    const row = serviceRows[i];
    const unlocked = isUnlocked(state, i);
    toggleClass(row.card, 'ux-none', firstLocked >= 0 && i > firstLocked);
    toggleClass(row.card, 'locked', !unlocked);
    if (!unlocked) {
      setText(row.name, '???');
      setText(row.lv, '');
      delete row.info.dataset.v;
      setText(row.info, `${SERVICES[i - 1].name} Lv 1이 필요해요`);
      setText(row.buyHead, '잠김');
      setText(row.buyPrice, '');
      setDisabled(row.btn, true);
      toggleClass(row.card, 'affordable', false);
      prevCan[i] = undefined;
      return;
    }
    const lv = state.services[i];
    const count = buyCount(i);
    const cost = bulkCost(i, lv, count);
    const can = Number.isFinite(cost) && cost <= state.points;
    const nm = nextMilestone(lv, SERVICE_MILESTONES);
    setText(row.name, def.name);
    setText(row.lv, `Lv ${formatNumber(lv)}`);
    setVal(row.info, '', `+${formatNumber(serviceProd(state, i))}`, '/초');
    const prevMs = SERVICE_MILESTONES.filter((m) => m <= lv).pop() ?? 0;
    row.msFill.style.transform = `scaleX(${nm ? Math.min(1, (lv - prevMs) / (nm - prevMs)).toFixed(3) : 1})`;
    setText(row.msLabel, nm ? `Lv ${nm}에서 x2` : '마일스톤 모두 달성');
    setText(row.buyHead, `${count > 1 ? `x${formatNumber(count)} ` : ''}구매`);
    setText(row.buyPrice, `${formatNumber(cost)} P`);
    setDisabled(row.btn, !can);
    toggleClass(row.card, 'affordable', can);
    const now = performance.now();
    if (can && prevCan[i] === false && now - (lastSpark[i] ?? 0) > 2000) {
      lastSpark[i] = now;
      fx.sparkle(row.card, row.icon);
    }
    prevCan[i] = can;
    if (i === 0 && can && !firstBuyHinted && activeTab === 'services' && state.services.every((v) => v === 0)) {
      firstBuyHinted = true;
      fx.edge(row.btn, 'or', [1, 0, 1, 0, 1, 1]);
    }
  });
}

function updateTapPanel(): void {
  const lv = state.tapLevel;
  const cost = tapCost(lv);
  const can = cost <= state.points;
  const nm = nextMilestone(lv, TAP_MILESTONES);
  setText(tapRefs.lv, `Lv ${formatNumber(lv)}`);
  const pct = (r: number): string => `${formatNumber(r * 100)}%`;
  setVal(tapRefs.info, '탭 1회 ', `+${formatNumber(tapValue(state))}`, ' P');
  const ra = tapRatio(lv);
  const rb = nextTapRatio(lv);
  const shown = (r: number, d?: number): string => `${d === undefined ? formatNumber(r * 100) : +(r * 100).toFixed(d)}%`;
  const dig = [undefined, 2, 3].find((d) => shown(ra, d) !== shown(rb, d));
  setText(tapRefs.next, dig === undefined && shown(ra) === shown(rb) ? `탭 비율 ${shown(ra, 3)}` : `탭 비율 ${shown(ra, dig)} → ${shown(rb, dig)}`);
  setText(tapRefs.msLabel, nm ? `Lv ${nm}에서 비율 ${pct(tapRatio(nm))}` : '마일스톤 모두 달성');
  const prevTapMs = TAP_MILESTONES.filter((m) => m <= lv).pop() ?? 0;
  tapRefs.msFill.style.transform = `scaleX(${nm ? Math.min(1, (lv - prevTapMs) / (nm - prevTapMs)).toFixed(3) : 1})`;
  setText(tapRefs.buyHead, '강화');
  setText(tapRefs.buyPrice, `${formatNumber(cost)} P`);
  setDisabled(tapBtn, !can);
  toggleClass(tapBtn.closest('.card') as Element, 'affordable', can);
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
      p('포인트, 서비스, 공구 강화가 처음으로 돌아가요.'),
      el(
        'div',
        { cls: 'mv-box pf' },
        iconImg(houseIcon(target.theme), { size: 48, alt: '' }),
        el('div', { cls: 'mv-main' }, el('b', { cls: 'fb', text: `다음 집: ${target.name}` }), el('span', {}, '영구 배율은 ', el('b', { cls: 'nowrap mv-num', text: `x${formatNumber(cur)} → x${formatNumber(next)}` }), '가 돼요.')),
      ),
      ...strat.moveConfirmNotes(state),
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
      snapNext = true;
      lastReady = false;
      save();
      update();
    },
    onDone: () => {
      moving = false;
      if (state.moves === MOON_STAGE) openMoonPopup();
      else strat.afterMove();
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

function openOfflinePopup(r: OfflineResult): void {
  pendingReward += r.gain;
  const gain = el('b', { cls: 'reward-num', text: '0' });
  const body: HTMLElement[] = [p('집이 그동안 혼자 일했어요.'), p(`${formatDuration(r.seconds)} 동안 모인 포인트예요`, 'dim'), el('div', { cls: 'reward-box' }, gain, document.createTextNode(' P'))];
  if (r.capped) body.push(p(`최대 ${formatDuration(offlineCapSec(state))}까지 쌓여요`, 'dim small'));
  showModal('어서 와요!', body, [{ label: '받기', reward: true, onClick: receiveReward }], { chip: '보상', noClose: true, icon: iconImg('coin-pile', { size: 32, cls: 'title-ico' }) });
  fx.countUp(gain, r.gain, 900, formatNumber);
  sfx.reward();
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
            snapNext = true;
            state = defaultState(Date.now());
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

function load(): OfflineResult | null {
  const now = Date.now();
  const raw = readSave();
  const r = parseSave(raw);
  if (r.kind === 'future' && raw) {
    writeBackup(raw);
    showToast('더 새로운 버전의 저장 데이터라 불러오지 않았어요. 따로 보관해 뒀어요.');
  }
  if (r.kind === 'corrupt' && raw) writeBackup(raw);
  const base = r.kind === 'ok' ? r.state : defaultState(now);
  const out = applyOffline({ ...base, savedAt: base.savedAt || now }, now);
  state = out.state;
  return out.report;
}

function onVisibility(): void {
  if (document.visibilityState === 'hidden') {
    save();
    return;
  }
  const out = applyOffline(state, Date.now());
  state = out.state;
  if (out.report) openOfflinePopup(out.report);
  lastFrame = performance.now();
  update();
}

let lastFrame = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - lastFrame) / 1000, 0.25);
  lastFrame = now;
  if (document.visibilityState === 'visible') {
    state = tick(state, dt, () => Math.random());
    update();
  }
  requestAnimationFrame(frame);
}

build();
const report = load();
snapNext = true;
lastTitle = '';
lastReady = null;
if (report) openOfflinePopup(report);
update();
document.addEventListener('visibilitychange', onVisibility);
window.addEventListener('beforeunload', save);
setInterval(save, 10_000);
requestAnimationFrame(frame);
