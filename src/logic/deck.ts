/** 공구함 덱(설계 DESIGN-DECK.md): 이 집에서만 쓰는 카드. 칸 수는 이사 횟수, 카드는 진행 문턱마다 무료 3택. 이사하면 초기화(prestige.ts). 2단계는 카드 12장·3칸 */
import { AMP_DEX_MAX, CARDS, CARD_CHARGE_NEED, CARD_MULT_CAP_BASE, CARD_OFFER_SIZE, CARD_STAR_MAX, CHARGE_NEED_SCALE, CHARGE_RULES, DECK_MARKS, DECK_MARK_DIGITS, DECK_SLOTS, DECK_TARGET_SCALE, RARITY_ODDS, RESONANCE_SPEED, cardDef, type CardDef, type CardRarity, type CardTag } from '../data/cards';
import { completedSetCount } from './collection';
import { BOMB_BLAST, CHAIN_BONUS_STEP } from '../data/unpack';
import { SHIELD_CHARGE_PERFECTS } from '../data/gear';
import { houseTarget } from './house';
import type { ChargeGrade } from './charge';
import type { GameState } from './state';

export interface DeckSlot {
  id: string;
  /** 1~3. 같은 카드를 또 고르면 오른다(최대 `CARD_STAR_MAX`) */
  star: number;
  /** 충전 눈금(0~필요 눈금). 강타 정산 때만 찬다. 카드를 바꾸면 0. 저장됨 */
  charge: number;
}

export interface DeckBuff {
  /** C5: 다음 강타 탭 수 x2가 예약됐는가 */
  nextStrike: boolean;
  /** S5: 다음 일반 상자가 폭탄으로 바뀌는가 */
  forceBomb: boolean;
  /** S5: 폭탄 예약까지 센 퍼펙트 강타 수 */
  perfects: number;
  /** F5: 이번 피버 동안 터진 상자 수 */
  boxesInFever: number;
}

export const emptyBuff = (): DeckBuff => ({ nextStrike: false, forceBomb: false, perfects: 0, boxesInFever: 0 });

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
  /** 발동 카드의 진행 값(C5·S5·F5). 이사하면 초기화. 저장됨 */
  buff: DeckBuff;
  /** 이 집의 목표 배수(이사할 때 `DECK_TARGET_SCALE`에서 고정. `houseTarget`이 곱한다). 저장됨 */
  targetScale: number;
}

export const emptyDeck = (): DeckState => ({ slots: [], offers: [], rerolls: 2, mark: 0, seen: [], buff: emptyBuff(), targetScale: 1 });

/** 이사 횟수 moves인 집에 적용할 목표 배수(표 값. 첫 집은 1) */
export function deckTargetScale(moves: number): number {
  return DECK_TARGET_SCALE[Math.min(Math.max(moves, 0), DECK_TARGET_SCALE.length - 1)];
}

/** 카드의 필요 눈금 = 희귀도별 `CARD_CHARGE_NEED` x 집 길이 보정(`CHARGE_NEED_SCALE`). rarity를 안 주면 일반 */
export function cardChargeNeed(moves: number, rarity: CardRarity = 'common'): number {
  return CARD_CHARGE_NEED[rarity] * CHARGE_NEED_SCALE[Math.min(Math.max(moves, 0), CHARGE_NEED_SCALE.length - 1)];
}

/** 낀 카드 하나의 필요 눈금 */
export function slotNeed(slot: Pick<DeckSlot, 'id'>, moves: number): number {
  return cardChargeNeed(moves, cardDef(slot.id)?.rarity);
}

/** 카드 하나의 배수 = 1 + (상한 - 1) x min(1, 눈금/필요). 상한 = ★1 x4, ★ 하나당 +1, 증폭 전설은 bonus(상한 보너스)를 더한다 */
export function cardMult(star: number, charge: number, need: number, bonus = 0): number {
  return 1 + (CARD_MULT_CAP_BASE + star + bonus - 1) * Math.min(1, charge / need);
}

type DeckCtx = Pick<GameState, 'deck' | 'moves' | 'collection'>;

/** 낀 카드별 증폭 상한 보너스. 공구 장인(A1)은 꽉 찬 다른 카드 1장마다 +1, 수집 노트(A2)는 완성한 도감 세트 1개마다 +1(최대 `AMP_DEX_MAX`) */
export function slotCapBonuses(state: DeckCtx): number[] {
  const slots = state.deck.slots;
  const sets = slots.some((s) => cardDef(s.id)?.amp === 'dex') ? Math.min(AMP_DEX_MAX, completedSetCount(state.collection)) : 0;
  return slots.map((sl, i) => {
    const amp = cardDef(sl.id)?.amp;
    if (amp === 'dex') return sets;
    if (amp !== 'tool') return 0;
    return slots.reduce((n, o, j) => n + (j !== i && o.charge >= slotNeed(o, state.moves) ? 1 : 0), 0);
  });
}

/** 같은 태그 카드 장수 -> 그 태그 카드들의 충전 속도 배율(공명). 이중 태그 카드는 두 태그 모두에 센다 */
export function resonanceSpeed(count: number): number {
  return RESONANCE_SPEED[Math.min(Math.max(count, 0), RESONANCE_SPEED.length - 1)];
}

export interface ResonanceView {
  tag: CardTag;
  /** 이 태그 카드 장수 */
  count: number;
  /** 공명 단계(0 = 없음, 장수 2·3·4 = 1·2·3) */
  level: number;
  /** 충전 속도 배율(1 / 1.5 / 2 / 3) */
  speed: number;
}

const ALL_TAGS: readonly CardTag[] = ['precise', 'chain', 'special', 'rush', 'fever'];

/** 태그별 공명 현황(카드가 하나라도 있는 태그만. 장수 많은 순) */
export function deckResonance(state: Pick<GameState, 'deck'>): ResonanceView[] {
  const out: ResonanceView[] = [];
  for (const tag of ALL_TAGS) {
    const count = state.deck.slots.reduce((n, sl) => n + (cardDef(sl.id)?.tags.includes(tag) ? 1 : 0), 0);
    if (count > 0) out.push({ tag, count, level: Math.max(0, Math.min(count, RESONANCE_SPEED.length - 1) - 1), speed: resonanceSpeed(count) });
  }
  return out.sort((a, b) => b.count - a.count);
}

const multCache = new WeakMap<DeckState, { sets: number; m: number }>();

/** 공구함 배율 = 낀 카드 배수의 곱(`tapStable`에 곱한다. 머리 총 배율·`multBreakdown`에는 안 들어간다). `state.deck` 키 WeakMap 캐시(수집 노트가 있으면 완성 세트 수도 키) */
export function deckMult(state: DeckCtx): number {
  const deck = state.deck;
  if (!deck || deck.slots.length === 0) return 1;
  const sets = deck.slots.some((s) => cardDef(s.id)?.amp === 'dex') ? completedSetCount(state.collection) : 0;
  const hit = multCache.get(deck);
  if (hit && hit.sets === sets) return hit.m;
  const bonus = slotCapBonuses(state);
  let m = 1;
  deck.slots.forEach((sl, i) => { m *= cardMult(sl.star, sl.charge, slotNeed(sl, state.moves), bonus[i]); });
  multCache.set(deck, { sets, m });
  return m;
}

export interface DeckSlotView {
  id: string;
  rarity: CardRarity;
  star: number;
  charge: number;
  need: number;
  /** 지금 상한(배수 최댓값. ★·증폭 보너스 반영: 3 + ★ + 보너스) */
  cap: number;
  /** 증폭 전설이 더한 상한 보너스 */
  capBonus: number;
  /** 이 카드의 배수 */
  mult: number;
  /** 눈금이 꽉 찼는가 */
  full: boolean;
  /** 이 카드의 공명 단계(이중 태그면 높은 쪽. 0 = 없음) */
  resonance: number;
  /** 충전 속도 배율(이중 태그면 태그별 배율 중 큰 쪽) */
  speed: number;
}

/** 칸별 보기(낀 순서) */
export function deckSlotViews(state: DeckCtx): DeckSlotView[] {
  const bonus = slotCapBonuses(state);
  const res = deckResonance(state);
  return state.deck.slots.map((sl, i) => {
    const d = cardDef(sl.id);
    const need = slotNeed(sl, state.moves);
    const mine = res.filter((r) => d?.tags.includes(r.tag));
    return {
      id: sl.id, rarity: d?.rarity ?? 'common', star: sl.star, charge: sl.charge, need,
      cap: CARD_MULT_CAP_BASE + sl.star + bonus[i], capBonus: bonus[i],
      mult: cardMult(sl.star, sl.charge, need, bonus[i]), full: sl.charge >= need,
      resonance: Math.max(0, ...mine.map((r) => r.level)), speed: Math.max(1, ...mine.map((r) => r.speed)),
    };
  });
}

/** 덱이 칸까지 다 차고 모든 카드가 꽉 찼는가 */
export function deckAllFull(state: Pick<GameState, 'deck' | 'moves'>): boolean {
  return state.deck.slots.length >= deckSlots(state.moves) && state.deck.slots.every((sl) => sl.charge >= slotNeed(sl, state.moves));
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
  const full = after.deck.slots.filter((sl) => sl.charge >= slotNeed(sl, after.moves) && !(before.deck.slots.find((b) => b.id === sl.id)?.charge! >= slotNeed(sl, before.moves))).map((sl) => sl.id);
  return { full, before: deckMult(before), after: deckMult(after), allFull: full.length > 0 && deckAllFull(after) && !deckAllFull(before) };
}

/**
 * 낀 카드마다 태그별 충전량 gain(tag)을 더한다(필요 눈금에서 멈춤). 이중 태그 카드는 태그별 충전량에 그 태그의 공명 배율을 곱해 합친다.
 * 태그가 없는 증폭 전설은 어떤 태그 조건이든 일어나면 차고(태그별 충전량 중 최댓값), 공명은 받지 않는다. 바뀐 게 없으면 같은 state
 */
export function addCharge(state: GameState, gain: (tag: CardTag) => number): GameState {
  const deck = state.deck;
  if (deck.slots.length === 0) return state;
  const speed = new Map(deckResonance(state).map((r) => [r.tag, r.speed]));
  const base = ALL_TAGS.map((t) => gain(t));
  const best = Math.max(...base);
  if (best <= 0) return state;
  let changed = false;
  const slots = deck.slots.map((sl) => {
    const d = cardDef(sl.id);
    const need = slotNeed(sl, state.moves);
    const tags = d?.tags ?? [];
    const g = tags.length === 0 ? best : tags.reduce((n, t) => n + gain(t) * (speed.get(t) ?? 1), 0);
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
  const specialGain = Math.min(CHARGE_RULES.specialMax, ev.specials * CHARGE_RULES.special);
  return addCharge(state, (tag) => (tag === 'chain' ? chainGain : tag === 'special' ? specialGain : tag === 'fever' ? feverGain : 0));
}

/** 퍼펙트 강타 정산 충전(정밀). streak은 이번 강타를 포함한 연속 퍼펙트 수 */
export function chargeOnPerfect(state: GameState, streak: number): GameState {
  const g = streak > 0 && streak % 10 === 0 ? CHARGE_RULES.preciseTen : CHARGE_RULES.precise;
  return addCharge(state, (tag) => (tag === 'precise' ? g : 0));
}

/** 칸 수. 4단계는 이사 횟수와 상관없이 4칸(5·6칸은 7단계) */
export function deckSlots(moves: number): number {
  void moves;
  return DECK_SLOTS;
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
  /** 안전모 실드 칸 수에 더하는 값(`gearEffects.shieldMax`) */
  shieldAdd: number;
  /** 실드가 한 칸 차는 퍼펙트 수(기본 `SHIELD_CHARGE_PERFECTS`. 화면이 `resolveStreak`에 넘긴다) */
  shieldChargePerfects: number;
  /** 연쇄 보너스 계수(`chainBonus`의 step. 기본 `CHAIN_BONUS_STEP`) */
  chainStep: number;
  /** 폭탄이 함께 터뜨리는 수(기본 `BOMB_BLAST`) */
  bombBlast: number;
  /** 피버 배율에 더하는 값(`feverMultOf`) */
  feverMultAdd: number;
}

const NO_EFFECTS: DeckEffects = { streakBonus: 0, chainCapAdd: 0, perfectHalfAdd: 0, weakTapsMult: 1, weakDelayMult: 1, goldMultAdd: 0, specialRateMult: 1, feverChargeAdd: 0, feverSecAdd: 0, shieldAdd: 0, shieldChargePerfects: SHIELD_CHARGE_PERFECTS, chainStep: CHAIN_BONUS_STEP, bombBlast: BOMB_BLAST, feverMultAdd: 0 };
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
      fx.shieldAdd += d.shieldAdd ?? 0;
      fx.shieldChargePerfects = Math.min(fx.shieldChargePerfects, d.shieldChargePerfects ?? SHIELD_CHARGE_PERFECTS);
      fx.chainStep = Math.max(fx.chainStep, d.chainStep ?? CHAIN_BONUS_STEP);
      fx.bombBlast = Math.max(fx.bombBlast, d.bombBlast ?? BOMB_BLAST);
      fx.feverMultAdd += d.feverMultAdd ?? 0;
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

/** 강타 탭 수에 곱하는 카드 배율: P3(연속 퍼펙트가 10의 배수인 퍼펙트 강타)와 C5가 예약해 둔 다음 강타 배율. streak은 이번 강타를 포함한 연속 퍼펙트 수 */
export function deckStrikeMult(state: { deck?: DeckState }, grade: ChargeGrade, streak: number): number {
  const deck = state.deck;
  if (!deck) return 1;
  let m = 1;
  for (const s of deck.slots) {
    const d = cardDef(s.id);
    const e = d?.streakEvery;
    if (e && grade === 'perfect' && streak > 0 && streak % e.every === 0) m *= e.mult;
    if (d?.bigChainNext && deck.buff.nextStrike) m *= d.bigChainNext.mult;
  }
  return m;
}

/** 이번 강타에 곱한 카드 배율이 있으면 발동 기록으로 바꾼다(`releaseCharge`가 heavyHit 결과에 붙인다) */
export function deckMultFires(state: { deck?: DeckState }, grade: ChargeGrade, streak: number): DeckFire[] {
  const deck = state.deck;
  if (!deck) return [];
  const out: DeckFire[] = [];
  for (const s of deck.slots) {
    const d = cardDef(s.id);
    const e = d?.streakEvery;
    if (e && grade === 'perfect' && streak > 0 && streak % e.every === 0) out.push({ id: s.id, times: 1, mult: e.mult });
    if (d?.bigChainNext && deck.buff.nextStrike) out.push({ id: s.id, times: 1, mult: d.bigChainNext.mult });
  }
  return out;
}

/** 퍼펙트 강타 보상(P5): 탭 1회 x (연속 수 x perStreak). 발동 기록의 `taps`를 `releaseCharge`가 P로 바꿔 더한다 */
export function deckPerfectFires(state: { deck?: DeckState }, grade: ChargeGrade, streak: number): DeckFire[] {
  const deck = state.deck;
  if (!deck || grade !== 'perfect' || streak <= 0) return [];
  const out: DeckFire[] = [];
  for (const s of deck.slots) {
    const r = cardDef(s.id)?.perfectReward;
    if (r) out.push({ id: s.id, times: 1, taps: streak * r.perStreak });
  }
  return out;
}

/**
 * 강타 직후 발동 카드의 진행 값 갱신(`releaseCharge`가 부른다): C5는 1,000연쇄 이상이면 다음 강타 배율을 예약하고 아니면 지운다(이번 강타가 썼다),
 * S5는 퍼펙트 강타를 세어 5번째에 폭탄을 예약한다. 바뀐 게 없으면 같은 state
 */
export function deckBuffAfterStrike(state: GameState, grade: ChargeGrade, chain: number): GameState {
  const deck = state.deck;
  if (deck.slots.length === 0) return state;
  const b = { ...deck.buff };
  for (const s of deck.slots) {
    const d = cardDef(s.id);
    if (d?.bigChainNext) b.nextStrike = chain >= d.bigChainNext.min;
    if (d?.bombEvery && grade === 'perfect') {
      b.perfects++;
      if (b.perfects >= d.bombEvery) { b.perfects = 0; b.forceBomb = true; }
    }
  }
  if (b.nextStrike === deck.buff.nextStrike && b.forceBomb === deck.buff.forceBomb && b.perfects === deck.buff.perfects) return state;
  return { ...state, deck: { ...deck, buff: b } };
}

/** F5: 피버 중 터진 상자 수를 센다(`settleDeck`이 부른다). F5가 없거나 피버가 아니면 같은 state */
export function deckCountFeverBoxes(state: GameState, boxes: number): GameState {
  if (boxes <= 0 || state.fever.activeSec <= 0 || !state.deck.slots.some((s) => cardDef(s.id)?.feverEndTaps)) return state;
  return { ...state, deck: { ...state.deck, buff: { ...state.deck.buff, boxesInFever: state.deck.buff.boxesInFever + boxes } } };
}

/** F5: 피버가 끝나는 순간의 보상 탭 수(피버 동안 터진 상자 수 x taps). `tick`이 피버 종료를 감지해 부르고, 탭 1회 수익을 곱해 P로 바꾼다. 없으면 null */
export function deckFeverEnd(state: GameState): { state: GameState; taps: number; fires: DeckFire[] } | null {
  const deck = state.deck;
  if (deck.buff.boxesInFever <= 0) return null;
  const fires: DeckFire[] = [];
  let taps = 0;
  for (const s of deck.slots) {
    const t = cardDef(s.id)?.feverEndTaps;
    if (!t) continue;
    fires.push({ id: s.id, times: deck.buff.boxesInFever, taps: deck.buff.boxesInFever * t });
    taps += deck.buff.boxesInFever * t;
  }
  return { state: { ...state, deck: { ...deck, buff: { ...deck.buff, boxesInFever: 0 } } }, taps, fires };
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

/** 진행 문턱 k(1~DECK_MARKS-1)의 누적 P: 이 집 목표(`houseTarget`) x 10^(-d), d는 `DECK_MARK_DIGITS[이사 횟수][k]` */
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

/** 이 집에서 앞으로 받을 고르기 횟수(아직 안 지난 문턱 수 + 받아 놓고 안 고른 묶음 수). 첫 집은 0 */
export function deckPicksLeft(state: Pick<GameState, 'moves' | 'deck'>): number {
  if (state.moves === 0) return 0;
  return DECK_MARKS - state.deck.mark + state.deck.offers.length;
}

export interface NextMark {
  /** 다음 문턱 번호(1~DECK_MARKS-1). 지금 mark와 같다 */
  k: number;
  /** 다음 문턱 누적 P(이 집 `earned` 기준) */
  at: number;
  /** 앞 문턱(없으면 한 자릿수 아래)에서 다음 문턱까지 자릿수(로그) 기준 진행률 0~1 */
  progress: number;
}

/** 다음 문턱과 진행률. 첫 집이거나 문턱을 다 지났으면 null */
export function deckNextMark(state: Pick<GameState, 'moves' | 'deck' | 'earned'>): NextMark | null {
  const k = state.deck.mark;
  if (state.moves === 0 || k < 1 || k >= DECK_MARKS) return null;
  const at = markThreshold(state, k);
  const prev = k > 1 ? markThreshold(state, k - 1) : at / 10;
  const progress = Math.min(1, Math.max(0, Math.log10(Math.max(state.earned, prev) / prev) / Math.log10(at / prev)));
  return { k, at, progress };
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

/** 지금 뽑을 수 있는 카드(★3 카드는 뺀다) */
function offerPool(slots: readonly DeckSlot[]): CardDef[] {
  return CARDS.filter((c) => (slots.find((s) => s.id === c.id)?.star ?? 0) < CARD_STAR_MAX);
}

/** 희귀도별 실제 확률. 뽑을 카드가 하나도 없는 희귀도는 빠지고 나머지가 비율대로 늘어난다(합 1). 화면은 이 값을 그대로 보여 준다 */
export function deckOfferOdds(state: Pick<GameState, 'deck'>): Record<CardRarity, number> {
  const pool = offerPool(state.deck.slots);
  const w = (r: CardRarity) => (pool.some((c) => c.rarity === r) ? RARITY_ODDS[r] : 0);
  const sum = w('common') + w('rare') + w('legend');
  return { common: w('common') / sum, rare: w('rare') / sum, legend: w('legend') / sum };
}

/** 고르기 후보 카드가 이미 낀 카드라서 "★ 올리기"인가(칸을 안 쓴다) */
export function isStarUp(state: Pick<GameState, 'deck'>, cardId: string): boolean {
  return state.deck.slots.some((s) => s.id === cardId && s.star < CARD_STAR_MAX);
}

/**
 * 3택 묶음: 서로 다른 3장. 세 칸 모두 희귀도를 `RARITY_ODDS`(일반 60·레어 32·전설 8)로 따로 굴리고, 칸마다 역할이 다르다.
 * 첫 칸은 가진 태그 카드(낀 카드면 ★ 올리기 후보), 둘째 칸은 아직 없는 태그 카드(태그가 없는 증폭 전설 포함), 셋째 칸은 아무 카드다.
 * 조건에 맞는 카드가 없으면 같은 희귀도의 아무 카드, 그 희귀도에 카드가 없으면 다른 희귀도에서 채운다. ★3 카드는 나오지 않는다.
 * 난수는 seed로만 만들어(호출자의 rng를 안 쓴다) 시뮬 난수열을 건드리지 않는다
 */
export function rollCardOffer(slots: readonly DeckSlot[], seed: number): string[] {
  const r = hashRng(seed);
  const pool = offerPool(slots);
  const heldTags = new Set(slots.flatMap((s) => cardDef(s.id)?.tags ?? []));
  const out: CardDef[] = [];
  const pick = (cands: CardDef[]) => cands[Math.floor(r() * cands.length)];
  for (let i = 0; i < CARD_OFFER_SIZE; i++) {
    const left = pool.filter((c) => !out.includes(c));
    if (left.length === 0) break;
    const odds = RARITY_ODDS;
    const rar = (['common', 'rare', 'legend'] as const).filter((x) => left.some((c) => c.rarity === x));
    let roll = r() * rar.reduce((n, x) => n + odds[x], 0);
    let rarity = rar[rar.length - 1];
    for (const x of rar) { if (roll < odds[x]) { rarity = x; break; } roll -= odds[x]; }
    const inR = left.filter((c) => c.rarity === rarity);
    const role = i === 0 ? inR.filter((c) => c.tags.some((t) => heldTags.has(t))) : i === 1 ? inR.filter((c) => !c.tags.some((t) => heldTags.has(t))) : inR;
    out.push(pick(role.length > 0 ? role : inR));
  }
  return out.map((c) => c.id);
}

/** 묶음 추첨용 시드: 이사 횟수·문턱·누적 탭 수(진행하면 바뀌어 매번 같지는 않다). 호출자의 rng를 쓰지 않아 시뮬 난수열을 건드리지 않는다 */
export function offerSeed(state: Pick<GameState, 'moves' | 'stats'>, mark: number): number {
  return state.moves * 7919 + mark * 104729 + state.stats.totalTaps * 31 + 17;
}

/** 이사 직후의 덱: 빈 칸·첫 묶음·문턱 1(다시 받기 2, 카드 도감은 이어받음) */
export function deckAfterMove(prev: Pick<GameState, 'moves' | 'stats' | 'deck'>): DeckState {
  const moves = prev.moves + 1;
  return { slots: [], offers: [rollCardOffer([], offerSeed({ moves, stats: prev.stats }, 1))], rerolls: 2, mark: 1, seen: prev.deck.seen, buff: emptyBuff(), targetScale: deckTargetScale(moves) };
}

/**
 * 진행 문턱 판정. 이 집에서 번 P(`earned`)가 넘은 문턱마다 3택 묶음을 1개씩 지급한다(한 번에 여러 개를 넘으면 그만큼 쌓인다. 고르기 횟수 = 문턱 수).
 * 첫 집(moves 0)과 문턱을 다 넘긴 뒤, 새 문턱이 없을 때는 같은 객체를 돌려준다(탭마다 불리므로 가볍게). 화면은 `deck.mark`나 `deck.offers.length`가 늘었는지로 새 묶음을 안다.
 */
export function checkMarks(state: GameState): GameState {
  if (state.moves === 0) return state;
  const deck = state.deck;
  if (deck.mark >= DECK_MARKS || state.earned < markThreshold(state, deck.mark)) return state;
  let mark = deck.mark;
  const offers = [...deck.offers];
  while (mark < DECK_MARKS && state.earned >= markThreshold(state, mark)) {
    mark++;
    offers.push(rollCardOffer(deck.slots, offerSeed(state, mark)));
  }
  return { ...state, deck: { ...deck, mark, offers } };
}

/** 칸이 다 차 있어 고른 카드를 넣으려면 바꿀 칸을 지정해야 하는가 */
export function deckFull(state: GameState): boolean {
  return state.deck.slots.length >= deckSlots(state.moves);
}

/**
 * offerIndex번째 대기 묶음에서 카드를 고른다.
 * - cardId가 null이면 건너뛰기(묶음만 버린다).
 * - 빈 칸이 있으면 뒤에 끼운다. 칸이 다 찼으면 replaceSlot(바꿀 칸 번호)을 줘야 하고, 원래 카드는 버려진다.
 * - 이미 낀 카드를 고르면 칸을 쓰지 않고 ★이 올라 상한 +1(최대 ★3, 눈금은 그대로. replaceSlot은 무시). ★3 카드는 null.
 * - 묶음에 없는 카드, 잘못된 칸 번호는 null.
 */
export function chooseCard(state: GameState, offerIndex: number, cardId: string | null, replaceSlot?: number): GameState | null {
  const offer = state.deck.offers[offerIndex];
  if (!offer) return null;
  const offers = state.deck.offers.filter((_, i) => i !== offerIndex);
  if (cardId === null) return { ...state, deck: { ...state.deck, offers } };
  if (!offer.includes(cardId) || !cardDef(cardId)) return null;
  const heldAt = state.deck.slots.findIndex((s) => s.id === cardId);
  if (heldAt >= 0) {
    if (state.deck.slots[heldAt].star >= CARD_STAR_MAX) return null;
    return { ...state, deck: { ...state.deck, slots: state.deck.slots.map((s, i) => (i === heldAt ? { ...s, star: s.star + 1 } : s)), offers } };
  }
  const card: DeckSlot = { id: cardId, star: 1, charge: 0 };
  let slots: DeckSlot[];
  if (!deckFull(state)) slots = [...state.deck.slots, card];
  else {
    if (replaceSlot === undefined || !Number.isInteger(replaceSlot) || replaceSlot < 0 || replaceSlot >= state.deck.slots.length) return null;
    slots = state.deck.slots.map((s, i) => (i === replaceSlot ? card : s));
  }
  return { ...state, deck: { ...state.deck, slots, offers } };
}
