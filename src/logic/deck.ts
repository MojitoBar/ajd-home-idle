/** 공구함 덱(설계 DESIGN-DECK.md): 이 집에서만 쓰는 카드. 칸 수는 이사 횟수, 카드는 진행 문턱마다 무료 3택. 이사하면 초기화(prestige.ts). 2단계는 카드 12장·3칸 */
import { CARDS, CARD_CHARGE_NEED, CARD_MULT_CAP_BASE, CARD_OFFER_SIZE, CHARGE_NEED_SCALE, CHARGE_RULES, DECK_MARKS, DECK_MARK_DIGITS, DECK_TARGET_SCALE, cardDef, type CardTag } from '../data/cards';
import { houseTarget } from './house';
import type { ChargeGrade } from './charge';
import type { GameState } from './state';

export interface DeckSlot {
  id: string;
  /** 1~3. 1단계는 항상 1(★ 강화는 3단계) */
  star: number;
  /** 충전 눈금(0~필요 눈금). 강타 정산 때만 찬다. 카드를 바꾸면 0. 저장됨 */
  charge: number;
}

export interface DeckState {
  /** 낀 카드(최대 `deckSlots(moves)`장). 저장됨 */
  slots: DeckSlot[];
  /** 대기 중인 3택 묶음(오래된 순). 저장됨 */
  offers: string[][];
  /** 남은 다시 받기(3단계부터 쓴다). 저장됨 */
  rerolls: number;
  /** 이 집에서 지난 문턱 수(0~DECK_MARKS). 이사 직후 1곳 + 진행 문턱 5곳. 저장됨 */
  mark: number;
  /** 카드 도감(본 카드, 영구). 5단계에서 채운다. 저장됨 */
  seen: string[];
  /** 이 집의 목표 배수(이사할 때 `DECK_TARGET_SCALE`에서 고정. `houseTarget`이 곱한다). 저장됨 */
  targetScale: number;
}

export const emptyDeck = (): DeckState => ({ slots: [], offers: [], rerolls: 2, mark: 0, seen: [], targetScale: 1 });

/** 이사 횟수 moves인 집에 적용할 목표 배수(표 값. 첫 집은 1) */
export function deckTargetScale(moves: number): number {
  return DECK_TARGET_SCALE[Math.min(Math.max(moves, 0), DECK_TARGET_SCALE.length - 1)];
}

/** 카드의 필요 눈금. 지금 카드는 전부 일반으로 본다(희귀도별 값은 `CARD_CHARGE_NEED`) */
export function cardChargeNeed(moves: number): number {
  return CARD_CHARGE_NEED.common * CHARGE_NEED_SCALE[Math.min(Math.max(moves, 0), CHARGE_NEED_SCALE.length - 1)];
}

/** 카드 하나의 배수 = 1 + (상한 - 1) x min(1, 눈금/필요). 상한은 ★1 x4, ★ 하나당 +1 */
export function cardMult(star: number, charge: number, need: number): number {
  return 1 + (CARD_MULT_CAP_BASE + star - 1) * Math.min(1, charge / need);
}

const multCache = new WeakMap<DeckState, number>();

/** 공구함 배율 = 낀 카드 배수의 곱(`tapStable`에 곱한다. 머리 총 배율·`multBreakdown`에는 안 들어간다). `state.deck` 키 WeakMap 캐시 */
export function deckMult(state: Pick<GameState, 'deck' | 'moves'>): number {
  const deck = state.deck;
  if (!deck || deck.slots.length === 0) return 1;
  let m = multCache.get(deck);
  if (m === undefined) {
    const need = cardChargeNeed(state.moves);
    m = 1;
    for (const sl of deck.slots) m *= cardMult(sl.star, sl.charge, need);
    multCache.set(deck, m);
  }
  return m;
}

export interface DeckSlotView {
  id: string;
  star: number;
  charge: number;
  need: number;
  /** 이 카드의 배수 */
  mult: number;
  /** 눈금이 꽉 찼는가 */
  full: boolean;
}

/** 칸별 보기(낀 순서) */
export function deckSlotViews(state: Pick<GameState, 'deck' | 'moves'>): DeckSlotView[] {
  const need = cardChargeNeed(state.moves);
  return state.deck.slots.map((sl) => ({ id: sl.id, star: sl.star, charge: sl.charge, need, mult: cardMult(sl.star, sl.charge, need), full: sl.charge >= need }));
}

/** 덱이 칸까지 다 차고 모든 카드가 꽉 찼는가 */
export function deckAllFull(state: Pick<GameState, 'deck' | 'moves'>): boolean {
  const need = cardChargeNeed(state.moves);
  return state.deck.slots.length >= deckSlots(state.moves) && state.deck.slots.every((sl) => sl.charge >= need);
}

/** 강타 정산의 충전 결과(`HeavyResult.deckCharge`) */
export interface DeckChargeResult {
  /** 이번 강타로 꽉 찬 카드 id */
  full: string[];
  /** 강타 전·후 공구함 배율 */
  before: number;
  after: number;
  /** 덱 전체가 이번에 처음 꽉 찼는가 */
  allFull: boolean;
}

/** 정산 전·후 state를 비교해 충전 결과를 만든다 */
export function deckChargeResult(before: GameState, after: GameState): DeckChargeResult {
  const need = cardChargeNeed(before.moves);
  const full = after.deck.slots.filter((sl) => sl.charge >= need && !(before.deck.slots.find((b) => b.id === sl.id)?.charge! >= need)).map((sl) => sl.id);
  return { full, before: deckMult(before), after: deckMult(after), allFull: full.length > 0 && deckAllFull(after) && !deckAllFull(before) };
}

/** 낀 카드마다 gain(그 카드의 태그)만큼 눈금을 올린다(필요 눈금에서 멈춤). 바뀐 게 없으면 같은 state */
export function addCharge(state: GameState, gain: (tags: readonly CardTag[]) => number): GameState {
  const deck = state.deck;
  if (deck.slots.length === 0) return state;
  const need = cardChargeNeed(state.moves);
  let changed = false;
  const slots = deck.slots.map((sl) => {
    const g = gain(cardDef(sl.id)?.tags ?? []);
    if (g <= 0 || sl.charge >= need) return sl;
    changed = true;
    return { ...sl, charge: Math.min(need, sl.charge + g) };
  });
  return changed ? { ...state, deck: { ...deck, slots } } : state;
}

/** 강타(강타·급소) 정산 때 연쇄·특별·피버 조건 충전. feverBefore는 강타 직전 피버 중이었는가, feverAfter는 직후 */
export function chargeOnStrike(state: GameState, ev: { chain: number; specials: number; feverBefore: boolean; feverAfter: boolean }): GameState {
  const chainGain = Math.min(CHARGE_RULES.chainMax, Math.floor(ev.chain / CHARGE_RULES.chainPer));
  const feverGain = (ev.feverBefore ? CHARGE_RULES.feverStrike : 0) + (!ev.feverBefore && ev.feverAfter ? CHARGE_RULES.feverOn : 0);
  const specialGain = ev.specials * CHARGE_RULES.special;
  return addCharge(state, (tags) => (tags.includes('chain') ? chainGain : 0) + (tags.includes('special') ? specialGain : 0) + (tags.includes('fever') ? feverGain : 0));
}

/** 퍼펙트 강타 정산 충전(정밀). streak은 이번 강타를 포함한 연속 퍼펙트 수 */
export function chargeOnPerfect(state: GameState, streak: number): GameState {
  const g = streak > 0 && streak % 10 === 0 ? CHARGE_RULES.preciseTen : CHARGE_RULES.precise;
  return addCharge(state, (tags) => (tags.includes('precise') ? g : 0));
}

/** 칸 수. 1단계는 이사 횟수와 상관없이 3칸(뒤 단계에서 4·5·6칸) */
export function deckSlots(moves: number): number {
  void moves;
  return 3;
}

export interface DeckEffects {
  /** 연속 퍼펙트 배수 계수에 더하는 값(`perkEffects.streakBonus`가 합친다) */
  streakBonus: number;
  /** 연쇄 보너스 상한에 더하는 값(`gearEffects.chainCap`이 합친다) */
  chainCapAdd: number;
  /** 퍼펙트 구간 반폭에 더하는 값(`gearEffects.perfectHalf`가 합치고 고정 상한으로 자른다) */
  perfectHalfAdd: number;
  /** 급소 탭 수 배율(`gearEffects.weakTaps`) */
  weakTapsMult: number;
  /** 급소 간격 배율(`gearEffects.weakDelayMult`) */
  weakDelayMult: number;
  /** 황금 배율에 더하는 값(`hitBox`) */
  goldMultAdd: number;
  /** 특별 상자 확률 배율(`perkEffects.specialRateMult`) */
  specialRateMult: number;
  /** 피버 충전 배율에 더하는 값(`perkEffects.feverCharge`) */
  feverChargeAdd: number;
  /** 피버 시간에 더하는 초(`perkEffects.feverSec`) */
  feverSecAdd: number;
}

const NO_EFFECTS: DeckEffects = { streakBonus: 0, chainCapAdd: 0, perfectHalfAdd: 0, weakTapsMult: 1, weakDelayMult: 1, goldMultAdd: 0, specialRateMult: 1, feverChargeAdd: 0, feverSecAdd: 0 };
const effectCache = new WeakMap<DeckState, DeckEffects>();

/** 상시 효과 합. 터지는 상자마다 불리므로 `state.deck` 객체를 키로 캐시한다 */
export function deckEffects(state: { deck?: DeckState }): DeckEffects {
  const deck = state.deck;
  if (!deck || deck.slots.length === 0) return NO_EFFECTS;
  let fx = effectCache.get(deck);
  if (!fx) {
    fx = { ...NO_EFFECTS };
    for (const s of deck.slots) {
      const d = cardDef(s.id);
      if (!d) continue;
      fx.streakBonus += d.streakBonus ?? 0;
      fx.chainCapAdd += d.chainCapAdd ?? 0;
      fx.perfectHalfAdd += d.perfectHalfAdd ?? 0;
      fx.weakTapsMult *= d.weakTapsMult ?? 1;
      fx.weakDelayMult *= d.weakDelayMult ?? 1;
      fx.goldMultAdd += d.goldMultAdd ?? 0;
      fx.specialRateMult *= d.specialRateMult ?? 1;
      fx.feverChargeAdd += d.feverChargeAdd ?? 0;
      fx.feverSecAdd += d.feverSecAdd ?? 0;
    }
    effectCache.set(deck, fx);
  }
  return fx;
}

/** 강타 1회에 카드가 터진 기록(연출용). 같은 카드는 강타 1회에 한 줄이다 */
export interface DeckFire {
  id: string;
  /** 발동 횟수(연출은 "x times"로 한 번만) */
  times: number;
  /** 탭 수에 곱한 배율(곱하는 카드) */
  mult?: number;
  /** 보상으로 받은 탭 수(탭 1회 수익 x taps). 보상 카드 */
  taps?: number;
  /** 보상 P(`taps`를 P로 바꾼 값. heavyHit이 채운다) */
  gain?: number;
  /** 피버에 더한 초(F3). 뗀 순간 터진다 */
  sec?: number;
}

/** 강타 탭 수에 곱하는 카드 배율(P3). 퍼펙트가 아니면 1. streak은 이번 강타를 포함한 연속 퍼펙트 수 */
export function deckStrikeMult(state: { deck?: DeckState }, grade: ChargeGrade, streak: number): number {
  const deck = state.deck;
  if (!deck || grade !== 'perfect' || streak <= 0) return 1;
  let m = 1;
  for (const s of deck.slots) {
    const e = cardDef(s.id)?.streakEvery;
    if (e && streak % e.every === 0) m *= e.mult;
  }
  return m;
}

/** 이번 강타에 곱한 카드 배율이 있으면 발동 기록으로 바꾼다(`releaseCharge`가 heavyHit 결과에 붙인다) */
export function deckMultFires(state: { deck?: DeckState }, grade: ChargeGrade, streak: number): DeckFire[] {
  const deck = state.deck;
  if (!deck || grade !== 'perfect' || streak <= 0) return [];
  const out: DeckFire[] = [];
  for (const s of deck.slots) {
    const e = cardDef(s.id)?.streakEvery;
    if (e && streak % e.every === 0) out.push({ id: s.id, times: 1, mult: e.mult });
  }
  return out;
}

export interface StrikeEvent {
  /** 이번 강타로 터진 상자 수 */
  chain: number;
  /** 이번 강타로 터진 황금 상자 수(생략하면 0) */
  gold?: number;
}

/** 퍼펙트 강타가 피버 중에 쳐졌으면 피버에 더할 초와 발동 기록(F3). `releaseCharge`가 부른다 */
export function deckFeverFires(state: { deck?: DeckState; fever: { activeSec: number } }, grade: ChargeGrade): { sec: number; fires: DeckFire[] } {
  const deck = state.deck;
  if (!deck || grade !== 'perfect' || state.fever.activeSec <= 0) return { sec: 0, fires: [] };
  let sec = 0;
  const fires: DeckFire[] = [];
  for (const s of deck.slots) {
    const add = cardDef(s.id)?.feverPerfectSec;
    if (add) {
      sec += add;
      fires.push({ id: s.id, times: 1, sec: add });
    }
  }
  return { sec, fires };
}

/** 강타 1회 정산(strike 사건). 카드 하나당 한 줄로 묶어 돌려준다. 칸 수만큼만 도는 산술이라 3,000연쇄도 한 번이다 */
export function deckEvent(state: { deck?: DeckState }, ev: StrikeEvent): DeckFire[] {
  const deck = state.deck;
  if (!deck || deck.slots.length === 0 || ev.chain <= 0) return [];
  const out: DeckFire[] = [];
  const gold = ev.gold ?? 0;
  for (const s of deck.slots) {
    const d = cardDef(s.id);
    if (!d) continue;
    if (d.chainEvery) {
      const times = Math.floor(ev.chain / d.chainEvery.per);
      if (times > 0) out.push({ id: s.id, times, taps: times * d.chainEvery.taps });
    }
    if (d.goldEvery && gold >= d.goldEvery.min) out.push({ id: s.id, times: gold, taps: gold * d.goldEvery.taps });
  }
  return out;
}

/** 진행 문턱 k(1~5)의 누적 P: 이 집 목표(`houseTarget`) x 10^(-d), d는 `DECK_MARK_DIGITS[이사 횟수][k]` */
export function markThreshold(state: Pick<GameState, 'moves' | 'deck'>, k: number): number {
  const row = DECK_MARK_DIGITS[Math.min(Math.max(state.moves, 1), DECK_MARK_DIGITS.length) - 1];
  return houseTarget(state) * 10 ** -row[k - 1];
}

/** 이 집에서 지금까지 지난 문턱 수(이사 직후 1곳 포함, 1~DECK_MARKS) */
export function marksPassed(state: Pick<GameState, 'moves' | 'deck'>, earned: number): number {
  let m = 1;
  while (m < DECK_MARKS && earned >= markThreshold(state, m)) m++;
  return m;
}

function hashRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 3택 묶음: 서로 다른 3장. 안 낀 카드가 3장 이상이면 낀 카드는 나오지 않고, 모자랄 때만 낀 카드로 채운다(희귀도 추첨은 3단계) */
export function rollCardOffer(slots: readonly DeckSlot[], seed: number): string[] {
  const r = hashRng(seed);
  const shuffle = (a: string[]) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const held = new Set(slots.map((s) => s.id));
  const fresh = shuffle(CARDS.filter((c) => !held.has(c.id)).map((c) => c.id));
  const rest = shuffle(CARDS.filter((c) => held.has(c.id)).map((c) => c.id));
  return [...fresh, ...rest].slice(0, CARD_OFFER_SIZE);
}

/** 묶음 추첨용 시드: 이사 횟수·문턱·누적 탭 수(진행하면 바뀌어 매번 같지는 않다). 호출자의 rng를 쓰지 않아 시뮬 난수열을 건드리지 않는다 */
export function offerSeed(state: Pick<GameState, 'moves' | 'stats'>, mark: number): number {
  return state.moves * 7919 + mark * 104729 + state.stats.totalTaps * 31 + 17;
}

/** 이사 직후의 덱: 빈 칸·첫 묶음·문턱 1(다시 받기 2, 카드 도감은 이어받음) */
export function deckAfterMove(prev: Pick<GameState, 'moves' | 'stats' | 'deck'>): DeckState {
  const moves = prev.moves + 1;
  return { slots: [], offers: [rollCardOffer([], offerSeed({ moves, stats: prev.stats }, 1))], rerolls: 2, mark: 1, seen: prev.deck.seen, targetScale: deckTargetScale(moves) };
}

/**
 * 진행 문턱 판정. 이 집에서 번 P(`earned`)가 다음 문턱을 넘으면 3택 묶음을 1개 지급한다. 한 번에 문턱 여러 개를 넘어도 묶음은 1개.
 * 첫 집(moves 0)과 문턱을 다 넘긴 뒤에는 같은 객체를 돌려준다(탭마다 불리므로 가볍게). 화면은 `deck.mark`나 `deck.offers.length`가 늘었는지로 새 묶음을 안다.
 */
export function checkMarks(state: GameState): GameState {
  if (state.moves === 0) return state;
  const deck = state.deck;
  if (deck.mark >= DECK_MARKS || state.earned < markThreshold(state, deck.mark)) return state;
  const mark = marksPassed(state, state.earned);
  return { ...state, deck: { ...deck, mark, offers: [...deck.offers, rollCardOffer(deck.slots, offerSeed(state, mark))] } };
}

/** 칸이 다 차 있어 고른 카드를 넣으려면 바꿀 칸을 지정해야 하는가 */
export function deckFull(state: GameState): boolean {
  return state.deck.slots.length >= deckSlots(state.moves);
}

/**
 * offerIndex번째 대기 묶음에서 카드를 고른다.
 * - cardId가 null이면 건너뛰기(묶음만 버린다).
 * - 빈 칸이 있으면 뒤에 끼운다. 칸이 다 찼으면 replaceSlot(바꿀 칸 번호)을 줘야 하고, 원래 카드는 버려진다.
 * - 묶음에 없는 카드, 이미 낀 카드(★ 강화는 3단계), 잘못된 칸 번호는 null.
 */
export function chooseCard(state: GameState, offerIndex: number, cardId: string | null, replaceSlot?: number): GameState | null {
  const offer = state.deck.offers[offerIndex];
  if (!offer) return null;
  const offers = state.deck.offers.filter((_, i) => i !== offerIndex);
  if (cardId === null) return { ...state, deck: { ...state.deck, offers } };
  if (!offer.includes(cardId) || !cardDef(cardId) || state.deck.slots.some((s) => s.id === cardId)) return null;
  const card: DeckSlot = { id: cardId, star: 1, charge: 0 };
  let slots: DeckSlot[];
  if (!deckFull(state)) slots = [...state.deck.slots, card];
  else {
    if (replaceSlot === undefined || !Number.isInteger(replaceSlot) || replaceSlot < 0 || replaceSlot >= state.deck.slots.length) return null;
    slots = state.deck.slots.map((s, i) => (i === replaceSlot ? card : s));
  }
  return { ...state, deck: { ...state.deck, slots, offers } };
}
