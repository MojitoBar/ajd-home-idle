import { COLLECTIBLES, RARITIES, SETS, VARIANTS, type Rarity, type SetDef } from '../data/collectibles';
import type { GameState } from './state';

/** 칸 레벨에 필요한 누적 개수(Lv 1~5). */
export const SLOT_LEVEL_NEED = [1, 3, 7, 15, 31] as const;
export const SLOT_MAX_LEVEL = SLOT_LEVEL_NEED.length;

/** 개수 -> 레벨(0이면 미등록, 최대 5). */
export function slotLevel(count: number): number {
  let lv = 0;
  for (const need of SLOT_LEVEL_NEED) if (count >= need) lv++;
  return lv;
}

/** 다음 레벨까지 남은 개수. 미등록이면 첫 등록까지, 최대면 0. */
export function slotNextNeed(count: number): number {
  const lv = slotLevel(count);
  return lv >= SLOT_MAX_LEVEL ? 0 : SLOT_LEVEL_NEED[lv] - count;
}

/** 레벨에 따른 기여 배수 2^(Lv-1)(Lv 1 = 1, Lv 5 = 16). */
export function slotLevelMult(level: number): number {
  return level <= 0 ? 0 : 2 ** (level - 1);
}

/** 칸 기여만의 도감 배율(세트 곱 제외) */
export function slotMultOf(collection: GameState['collection']): number {
  let bonus = 0;
  for (const c of COLLECTIBLES) {
    const slot = collection[c.id];
    if (!slot) continue;
    const w = RARITIES.find((r) => r.id === c.rarity)!.weight;
    for (const v of VARIANTS) bonus += w * v.weight * slotLevelMult(slotLevel(slot[v.id]));
  }
  return 1 + bonus;
}

/** 도감 배율 = 칸 기여 x 완성 세트 곱 */
export function collectionMultOf(collection: GameState['collection']): number {
  return slotMultOf(collection) * setEffects({ collection }).dexMult;
}

export interface SetProgress extends SetDef {
  have: number;
  total: number;
  done: boolean;
}

/** 등급별 세트 진행도(가진 종 수 / 전체 종 수). 변이는 따지지 않는다. */
export function setProgress(collection: GameState['collection']): SetProgress[] {
  return SETS.map((def) => {
    const pool = COLLECTIBLES.filter((c) => c.rarity === def.rarity);
    const have = pool.filter((c) => VARIANTS.some((v) => (collection[c.id]?.[v.id] ?? 0) > 0)).length;
    return { ...def, have, total: pool.length, done: have >= pool.length };
  });
}

export interface SetEffects {
  dexMult: number;
  feverSec: number;
  critMult: number;
}

/** 완성한 세트의 효과 합. 도감 배율은 곱(기본 1), 초·치명 배율 가산은 합(기본 0). */
export function setEffects(state: Pick<GameState, 'collection'>): SetEffects {
  const fx: SetEffects = { dexMult: 1, feverSec: 0, critMult: 0 };
  for (const s of setProgress(state.collection)) {
    if (!s.done) continue;
    fx.dexMult *= s.dexMult;
    if (s.effect && s.value !== undefined) fx[s.effect] += s.value;
  }
  return fx;
}

export function completedSetCount(collection: GameState['collection']): number {
  return setProgress(collection).filter((s) => s.done).length;
}

export function completedSetRarities(collection: GameState['collection']): Rarity[] {
  return setProgress(collection).filter((s) => s.done).map((s) => s.rarity);
}
