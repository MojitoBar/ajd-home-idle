import { tapStable, tapValue } from './economy';
import {
  PARCEL_FREE_BOX_CHANCE,
  PARCEL_MAX_PPS_SEC,
  PARCEL_MIN_PPS_SEC,
  PARCEL_TAPS_PER_SEC,
  chargeFever,
  nextParcelDelay,
} from './fever';
import { addToCollection, rollBox, type BoxResult } from './gacha';
import { featureOpen } from './guide';
import { perkEffects } from './perks';
import type { GameState } from './state';

export interface TapResult {
  state: GameState;
  gain: number;
  crit: boolean;
  /** 전액 허용량이 없어 기본값 몫만 받은 탭(치명타 없음, 피버는 0.5만 채운다) */
  damped: boolean;
}

/** 치명타 판정 + 피버 충전이 들어간 탭. rng() < 확률이면 치명타. comboMult는 수익에만 곱한다. 기존 applyTap은 그대로 둔다. */
export function tapWithRng(state: GameState, rng: () => number, damped = false, comboMult = 1): TapResult {
  const fx = perkEffects(state);
  const crit = !damped && rng() < fx.critChance;
  const gain = tapValue(state, damped) * (crit ? fx.critMult : 1) * comboMult;
  return {
    gain,
    crit,
    damped,
    state: {
      ...state,
      points: state.points + gain,
      earned: state.earned + gain,
      fever: featureOpen(state, 'fever') ? chargeFever(state.fever, fx.feverSec, (damped ? 0.5 : 1) * fx.feverCharge) : state.fever,
      stats: { ...state.stats, totalTaps: state.stats.totalTaps + 1, totalEarned: state.stats.totalEarned + gain },
    },
  };
}

export type ParcelReward =
  | { kind: 'points'; gain: number; seconds: number }
  | { kind: 'box'; result: BoxResult };

export function parcelVisible(state: GameState): boolean {
  return state.parcel.remainSec > 0;
}

/** 가격·개봉 수(boxesThisRun) 없이 무료 사은품 상자 1개를 도감에 넣는다. 난수: 희귀도·종류·변형. */
export function grantFreeBox(state: GameState, rng: () => number): { state: GameState; result: BoxResult } {
  const { item, variant } = rollBox(rng);
  const { collection, result } = addToCollection(state.collection, item, variant);
  return {
    state: { ...state, collection, stats: { ...state.stats, boxesOpened: state.stats.boxesOpened + 1 } },
    result,
  };
}

/** 떠 있는 택배 상자를 잡는다. 없으면 null. 난수: 종류, 초 수(포인트일 때) 또는 상자 3개. */
export function catchParcel(state: GameState, rng: () => number): { state: GameState; reward: ParcelReward } | null {
  if (!parcelVisible(state)) return null;
  const parcel = { nextInSec: nextParcelDelay(rng, perkEffects(state).parcelDelayScale), remainSec: 0 };
  if (rng() < PARCEL_FREE_BOX_CHANCE) {
    const free = grantFreeBox(state, rng);
    return { state: { ...free.state, parcel }, reward: { kind: 'box', result: free.result } };
  }
  const seconds = PARCEL_MIN_PPS_SEC + rng() * (PARCEL_MAX_PPS_SEC - PARCEL_MIN_PPS_SEC);
  const gain = tapStable(state) * PARCEL_TAPS_PER_SEC * seconds;
  return {
    state: {
      ...state,
      parcel,
      points: state.points + gain,
      earned: state.earned + gain,
      stats: { ...state.stats, totalEarned: state.stats.totalEarned + gain },
    },
    reward: { kind: 'points', gain, seconds },
  };
}
