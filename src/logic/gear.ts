/** 공구 강화(상한 축 5종): 비용·해금·구매·효과 값과 안전모 실드 규칙. 레벨(`state.gear`)은 영구, 실드는 저장하지 않는 실행 중 값. */
import {
  GEAR_CHAIN_CAP_BASE,
  GEAR_CHAIN_CAP_STEP,
  GEAR_COST_GROWTH,
  GEAR_PERFECT_HALF_BASE,
  GEAR_PERFECT_HALF_MAX,
  GEAR_PERFECT_HALF_STEP,
  GEAR_SPECIAL_RATE_BASE,
  GEAR_SPECIAL_RATE_STEP,
  GEAR_WEAK_DELAY_STEP,
  GEAR_WEAK_TAPS_BASE,
  GEAR_WEAK_TAPS_STEP,
  SHIELD_CHARGE_PERFECTS,
  gearDef,
  type GearId,
} from '../data/gear';
import type { ChargeGrade } from './charge';
import { GUIDE_SPECIAL_RATE, featureOpen, guideAt, guideEnded, type GuideFeature } from './guide';
import { DECK_PERFECT_HALF_HARD_MAX } from '../data/cards';
import { deckEffects } from './deck';
import { houseInfo } from './house';
import { perkEffects } from './perks';
import type { GameState } from './state';

export function gearLevel(state: GameState, id: GearId): number {
  return state.gear[id] ?? 0;
}

/** 다음 레벨 비용(상한이면 Infinity) */
export function gearCost(state: GameState, id: GearId): number {
  const def = gearDef(id);
  const lv = gearLevel(state, id);
  if (lv >= def.maxLevel) return Infinity;
  return houseInfo(state.moves).target * def.frac * GEAR_COST_GROWTH ** lv;
}

/** 가이드 중에는 공구가 돕는 요소(수평계 = 강타, 안전모 = 연속 퍼펙트…)가 열려야 카드가 열린다 */
const GEAR_FEATURE: Record<GearId, GuideFeature> = { level: 'charge', helmet: 'streak', crowbar: 'chain', awl: 'weak', loupe: 'special' };

/** 카드가 보이는가: 이사를 했거나 이 집 상자를 해금 수만큼 열었다. 가이드 중에는 영구 공구 단계에 닿고 그 공구의 요소가 열려 있어야 한다 */
export function gearUnlocked(state: GameState, id: GearId): boolean {
  if (!guideEnded(state) && !(featureOpen(state, 'gear') && featureOpen(state, GEAR_FEATURE[id]))) return false;
  return state.moves > 0 || state.unpack.box >= gearDef(id).unlockBox;
}

export function canBuyGear(state: GameState, id: GearId): boolean {
  return gearUnlocked(state, id) && gearLevel(state, id) < gearDef(id).maxLevel && state.points >= gearCost(state, id);
}

export function buyGear(state: GameState, id: GearId): GameState | null {
  if (!canBuyGear(state, id)) return null;
  return { ...state, points: state.points - gearCost(state, id), gear: { ...state.gear, [id]: gearLevel(state, id) + 1 } };
}

export interface GearEffects {
  /** 퍼펙트 구간 반폭(수평계) */
  perfectHalf: number;
  /** 실드 최대 칸 수(안전모) */
  shieldMax: number;
  /** 연쇄 보너스 상한(빠루) */
  chainCap: number;
  /** 급소 한 방의 탭 수(송곳) */
  weakTaps: number;
  /** 급소 다음 등장 간격 배율(송곳) */
  weakDelayMult: number;
  /** 특별 상자 확률(돋보기) */
  specialRate: number;
}

export function gearEffects(state: GameState): GearEffects {
  const lv = (id: GearId) => gearLevel(state, id);
  const dk = deckEffects(state);
  return {
    perfectHalf: Math.min(DECK_PERFECT_HALF_HARD_MAX, Math.min(GEAR_PERFECT_HALF_MAX, GEAR_PERFECT_HALF_BASE + GEAR_PERFECT_HALF_STEP * lv('level')) + dk.perfectHalfAdd),
    shieldMax: lv('helmet'),
    chainCap: GEAR_CHAIN_CAP_BASE + GEAR_CHAIN_CAP_STEP * lv('crowbar') + dk.chainCapAdd,
    weakTaps: Math.round((GEAR_WEAK_TAPS_BASE + GEAR_WEAK_TAPS_STEP * lv('awl')) * dk.weakTapsMult),
    weakDelayMult: (1 - GEAR_WEAK_DELAY_STEP * lv('awl')) * dk.weakDelayMult,
    specialRate: Math.max(GEAR_SPECIAL_RATE_BASE + GEAR_SPECIAL_RATE_STEP * lv('loupe'), guideAt(state, 'special') ? GUIDE_SPECIAL_RATE : 0) * perkEffects(state).specialRateMult,
  };
}

export interface ShieldState {
  /** 지금 가진 칸 수 */
  n: number;
  /** 다음 칸까지 남은 퍼펙트 수 */
  toNext: number;
}

/** 불러오기·이사 때 가득 찬 실드 */
export function initialShield(max: number): ShieldState {
  return { n: max, toNext: SHIELD_CHARGE_PERFECTS };
}

export interface StreakResolve {
  streak: number;
  shield: ShieldState;
  /** 실드가 연속을 지켰다 */
  saved: boolean;
}

/** 판정 뒤의 연속 퍼펙트와 실드. 퍼펙트는 +1하고 8번마다 칸을 채운다. 굿·미스는 칸이 있고 연속이 있으면 연속을 유지(+1 없음)하고 칸을 쓴다. 보상은 실제 판정대로(여기서 안 다룸) */
export function resolveStreak(prev: number, grade: ChargeGrade, shield: ShieldState, max: number): StreakResolve {
  if (grade === 'perfect') {
    let { n, toNext } = shield;
    toNext -= 1;
    if (toNext <= 0) {
      n = Math.min(max, n + 1);
      toNext = SHIELD_CHARGE_PERFECTS;
    }
    return { streak: prev + 1, shield: { n, toNext }, saved: false };
  }
  if (prev > 0 && shield.n > 0) return { streak: prev, shield: { ...shield, n: shield.n - 1 }, saved: true };
  return { streak: 0, shield, saved: false };
}
