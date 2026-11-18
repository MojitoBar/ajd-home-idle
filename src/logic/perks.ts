import { MOVE_PERK_BOXES_BASE, MOVE_PERK_BOXES_MAX, PERKS, PERK_OFFER_SIZE, type PerkDef } from '../data/perks';
import { setEffects } from './collection';
import { CRIT_MULT, CRIT_CHANCE, FEVER_SEC } from './fever';
import type { GameState } from './state';

export function perkDef(id: string): PerkDef | undefined {
  return PERKS.find((p) => p.id === id);
}

export function perkLevel(state: Pick<GameState, 'perks'>, id: string): number {
  return state.perks[id] ?? 0;
}

/** 특전 `손목 단련`의 탭 피해 배율(세트 효과 제외) */
export function tapPowerMult(state: Pick<GameState, 'perks'>): number {
  return 1 + perkDef('tap_power')!.per * perkLevel(state, 'tap_power');
}

/** 특전 `도감 수집가`의 도감 배율 곱 */
export function dexBoostMult(state: Pick<GameState, 'perks'>): number {
  return 1 + perkDef('dex_boost')!.per * perkLevel(state, 'dex_boost');
}

/** 특전 `살림 장인`의 살림 배율 곱 */
export function homeBoostMult(state: Pick<GameState, 'perks'>): number {
  return 1 + perkDef('home_boost')!.per * perkLevel(state, 'home_boost');
}

export interface PerkEffects {
  tapMult: number;
  critChance: number;
  critMult: number;
  feverSec: number;
  boxPriceMult: number;
  parcelDelayScale: number;
  /** 강타·급소 탭 수에 곱하는 배율(강타 단련) */
  strikeMult: number;
  /** 연속 퍼펙트 배수 계수에 더하는 값(기본 계수 0.5에 얹는다) */
  streakBonus: number;
  /** 특별 상자 확률에 곱하는 배율 */
  specialRateMult: number;
  /** 피버 게이지 충전량에 곱하는 배율 */
  feverCharge: number;
}

export function perkEffects(state: Pick<GameState, 'perks'> & { collection?: GameState['collection'] }): PerkEffects {
  const set = setEffects({ collection: state.collection ?? {} });
  const lv = (id: string) => perkLevel(state, id);
  const per = (id: string) => perkDef(id)!.per;
  return {
    tapMult: 1 + per('tap_power') * lv('tap_power'),
    critChance: CRIT_CHANCE + per('crit') * lv('crit'),
    critMult: CRIT_MULT + per('tap_crit_power') * lv('tap_crit_power') + set.critMult,
    feverSec: FEVER_SEC + per('fever_long') * lv('fever_long') + set.feverSec,
    boxPriceMult: 1 - per('box_discount') * lv('box_discount'),
    parcelDelayScale: 1 - per('parcel_freq') * lv('parcel_freq'),
    strikeMult: 1 + per('strike_power') * lv('strike_power'),
    streakBonus: per('streak_coef') * lv('streak_coef'),
    specialRateMult: 1 + per('special_freq') * lv('special_freq'),
    feverCharge: 1 + per('fever_charge') * lv('fever_charge'),
  };
}

/** 결정적 난수(mulberry32). migrate 소급 지급과 rng 없는 이사에 쓴다. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 최대 레벨이 아닌 특전 중 서로 다른 3개를 뽑는다(후보가 모자라면 그만큼). */
export function rollPerkOffer(perks: Record<string, number>, rng: () => number): string[] {
  const pool = PERKS.filter((p) => (perks[p.id] ?? 0) < p.maxLevel).map((p) => p.id);
  const out: string[] = [];
  while (out.length < PERK_OFFER_SIZE && pool.length > 0) {
    const i = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

/** 이사 보상 특전 상자 수: moves(이사 전 횟수)가 0이면 2개, 그 뒤 3·4·5·5… */
export function movePerkBoxes(moves: number): number {
  return Math.min(MOVE_PERK_BOXES_BASE + Math.max(0, Math.floor(moves)), MOVE_PERK_BOXES_MAX);
}

export interface PerkOptionView {
  id: string;
  name: string;
  emoji: string;
  category: PerkDef['category'];
  desc: string;
  level: number;
  /** 끝없이 오르는 특전은 Infinity(화면은 `unlimited`로 가른다) */
  maxLevel: number;
  /** 레벨 상한이 없다(maxed는 항상 false) */
  unlimited: boolean;
  maxed: boolean;
}

/** 화면용: 대기 중인 선택 묶음마다 3개 옵션의 현재 레벨 정보. */
export function perkOfferViews(state: GameState): PerkOptionView[][] {
  return state.perkOffers.map((offer) =>
    offer.flatMap((id) => {
      const d = perkDef(id);
      if (!d) return [];
      const level = perkLevel(state, id);
      return [{ id, name: d.name, emoji: d.emoji, category: d.category, desc: d.desc, level, maxLevel: d.maxLevel, unlimited: !Number.isFinite(d.maxLevel), maxed: level >= d.maxLevel }];
    }),
  );
}

/** offerIndex번째 대기 묶음에서 특전 1개 선택. 묶음에 없거나 이미 최대면 null. */
export function choosePerk(state: GameState, offerIndex: number, perkId: string): GameState | null {
  const offer = state.perkOffers[offerIndex];
  const d = perkDef(perkId);
  if (!offer || !d || !offer.includes(perkId)) return null;
  const level = perkLevel(state, perkId);
  if (level >= d.maxLevel) return null;
  return {
    ...state,
    perks: { ...state.perks, [perkId]: level + 1 },
    perkOffers: state.perkOffers.filter((_, i) => i !== offerIndex),
  };
}

/** 묶음의 모든 후보가 최대 레벨이라 고를 수 없을 때 묶음을 버린다. */
export function discardPerkOffer(state: GameState, offerIndex: number): GameState | null {
  const offer = state.perkOffers[offerIndex];
  if (!offer) return null;
  if (offer.some((id) => (perkDef(id) && perkLevel(state, id) < perkDef(id)!.maxLevel))) return null;
  return { ...state, perkOffers: state.perkOffers.filter((_, i) => i !== offerIndex) };
}

export function pendingPerkCount(state: GameState): number {
  return state.perkOffers.length;
}
