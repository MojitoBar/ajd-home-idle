import { PERKS, PERK_OFFER_SIZE, type PerkDef } from '../data/perks';
import { setEffects } from './collection';
import { CRIT_MULT, CRIT_CHANCE, FEVER_SEC } from './fever';
import { OFFLINE_CAP_SEC_BASE, OFFLINE_RATE_BASE } from './offlineBase';
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

export interface PerkEffects {
  tapMult: number;
  critChance: number;
  critMult: number;
  feverSec: number;
  serviceMult: number;
  offlineRate: number;
  offlineCapSec: number;
  boxPriceMult: number;
  parcelDelayScale: number;
  /** 결합 배율의 (배율-1) 부분에 곱할 값 */
  bundleBoost: number;
  extraSlots: number;
  penaltyMult: number;
  /** 오프라인 보상에 곱할 값(세트 효과) */
  offlineMult: number;
}

export function perkEffects(state: Pick<GameState, 'perks'> & { collection?: GameState['collection'] }): PerkEffects {
  const set = setEffects({ collection: state.collection ?? {} });
  const lv = (id: string) => perkLevel(state, id);
  const per = (id: string) => perkDef(id)!.per;
  return {
    tapMult: (1 + per('tap_power') * lv('tap_power')) * set.tapMult,
    critChance: CRIT_CHANCE + per('crit') * lv('crit'),
    critMult: CRIT_MULT + per('tap_crit_power') * lv('tap_crit_power') + set.critMult,
    feverSec: FEVER_SEC + per('fever_long') * lv('fever_long') + set.feverSec,
    serviceMult: (1 + per('svc_power') * lv('svc_power')) * set.serviceMult,
    offlineRate: OFFLINE_RATE_BASE + per('offline_rate') * lv('offline_rate'),
    offlineCapSec: OFFLINE_CAP_SEC_BASE + per('offline_cap') * lv('offline_cap'),
    boxPriceMult: 1 - per('box_discount') * lv('box_discount'),
    parcelDelayScale: 1 - per('parcel_freq') * lv('parcel_freq'),
    bundleBoost: 1 + per('bundle_boost') * lv('bundle_boost'),
    extraSlots: per('contract_slot') * lv('contract_slot'),
    penaltyMult: 1 - per('penalty_cut') * lv('penalty_cut'),
    offlineMult: set.offlineMult,
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

export interface PerkOptionView {
  id: string;
  name: string;
  emoji: string;
  category: PerkDef['category'];
  desc: string;
  level: number;
  maxLevel: number;
  maxed: boolean;
}

/** 화면용: 대기 중인 선택 묶음마다 3개 옵션의 현재 레벨 정보. */
export function perkOfferViews(state: GameState): PerkOptionView[][] {
  return state.perkOffers.map((offer) =>
    offer.flatMap((id) => {
      const d = perkDef(id);
      if (!d) return [];
      const level = perkLevel(state, id);
      return [{ id, name: d.name, emoji: d.emoji, category: d.category, desc: d.desc, level, maxLevel: d.maxLevel, maxed: level >= d.maxLevel }];
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
