// 전략 요소 화면: 결합 할인 · 이사 특전 3택 · 약정 · 위약금 · 배율 내역. 로직은 읽기/호출만 한다.
import { BUNDLES } from '../data/bundles';
import { CONTRACTS, type ContractKind } from '../data/contracts';
import { PERKS, type PerkCategory } from '../data/perks';
import { SERVICES, TAPS_PER_SEC_FULL, TAP_MILESTONES } from '../data/services';
import { bundleStatuses } from '../logic/bundle';
import { contractBlock, contractPenaltyPreview, contractSlots, contractStatuses, freeContractSlots, startContract } from '../logic/contract';
import { contractExtraPps, multBreakdown, serviceProd, tapBreakdown } from '../logic/economy';
import { formatDuration, formatNumber } from '../logic/format';
import { choosePerk, discardPerkOffer, pendingPerkCount, perkLevel, perkOfferViews, type PerkOptionView } from '../logic/perks';
import { moveStatus } from '../logic/prestige';
import type { GameState } from '../logic/state';
import type { UiCtx } from './collectUi';
import { bundleIcon, iconImg, iconUrl, perkIcon, setLabel, svcIcon } from './icons';
import { desktopMq, el, glyph, setDisabled, setText, toggleClass } from './dom';
import * as fx from './fx';
import { vibrate } from './prefs';
import { sfx } from './sound';

export interface StrategyHooks {
  ctx: UiCtx;
  card(i: number): HTMLElement | null;
  icon(i: number): HTMLElement | null;
  servicesVisible(): boolean;
  toast(msg: string): void;
  buyCount(i: number): number;
}

let H: StrategyHooks;
const CAT_NAME: Record<PerkCategory, string> = { tap: '탭', idle: '방치', luck: '운', strategy: '전략' };
const KIND_NAME: Record<ContractKind, string> = { short: '짧게', normal: '보통', long: '길게' };

export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function minutesLeft(sec: number): string {
  return sec <= 60 ? `${Math.max(1, Math.ceil(sec))}초` : `${Math.ceil(sec / 60)}분`;
}

// ---------- 서비스 탭 상단: 약정 칸 + 결합 목록 ----------
const slotsPill = el('span', { cls: 'slots-pill' });
const bundleToggle = el('button', { cls: 'chip bundle-toggle', attrs: { type: 'button', 'aria-expanded': 'true' } });
const bundleToggleText = el('span', { cls: 'lbl' });
const bundleDot = el('i', { cls: 'dot', attrs: { hidden: '' } });
bundleToggle.append(bundleToggleText, glyph('chevron'), bundleDot);
let bundleAlert = false;
let bundleSeen = false;
const bundleRow = el('div', { cls: 'bundle-row' });
export const topBar = el('div', { cls: 'strat-top' }, el('div', { cls: 'strat-line' }, slotsPill, bundleToggle), bundleRow);
let bundlesOpen = window.innerWidth >= 900 && window.innerHeight > 1000;

interface BundleChipRefs {
  root: HTMLElement;
  mult: HTMLElement;
  barFill: HTMLElement;
  next: HTMLElement;
  need: HTMLElement;
}
const bundleChips = new Map<string, BundleChipRefs>();

function buildBundleChips(): void {
  for (const b of BUNDLES) {
    const mult = el('span', { cls: 'bc-mult' });
    const barFill = el('div', { cls: 'bc-fill' });
    const next = el('div', { cls: 'bc-next' });
    const need = el('div', { cls: 'bc-need' });
    const root = el(
      'div',
      { cls: 'bchip pf', attrs: { 'data-bundle': b.id } },
      el('div', { cls: 'bc-head' }, el('span', { cls: 'bc-name' }, iconImg(bundleIcon(b.id), { size: 32, cls: 'bc-ico-img' }), el('span', { cls: 'bc-name-t', text: b.name })), mult),
      el('div', { cls: 'bc-mid' }, need, next),
      el('div', { cls: 'bc-bar' }, barFill),
    );
    bundleChips.set(b.id, { root, mult, barFill, next, need });
    bundleRow.append(root);
  }
}

// ---------- 서비스 카드 덧붙임(결합 칩·힌트·약정 버튼·약정 배지) ----------
interface CardExtras {
  chips: HTMLElement;
  hint: HTMLElement;
  contractBtn: HTMLButtonElement;
  badge: HTMLElement;
  bundleSpans: Map<string, HTMLElement>;
}
const extras = new Map<number, CardExtras>();

export function buildCardExtras(i: number): { chips: HTMLElement; hint: HTMLElement; contractBtn: HTMLButtonElement } {
  const badge = el('span', { cls: 'ct-badge', attrs: { hidden: '' } });
  const chips = el('div', { cls: 'card-chips' }, badge);
  const bundleSpans = new Map<string, HTMLElement>();
  for (const b of BUNDLES) {
    if (!b.services.includes(i)) continue;
    const s = el('span', { cls: 'mini-chip', attrs: { title: b.name, 'aria-label': b.name } });
    bundleSpans.set(b.id, s);
    chips.append(s);
  }
  const hint = el('div', { cls: 'bundle-hint', attrs: { hidden: '' } });
  const contractBtn = el('button', { cls: 'btn contract-btn', attrs: { type: 'button', hidden: '' } });
  contractBtn.addEventListener('click', () => openContractSheet(i));
  extras.set(i, { chips, hint, contractBtn, badge, bundleSpans });
  return { chips, hint, contractBtn };
}

// ---------- 이사 근처: 특전 알림 + 위약금 안내 ----------
const perkAlert = el('button', { cls: 'btn gold perk-alert', attrs: { type: 'button', hidden: '' } });
perkAlert.addEventListener('click', () => openPerkPick());
const moveNote = el('div', { cls: 'move-note', attrs: { hidden: '' } });
export const moveExtra = el('div', { cls: 'move-extra' }, perkAlert, moveNote);
export const perkBtn = el('button', { cls: 'btn icon-btn perk-btn', attrs: { type: 'button', 'aria-label': '내 특전', title: '내 특전' } }, iconImg('perk', { size: 32, alt: '' }));
const perkDot = el('i', { cls: 'perk-dot', attrs: { hidden: '' } });
perkBtn.append(perkDot);
perkBtn.addEventListener('click', () => openPerkList());

// ---------- 배율 내역 팝오버 ----------
const multPop = el('div', { cls: 'mult-pop', attrs: { hidden: '', role: 'dialog', 'aria-label': '배율 내역' } });
const multCatch = el('div', { cls: 'mult-catch', attrs: { hidden: '' } });
let multTarget: number | 'tap' | null = null;
let multLast = 0;
let inMultModal = false;

export function initStrategy(hooks: StrategyHooks): void {
  H = hooks;
  buildBundleChips();
  bundleToggle.addEventListener('click', () => {
    bundlesOpen = !bundlesOpen;
    if (bundlesOpen) bundleAlert = false;
    syncBundleToggle(bundleStatuses(H.ctx.get()).filter((s) => s.stage > 0).length);
  });
  multCatch.addEventListener('click', closeMult);
  const app = document.getElementById('app')!;
  app.append(multCatch, multPop);
}

function syncBundleToggle(active: number): void {
  setText(bundleToggleText, `결합 ${active}/${BUNDLES.length}`);
  bundleToggle.setAttribute('aria-expanded', String(bundlesOpen));
  bundleRow.hidden = !bundlesOpen;
  bundleDot.hidden = !bundleAlert || bundlesOpen;
}

// ---------- 매 프레임 동기화 ----------
let prevStages: Map<string, number> | null = null;
let prevContracts = new Map<number, ContractKind>();
let prevMoves = -1;

export function sync(state: GameState, snap: boolean): void {
  const moved = state.moves !== prevMoves;
  const reseed = snap || moved || prevStages === null;
  prevMoves = state.moves;

  // 결합
  const statuses = bundleStatuses(state);
  const raised: { name: string; mult: number; stage: number; services: number[] }[] = [];
  const nextStages = new Map<string, number>();
  for (const s of statuses) {
    nextStages.set(s.id, s.stage);
    const r = bundleChips.get(s.id)!;
    setText(r.mult, s.stage > 0 ? `x${formatNumber(s.mult)}` : 'x1');
    toggleClass(r.root, 'on', s.stage > 0);
    toggleClass(r.root, 'max', s.nextLevel === null);
    r.root.dataset.stage = String(s.stage);
    if (s.nextLevel === null) {
      setText(r.next, '최대');
      setText(r.need, '모든 서비스 Lv 100 달성');
      r.barFill.style.transform = 'scaleX(1)';
    } else {
      setText(r.next, `다음 x${formatNumber(s.nextMult!)}`);
      const worst = [...s.lacking].sort((a, b) => b.need - a.need);
      setText(r.need, `${worst[0].name} ${formatNumber(worst[0].need)}레벨${worst.length > 1 ? ` 외 ${worst.length - 1}개` : ''} 더`);
      r.barFill.style.transform = `scaleX(${Math.min(1, s.minLevel / s.nextLevel).toFixed(3)})`;
    }
    const was = prevStages?.get(s.id) ?? s.stage;
    if (!reseed && s.stage > was) raised.push({ name: s.name, mult: s.mult, stage: s.stage, services: s.services.map((x) => x.index) });
  }
  const unlocked = (state.unlocked ?? []).includes('bundle');
  if (!reseed && ((unlocked && !bundleSeen) || raised.length)) bundleAlert = true;
  bundleSeen = unlocked;
  syncBundleToggle(statuses.filter((s) => s.stage > 0).length);
  prevStages = nextStages;

  // 서비스 카드 덧붙임
  const act = new Map(contractStatuses(state).map((c) => [c.service, c]));
  for (const [i, x] of extras) {
    const lv = state.services[i];
    const card = H.card(i);
    // 태그는 1개: 아직 못 이룬 결합 중 가장 가까운 것, 없으면 가장 배율이 높은 결합
    const mine = statuses.filter((s) => x.bundleSpans.has(s.id));
    const open = mine.filter((s) => s.stage === 0 && s.nextLevel !== null);
    const shown = open.length > 0 ? open.reduce((a, b) => (b.nextLevel! - b.minLevel < a.nextLevel! - a.minLevel ? b : a)) : mine.reduce<(typeof mine)[number] | null>((a, b) => (a === null || b.mult > a.mult ? b : a), null);
    for (const s of mine) {
      const span = x.bundleSpans.get(s.id)!;
      span.hidden = s !== shown;
      const nm = s.name.replace(/ 결합$/, '');
      setText(span, s.stage > 0 ? `x${formatNumber(s.mult)}` : nm);
      toggleClass(span, 'on', s.stage > 0);
    }
    // 결합 힌트: 이 서비스만 모자란 결합이 있고 가까울 때
    let hintText = '';
    let completes = false;
    let bestNeed = Infinity;
    for (const s of statuses) {
      if (s.nextLevel === null || !s.services.some((v) => v.index === i)) continue;
      if (s.lacking.length === 1 && s.lacking[0].index === i && s.lacking[0].need <= 10 && s.lacking[0].need < bestNeed && lv >= 1) {
        bestNeed = s.lacking[0].need;
        hintText = `x${formatNumber(s.nextMult!)}까지 ${bestNeed}레벨 더`;
        completes = H.buyCount(i) >= bestNeed;
      }
    }
    x.hint.hidden = hintText === '';
    setText(x.hint, hintText);
    toggleClass(x.hint, 'ready', completes);

    // 약정
    const c = act.get(i);
    x.badge.hidden = !c;
    if (c) {
      setText(x.badge, `x${formatNumber(c.mult)} ${fmtTime(c.remainSec)}`);
      toggleClass(x.badge, 'soon', c.remainSec < 30);
    }
    if (card) toggleClass(card, 'contracted', !!c);
    const block = contractBlock(state, i);
    x.contractBtn.hidden = block === 'locked';
    setText(x.contractBtn, block === 'full' ? '약정 가득' : block === 'busy' ? '약정 중' : '약정');
    setDisabled(x.contractBtn, block !== null && block !== 'busy');
  }

  // 약정 칸·만료 알림
  const total = contractSlots(state);
  const used = total - freeContractSlots(state);
  setText(slotsPill, `약정 칸 ${used}/${total}`);
  toggleClass(slotsPill, 'full', used >= total);
  const nowMap = new Map(contractStatuses(state).map((c) => [c.service, c.kind]));
  if (!reseed) {
    for (const [svc] of prevContracts) {
      if (nowMap.has(svc)) continue;
      H.toast(`${SERVICES[svc].name} 약정이 끝났어요`);
      sfx.contractEnd();
      const card = H.card(svc);
      if (card && H.servicesVisible()) fx.pop(card, 1.04);
    }
  }
  prevContracts = nowMap;

  if (raised.length > 0 && !snap) bundleUpFx(raised.sort((a, b) => b.mult - a.mult)[0]);

  // 특전 알림
  const pending = pendingPerkCount(state);
  perkAlert.hidden = pending === 0;
  if (pending > 0) setLabel(perkAlert, 'perk', 32, `특전 고르기 ${pending}`);
  perkDot.hidden = pending === 0;
  perkBtn.setAttribute('aria-label', pending > 0 ? `내 특전, 고를 특전 ${pending}개` : '내 특전');

  // 위약금 안내
  const ms = moveStatus(state);
  for (const n of document.querySelectorAll<HTMLElement>('.live-pen')) setText(n, `위약금 ${formatNumber(ms.penalty)} P가 빠져요`);
  if (state.contracts.length === 0 || (ms.ok && ms.penalty > 0)) {
    moveNote.hidden = true;
  } else {
    moveNote.hidden = false;
    const left = Math.max(...state.contracts.map((c) => c.remainSec));
    toggleClass(moveNote, 'block', ms.reason === 'penalty');
    setText(
      moveNote,
      ms.reason === 'penalty'
        ? `이사 위약금 ${formatNumber(ms.penalty)} P · ${formatNumber(ms.penaltyShortfall)} P가 모자라요 (약정 만료까지 ${minutesLeft(left)})`
        : `지금 이사하면 위약금 ${formatNumber(ms.penalty)} P가 빠져요`,
    );
  }

  if (!multPop.hidden && multPop.isConnected && performance.now() - multLast > 200) renderMult(state);
}

export function moveBarText(state: GameState, base: string): string {
  const ms = moveStatus(state);
  if (ms.reason === 'penalty') return '위약금이 모자라요';
  if (ms.ok && ms.penalty > 0) return `이사할 수 있어요 · 위약금 ${formatNumber(ms.penalty)} P`;
  return base;
}

export function moveConfirmNotes(state: GameState): HTMLElement[] {
  if (state.contracts.length === 0) return [];
  const ms = moveStatus(state);
  const out: HTMLElement[] = [];
  if (ms.penalty > 0) out.push(el('p', { cls: 'penalty-line live-pen', text: `위약금 ${formatNumber(ms.penalty)} P가 빠져요` }));
  out.push(el('p', { cls: 'dim', text: `약정 ${state.contracts.length}개도 함께 끝나요` }));
  return out;
}

export function afterMove(): void {
  if (pendingPerkCount(H.ctx.get()) === 0) return;
  fx.banner('특전을 골라요', { sub: '이사 특전 3개 중 하나예요', tone: 'gold', ms: 1300 });
  window.setTimeout(openPerkPick, 900);
}

// ---------- 결합 단계 상승 연출 ----------
function bundleUpFx(b: { name: string; mult: number; stage: number; services: number[] }): void {
  // 마일스톤 배너(같은 틱에 뜸)와 겹치면 그 배너가 끝난 뒤에 보여 준다
  window.setTimeout(() => {
    window.setTimeout(() => {
      fx.banner(`${b.name} x${formatNumber(b.mult)}!`, { sub: `결합 ${b.stage}단계`, tone: 'gold', ms: 1800 });
      fx.flash('#ffc83d', 500);
      fx.confetti(window.innerWidth / 2, window.innerHeight * 0.4, 50);
      sfx.bundleUp();
      vibrate([20, 30, 20, 30, 40]);
    }, fx.bannerActive() ? 1750 : 0);
  }, 0);
  const chip = [...bundleChips.entries()].find(([id]) => BUNDLES.find((x) => x.id === id)?.name === b.name)?.[1];
  if (chip) fx.pxFrames(chip.mult, [{ translate: '0 -4px' }, { translate: '0 0' }], 83);
  if (!H.servicesVisible()) return;
  const pts: { x: number; y: number; card: HTMLElement; seen: boolean }[] = [];
  for (const i of b.services) {
    const ic = H.icon(i);
    const card = H.card(i);
    if (!ic || !card || !ic.isConnected) continue;
    const r = ic.getBoundingClientRect();
    if (r.width === 0) continue;
    const cy = r.top + r.height / 2;
    const bottomPad = desktopMq.matches ? 24 : 144;
    const seen = cy > 90 && cy < window.innerHeight - bottomPad + 4;
    pts.push({ x: r.left + r.width / 2, y: Math.min(window.innerHeight - bottomPad, Math.max(90, cy)), card, seen });
  }
  if (pts.length === 0) return;
  pts.sort((a, c) => a.y - c.y);
  for (const p of pts) {
    p.card.classList.remove('bundle-glow');
    void p.card.offsetWidth;
    p.card.classList.add('bundle-glow');
    window.setTimeout(() => p.card.classList.remove('bundle-glow'), 1500);
    if (p.seen) fx.burst(p.x, p.y, { n: 12, kind: 'star', colors: ['#ffc83d', '#ffffff', '#5b92ff'], speed: 200, size: 5 });
  }
}

// ---------- 약정 시트 ----------
function openContractSheet(i: number): void {
  const state = H.ctx.get();
  const block = contractBlock(state, i);
  const def = SERVICES[i];
  const total = contractSlots(state);
  const body: HTMLElement[] = [
    el('p', { cls: 'dim' }, '약정하면 수익이 늘고, 위약금은 ', el('span', { attrs: { style: 'white-space:nowrap' }, text: '이사할 때' }), ' 내요.'),
    el('p', { cls: 'sheet-slots', text: `약정 칸 ${total - freeContractSlots(state)}/${total}` }),
  ];
  const active = contractStatuses(state).find((c) => c.service === i);
  if (active) {
    body.push(
      el('p', { cls: 'sheet-slots', text: `진행 중 · ${KIND_NAME[active.kind]} x${formatNumber(active.mult)} · 남은 시간 ${fmtTime(active.remainSec)}` }),
      el('p', { cls: 'penalty-line', text: `지금 이사하면 위약금 ${formatNumber(active.penalty)} P` }),
      el('p', { cls: 'dim', text: '이 서비스는 약정이 끝나면 다시 걸 수 있어요.' }),
    );
  }
  for (const c of active ? [] : CONTRACTS) {
    const started = startContract(state, i, c.kind);
    const extra = started ? contractExtraPps(started, i) : 0;
    const b = el(
      'button',
      { cls: `ct-opt k-${c.kind}`, attrs: { type: 'button', 'data-kind': c.kind } },
      el('span', { cls: 'ct-name fb', text: KIND_NAME[c.kind] }),
      el('span', { cls: 'ct-gain', text: extra > 0 ? `+${formatNumber(extra)}/초` : '' }),
      el('span', { cls: 'ct-meta', text: `${formatDuration(c.sec)} · x${formatNumber(c.mult)}` }),
      el('span', { cls: 'ct-pen', text: `지금 걸면 위약금 최대 ${formatNumber(contractPenaltyPreview(state, c.kind))} P` }),
      pickBtn(),
    );
    b.disabled = block !== null;
    b.addEventListener('click', () => confirmContract(i, c.kind));
    body.push(b);
  }
  if (block === 'full') body.push(el('p', { cls: 'ct-why', text: '빈 약정 칸이 없어요. 약정이 끝나면 다시 걸 수 있어요.' }));
  H.ctx.showModal(`${def.name} 약정`, body, [{ label: '닫기', onClick: H.ctx.dismissModal }], { icon: iconImg('contract', { size: 32, cls: 'title-ico' }) });
}

function confirmContract(i: number, kind: ContractKind): void {
  const next = startContract(H.ctx.get(), i, kind);
  if (!next) return;
  H.ctx.set(next);
  H.ctx.dismissModal();
  H.ctx.save();
  H.ctx.update();
  window.setTimeout(() => stampFx(i, kind), 120);
}

function stampFx(i: number, kind: ContractKind): void {
  const card = H.card(i);
  const def = CONTRACTS.find((c) => c.kind === kind)!;
  sfx.stamp();
  vibrate([30, 40, 20]);
  if (!card || !card.isConnected) return;
  const r = card.getBoundingClientRect();
  const st = el('div', { cls: 'stamp-fx' }, iconImg('contract', { size: 48, alt: '', cls: 'stamp-ico' }), el('b', { text: '약정 시작' }), el('span', { text: `${KIND_NAME[kind]} · x${formatNumber(def.mult)}` }));
  st.style.left = `${r.left + r.width * 0.5}px`;
  st.style.top = `${r.top + r.height * 0.5}px`;
  document.body.append(st);
  window.setTimeout(() => st.remove(), 1500);
  window.setTimeout(() => {
    fx.shake(card, 4, 300);
    fx.burst(r.left + r.width * 0.5, r.top + r.height * 0.5, { n: 14, colors: ['#e9304b', '#ffc83d', '#ffffff'], speed: 230 });
    fx.flash('#e9304b', 260);
  }, 160);
}

/** 선택 카드 안의 '고르기' 표시. 누름은 카드 전체가 받는다(pointer-events: none) */
function pickBtn(): HTMLElement {
  return el('span', { cls: 'btn sm primary pick-btn', text: '고르기' });
}

function perkEmoji(id: string, silhouette: boolean): HTMLElement {
  const wrap = el('span', { cls: 'pr-emoji' }, iconImg(perkIcon(id), { size: 32, alt: '' }));
  if (silhouette) wrap.style.setProperty('--ic', `url(${iconUrl(perkIcon(id))})`);
  return wrap;
}

// ---------- 특전 3택 ----------
let picking = false;

function perkCard(opt: PerkOptionView, k: number): HTMLButtonElement {
  const next = Math.min(opt.maxLevel, opt.level + 1);
  const front = el(
    'div',
    { cls: 'pface front' },
    el('span', { cls: 'pc-cat tag', text: CAT_NAME[opt.category] }),
    el('span', { cls: 'pc-emoji' }, iconImg(perkIcon(opt.id), { size: 32, alt: '' })),
    el('span', { cls: 'pc-name', text: opt.name }),
    el('span', { cls: 'pc-fx', text: opt.desc }),
    el('span', { cls: 'pc-lv', text: opt.maxed ? `Lv ${opt.level} 최대` : `Lv ${opt.level} → ${next}` }),
    pickBtn(),
  );

  const b = el('button', { cls: `pcard cat-${opt.category}${opt.maxed ? ' maxed' : ''}`, attrs: { type: 'button', 'data-perk': opt.id } }, el('div', { cls: 'pcard-inner' }, front));
  b.style.setProperty('--k', String(k));
  b.disabled = opt.maxed;
  return b;
}

function openPerkPick(): void {
  const state = H.ctx.get();
  const offers = perkOfferViews(state);
  if (offers.length === 0) return;
  picking = false;
  const opts = offers[0];
  const cards = opts.map((o, k) => perkCard(o, k));
  cards.forEach((c, k) => {
    const opt = opts[k];
    c.addEventListener('click', () => pickPerk(opt, c, cards));
  });
  const allMaxed = opts.every((o) => o.maxed);
  const actions: Parameters<UiCtx['showModal']>[2] = [{ label: '나중에 고르기', quiet: true, onClick: H.ctx.dismissModal }];
  if (allMaxed) actions.unshift({ label: '이 묶음 넘기기', primary: true, onClick: () => discardOffer() });
  const pend = offers.length;
  H.ctx.showModal(
    `이사 특전 고르기${pend > 1 ? ` (대기 ${pend})` : ''}`,
    [el('p', { cls: 'dim', text: allMaxed ? '전부 최대 레벨이에요' : '하나를 고르면 이사해도 계속 유지돼요.' }), el('div', { cls: 'pcards' }, ...cards)],
    actions,
    { chip: '특전', cls: 'perk-pick', icon: iconImg('perk', { size: 32, cls: 'title-ico' }) },
  );
  if (!fx.isReduced()) cards.forEach((_, k) => window.setTimeout(() => sfx.perkFlip(k), 250 + k * 180));
}

function discardOffer(): void {
  const next = discardPerkOffer(H.ctx.get(), 0);
  if (!next) return;
  H.ctx.set(next);
  H.ctx.save();
  H.ctx.dismissModal();
  H.ctx.update();
  if (pendingPerkCount(next) > 0) window.setTimeout(openPerkPick, 300);
}

function pickPerk(opt: PerkOptionView, card: HTMLElement, all: HTMLElement[]): void {
  if (picking) return;
  const next = choosePerk(H.ctx.get(), 0, opt.id);
  if (!next) return;
  picking = true;
  H.ctx.set(next);
  H.ctx.save();
  H.ctx.update();
  for (const c of all) c.classList.add(c === card ? 'chosen' : 'faded');
  const r = card.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  sfx.perkPick();
  vibrate([20, 30, 40]);
  fx.burst(cx, cy, { n: 22, kind: 'star', colors: ['#ffc83d', '#ffffff', '#5b92ff', '#e9304b'], speed: 280, size: 6 });
  fx.confetti(cx, cy, 40);
  fx.floatText(cx, r.top, `Lv ${Math.min(opt.maxLevel, opt.level + 1)}`, { scale: 1.1, ms: 1100 });
  const wait = fx.isReduced() ? 350 : 1100;
  window.setTimeout(() => {
    H.ctx.dismissModal();
    picking = false;
    if (pendingPerkCount(H.ctx.get()) > 0) window.setTimeout(openPerkPick, 450);
  }, wait);
}

function openPerkList(): void {
  const state = H.ctx.get();
  const pending = pendingPerkCount(state);
  const body: HTMLElement[] = [];
  if (pending > 0) {
    const b = el('button', { cls: 'btn gold perk-pick-btn', attrs: { type: 'button' } });
    setLabel(b, 'perk', 32, `특전 고르기 ${pending}`);
    b.addEventListener('click', () => {
      H.ctx.dismissModal();
      openPerkPick();
    });
    body.push(b);
  }
  const owned = PERKS.filter((p) => perkLevel(state, p.id) > 0).length;
  body.push(el('p', { cls: 'dim', text: `보유 ${owned}/${PERKS.length}종이에요.` }), el('p', { cls: 'dim', text: '이사할 때마다 3개 중 하나를 골라요.' }));
  const list = el('div', { cls: 'perk-list' });
  for (const p of PERKS) {
    const lv = perkLevel(state, p.id);
    const pips = el('span', { cls: 'pips' });
    for (let k = 0; k < p.maxLevel; k++) pips.append(el('i', { cls: k < lv ? 'on' : '' }));
    list.append(
      el(
        'div',
        { cls: `perk-row cat-${p.category}${lv === 0 ? ' none' : ''}` },
        perkEmoji(p.id, lv === 0),
        el('div', { cls: 'pr-main' }, el('div', { cls: 'pr-name' }, el('b', { cls: 'fb', text: p.name }), el('em', { cls: 'tag', text: CAT_NAME[p.category] })), el('div', { cls: 'pr-desc', text: `레벨당 ${p.desc}` })),
        el('div', { cls: 'pr-lv' }, el('b', { text: `${lv}/${p.maxLevel}` }), pips),
      ),
    );
  }
  body.push(list);
  H.ctx.showModal('내 특전', body, [{ label: '닫기', onClick: H.ctx.dismissModal }], { icon: iconImg('perk', { size: 32, cls: 'title-ico' }) });
}

// ---------- 배율 내역 ----------
function defaultTarget(state: GameState): number | 'tap' {
  let best: number | 'tap' = 'tap';
  let bv = -1;
  SERVICES.forEach((_, i) => {
    if (state.services[i] <= 0) return;
    const v = serviceProd(state, i);
    if (v > bv) {
      bv = v;
      best = i;
    }
  });
  return best;
}

export function toggleMult(anchor: HTMLElement, target?: 'tap'): void {
  if (!multPop.hidden && multPop.isConnected) {
    if (inMultModal) H.ctx.dismissModal();
    closeMult();
    return;
  }
  const state = H.ctx.get();
  multTarget = target ?? defaultTarget(state);
  inMultModal = !desktopMq.matches;
  toggleClass(multPop, 'in-modal', inMultModal);
  multPop.hidden = false;
  if (inMultModal) {
    multCatch.hidden = true;
    renderMult(state);
    H.ctx.showModal('배율 내역', [multPop], [{ label: '닫기', onClick: () => { closeMult(); H.ctx.dismissModal(); } }], { icon: iconImg('coin', { size: 32, cls: 'title-ico' }) });
    sfx.ready();
    return;
  }
  const app = document.getElementById('app')!;
  app.append(multPop);
  const a = anchor.getBoundingClientRect();
  multPop.style.top = `${Math.round(a.bottom - app.getBoundingClientRect().top + 6)}px`;
  multCatch.hidden = false;
  renderMult(state);
  fx.bounce(multPop, 0.96);
  sfx.ready();
}

function closeMult(): void {
  multPop.hidden = true;
  multCatch.hidden = true;
}

function renderMult(state: GameState): void {
  multLast = performance.now();
  if (typeof multTarget === 'number' && state.services[multTarget] <= 0) multTarget = 'tap';
  const t = multTarget ?? 'tap';
  const bd = multBreakdown(state, t);
  const tbd = tapBreakdown(state);
  const targets = el('div', { cls: 'mp-targets' });
  const mk = (label: Node, v: number | 'tap'): void => {
    const b = el('button', { cls: `chip mp-t${v === t ? ' active' : ''}`, attrs: { type: 'button', 'aria-label': v === 'tap' ? '탭 수익' : SERVICES[v].name, title: v === 'tap' ? '탭 수익' : SERVICES[v].name } });
    b.append(label);
    b.addEventListener('click', () => {
      multTarget = v;
      renderMult(H.ctx.get());
    });
    targets.append(b);
  };
  mk(document.createTextNode('탭'), 'tap');
  SERVICES.forEach((s, i) => {
    if (state.services[i] > 0) mk(iconImg(svcIcon(s.id), { size: inMultModal ? 32 : 48, alt: s.name }), i);
  });
  const rows: [string, number][] = [
    ['영구 배율', bd.permanent],
    ['도감', bd.collection],
    ['이벤트', bd.event],
    ['피버', bd.fever],
    ['결합', bd.bundle],
    ['약정', bd.contract],
    ['특전', bd.perk],
    ['도감 세트', bd.set],
  ];
  const list = el('div', { cls: 'mp-rows' });
  for (const [label, v] of rows) {
    list.append(el('div', { cls: `mp-row${v > 1.0001 ? ' hot' : ''}` }, el('span', { text: label }), el('b', { text: `x${formatNumber(v)}` })));
  }
  const note = (text: string): HTMLElement => el('div', { cls: 'mp-note', text });
  const foot =
    t === 'tap'
      ? el(
          'div',
          { cls: 'mp-foot' },
          note(`탭 1회 = 기본 ${formatNumber(tbd.flat)} + 초당 수익분 ${formatNumber(tbd.fromPps)}`),
          ...(inMultModal ? [note(`레벨 ${TAP_MILESTONES.join('·')}에서 탭 비율이 올라요`), note(`초당 ${TAPS_PER_SEC_FULL}회까지는 전액, 넘으면 기본값만 받아요`)] : []),
        )
      : el('div', { cls: 'mp-foot' }, note(`${SERVICES[t].name} 현재 +${formatNumber(serviceProd(state, t))}/초 (레벨·마일스톤 포함)`));
  multPop.replaceChildren(
    el('div', { cls: 'mp-title' }, el('span', { text: inMultModal ? '곱해지는 배율' : '배율 내역' }), el('b', { cls: 'mp-total', text: `합계 x${formatNumber(bd.total)}` })),
    targets,
    list,
    foot,
  );
}
