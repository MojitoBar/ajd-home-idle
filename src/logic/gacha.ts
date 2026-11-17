import { COLLECTIBLES, RARITIES, SLOT_TOTAL, VARIANTS, type CollectibleDef, type Rarity, type Variant } from '../data/collectibles';
import { tapStable } from './economy';
import { dexBoostMult, perkEffects } from './perks';
import { collectionMultOf, completedSetRarities, slotLevel, slotNextNeed } from './collection';
import type { GameState } from './state';

export const BOX_MIN_PRICE = 5000;
export const BOX_TAP_FACTOR = 900;
export const BOX_PRICE_GROWTH = 1.06;

export interface BoxResult {
  item: CollectibleDef;
  variant: Variant;
  isNew: boolean;
  count: number;
  /** 열기 전·후 칸 레벨(미등록이면 0) */
  prevLevel: number;
  level: number;
  /** 다음 레벨까지 남은 개수(최대면 0) */
  nextNeed: number;
  /** 이번에 새로 완성된 세트 */
  completedSets: Rarity[];
}

export const GUARANTEE_BOX_COUNT = 10;

export function boxPrice(state: GameState): number {
  // 일시 배율(피버)은 가격에 넣지 않는다. 탭 약 900번(30초)분
  return Math.max(BOX_MIN_PRICE, BOX_TAP_FACTOR * tapStable(state)) * BOX_PRICE_GROWTH ** state.boxesThisRun * perkEffects(state).boxPriceMult;
}

function pickByProb<T extends { prob: number }>(list: readonly T[], r: number): T {
  let cum = 0;
  for (let i = 0; i < list.length - 1; i++) {
    cum += list[i].prob;
    if (r < cum) return list[i];
  }
  return list[list.length - 1];
}

/** 난수 3개(희귀도, 종, 변이)로 결과만 결정한다. 상태는 바꾸지 않는다. minRare면 레어 이상 안에서 원래 확률 비율대로 뽑는다. */
export function rollBox(rng: () => number, minRare = false): { item: CollectibleDef; variant: Variant } {
  const r0 = rng();
  const rarity = (minRare ? pickByProb(RARITIES.slice(1).map((r) => ({ ...r, prob: r.prob / (1 - RARITIES[0].prob) })), r0) : pickByProb(RARITIES, r0)).id;
  const pool = COLLECTIBLES.filter((c) => c.rarity === rarity);
  const item = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  const variant = pickByProb(VARIANTS, rng()).id;
  return { item, variant };
}

/** 상자 1개 구매·개봉. P 부족이면 null. 중복은 개수만 증가(P 환급 없음). */
export function openBox(state: GameState, rng: () => number, minRare = false): { state: GameState; result: BoxResult } | null {
  const price = boxPrice(state);
  if (!Number.isFinite(price) || price > state.points) return null;
  const { item, variant } = rollBox(rng, minRare);
  const { collection, result } = addToCollection(state.collection, item, variant);
  return {
    state: {
      ...state,
      points: state.points - price,
      boxesThisRun: state.boxesThisRun + 1,
      collection,
      stats: { ...state.stats, boxesOpened: state.stats.boxesOpened + 1 },
    },
    result,
  };
}

/** 도감에 1개 더하고 결과(레벨·세트 변화 포함)를 만든다. 택배 무료 상자도 같이 쓴다. */
export function addToCollection(
  before: GameState['collection'],
  item: CollectibleDef,
  variant: Variant,
): { collection: GameState['collection']; result: BoxResult } {
  const prev = before[item.id] ?? { base: 0, shiny: 0, gold: 0, rainbow: 0 };
  const count = prev[variant] + 1;
  const collection = { ...before, [item.id]: { ...prev, [variant]: count } };
  const done = completedSetRarities(before);
  return {
    collection,
    result: {
      item,
      variant,
      isNew: count === 1,
      count,
      prevLevel: slotLevel(count - 1),
      level: slotLevel(count),
      nextNeed: slotNextNeed(count),
      completedSets: completedSetRarities(collection).filter((r) => !done.includes(r)),
    },
  };
}

/**
 * 최대 count개 연속 개봉(P가 모자라면 거기서 멈춤). 하나도 못 열면 results가 빈 배열.
 * 10개를 모두 열 수 있을 때 앞 9개에 레어 이상이 없으면 10번째를 레어 이상으로 정한다.
 */
export function openBoxes(state: GameState, rng: () => number, count: number): { state: GameState; results: BoxResult[] } {
  const results: BoxResult[] = [];
  let cur = state;
  for (let i = 0; i < count; i++) {
    const guarantee = count === GUARANTEE_BOX_COUNT && i === count - 1 && results.every((x) => x.item.rarity === 'common');
    const r = openBox(cur, rng, guarantee);
    if (!r) break;
    cur = r.state;
    results.push(r.result);
  }
  return { state: cur, results };
}

export function collectionMult(state: GameState): number {
  return collectionMultOf(state.collection) * dexBoostMult(state);
}

export interface RarityProgress {
  rarity: Rarity;
  name: string;
  registered: number;
  total: number;
}

export function collectionProgress(state: GameState): {
  mult: number;
  registered: number;
  total: number;
  byRarity: RarityProgress[];
} {
  const byRarity = RARITIES.map((r) => ({ rarity: r.id, name: r.name, registered: 0, total: 0 }));
  let registered = 0;
  for (const c of COLLECTIBLES) {
    const row = byRarity.find((b) => b.rarity === c.rarity)!;
    row.total += VARIANTS.length;
    const slot = state.collection[c.id];
    for (const v of VARIANTS) {
      if (slot && slot[v.id] > 0) {
        row.registered++;
        registered++;
      }
    }
  }
  return { mult: collectionMult(state), registered, total: SLOT_TOTAL, byRarity };
}

export function isRegistered(state: GameState, itemId: string, variant: Variant): boolean {
  return (state.collection[itemId]?.[variant] ?? 0) > 0;
}

export interface OddsTable {
  rarities: { id: Rarity; name: string; prob: number; percent: string; speciesCount: number; weight: number }[];
  variants: { id: Variant; name: string; emoji: string; prob: number; percent: string; weight: number }[];
}

const pct = (p: number) => `${+(p * 100).toFixed(2)}%`;

/** 상자 화면에 항상 표시할 확률표. 각 목록의 prob 합은 1(100%). */
export function oddsTable(): OddsTable {
  return {
    rarities: RARITIES.map((r) => ({
      id: r.id,
      name: r.name,
      prob: r.prob,
      percent: pct(r.prob),
      speciesCount: COLLECTIBLES.filter((c) => c.rarity === r.id).length,
      weight: r.weight,
    })),
    variants: VARIANTS.map((v) => ({ id: v.id, name: v.name, emoji: v.emoji, prob: v.prob, percent: pct(v.prob), weight: v.weight })),
  };
}
