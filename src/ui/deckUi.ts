// 공구함 덱 화면(1단계): 카드 줄 · 공구함 창 · 카드 고르기 창 · 발동 연출. 로직은 logic/deck.ts, 설계는 DESIGN-DECK.md 7·8절.
import { cardDef, type CardDef, type CardTag } from '../data/cards';
import { boostOffer, chooseBoost, chooseCard, deckBoostIn, deckBoostPacks, deckFull, deckMult, deckNextMark, deckOfferOdds, deckPicksLeft, deckResonance, deckSlotViews, deckSlots, deckStackSum, isStarUp, type DeckChargeResult, type DeckFire, type DeckSlotView, type StackEvent } from '../logic/deck';
import { formatNumber } from '../logic/format';
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
  /** 방(테두리 번쩍임이 도는 곳) */
  room: () => Element;
}

let H: DeckHooks;
const TAG_NAME: Record<CardTag, string> = { precise: '정밀', chain: '연쇄', special: '특별', rush: '러시', fever: '피버' };
const RARITY_NAME = { common: '일반', rare: '레어', legend: '전설' } as const;
/** 충전 방법(로직 `CHARGE_RULES`의 조건과 같다: 정밀 = 퍼펙트 강타, 연쇄 = 50연쇄마다, 특별 = 터진 특별 상자, 피버 = 피버 중 강타) */
const HOW: Partial<Record<CardTag, string>> = { precise: '퍼펙트 강타로 충전', chain: '긴 연쇄로 충전', special: '특별 상자를 터뜨려 충전', fever: '피버 중 강타로 충전' };
export const howText = (d: CardDef): string => d.tags.map((t) => HOW[t]).filter(Boolean).join(' · ') || '어떤 강타로든 충전';
/** 배수 글자: 10 미만은 소수 한 자리(.0은 뗀다), 그 이상은 정수 */
const fmtMult = (v: number): string => (v >= 10 ? formatNumber(Math.round(v)) : String(Math.round(v * 10) / 10));
const pow10 = (v: number): number => (v >= 1 ? Math.floor(Math.log10(v) + 1e-9) : 0);
const cardIcon = (d: CardDef, size: number, cls?: string): HTMLImageElement => iconImg(d.icon as IconName, { size, alt: '', cls });
const tagVar = (d: CardDef): string => (d.tags.length > 0 ? `var(--tag-${d.tags[0]})` : 'var(--k3)');
/** ★ 점 n개(노랑 4x4 사각, k1 외곽). 카드 줄 칸·공구함 패널 이름 옆이 같이 쓴다 */
const starDots = (n: number, cls = 'stars'): HTMLElement => {
  const w = el('span', { cls, attrs: { 'aria-label': `별 ${n}개` } }, ...Array.from({ length: n }, () => el('i')));
  w.dataset.n = String(n);
  return w;
};
const pctText = (v: number): string => `${Math.round(v * 100)}%`;
const speedText = (v: number): string => `×${v}`;
/** 태그 칩(이중 태그 카드는 두 개). 칩마다 자기 태그 색 테두리 */
const chip = (t: CardTag, cls: string): HTMLElement => {
  const c = el('em', { cls, text: TAG_NAME[t] });
  c.style.setProperty('--cc', `var(--tag-${t})`);
  return c;
};

// ---------- 카드 줄 ----------
const row = el('div', { cls: 'deck-row', attrs: { role: 'group', 'aria-label': '공구함' } });
const rowLabel = el('span', { cls: 'deck-label' });
const multEl = el('b', { cls: 'deck-mult calm' });
const sumEl = el('span', { cls: 'deck-ss', attrs: { hidden: '' } });
const side = el('div', { cls: 'deck-side' }, el('span', { cls: 'deck-title' }, '공구함', sumEl), multEl, rowLabel);
const multRoll = fx.roller(multEl, (v) => `×${fmtMult(v)}`);
interface Cell {
  slot: HTMLElement;
  fill: HTMLElement | null;
  bar: HTMLElement | null;
  badge: HTMLElement | null;
}
let cells: Cell[] = [];
/** 연쇄 재생이 끝날 때까지 공구함 숫자를 강타 전 값으로 붙든다 */
let heldMult: number | null = null;
/** 알림: 대기 묶음이 있을 때 이사 줄 위에 뜨는 노란 버튼 */
export const alertBtn = el('button', { cls: 'btn gold perk-alert deck-alert', attrs: { type: 'button', hidden: '' } });

let rowKey = '';

export function initDeck(hooks: DeckHooks): void {
  H = hooks;
  row.addEventListener('click', () => H.ctx.goto('deck'));
  alertBtn.addEventListener('click', () => (pendingCount(H.ctx.get()) > 0 ? openPick() : openBoost()));
}

export const pendingCount = (s: GameState): number => s.deck?.offers.length ?? 0;
/** 공구 강화 탭 알림 점용: 대기 묶음이 있는가 */
export const hasPending = (): boolean => !!H && (pendingCount(H.ctx.get()) > 0 || boostCount(H.ctx.get()) > 0);
const boostCount = (s: GameState): number => (s.deck ? deckBoostPacks(s) : 0);

/** 매 update 끝에서 호출. 이사 전(moves 0)에는 줄을 만들지 않는다 */
export function sync(state: GameState): void {
  const on = state.moves > 0 && !!state.deck;
  if (!on) {
    if (row.isConnected) row.remove();
    alertBtn.hidden = true;
    rowKey = '';
    resetStacks();
    heldMult = null;
    lastRes = null;
    lastBoxes = 0;
    multRoll.snap(1);
    document.body.classList.remove('has-deck');
    return;
  }
  if (rowHold) return;
  if (!row.isConnected) {
    H.host.prepend(row);
    document.body.classList.add('has-deck');
  }
  const n = deckSlots(state.moves);
  const key = `${n}|${state.deck.slots.map((s) => s.id).join(',')}|${pendingCount(state) > 0 ? 1 : 0}`;
  if (key !== rowKey) {
    rowKey = key;
    cells = [];
    for (let i = 0; i < n; i++) {
      const slotState = state.deck.slots[i];
      const d = slotState ? cardDef(slotState.id) : undefined;
      const b = el('button', { cls: `deck-slot${d ? ` on r-${d.rarity}` : ''}`, attrs: { type: 'button', 'aria-label': d ? `${d.name}: ${d.desc}` : '빈 칸' } });
      let fill: HTMLElement | null = null;
      let bar: HTMLElement | null = null;
      let badge: HTMLElement | null = null;
      if (d) {
        b.dataset.card = d.id;
        if (d.tags.length > 0) b.style.setProperty('--tc', tagVar(d));
        else b.classList.add('notag');
        b.append(cardIcon(d, 32), starDots(slotState.star, 'stars deck-stars'));
        fill = el('i');
        bar = el('span', { cls: 'deck-bar' }, fill);
        badge = el('span', { cls: 'deck-stack', attrs: { hidden: '' } });
        b.append(badge);
      }
      cells.push({ slot: b, fill, bar, badge });
    }
    row.replaceChildren(...cells.map((c) => el('div', { cls: 'deck-cell' }, c.slot, ...(c.bar ? [c.bar] : []))), side);
  }
  const views = deckSlotViews(state);
  const buff = state.deck.buff;
  views.forEach((v, i) => {
    const c = cells[i];
    if (!c?.fill || !c.bar) return;
    c.fill.style.width = `${barPx(v)}px`;
    c.bar.classList.toggle('full', v.full && v.stacks === 0);
    c.bar.classList.toggle('ov', v.stacks > 0);
    c.bar.classList.toggle('res', v.resonance > 0);
    c.bar.dataset.charge = `${v.charge}/${v.need}`;
    c.slot.classList.toggle('armed', (v.id === 'C5' && !!buff?.nextStrike) || (v.id === 'S5' && !!buff?.forceBomb));
    const stars = c.slot.querySelector<HTMLElement>('.deck-stars');
    if (stars && stars.dataset.n !== String(v.star)) stars.replaceWith(starDots(v.star, 'stars deck-stars'));
  });
  watchStacks(views);
  watchResonance(state);
  watchFurnace(state, views);
  const m = heldMult ?? deckMult(state);
  multRoll.set(m);
  multEl.classList.toggle('calm', m <= 1.0001);
  const filled = state.deck.slots.length;
  const label = filled >= n ? '칸 가득' : `빈 칸 ${n - filled}`;
  if (rowLabel.textContent !== label) rowLabel.textContent = label;
  const pend = pendingCount(state);
  /** 알림 버튼 하나가 둘 다 맡는다: 카드 묶음이 먼저, 없으면 강화 고르기 묶음 */
  const bst = boostCount(state);
  alertBtn.hidden = pend === 0 && bst === 0;
  if (pend > 0) setLabel(alertBtn, 'ui-tools', 32, `카드 고르기${pend > 1 ? ` ${pend}` : ''}`);
  else if (bst > 0) setLabel(alertBtn, 'ui-tools', 32, `강화 고르기${bst > 1 ? ` ${bst}` : ''}`);
}

/** 충전 막대 채움: 1도트(2px) 단위, 막대 48px = 24도트 */
function barPx(v: DeckSlotView): number {
  if (v.stacks > 0) return v.charge <= 0 ? 0 : Math.min(46, Math.max(2, Math.floor((v.charge / v.stackNeed) * 24) * 2));
  if (v.full) return 48;
  return v.charge <= 0 ? 0 : Math.max(2, Math.floor((v.charge / v.need) * 24) * 2);
}

/** 공명 단계가 오른 순간(2·3·4장째): 그 태그 칸들이 함께 튀고 테두리 번쩍 + 효과음. 처음 줄이 생길 때·불러오기는 조용히 기록만 한다 */
let lastRes: Map<string, number> | null = null;
function watchResonance(state: GameState): void {
  const now = new Map(deckResonance(state).map((r) => [r.tag as string, r.level]));
  const prev = lastRes;
  lastRes = now;
  if (!prev || rowHold) return;
  const up = [...now].filter(([tag, lv]) => lv > (prev.get(tag) ?? 0)).map(([tag]) => tag as CardTag);
  if (up.length === 0) return;
  window.setTimeout(() => resonanceFx(up), ms(420));
}

function resonanceFx(tags: CardTag[]): void {
  if (!row.isConnected) return;
  const state = H.ctx.get();
  sfx.breakthrough();
  vibrate([10, 20, 10]);
  if (fx.isReduced()) return;
  state.deck.slots.forEach((sl, i) => {
    const d = cardDef(sl.id);
    if (!d || !d.tags.some((t) => tags.includes(t))) return;
    const slot = row.querySelectorAll<HTMLElement>('.deck-slot')[i];
    if (!slot) return;
    window.setTimeout(() => {
      fx.pxFrames(slot, [{ translate: '0 -6px' }, { translate: '0 -6px' }, { translate: '0 -2px' }, { translate: '0 0' }], 60);
      fx.edge(slot, 'or', [1, 0, 1, 0, 1, 1]);
      const r = slot.getBoundingClientRect();
      fx.burst(r.left + r.width / 2, r.top + r.height / 2, { n: 6, kind: 'star', colors: ['or', 'g3', 'k5'], speed: 180, size: 4 });
    }, i * 60);
  });
}

/** 용광로(F5): 피버가 끝날 때 보상이 상태에 바로 더해지고 알림 이벤트가 없어서, 피버 종료를 보고 칸만 튕긴다 */
let lastBoxes = 0;
function watchFurnace(state: GameState, views: DeckSlotView[]): void {
  const boxes = state.deck.buff?.boxesInFever ?? 0;
  const ended = lastBoxes > 0 && boxes === 0 && state.fever.activeSec <= 0;
  lastBoxes = boxes;
  if (!ended || rowHold || fx.isReduced()) return;
  const i = views.findIndex((v) => v.id === 'F5');
  const slot = row.querySelectorAll<HTMLElement>('.deck-slot')[i];
  if (!slot) return;
  fx.pxFrames(slot, [{ translate: '0 -6px' }, { translate: '0 -6px' }, { translate: '0 -2px' }, { translate: '0 0' }], 60);
  fx.edge(slot, 'or', [1, 0, 1, 0, 1, 1]);
  const r = slot.getBoundingClientRect();
  fx.burst(r.left + r.width / 2, r.top + r.height / 2, { n: 8, kind: 'star', colors: ['or', 'g2', 'k5'], speed: 200, size: 4 });
  sfx.milestone();
  fx.coinShower(slot, H.pts(), 8);
}

// ---------- 스택 배지 · 오르는 순간 연출 ----------
interface StackPend {
  slot: number;
  id: string;
  from: number;
  to: number;
  timer: number | null;
}
/** 아직 연출을 안 한 스택 상승(칸 번호별). 연출이 나올 때까지 배지는 `from`을 보여 준다 */
const stackPend = new Map<number, StackPend>();
/** 칸별로 마지막에 본 스택(줄을 처음 만들 때·불러오기는 조용히 기록만 한다) */
let stackSeen: { id: string; n: number }[] = [];
const stackFxAt = new Map<number, number>();
/** 카드 하나당 연출은 이 간격에 한 번(그 사이 오른 스택은 합친다) */
const STACK_FX_GAP_MS = 150;
const STACK_ORDER_MS = 60;

function resetStacks(): void {
  stackPend.forEach((p) => p.timer !== null && clearTimeout(p.timer));
  stackPend.clear();
  stackSeen = [];
  stackFxAt.clear();
  sumEl.hidden = true;
}

/** 배지 단계: 0~9 = 0, 10~19 = 1, 20~29 = 2, 30+ = 3 */
const stackTier = (n: number): number => Math.min(3, Math.floor(n / 10));

function paintBadge(c: Cell, n: number): void {
  const b = c.badge;
  if (!b) return;
  b.hidden = n <= 0;
  if (n <= 0) return;
  const t = `×${n}`;
  if (b.textContent !== t) b.textContent = t;
  b.dataset.tier = String(stackTier(n));
}

function watchStacks(views: DeckSlotView[]): void {
  let sum = 0;
  views.forEach((v, i) => {
    const c = cells[i];
    if (!c) return;
    let p = stackPend.get(i);
    if (p && p.id !== v.id) {
      if (p.timer !== null) clearTimeout(p.timer);
      stackPend.delete(i);
      p = undefined;
    }
    if (p) {
      paintBadge(c, p.from);
      sum += p.from;
      return;
    }
    const prev = stackSeen[i];
    stackSeen[i] = { id: v.id, n: v.stacks };
    if (prev && prev.id === v.id && v.stacks > prev.n) {
      enqueueStack({ slot: i, id: v.id, from: prev.n, to: v.stacks });
      scheduleStack(i, 0);
      paintBadge(c, prev.n);
      sum += prev.n;
      return;
    }
    paintBadge(c, v.stacks);
    sum += v.stacks;
  });
  stackSeen.length = views.length;
  paintSum(sum);
}

function paintSum(sum: number): void {
  sumEl.hidden = sum <= 0;
  const t = `스택 ${formatNumber(sum)}`;
  if (sumEl.textContent !== t) sumEl.textContent = t;
}

function enqueueStack(ev: StackEvent): void {
  const p = stackPend.get(ev.slot);
  if (p && p.id === ev.id) p.to = Math.max(p.to, ev.to);
  else stackPend.set(ev.slot, { slot: ev.slot, id: ev.id, from: ev.from, to: ev.to, timer: null });
}

function scheduleStack(slot: number, order: number): void {
  const p = stackPend.get(slot);
  if (!p || p.timer !== null) return;
  const wait = Math.max(0, (stackFxAt.get(slot) ?? -1e9) + STACK_FX_GAP_MS - performance.now()) + order * STACK_ORDER_MS;
  p.timer = window.setTimeout(() => playStack(p), ms(wait));
}

/** 칸 위로 떠오르는 작은 글자(+N). 움직임 줄이기에서는 제자리 */
function plusMark(slot: HTMLElement, text: string): void {
  const mark = el('b', { cls: 'deck-x stack-plus', text });
  slot.append(mark);
  if (fx.isReduced()) {
    mark.classList.add('still');
    window.setTimeout(() => mark.remove(), 800);
    return;
  }
  fx.pxFrames(mark, [{ translate: '-50% 0' }, { translate: '-50% -4px' }, { translate: '-50% -10px' }, { translate: '-50% -14px' }, { translate: '-50% -14px' }, { translate: '-50% -14px' }, { translate: '-50% -14px', visibility: 'hidden' }, { translate: '-50% -14px' }, { translate: '-50% -14px', visibility: 'hidden' }], 80).onfinish = () => mark.remove();
  window.setTimeout(() => mark.remove(), 1000);
}

/** 스택이 오른 순간: 카드가 튀고 배지 숫자가 번쩍이며 올라가고 노란 네모 입자 · 상승음. 10의 배수를 넘으면 줄 전체 번쩍 + 입자 2배 */
function playStack(p: StackPend): void {
  if (rowHold) {
    p.timer = window.setTimeout(() => playStack(p), 100);
    return;
  }
  stackPend.delete(p.slot);
  stackFxAt.set(p.slot, performance.now());
  const state = H.ctx.get();
  if (!state.deck || !row.isConnected) return;
  const v = deckSlotViews(state)[p.slot];
  const c = cells[p.slot];
  if (!v || !c?.badge || v.id !== p.id) return sync(state);
  const to = Math.max(p.to, v.stacks);
  const gain = to - p.from;
  const big = Math.floor(to / 10) > Math.floor(p.from / 10);
  stackSeen[p.slot] = { id: p.id, n: v.stacks };
  const badge = c.badge;
  const slot = c.slot;
  sync(state);
  sfx.stackUp(to, big);
  vibrate(big ? [10, 20, 10] : 8);
  slot.classList.add('stack-up');
  badge.classList.add('up');
  window.setTimeout(() => {
    slot.classList.remove('stack-up');
    badge.classList.remove('up');
  }, ms(420));
  if (gain > 1) {
    plusMark(slot, `+${gain}`);
    if (!fx.isReduced()) {
      const mid = p.from + Math.ceil(gain / 2);
      badge.textContent = `×${p.from}`;
      window.setTimeout(() => (badge.textContent = `×${mid}`), ms(60));
      window.setTimeout(() => (badge.textContent = `×${to}`), ms(120));
    }
  }
  sumEl.classList.add('pop');
  multEl.classList.add('pop');
  window.setTimeout(() => {
    sumEl.classList.remove('pop');
    multEl.classList.remove('pop');
  }, ms(420));
  if (fx.isReduced()) return;
  fx.pxFrames(slot, big ? [{ translate: '0 -12px' }, { translate: '0 -14px' }, { translate: '0 -8px' }, { translate: '0 -2px' }, { translate: '0 0' }] : [{ translate: '0 -8px' }, { translate: '0 -10px' }, { translate: '0 -4px' }, { translate: '0 0' }], ms(60));
  const r = slot.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const opt = { n: 10, kind: 'dot' as const, colors: ['g2', 'g3', 'g1', 'k5'], speed: 210, size: 8, gravity: 300, life: 0.6, ring: true };
  fx.burst(cx, cy, opt);
  if (big) {
    fx.burst(cx, cy, { ...opt, speed: 320, ring: false });
    fx.edge(row, 'g3', [1, 0, 1, 0, 1, 1]);
  }
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
function cardRow(d: CardDef, v?: DeckSlotView): HTMLElement {
  const how = [d.rarity === 'common' ? '' : RARITY_NAME[d.rarity], howText(d), v && v.speed > 1 ? `충전 ×${v.speed}` : ''].filter(Boolean).join(' · ');
  const main = el('div', { cls: 'pr-name' }, el('b', { cls: 'fb', text: d.name }), ...(v ? [starDots(v.star, 'stars pr-stars')] : []), ...d.tags.map((t) => chip(t, 'tag')));
  const body = el('div', { cls: 'pr-main' }, main, el('div', { cls: 'pr-desc', text: d.desc }), el('div', { cls: 'pr-how', text: how }));
  if (v) {
    const fill = el('i');
    fill.style.width = v.stacks > 0 || !v.full ? `${Math.min(100, Math.round(barPx(v) / 0.48))}%` : '100%';
    body.append(el('span', { cls: `deck-bar${v.full && v.stacks === 0 ? ' full' : ''}${v.stacks > 0 ? ' ov' : ''}${v.resonance > 0 ? ' res' : ''}` }, fill));
    body.append(
      el(
        'div',
        { cls: 'pr-stack' },
        el('b', { cls: v.stacks > 0 ? 'has' : '', text: `스택 ${formatNumber(v.stacks)}` }),
        el('span', { text: `다음 스택까지 ${formatNumber(Math.max(1, Math.ceil(v.stackNeed - v.charge)))}` }),
        el('span', { text: `다음 ×${fmtMult(v.nextStackMult)}` }),
      ),
    );
  }
  const r = el(
    'div',
    { cls: `perk-row deck-card r-${d.rarity}` },
    el('span', { cls: 'pr-emoji' }, cardIcon(d, 32)),
    body,
    el('div', { cls: 'pr-lv' }, v ? el('b', { text: `지금 ×${fmtMult(v.mult)}` }) : el('b', { text: RARITY_NAME[d.rarity] }), ...(v ? [el('span', { cls: 'pr-max', text: `최대 ×${v.cap}${v.capBonus > 0 ? ` (+${v.capBonus})` : ''}` })] : [])),
  );
  r.style.setProperty('--cc', tagVar(d));
  return r;
}

// ---------- 공구함 탭(이사 뒤 4번째 탭) ----------
export const panel = el('div', { cls: 'panel-inner deck-panel' });
let panelKey = '';
const panelMult = el('b', { cls: 'dp-mult' });
const panelRoll = fx.roller(panelMult, (v) => `×${fmtMult(v)}`);

/** 매 update에서(공구함 탭을 보는 동안) 부른다. 낀 카드·고르기·진행이 바뀔 때만 다시 짠다 */
export function syncPanel(state: GameState, force = false): void {
  if (!state.deck) return;
  const views = deckSlotViews(state);
  const pend = pendingCount(state);
  const boosts = boostCount(state);
  const next = deckNextMark(state);
  const left = deckPicksLeft(state);
  const n = deckSlots(state.moves);
  const prog = next ? Math.floor(next.progress * 25) * 4 : 0;
  const res = deckResonance(state);
  const key = `${n}|${views.map((v) => `${v.id}${v.star}:${v.full ? 'F' : barPx(v)}:${Math.round(v.mult * 10)}:${v.cap}:${v.speed}:${v.stacks}:${Math.ceil(v.stackNeed - v.charge)}`).join(',')}|${res.map((r) => `${r.tag}${r.count}`).join(',')}|${pend}|${boosts}|${left}|${prog}`;
  const m = deckMult(state);
  if (force) panelRoll.snap(m);
  else panelRoll.set(m);
  panelMult.classList.toggle('calm', m <= 1.0001);
  if (key === panelKey && !force) return;
  panelKey = key;
  const top = el('div', { cls: 'dp-top' }, el('div', { cls: 'dp-lbl' }, el('span', { text: '공구함 배율' }), el('span', { cls: 'dp-sub', text: '낀 카드의 배수를 모두 곱해요' })), panelMult);
  const body: HTMLElement[] = [top];
  const sum = deckStackSum(state);
  body.push(el('div', { cls: 'pf dp-stack' }, el('b', { text: `스택 합 ${formatNumber(sum)}` }), el('span', { text: `다음 강화 고르기까지 스택 ${deckBoostIn(state)}개` })));
  if (boosts > 0) {
    const b = el('button', { cls: 'btn gold perk-pick-btn dp-pick', attrs: { type: 'button' } });
    setLabel(b, 'ui-tools', 32, `강화 고르기${boosts > 1 ? ` ${boosts}` : ''}`);
    b.addEventListener('click', () => openBoost());
    body.push(b);
  }
  if (pend > 0) {
    const b = el('button', { cls: 'btn gold perk-pick-btn dp-pick', attrs: { type: 'button' } });
    setLabel(b, 'ui-tools', 32, `카드 고르기${pend > 1 ? ` ${pend}` : ''}`);
    b.addEventListener('click', () => openPick());
    body.push(b);
  } else if (next) {
    const fill = el('i');
    fill.style.width = `${prog}%`;
    body.push(el('div', { cls: 'pf dp-next' }, el('div', { cls: 'dp-next-head' }, el('b', { text: '다음 카드까지' }), el('span', { text: `남은 고르기 ${left}번` })), el('span', { cls: 'dp-track' }, fill)));
  } else {
    body.push(el('div', { cls: 'pf dp-next' }, el('div', { cls: 'dp-next-head' }, el('b', { text: '이 집의 카드를 모두 받았어요' }))));
  }
  const resBox = el('div', { cls: 'pf dp-res' });
  const live = res.filter((r) => r.level > 0);
  if (live.length === 0) resBox.append(el('span', { cls: 'dp-res-none', text: '같은 태그를 2장 모으면 충전이 빨라져요' }));
  for (const r of live) resBox.append(el('div', { cls: 'dp-res-row' }, chip(r.tag, 'tag'), el('b', { text: `${TAG_NAME[r.tag]} ${r.count}장` }), el('span', { text: `충전 ${speedText(r.speed)}` })));
  const odds = el('button', { cls: 'btn quiet deck-odds-btn', text: '확률 보기', attrs: { type: 'button' } });
  odds.addEventListener('click', () => openOdds());
  body.push(resBox, el('div', { cls: 'dp-tools' }, odds));
  const list = el('div', { cls: 'perk-list dp-list' });
  for (const v of views) {
    const d = cardDef(v.id);
    if (d) list.append(cardRow(d, v));
  }
  for (let i = views.length; i < n; i++) list.append(el('div', { cls: 'perk-row deck-card-empty' }, el('span', { cls: 'pr-emoji' }), el('div', { cls: 'pr-main' }, el('div', { cls: 'pr-name' }, el('span', { text: '빈 칸' })))));
  body.push(list, el('p', { cls: 'note dim dp-note', text: '이사하면 공구함은 비워져요' }));
  panel.replaceChildren(...body);
}

// ---------- 카드 고르기 창 ----------
let busy = false;
/** 등장·뒤집기 연출 재생 중(이 동안 누르면 건너뛰기만 하고 카드는 안 골라진다) */
let playing = false;
let swallow = false;
let introToken = 0;
/** 지금 열린 고르기 창이 카드 고르기(pick)인가 강화 고르기(boost)인가 */
let mode: 'pick' | 'boost' = 'pick';
let introStop: (() => void) | null = null;
/** 고른 카드가 칸에 꽂히기 전까지 카드 줄을 옛 모습으로 붙든다 */
let rowHold = false;
/** 촬영용: 연출을 N배 느리게(`window.__deckSlow`) */
const slow = (): number => (window as unknown as { __deckSlow?: number }).__deckSlow ?? 1;
const ms = (n: number): number => n * slow();
const REVEAL_COLOR: Record<CardDef['rarity'], string> = { common: 'k5', rare: 'b4', legend: 'g3' };

function pickBtn(text: string): HTMLElement {
  return el('span', { cls: 'btn sm primary pick-btn', text });
}

/** 선택 카드(`pcard`): 칩 = 태그, 이미 낀 카드·고를 수 없는 카드는 `maxed` 모양. 앞면 위에 희귀도 뒷면(`pback`)이 겹쳐 있다 */
function deckCard(d: CardDef, k: number, o: { lv: string; btn: string; locked?: boolean; up?: boolean }): HTMLButtonElement {
  const front = el(
    'div',
    { cls: 'pface front' },
    el('span', { cls: 'pc-tags' }, ...d.tags.map((t) => chip(t, 'pc-cat tag'))),
    el('span', { cls: 'pc-emoji' }, cardIcon(d, 32)),
    el('span', { cls: 'pc-name', text: d.name }),
    el('span', { cls: 'pc-fx', text: d.desc }),
    el('span', { cls: 'pc-how', text: howText(d) }),
    el('span', { cls: `pc-lv${o.up ? ' up' : ''}` }, ...o.lv.split('|').flatMap((t, i) => (i === 0 ? [el('span', { text: t })] : [' ', el('span', { text: t })]))),
    pickBtn(o.btn),
  );
  const back = el('div', { cls: 'pback' }, iconImg(`card/back-${d.rarity}` as IconName, { size: 48, alt: '' }));
  const b = el('button', { cls: `pcard r-${d.rarity}${o.locked ? ' maxed' : ''}${o.up ? ' starup' : ''}`, attrs: { type: 'button', 'data-card': d.id } }, el('div', { cls: 'pcard-inner' }, front, back));
  b.style.setProperty('--k', String(k));
  b.style.setProperty('--cc', tagVar(d));
  b.disabled = !!o.locked;
  return b;
}

const inner = (c: HTMLElement): HTMLElement => c.querySelector<HTMLElement>('.pcard-inner')!;

/** 가로 폭을 계단식으로 줄였다 늘린다(회전 없음). 폭이 0인 순간 `toBack`에 맞게 앞면·뒷면을 바꾼다 */
function flip(c: HTMLElement, toBack: boolean, track: Animation[], then?: () => void): void {
  const a1 = fx.pxFrames(inner(c), [{ scale: '1 1' }, { scale: '0.67 1' }, { scale: '0.33 1' }, { scale: '0 1' }], ms(30), { fill: 'forwards' });
  track.push(a1);
  a1.onfinish = () => {
    c.classList.toggle('back', toBack);
    const a2 = fx.pxFrames(inner(c), [{ scale: '0.33 1' }, { scale: '0.67 1' }, { scale: '1 1' }], ms(30));
    track.push(a2);
    a1.cancel();
    then?.();
  };
}

/** 앞면이 나오는 순간: 흰 번쩍 → 희귀도 색 번쩍 + 반짝임 입자 + 효과음. 전설은 노랑 테두리 깜빡임 */
function revealFx(c: HTMLElement, d: CardDef, k: number): void {
  const box = inner(c);
  const r = box.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const fl = el('i', { cls: 'pflash' });
  box.append(fl);
  const col = `var(--${REVEAL_COLOR[d.rarity]})`;
  const frames: Keyframe[] =
    d.rarity === 'common' ? [{ visibility: 'visible', background: 'var(--k5)' }, { visibility: 'hidden' }]
    : d.rarity === 'rare' ? [{ visibility: 'visible', background: 'var(--k5)' }, { visibility: 'visible', background: col }, { visibility: 'hidden' }]
    : [{ visibility: 'visible', background: 'var(--k5)' }, { visibility: 'visible', background: col }, { visibility: 'visible', background: 'var(--k5)' }, { visibility: 'visible', background: col }, { visibility: 'visible', background: 'var(--g2)' }, { visibility: 'hidden' }];
  fx.pxFrames(fl, frames, ms(d.rarity === 'legend' ? 50 : 40)).onfinish = () => fl.remove();
  sfx.cardReveal(d.rarity, k);
  if (d.rarity === 'legend') {
    // 전설: 카드 노랑 테두리 깜빡임 + 별 입자 링·산개 + 모서리 반짝 + 창·화면 테두리 번쩍 + 창 흔들림(고르기 연출 1.2초 안에서 끝난다)
    fx.edge(box, 'g3', [1, 0, 1, 0, 1, 0, 1, 0, 1, 1]);
    fx.burst(cx, cy, { n: 16, kind: 'star', colors: ['g1', 'or', 'g2'], speed: 360, size: 6, ring: true });
    fx.burst(cx, cy, { n: 14, kind: 'star', colors: ['or', 'g2', 'g1', 'k1'], speed: 300, size: 8 });
    [[r.left + 8, r.top + 8], [r.right - 8, r.top + 8], [r.left + 8, r.bottom - 8], [r.right - 8, r.bottom - 8]].forEach(([x, y]) => fx.twinkle(x, y, 'g3', 8));
    const modal = c.closest<HTMLElement>('.modal');
    const ov = c.closest<HTMLElement>('.overlay');
    if (ov) fx.edge(ov, 'g3', [1, 0, 1, 0, 1, 1]);
    if (modal) fx.shake(modal, 4, 240);
    vibrate([15, 20, 30]);
  } else if (d.rarity === 'rare') {
    fx.edge(box, 'b4', [1, 0, 1, 1]);
    fx.burst(cx, cy, { n: 8, kind: 'star', colors: ['b3', 'b2', 'b4'], speed: 240, size: 6 });
  } else {
    fx.burst(cx, cy, { n: 4, kind: 'star', colors: ['b2', 'b3'], speed: 180, size: 4 });
  }
}

/** 등장(뒷면이 아래에서 한 장씩) → 왼쪽부터 뒤집기. 전체 약 1.1초. 아무 데나 누르면 `introStop`으로 즉시 완성 */
function intro(cards: HTMLElement[], defs: CardDef[]): void {
  const T = ++introToken;
  const timers: number[] = [];
  const anims: Animation[] = [];
  const body = cards[0]?.closest<HTMLElement>('.modal-body');
  const stop = (): void => {
    if (T !== introToken) return;
    timers.forEach(clearTimeout);
    anims.forEach((a) => a.cancel());
    introToken++;
    playing = false;
    introStop = null;
    body?.classList.remove('dealing');
    for (const c of cards) {
      c.classList.remove('pre', 'back');
      c.querySelectorAll('.pflash, .fx-edgebox').forEach((e) => e.remove());
    }
  };
  if (fx.isReduced() || cards.length === 0) {
    playing = false;
    return;
  }
  playing = true;
  introStop = stop;
  body?.classList.add('dealing');
  const at = (t: number, f: () => void): void => {
    timers.push(window.setTimeout(() => T === introToken && cards[0].isConnected && f(), ms(t)));
  };
  cards.forEach((c, k) => {
    const t0 = 100 + k * 120;
    at(t0, () => {
      c.classList.remove('pre');
      anims.push(fx.pxFrames(c, [{ translate: '0 140px' }, { translate: '0 84px' }, { translate: '0 40px' }, { translate: '0 8px' }, { translate: '0 0' }, { translate: '0 -4px' }, { translate: '0 0' }], ms(36)));
    });
    at(t0 + 4 * 36, () => sfx.cardDeal(k));
    at(580 + k * 160, () => flip(c, false, anims, () => revealFx(c, defs[k], k)));
  });
  at(1130, stop);
}

/** 연출 도중 창을 누르면 건너뛰기만 한다(눌린 카드는 안 골라진다) */
function guardIntro(): void {
  const ov = document.querySelector('.modal.deck-pick')?.closest('.overlay');
  if (!ov) return;
  ov.addEventListener(
    'pointerdown',
    () => {
      if (!playing) {
        swallow = false;
        return;
      }
      swallow = true;
      introStop?.();
    },
    true,
  );
  ov.addEventListener(
    'click',
    (e) => {
      if (!playing && !swallow) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      swallow = false;
      introStop?.();
    },
    true,
  );
}

export function openPick(): void {
  const state = H.ctx.get();
  if (!state.deck || state.deck.offers.length === 0) return;
  mode = 'pick';
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
  guardIntro();
  renderPick();
}

function renderPick(replay = true): void {
  introStop?.();
  swallow = false;
  const state = H.ctx.get();
  const offer = state.deck.offers[0];
  if (!offer) return H.ctx.dismissModal();
  const pend = state.deck.offers.length;
  const owned = new Set(state.deck.slots.map((s) => s.id));
  const defs = offer.map((id) => cardDef(id)).filter((d): d is CardDef => !!d);
  const cards = defs.map((d, k) => {
    const have = owned.has(d.id);
    const up = have && isStarUp(state, d.id);
    const v = deckSlotViews(state).find((x) => x.id === d.id);
    const c = deckCard(d, k, { lv: up && v ? `칸 안 씀|최대 ×${v.cap} → ×${v.cap + 1}` : have ? '이미 끼웠어요' : `${RARITY_NAME[d.rarity]} 카드`, btn: up ? '★ 올리기' : '고르기', locked: have && !up, up });
    c.addEventListener('click', () => pickCard(d, c, cards));
    return c;
  });
  const play = replay && !fx.isReduced();
  if (play) cards.forEach((c) => c.classList.add('pre', 'back'));
  const allOwned = defs.every((d) => owned.has(d.id) && !isStarUp(state, d.id));
  const oddsBtn = el('button', { cls: 'btn quiet deck-odds-btn', text: '확률', attrs: { type: 'button', 'aria-label': '카드 확률 보기' } });
  oddsBtn.addEventListener('click', () => renderOdds());
  const hint = allOwned ? '전부 이미 끼운 카드예요. 건너뛰어요.' : deckFull(state) ? '3장 중 하나를 고르면 바꿀 칸을 골라요. 이 집에서만 써요.' : '3장 중 하나를 골라 칸에 끼워요. 이 집에서만 써요.';
  setModal(
    `카드 고르기${pend > 1 ? ` (남은 묶음 ${pend})` : ''}`,
    [el('div', { cls: 'dk-hint' }, el('p', { cls: 'dim', text: hint }), oddsBtn), el('div', { cls: 'pcards' }, ...cards)],
    [
      { label: '나중에 고르기', quiet: true, onClick: H.ctx.dismissModal },
      { label: '건너뛰기', primary: allOwned, onClick: skipOffer },
    ],
  );
  if (play) intro(cards, defs);
  else playing = false;
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
    if (mode === 'boost' ? boostCount(H.ctx.get()) > 0 : pendingCount(H.ctx.get()) > 0) (mode === 'boost' ? renderBoost() : renderPick());
    else H.ctx.dismissModal();
  }, wait);
}

function pickCard(d: CardDef, card: HTMLElement, all: HTMLElement[]): void {
  if (busy || playing) return;
  const state = H.ctx.get();
  const up = isStarUp(state, d.id);
  if (deckFull(state) && !up) return renderReplace(d);
  const next = chooseCard(state, 0, d.id);
  if (!next) return;
  const held = state.deck.slots.findIndex((x) => x.id === d.id);
  commit(next, card, all, d, up ? held : state.deck.slots.length, card.querySelector('.pc-emoji .ico'), up);
}

/** 카드를 골랐다: 고른 카드 튐·번쩍, 나머지는 뒷면으로 뒤집혀 아래로 빠지고, 창이 닫히며 아이콘이 카드 줄 칸으로 날아가 꽂힌다 */
function commit(next: GameState, card: HTMLElement, all: HTMLElement[], d: CardDef, slotIdx: number, iconEl: Element | null, starUp = false, boost = false): void {
  const reduced = fx.isReduced();
  rowHold = !reduced;
  H.ctx.set(next);
  H.ctx.save();
  H.ctx.update();
  for (const c of all) c.classList.add(c === card ? 'chosen' : 'faded');
  card.querySelector('.pick-btn')?.replaceChildren('고름!');
  const r = card.getBoundingClientRect();
  sfx.perkPick();
  vibrate([20, 30, 40]);
  fx.burst(r.left + r.width / 2, r.top + r.height / 2, { n: 18, kind: 'star', colors: ['#ffc83d', '#ffffff', '#5b92ff'], speed: 260, size: 6 });
  if (reduced) return afterChoice(350);
  busy = true;
  card.closest('.modal-body')?.classList.add('dealing');
  const box = inner(card);
  fx.pxFrames(box, [{ translate: '0 4px' }, { translate: '0 -4px' }, { translate: '0 2px' }, { translate: '0 0' }], ms(45));
  const fl = el('i', { cls: 'pflash' });
  box.append(fl);
  fx.pxFrames(fl, [{ visibility: 'visible', background: 'var(--k5)' }, { visibility: 'visible', background: 'var(--g3)' }, { visibility: 'hidden' }], ms(40)).onfinish = () => fl.remove();
  fx.edge(box, 'g3', [1, 0, 1, 0, 1, 1]);
  const trash: Animation[] = [];
  for (const c of all) {
    if (c === card) continue;
    flip(c, true, trash, () => {
      fx.pxFrames(c, [{ translate: '0 8px' }, { translate: '0 28px' }, { translate: '0 56px' }, { translate: '0 96px', visibility: 'hidden' }], ms(40), { fill: 'forwards' });
    });
  }
  const from = iconEl?.getBoundingClientRect() ?? r;
  window.setTimeout(() => {
    H.ctx.dismissModal();
    flyToSlot(d, from, slotIdx, starUp, boost);
  }, ms(360));
}

/** 닫히는 창에서 고른 카드 아이콘이 카드 줄 칸으로 날아간다(6걸음, 위로 솟았다 내려앉는 계단 경로). 도착하면 칸에 꽂힌다 */
function flyToSlot(d: CardDef, from: DOMRect, idx: number, starUp = false, boost = false): void {
  const slot = row.querySelectorAll<HTMLElement>('.deck-slot')[idx];
  const finish = (): void => {
    rowHold = false;
    busy = false;
    if (!H.ctx.get().deck) return;
    sync(H.ctx.get());
    if (!boost) landSlot(d, starUp);
    if (mode === 'boost' ? boostCount(H.ctx.get()) > 0 : pendingCount(H.ctx.get()) > 0) window.setTimeout(() => (mode === 'boost' ? openBoost() : openPick()), ms(260));
  };
  if (!slot || !row.isConnected) return finish();
  const to = slot.getBoundingClientRect();
  const size = Math.max(2, Math.round((to.width / 48) * 16) * 2);
  const img = iconImg(d.icon as IconName, { size, alt: '', cls: 'deck-fly' });
  img.style.width = `${size}px`;
  img.style.height = `${size}px`;
  document.body.append(img);
  const ax = from.left + from.width / 2;
  const ay = from.top + from.height / 2;
  const bx = to.left + to.width / 2;
  const by = to.top + to.height / 2;
  const STEPS = [0, 0.14, 0.32, 0.54, 0.76, 0.92, 1];
  const ARC = [0, 18, 34, 38, 28, 12, 0];
  const pos = (i: number): Keyframe => ({ translate: `${Math.round((ax + (bx - ax) * STEPS[i] - size / 2) / 2) * 2}px ${Math.round((ay + (by - ay) * STEPS[i] - ARC[i] * (Math.abs(by - ay) > 40 ? 1 : 0.5) - size / 2) / 2) * 2}px` });
  const frames = STEPS.map((_, i) => pos(i));
  const a = fx.pxFrames(img, frames, ms(50));
  [2, 4].forEach((i) => window.setTimeout(() => fx.twinkle(ax + (bx - ax) * STEPS[i], ay + (by - ay) * STEPS[i], 'g3', 4, 0.3), ms(50 * i)));
  let done = false;
  const end = (): void => {
    if (done) return;
    done = true;
    img.remove();
    finish();
  };
  a.onfinish = end;
  window.setTimeout(end, ms(700));
}

/** 칸에 꽂힌 순간: 칸 튐 + 칸 테두리 번쩍 + 입자 + 효과음 */
function landSlot(d: CardDef, starUp = false): void {
  const i = slotIndex(d.id);
  const slot = row.querySelectorAll<HTMLElement>('.deck-slot')[i];
  if (!slot) return;
  sfx.cardSlot();
  vibrate(15);
  if (fx.isReduced()) return;
  fx.pxFrames(slot, [{ translate: '0 6px' }, { translate: '0 -6px' }, { translate: '0 2px' }, { translate: '0 0' }], ms(50));
  slot.classList.add('lit');
  window.setTimeout(() => slot.classList.remove('lit'), ms(420));
  fx.edge(slot, 'g3', [1, 0, 1, 0, 1, 1]);
  const r = slot.getBoundingClientRect();
  fx.burst(r.left + r.width / 2, r.top + r.height / 2, { n: 8, kind: 'star', colors: ['g2', 'g3', 'k5'], speed: 200, size: 4 });
  if (!starUp) return;
  // ★ 올리기: 꽂힌 순간에 ★ 점이 깜빡이고 별 입자가 더 터진다(칸 튐은 위에서)
  const dots = slot.querySelector<HTMLElement>('.deck-stars');
  dots?.classList.add('pop');
  window.setTimeout(() => dots?.classList.remove('pop'), ms(480));
  fx.burst(r.left + r.width / 2, r.bottom - 8, { n: 12, kind: 'star', colors: ['g3', 'g2', 'k5'], speed: 260, size: 6 });
  window.setTimeout(() => sfx.milestone(), ms(120));
}

/** 칸이 차 있을 때: 같은 창 안에서 바꿀 칸을 고른다 */
function renderReplace(d: CardDef, choose: (slot: number) => GameState | null = (slot) => chooseCard(H.ctx.get(), 0, d.id, slot), back: () => void = () => renderPick(false)): void {
  introStop?.();
  const state = H.ctx.get();
  const views = deckSlotViews(state);
  const incoming = cardRow(d);
  incoming.classList.add('incoming');
  const cards = views.map((v, i) => {
    const sd = cardDef(v.id);
    if (!sd) return null;
    const c = deckCard(sd, i, { lv: `지금 ×${fmtMult(v.mult)}|스택 ${v.stacks} → ${Math.floor(v.stacks / 2)}`, btn: '바꾸기' });
    c.addEventListener('click', () => {
      if (busy || playing) return;
      const next = choose(i);
      if (next) commit(next, c, cards.filter((x): x is HTMLButtonElement => !!x), d, i, incoming.querySelector('.pr-emoji .ico'));
    });
    return c;
  });
  setModal(
    '바꿀 칸 고르기',
    [el('p', { cls: 'dim', text: '새 카드를 끼울 칸을 골라요. 고른 칸의 카드는 사라지고, 바꾸면 이 카드의 충전이 사라져요. 스택은 절반만 이어받아요(칸 스택 → 새 카드).' }), incoming, el('div', { cls: 'pcards' }, ...cards.filter((c): c is HTMLButtonElement => !!c))],
    [{ label: '돌아가기', quiet: true, onClick: back }],
  );
}

// ---------- 강화 고르기 ----------
export function openBoost(): void {
  const state = H.ctx.get();
  if (!state.deck || boostCount(state) === 0) return;
  mode = 'boost';
  busy = false;
  H.ctx.showModal(
    'x',
    [],
    [
      { label: '나중에 고르기', quiet: true, onClick: H.ctx.dismissModal },
      { label: '건너뛰기', onClick: skipBoost },
    ],
    { chip: '강화', cls: 'perk-pick deck-pick deck-boostpick', icon: titleIcon() },
  );
  guardIntro();
  renderBoost();
}

function renderBoost(replay = true): void {
  introStop?.();
  swallow = false;
  const state = H.ctx.get();
  const opts = boostOffer(state);
  if (opts.length === 0) return H.ctx.dismissModal();
  const pend = boostCount(state);
  const views = deckSlotViews(state);
  const defs: CardDef[] = [];
  const cards = opts.map((o, k) => {
    const d = cardDef(o.kind === 'boost' ? (views[o.slot]?.id ?? '') : o.id) as CardDef;
    defs.push(d);
    let c: HTMLButtonElement;
    if (o.kind === 'boost') {
      const v = views[o.slot];
      c = deckCard(d, k, { lv: `스택 ${v.stacks} → ${v.stacks + o.stacks}|지금 ×${fmtMult(v.mult)}`, btn: `스택 +${o.stacks}` });
      c.classList.add('boostopt');
      c.addEventListener('click', () => pickBoost(k, o, d, c, cards));
    } else {
      c = deckCard(d, k, { lv: `${RARITY_NAME[d.rarity]} 카드`, btn: '고르기' });
      c.addEventListener('click', () => pickBoost(k, o, d, c, cards));
    }
    return c;
  });
  const play = replay && !fx.isReduced();
  if (play) cards.forEach((c) => c.classList.add('pre', 'back'));
  const full = deckFull(state);
  setModal(
    `강화 고르기${pend > 1 ? ` (남은 묶음 ${pend})` : ''}`,
    [el('div', { cls: 'dk-hint' }, el('p', { cls: 'dim', text: full ? '스택 +2를 줄 카드나 새 카드를 골라요. 새 카드는 바꿀 칸을 골라요.' : '스택 +2를 줄 카드나 새 카드를 골라요.' })), el('div', { cls: 'pcards' }, ...cards)],
    [
      { label: '나중에 고르기', quiet: true, onClick: H.ctx.dismissModal },
      { label: '건너뛰기', onClick: skipBoost },
    ],
  );
  if (play) intro(cards, defs);
  else playing = false;
}

function skipBoost(): void {
  if (busy) return;
  const next = chooseBoost(H.ctx.get(), null);
  if (!next) return;
  H.ctx.set(next);
  H.ctx.save();
  H.ctx.update();
  afterChoice(0);
}

function pickBoost(k: number, o: ReturnType<typeof boostOffer>[number], d: CardDef, card: HTMLElement, all: HTMLElement[]): void {
  if (busy || playing) return;
  const state = H.ctx.get();
  if (o.kind === 'card') {
    if (deckFull(state)) return renderReplace(d, (slot) => chooseBoost(H.ctx.get(), k, slot), () => renderBoost(false));
    const next = chooseBoost(state, k);
    if (next) commit(next, card, all, d, state.deck.slots.length, card.querySelector('.pc-emoji .ico'));
    return;
  }
  const next = chooseBoost(state, k);
  if (next) commit(next, card, all, d, o.slot, card.querySelector('.pc-emoji .ico'), false, true);
}

// ---------- 확률 ----------
const RARITY_BAR: Record<CardDef['rarity'], string> = { common: 'k1', rare: 'b3', legend: 'g2' };
function oddsBody(): HTMLElement[] {
  const odds = deckOfferOdds(H.ctx.get());
  const line = (['common', 'rare', 'legend'] as const).map((r) => `${RARITY_NAME[r]} ${pctText(odds[r])}`).join(' · ');
  const bars = (['common', 'rare', 'legend'] as const).map((r) => {
    const fill = el('i');
    fill.style.width = `${Math.round(odds[r] * 100)}%`;
    fill.style.background = `var(--${RARITY_BAR[r]})`;
    return el('div', { cls: 'od-row' }, el('span', { text: RARITY_NAME[r] }), el('span', { cls: 'dp-track' }, fill), el('b', { text: pctText(odds[r]) }));
  });
  return [
    el('p', { cls: 'od-line', text: line }),
    el('div', { cls: 'od-bars pf' }, ...bars),
    el('p', { cls: 'dim', text: '카드 3장을 따로 뽑아요. 장마다 위 확률로 희귀도를 정해요.' }),
    el('p', { cls: 'dim', text: '이미 낀 카드가 나오면 칸을 쓰지 않고 ★이 올라요.' }),
    el('p', { cls: 'dim od-stack', text: '눈금이 꽉 차면 넘쳐서 스택 +1 · 스택마다 배수 +15% · 상한 없음 · 스택 6개마다 강화 고르기 · 이사하면 0부터 · 카드를 바꾸면 절반을 이어받아요.' }),
  ];
}

/** 고르기 창 안에서 확률 보기(돌아가기로 같은 묶음) */
function renderOdds(): void {
  introStop?.();
  setModal('카드 확률', oddsBody(), [{ label: '돌아가기', quiet: true, onClick: () => renderPick(false) }]);
}

/** 공구함 탭에서 따로 여는 확률 창 */
function openOdds(): void {
  H.ctx.showModal('카드 확률', oddsBody(), [{ label: '닫기', onClick: H.ctx.dismissModal }], { chip: '카드', cls: 'deck-odds', icon: titleIcon() });
}

// ---------- 발동 연출 ----------
const FIRE_GAP_MS = 90;
const WAIT_CHAIN_MAX_MS = 9000;
/** 같은 강타에 발동 카드가 있으면 충전 연출은 그 뒤로 미룬다 */
const CHARGE_AFTER_FIRE_MS = 400;

/** 강타·탭 결과를 받는다: deckFires는 연출, deckOffered는 새 묶음 알림 점멸. 창은 절대 저절로 열지 않는다 */
export function hit(fires: readonly DeckFire[] | undefined, offered: boolean | undefined, charge?: DeckChargeResult): void {
  if (offered && row.isConnected && !fx.isReduced()) fx.edge(row, 'or', [1, 0, 1, 0, 1, 1]);
  if (charge && row.isConnected && (charge.full.length > 0 || charge.after !== charge.before || charge.stacked.length > 0)) {
    if (heldMult === null) heldMult = charge.before;
    charge.stacked.forEach(enqueueStack);
    const lead = fires && fires.length > 0 ? CHARGE_AFTER_FIRE_MS : 0;
    whenChainDone(() =>
      window.setTimeout(() => {
        chargeFx(charge);
        charge.stacked.forEach((e, k) => scheduleStack(e.slot, k));
      }, lead),
    );
  }
  if (!fires || fires.length === 0 || !row.isConnected) return;
  // 탭 수에 곱하는 카드(mult)는 뗀 순간, 보상 카드는 연쇄 재생이 끝나는 순간
  const now = fires.filter((f) => f.mult !== undefined);
  const late = fires.filter((f) => f.mult === undefined);
  if (now.length > 0) play(now);
  if (late.length === 0) return;
  whenChainDone(() => play(late));
}

function whenChainDone(cb: () => void): void {
  const t0 = performance.now();
  const go = (): void => {
    if ((chainPlaying() || chainFinishing()) && performance.now() - t0 < WAIT_CHAIN_MAX_MS) {
      window.setTimeout(go, 50);
      return;
    }
    cb();
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

/** 칸 위에 뜨는 글자(×N, +N초). 움직임 줄이기에서는 제자리 1초 */
function slotMark(slot: HTMLElement, text: string, cls = ''): void {
  const mark = el('b', { cls: `deck-x${cls ? ` ${cls}` : ''}`, text });
  slot.append(mark);
  if (fx.isReduced()) {
    slot.classList.add('lit');
    window.setTimeout(() => slot.classList.remove('lit'), 300);
    window.setTimeout(() => mark.remove(), 1000);
    mark.classList.add('still');
    return;
  }
  fx.pxFrames(slot, [{ translate: '0 -4px' }, { translate: '0 -4px' }, { translate: '0 -2px' }, { translate: '0 0' }], 60);
  fx.edge(slot, 'g3', [1, 0, 1, 0, 1, 1]);
  fx.pxFrames(mark, [{ translate: '-50% 0' }, { translate: '-50% -4px' }, { translate: '-50% -8px' }, { translate: '-50% -8px' }, { translate: '-50% -8px' }, { translate: '-50% -8px' }, { translate: '-50% -8px', visibility: 'hidden' }, { translate: '-50% -8px' }, { translate: '-50% -8px', visibility: 'hidden' }], 100).onfinish = () => mark.remove();
  window.setTimeout(() => mark.remove(), 1200);
  vibrate(8);
}

function fire(f: DeckFire, index: number, order: number): void {
  const slot = row.querySelectorAll<HTMLElement>('.deck-slot')[index];
  if (!slot || slot.dataset.card !== f.id) return;
  slotMark(slot, f.sec !== undefined ? `+${f.sec}초` : `×${f.mult ?? f.times}`, f.sec !== undefined ? 'sec' : '');
  if (order < 3) sfx.milestone();
  if (f.gain !== undefined && f.gain > 0 && !fx.isReduced()) fx.coinShower(slot, H.pts(), 8);
}

// ---------- 충전 연출 ----------
/** 눈금은 막대만 오른다. 카드 완성·10의 거듭제곱 돌파·덱 완성만 연출(강타 1회에 한 번) */
function chargeFx(c: DeckChargeResult): void {
  heldMult = null;
  if (!row.isConnected) return;
  const state = H.ctx.get();
  sync(state);
  const reduced = fx.isReduced();
  const crossed = pow10(c.after) > pow10(c.before);
  if (c.full.length > 0) {
    const views = deckSlotViews(state);
    const order = c.full.map((id) => ({ id, i: slotIndex(id) })).filter((x) => x.i >= 0).sort((a, b) => a.i - b.i);
    order.forEach(({ id, i }, k) =>
      window.setTimeout(() => {
        const slot = row.querySelectorAll<HTMLElement>('.deck-slot')[i];
        const v = views.find((x) => x.id === id);
        if (!slot || !v) return;
        slotMark(slot, `×${fmtMult(v.mult)}`);
        if (k < 3) sfx.milestone();
      }, k * FIRE_GAP_MS),
    );
    fx.edge(H.room(), 'g3', [1, 0, 1, 0, 1, 1]);
  }
  if (crossed) {
    fx.edge(row, 'or', [1, 0, 1, 0, 1, 1]);
    window.setTimeout(() => sfx.breakthrough(), c.full.length > 0 ? 180 : 0);
  }
  if ((c.full.length > 0 || crossed) && !reduced) {
    fx.pxFrames(multEl, [{ translate: '0 -8px' }, { translate: '0 -8px' }, { translate: '0 -4px' }, { translate: '0 0' }], 60);
    multEl.classList.add('pop');
    window.setTimeout(() => multEl.classList.remove('pop'), 500);
  }
  if (c.boostPacks > 0 && !reduced) fx.edge(row, 'or', [1, 0, 1, 0, 1, 1]);
  if (c.allFull) fx.banner(`공구함 완성 ×${fmtMult(c.after)}`, { tone: 'gold', ms: 1700 });
}
