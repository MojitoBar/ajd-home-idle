import { BUNDLES, BUNDLE_LEVELS, BUNDLE_MULTS } from '../data/bundles';
import { SERVICES } from '../data/services';
import { perkEffects } from './perks';
import type { GameState } from './state';

/** 결합 단계(0~4): 최소 레벨이 BUNDLE_LEVELS 이상인 개수 */
export function bundleStageOf(minLevel: number): number {
  let stage = 0;
  for (const l of BUNDLE_LEVELS) if (minLevel >= l) stage++;
  return stage;
}

/** 특전 반영 전 단계 배율 */
function rawMult(stage: number): number {
  return stage === 0 ? 1 : BUNDLE_MULTS[stage - 1];
}

function boosted(stage: number, boost: number): number {
  return 1 + (rawMult(stage) - 1) * boost;
}

/** 서비스 하나에 걸리는 결합 배율(두 결합에 속하면 곱). 결합 달인 특전 반영. */
export function bundleMultFor(state: GameState, serviceIndex: number): number {
  const boost = perkEffects(state).bundleBoost;
  let m = 1;
  for (const b of BUNDLES) {
    if (!b.services.includes(serviceIndex)) continue;
    const min = Math.min(...b.services.map((i) => state.services[i]));
    m *= boosted(bundleStageOf(min), boost);
  }
  return m;
}

export interface BundleStatus {
  id: string;
  name: string;
  emoji: string;
  services: { index: number; name: string; level: number }[];
  minLevel: number;
  /** 0~4 */
  stage: number;
  /** 현재 배율(특전 반영, 없으면 1) */
  mult: number;
  /** 다음 단계 필요 레벨(최고 단계면 null) */
  nextLevel: number | null;
  /** 다음 단계 배율(특전 반영) */
  nextMult: number | null;
  /** 다음 단계까지 모자란 서비스와 필요한 추가 레벨 */
  lacking: { index: number; name: string; level: number; need: number }[];
}

export function bundleStatuses(state: GameState): BundleStatus[] {
  const boost = perkEffects(state).bundleBoost;
  return BUNDLES.map((b) => {
    const services = b.services.map((i) => ({ index: i, name: SERVICES[i].name, level: state.services[i] }));
    const minLevel = Math.min(...services.map((s) => s.level));
    const stage = bundleStageOf(minLevel);
    const nextLevel = stage < BUNDLE_LEVELS.length ? BUNDLE_LEVELS[stage] : null;
    const lacking =
      nextLevel === null
        ? []
        : services.filter((s) => s.level < nextLevel).map((s) => ({ ...s, need: nextLevel - s.level }));
    return {
      id: b.id,
      name: b.name,
      emoji: b.emoji,
      services,
      minLevel,
      stage,
      mult: boosted(stage, boost),
      nextLevel,
      nextMult: nextLevel === null ? null : boosted(stage + 1, boost),
      lacking,
    };
  });
}
