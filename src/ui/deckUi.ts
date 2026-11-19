// 공구함 덱 화면(1단계): 카드 줄 · 공구함 창 · 카드 고르기 창 · 발동 연출. 로직은 logic/deck.ts, 설계는 DESIGN-DECK.md 7·8절.
import { cardDef, type CardDef, type CardTag } from '../data/cards';
import { chooseCard, deckFull, deckSlots, type DeckFire } from '../logic/deck';
import type { GameState } from '../logic/state';
import type { UiCtx } from './collectUi';
import { el } from './dom';
import * as fx from './fx';
import { iconImg, setLabel, type IconName } from './icons';
import { vibrate } from './prefs';
import { sfx } from './sound';
import { chainFinishing, chainPlaying } from './unpackUi';

export interface DeckHooks {
  ctx: UiCtx;
  /** 점수판(동전이 날아갈 곳) */
  pts: () => Element;
  /** 카드 줄이 들어갈 이사 블록 */
  host: HTMLElement;
}

let H: DeckHooks;
const TAG_NAME: Record<CardTag, string> = { precise: '정밀', chain: '연쇄', special: '특별', rush: '러시', fever: '피버' };
const RARITY_NAME = { common: '일반', rare: '레어', legend: '전설' } as const;
const cardIcon = (d: CardDef, size: number, cls?: string): HTMLImageElement => iconImg(d.icon as IconName, { size, alt: '', cls });
const tagVar = (d: CardDef): string => `var(--tag-${d.tags[0]})`;

// ---------- 카드 줄 ----------
const row = el('div', { cls: 'deck-row', attrs: { role: 'group', 'aria-label': '공구함' } });
const rowLabel = el('span', { cls: 'deck-label' });
/** 알림: 대기 묶음이 있을 때 이사 줄 위에 뜨는 노란 버튼 */
export const alertBtn = el('button', { cls: 'btn gold perk-alert deck-alert', attrs: { type: 'button', hidden: '' } });
let rowKey = '';

export function initDeck(hooks: DeckHooks): void {
  H = hooks;
  row.addEventListener('click', () => openToolbox());
  alertBtn.addEventListener('click', () => openPick());
}

export const pendingCount = (s: GameState): number => s.deck?.offers.length ?? 0;
/** 공구 강화 탭 알림 점용: 대기 묶음이 있는가 */
export const hasPending = (): boolean => !!H && pendingCount(H.ctx.get()) > 0;

/** 매 update 끝에서 호출. 이사 전(moves 0)에는 줄을 만들지 않는다 */
export function sync(state: GameState): void {
  const on = state.moves > 0 && !!state.deck;
  if (!on) {
    if (row.isConnected) row.remove();
    alertBtn.hidden = true;
    rowKey = '';
    document.body.classList.remove('has-deck');
    return;
  }
  if (!row.isConnected) {
    H.host.prepend(row);
    document.body.classList.add('has-deck');
  }
  const n = deckSlots(state.moves);
  const key = `${n}|${state.deck.slots.map((s) => s.id).join(',')}|${pendingCount(state) > 0 ? 1 : 0}`;
  if (key !== rowKey) {
    rowKey = key;
    const kids: HTMLElement[] = [];
    for (let i = 0; i < n; i++) {
      const slot = state.deck.slots[i];
      const d = slot ? cardDef(slot.id) : undefined;
      const b = el('button', { cls: `deck-slot${d ? ' on' : ''}`, attrs: { type: 'button', 'aria-label': d ? `${d.name}: ${d.desc}` : '빈 칸' } });
      if (d) {
        b.dataset.card = d.id;
        b.style.setProperty('--tc', tagVar(d));
        b.append(cardIcon(d, 32));
      }
      kids.push(b);
    }
    row.replaceChildren(...kids, rowLabel);
  }
  const filled = state.deck.slots.length;
  const label = filled >= n ? '공구함 가득' : `공구함 · 빈 칸 ${n - filled}`;
  if (rowLabel.textContent !== label) rowLabel.textContent = label;
  const pend = pendingCount(state);
  alertBtn.hidden = pend === 0;
  if (pend > 0) setLabel(alertBtn, 'ui-tools', 32, `카드 고르기${pend > 1 ? ` ${pend}` : ''}`);
}

// ---------- 모달 공통 ----------
function setActions(box: Element, actions: { label: string; quiet?: boolean; primary?: boolean; onClick: () => void }[]): void {
  const rowEl = box.querySelector('.modal-actions');
  if (!rowEl) return;
  rowEl.replaceChildren(
    ...actions.map((a) => {
      const b = el('button', { cls: a.quiet ? 'btn quiet' : a.primary ? 'btn primary' : 'btn', text: a.label, attrs: { type: 'button' } });
      b.addEventListener('click', a.onClick);
      return b;
    }),
  );
}

function setModal(title: string, body: Node[], actions: Parameters<typeof setActions>[1]): void {
  const box = document.querySelector('.overlay .modal.deck-pick');
  if (!box) return;
  const h = box.querySelector('.modal-head h2');
  if (h) h.textContent = title;
  box.querySelector('.modal-body')?.replaceChildren(...body);
  setActions(box, actions);
}

const titleIcon = (): HTMLElement => iconImg('ui-tools', { size: 32, cls: 'title-ico' });

// ---------- 공구함 창 ----------
function cardRow(d: CardDef): HTMLElement {
  const r = el(
    'div',
    { cls: 'perk-row deck-card' },
    el('span', { cls: 'pr-emoji' }, cardIcon(d, 32)),
    el(
      'div',
      { cls: 'pr-main' },
      el('div', { cls: 'pr-name' }, el('b', { cls: 'fb', text: d.name }), ...d.tags.map((t) => el('em', { cls: 'tag', text: TAG_NAME[t] }))),
      el('div', { cls: 'pr-desc', text: d.desc }),
    ),
    el('div', { cls: 'pr-lv' }, el('b', { text: RARITY_NAME[d.rarity] })),
  );
  r.style.setProperty('--cc', tagVar(d));
  return r;
}

export function openToolbox(): void {
  const state = H.ctx.get();
  if (!state.deck) return;
  const n = deckSlots(state.moves);
  const pend = pendingCount(state);
  const body: HTMLElement[] = [];
  if (pend > 0) {
    const b = el('button', { cls: 'btn gold perk-pick-btn', attrs: { type: 'button' } });
    setLabel(b, 'ui-tools', 32, `카드 고르기${pend > 1 ? ` ${pend}` : ''}`);
    b.addEventListener('click', () => {
      H.ctx.dismissModal();
      openPick();
    });
    body.push(b);
  }
  const empty = n - state.deck.slots.length;
  body.push(el('p', { cls: 'dim', text: empty > 0 ? `빈 칸 ${empty}개 · 카드는 이 집에서만 써요. 이사하면 비워져요.` : '칸이 가득 찼어요. 새 카드를 고르면 바꿀 칸을 골라요.' }));
  const list = el('div', { cls: 'perk-list' });
  for (const s of state.deck.slots) {
    const d = cardDef(s.id);
    if (d) list.append(cardRow(d));
  }
  for (let i = 0; i < empty; i++) list.append(el('div', { cls: 'perk-row deck-card-empty' }, el('span', { cls: 'pr-emoji' }), el('div', { cls: 'pr-main' }, el('div', { cls: 'pr-name' }, el('span', { text: '빈 칸' })))));
  body.push(list);
  H.ctx.showModal('공구함', body, [{ label: '닫기', onClick: H.ctx.dismissModal }], { icon: titleIcon(), cls: 'deck-box' });
}

// ---------- 카드 고르기 창 ----------
let busy = false;

function pickBtn(text: string): HTMLElement {
  return el('span', { cls: 'btn sm primary pick-btn', text });
}

/** 선택 카드(`pcard`): 칩 = 태그, 이미 낀 카드·고를 수 없는 카드는 `maxed` 모양 */
function deckCard(d: CardDef, k: number, o: { lv: string; btn: string; locked?: boolean }): HTMLButtonElement {
  const front = el(
    'div',
    { cls: 'pface front' },
    el('span', { cls: 'pc-cat tag', text: TAG_NAME[d.tags[0]] }),
    el('span', { cls: 'pc-emoji' }, cardIcon(d, 32)),
    el('span', { cls: 'pc-name', text: d.name }),
    el('span', { cls: 'pc-fx', text: d.desc }),
    el('span', { cls: 'pc-lv', text: o.lv }),
    pickBtn(o.btn),
  );
  const b = el('button', { cls: `pcard${o.locked ? ' maxed' : ''}`, attrs: { type: 'button', 'data-card': d.id } }, el('div', { cls: 'pcard-inner' }, front));
  b.style.setProperty('--k', String(k));
  b.style.setProperty('--cc', tagVar(d));
  b.disabled = !!o.locked;
  return b;
}

export function openPick(): void {
  const state = H.ctx.get();
  if (!state.deck || state.deck.offers.length === 0) return;
  busy = false;
  H.ctx.showModal(
    'x',
    [],
    [
      { label: '나중에 고르기', quiet: true, onClick: H.ctx.dismissModal },
      { label: '건너뛰기', onClick: skipOffer },
    ],
    { chip: '카드', cls: 'perk-pick deck-pick', icon: titleIcon() },
  );
  renderPick();
}

function renderPick(): void {
  const state = H.ctx.get();
  const offer = state.deck.offers[0];
  if (!offer) return H.ctx.dismissModal();
  const pend = state.deck.offers.length;
  const owned = new Set(state.deck.slots.map((s) => s.id));
  const defs = offer.map((id) => cardDef(id)).filter((d): d is CardDef => !!d);
  const cards = defs.map((d, k) => {
    const have = owned.has(d.id);
    const c = deckCard(d, k, { lv: have ? '이미 끼웠어요' : `${RARITY_NAME[d.rarity]} 카드`, btn: '고르기', locked: have });
    c.addEventListener('click', () => pickCard(d, c, cards));
    return c;
  });
  const allOwned = defs.every((d) => owned.has(d.id));
  setModal(
    `카드 고르기${pend > 1 ? ` (남은 묶음 ${pend})` : ''}`,
    [el('p', { cls: 'dim', text: allOwned ? '전부 이미 끼운 카드예요. 건너뛰어요.' : deckFull(state) ? '3장 중 하나를 고르면 바꿀 칸을 골라요. 이 집에서만 써요.' : '3장 중 하나를 골라 칸에 끼워요. 이 집에서만 써요.' }), el('div', { cls: 'pcards' }, ...cards)],
    [
      { label: '나중에 고르기', quiet: true, onClick: H.ctx.dismissModal },
      { label: '건너뛰기', primary: allOwned, onClick: skipOffer },
    ],
  );
  if (!fx.isReduced()) cards.forEach((_, k) => window.setTimeout(() => sfx.perkFlip(k), 250 + k * 180));
}

function skipOffer(): void {
  if (busy) return;
  const next = chooseCard(H.ctx.get(), 0, null);
  if (!next) return;
  H.ctx.set(next);
  H.ctx.save();
  H.ctx.update();
  afterChoice(0);
}

function afterChoice(wait: number): void {
  busy = true;
  window.setTimeout(() => {
    busy = false;
    if (!document.querySelector('.overlay .modal.deck-pick')) return;
    if (pendingCount(H.ctx.get()) > 0) renderPick();
    else H.ctx.dismissModal();
  }, wait);
}

function pickCard(d: CardDef, card: HTMLElement, all: HTMLElement[]): void {
  if (busy) return;
  const state = H.ctx.get();
  if (deckFull(state)) return renderReplace(d);
  const next = chooseCard(state, 0, d.id);
  if (!next) return;
  commit(next, card, all);
}

function commit(next: GameState, card: HTMLElement, all: HTMLElement[]): void {
  H.ctx.set(next);
  H.ctx.save();
  H.ctx.update();
  for (const c of all) c.classList.add(c === card ? 'chosen' : 'faded');
  card.querySelector('.pick-btn')?.replaceChildren('고름!');
  const r = card.getBoundingClientRect();
  sfx.perkPick();
  vibrate([20, 30, 40]);
  fx.burst(r.left + r.width / 2, r.top + r.height / 2, { n: 18, kind: 'star', colors: ['#ffc83d', '#ffffff', '#5b92ff'], speed: 260, size: 6 });
  afterChoice(fx.isReduced() ? 350 : 800);
}

/** 칸이 차 있을 때: 같은 창 안에서 바꿀 칸을 고른다 */
function renderReplace(d: CardDef): void {
  const state = H.ctx.get();
  const cards = state.deck.slots.map((s, i) => {
    const sd = cardDef(s.id);
    if (!sd) return null;
    const c = deckCard(sd, i, { lv: '바꾸면 사라져요', btn: '바꾸기' });
    c.addEventListener('click', () => {
      if (busy) return;
      const next = chooseCard(H.ctx.get(), 0, d.id, i);
      if (next) commit(next, c, cards.filter((x): x is HTMLButtonElement => !!x));
    });
    return c;
  });
  const incoming = cardRow(d);
  incoming.classList.add('incoming');
  setModal(
    '바꿀 칸 고르기',
    [el('p', { cls: 'dim', text: '새 카드를 끼울 칸을 골라요. 고른 칸의 카드는 사라져요.' }), incoming, el('div', { cls: 'pcards' }, ...cards.filter((c): c is HTMLButtonElement => !!c))],
    [{ label: '돌아가기', quiet: true, onClick: () => renderPick() }],
  );
}

// ---------- 발동 연출 ----------
const FIRE_GAP_MS = 90;
const WAIT_CHAIN_MAX_MS = 9000;

/** 강타·탭 결과를 받는다: deckFires는 연출, deckOffered는 새 묶음 알림 점멸. 창은 절대 저절로 열지 않는다 */
export function hit(fires: readonly DeckFire[] | undefined, offered: boolean | undefined): void {
  if (offered && row.isConnected && !fx.isReduced()) fx.edge(row, 'or', [1, 0, 1, 0, 1, 1]);
  if (!fires || fires.length === 0 || !row.isConnected) return;
  // 탭 수에 곱하는 카드(mult)는 뗀 순간, 보상 카드는 연쇄 재생이 끝나는 순간
  const now = fires.filter((f) => f.mult !== undefined);
  const late = fires.filter((f) => f.mult === undefined);
  if (now.length > 0) play(now);
  if (late.length === 0) return;
  const t0 = performance.now();
  const go = (): void => {
    if ((chainPlaying() || chainFinishing()) && performance.now() - t0 < WAIT_CHAIN_MAX_MS) {
      window.setTimeout(go, 50);
      return;
    }
    play(late);
  };
  go();
}

function slotIndex(id: string): number {
  return [...row.querySelectorAll<HTMLElement>('.deck-slot')].findIndex((s) => s.dataset.card === id);
}

function play(fires: DeckFire[]): void {
  const ordered = fires.map((f) => ({ f, i: slotIndex(f.id) })).filter((x) => x.i >= 0).sort((a, b) => a.i - b.i);
  ordered.forEach(({ f, i }, k) => window.setTimeout(() => fire(f, i, k), k * FIRE_GAP_MS));
}

function fire(f: DeckFire, index: number, order: number): void {
  const slot = row.querySelectorAll<HTMLElement>('.deck-slot')[index];
  if (!slot || slot.dataset.card !== f.id) return;
  const reduced = fx.isReduced();
  const mark = el('b', { cls: 'deck-x', text: `×${f.mult ?? f.times}` });
  slot.append(mark);
  if (reduced) {
    slot.classList.add('lit');
    window.setTimeout(() => slot.classList.remove('lit'), 300);
    window.setTimeout(() => mark.remove(), 1000);
    mark.classList.add('still');
  } else {
    fx.pxFrames(slot, [{ translate: '0 -4px' }, { translate: '0 -4px' }, { translate: '0 -2px' }, { translate: '0 0' }], 60);
    fx.edge(slot, 'g3', [1, 0, 1, 0, 1, 1]);
    fx.pxFrames(mark, [{ translate: '-50% 0' }, { translate: '-50% -4px' }, { translate: '-50% -8px' }, { translate: '-50% -8px' }, { translate: '-50% -8px' }, { translate: '-50% -8px' }, { translate: '-50% -8px', visibility: 'hidden' }, { translate: '-50% -8px' }, { translate: '-50% -8px', visibility: 'hidden' }], 100).onfinish = () => mark.remove();
    window.setTimeout(() => mark.remove(), 1200);
    vibrate(8);
  }
  if (order < 3) sfx.milestone();
  if (f.gain !== undefined && f.gain > 0 && !reduced) fx.coinShower(slot, H.pts(), 8);
}
