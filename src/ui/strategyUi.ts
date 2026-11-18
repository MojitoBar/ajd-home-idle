// 전략 요소 화면: 이사 특전 3택 · 배율 내역. 로직은 읽기/호출만 한다.
import { PERKS, type PerkCategory } from '../data/perks';
import { TAPS_PER_SEC_FULL } from '../data/tap';
import { multBreakdown, tapBreakdown } from '../logic/economy';
import { formatNumber } from '../logic/format';
import { choosePerk, discardPerkOffer, pendingPerkCount, perkLevel, perkOfferViews, type PerkOptionView } from '../logic/perks';
import type { GameState } from '../logic/state';
import type { UiCtx } from './collectUi';
import { iconImg, iconUrl, perkIcon, setLabel } from './icons';
import { desktopMq, el, toggleClass } from './dom';
import * as fx from './fx';
import { vibrate } from './prefs';
import { sfx } from './sound';

export interface StrategyHooks {
  ctx: UiCtx;
}

let H: StrategyHooks;
const CAT_NAME: Record<PerkCategory, string> = { tap: '탭', idle: '방치', luck: '운', strategy: '전략' };

// ---------- 이사 근처: 특전 알림 ----------
const perkAlert = el('button', { cls: 'btn gold perk-alert', attrs: { type: 'button', hidden: '' } });
perkAlert.addEventListener('click', () => openPerkPick());
export const moveExtra = el('div', { cls: 'move-extra' }, perkAlert);
export const perkBtn = el('button', { cls: 'btn icon-btn perk-btn', attrs: { type: 'button', 'aria-label': '내 특전', title: '내 특전' } }, iconImg('perk', { size: 32, alt: '' }));
const perkDot = el('i', { cls: 'perk-dot', attrs: { hidden: '' } });
perkBtn.append(perkDot);
perkBtn.addEventListener('click', () => openPerkList());

// ---------- 배율 내역 팝오버 ----------
const multPop = el('div', { cls: 'mult-pop', attrs: { hidden: '', role: 'dialog', 'aria-label': '배율 내역' } });
const multCatch = el('div', { cls: 'mult-catch', attrs: { hidden: '' } });
let multLast = 0;
let inMultModal = false;

export function initStrategy(hooks: StrategyHooks): void {
  H = hooks;
  multCatch.addEventListener('click', closeMult);
  const app = document.getElementById('app')!;
  app.append(multCatch, multPop);
}

// ---------- 매 프레임 동기화 ----------
export function sync(state: GameState): void {
  // 특전 알림
  const pending = pendingPerkCount(state);
  perkAlert.hidden = pending === 0;
  if (pending > 0) setLabel(perkAlert, 'perk', 32, `특전 고르기 ${pending}`);
  perkDot.hidden = pending === 0;
  perkBtn.setAttribute('aria-label', pending > 0 ? `내 특전, 고를 특전 ${pending}개` : '내 특전');

  if (!multPop.hidden && multPop.isConnected && performance.now() - multLast > 200) renderMult(state);
}

export function afterMove(): void {
  if (pendingPerkCount(H.ctx.get()) === 0) return;
  const n = pendingPerkCount(H.ctx.get());
  fx.banner('특전 상자를 열어요', { sub: `특전 상자 ${n}개, 하나씩 3개 중 골라요`, tone: 'gold', ms: 1300 });
  window.setTimeout(openPerkPick, 900);
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

export function openPerkPick(): void {
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
    `특전 상자${pend > 1 ? ` (남은 상자 ${pend})` : ''}`,
    [el('p', { cls: 'dim', text: allMaxed ? '전부 최대 레벨이에요' : '3개 중 하나를 고르면 이사해도 계속 유지돼요.' }), el('div', { cls: 'pcards' }, ...cards)],
    actions,
    { chip: '고르기', cls: 'perk-pick', icon: iconImg('perk', { size: 32, cls: 'title-ico' }) },
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

/** 고른 직후 확인: 고른 카드 위에 특전 이름과 새 레벨이 크게 뜨고, 카드 안 레벨 줄이 'Lv N 달성'으로 바뀐다 */
function showGot(card: HTMLElement, name: string, lv: number): void {
  const lvEl = card.querySelector<HTMLElement>('.pc-lv');
  if (lvEl) {
    lvEl.textContent = `Lv ${lv}`;
    lvEl.classList.add('got');
  }
  card.querySelector('.pick-btn')?.replaceChildren('고름!');
  const host = card.closest<HTMLElement>('.pcards');
  if (!host) return;
  const tag = el('p', { cls: 'pk-got' }, el('b', { cls: 'pk-got-name', text: name }), el('span', { cls: 'pk-got-lv', text: `Lv ${lv}` }));
  const prev = host.previousElementSibling;
  if (prev?.tagName === 'P') prev.replaceWith(tag);
  else host.before(tag);
  if (!fx.isReduced()) fx.pxFrames(tag, [{ scale: '1.5' }, { scale: '1.25' }, { scale: '1.1' }, { scale: '1' }], 60);
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
  const lvNow = Math.min(opt.maxLevel, opt.level + 1);
  showGot(card, opt.name, lvNow);
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
  body.push(el('p', { cls: 'dim', text: `보유 ${owned}/${PERKS.length}종이에요.` }), el('p', { cls: 'dim', text: '특전 상자를 열어 3개 중 하나를 골라요. 이사하면 상자를 여러 개 받아요.' }));
  const list = el('div', { cls: 'perk-list' });
  for (const p of PERKS) {
    const lv = perkLevel(state, p.id);
    const pips = el('span', { cls: 'pips' });
    const unlimited = !Number.isFinite(p.maxLevel);
    if (unlimited) pips.append(el('span', { cls: 'pr-inf', text: '상한 없음' }));
    else for (let k = 0; k < p.maxLevel; k++) pips.append(el('i', { cls: k < lv ? 'on' : '' }));
    list.append(
      el(
        'div',
        { cls: `perk-row cat-${p.category}${lv === 0 ? ' none' : ''}` },
        perkEmoji(p.id, lv === 0),
        el('div', { cls: 'pr-main' }, el('div', { cls: 'pr-name' }, el('b', { cls: 'fb', text: p.name }), el('em', { cls: 'tag', text: CAT_NAME[p.category] })), el('div', { cls: 'pr-desc', text: `레벨당 ${p.desc}` })),
        el('div', { cls: 'pr-lv' }, el('b', { text: unlimited ? `Lv ${lv}` : `Lv ${lv}/${p.maxLevel}` }), pips),
      ),
    );
  }
  body.push(list);
  H.ctx.showModal('내 특전', body, [{ label: '닫기', onClick: H.ctx.dismissModal }], { icon: iconImg('perk', { size: 32, cls: 'title-ico' }) });
}

// ---------- 배율 내역 ----------
export function toggleMult(anchor: HTMLElement): void {
  if (!multPop.hidden && multPop.isConnected) {
    if (inMultModal) H.ctx.dismissModal();
    closeMult();
    return;
  }
  const state = H.ctx.get();
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
  const bd = multBreakdown(state, 'tap');
  const tbd = tapBreakdown(state);
  const rows: [string, number][] = [
    ['총 배율', bd.total / bd.fever],
    ['영구 배율', bd.permanent],
    ['도감', bd.collection],
    ['살림', bd.home],
    ['도감 세트', bd.set],
    ['특전', bd.perk],
  ];
  const list = el('div', { cls: 'mp-rows' });
  for (const [label, v] of rows) {
    list.append(el('div', { cls: `mp-row${v > 1.0001 ? ' hot' : ''}` }, el('span', { text: label }), el('b', { text: `x${formatNumber(v)}` })));
    // 머리 칩과 같은 값(피버 제외)이 맨 위, 피버 중일 때만 그 아래에 지금 값을 따로 보인다
    if (label === '총 배율' && bd.fever > 1.0001) list.append(el('div', { cls: 'mp-row fever' }, el('span', { text: `피버 중 x${formatNumber(bd.fever)}` }), el('b', { text: `→ 지금 x${formatNumber(bd.total)}` })));
  }
  const note = (text: string): HTMLElement => el('div', { cls: 'mp-note', text });
  const foot = el('div', { cls: 'mp-foot' }, note(`탭 1회 기본 ${formatNumber(tbd.flat)} P`), ...(inMultModal ? [note(`초당 ${TAPS_PER_SEC_FULL}회까지는 전액, 넘으면 기본값만 받아요`)] : []));
  multPop.replaceChildren(
    el('div', { cls: 'mp-title' }, el('span', { text: inMultModal ? '곱해지는 배율' : '배율 내역' }), el('b', { cls: 'mp-total', text: `총 x${formatNumber(bd.total / bd.fever)}` })),
    list,
    foot,
  );
}
