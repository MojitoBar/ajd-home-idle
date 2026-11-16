/** 꾹 눌러 강타: 길게 누르면 표시(marker)가 0 -> 1 -> 0을 왕복하고, 손을 뗀 자리가 판정이 된다. 저장하지 않는 실행 중 상태(연속 퍼펙트 streak 포함). */
import { heavyHit, type HeavyResult } from './unpack';
import type { GameState } from './state';

/** 이보다 길게 누르면 모으기 시작, 짧으면 일반 탭 */
export const CHARGE_HOLD_MS = 220;
/** 표시가 한쪽 끝에서 반대쪽 끝까지 가는 시간 */
export const CHARGE_SWEEP_MS = 600;

export type ChargeGrade = 'perfect' | 'good' | 'miss';

export const CHARGE_PERFECT: readonly [number, number] = [0.78, 0.88];
export const CHARGE_GOOD: readonly [number, number] = [0.58, 0.96];

/** 한 번의 스윙에서 판정이 되는 구간(퍼펙트는 굿 안쪽) */
export interface ChargeZone {
  perfect: readonly [number, number];
  good: readonly [number, number];
}

/** 구간을 따로 안 정하면 쓰는 고정 자리 */
export const CHARGE_ZONE_DEFAULT: ChargeZone = { perfect: CHARGE_PERFECT, good: CHARGE_GOOD };

/** 스윙마다 뽑는 구간 가운데의 범위, 직전 스윙과 최소 간격 */
export const CHARGE_CENTER_MIN = 0.35;
export const CHARGE_CENTER_MAX = 0.87;
export const CHARGE_CENTER_GAP = 0.15;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** 퍼펙트 가운데가 center인 구간(기본 구간과 같은 모양·폭, 0~1로 자름) */
export function chargeZoneAt(center: number): ChargeZone {
  return {
    perfect: [clamp01(center - 0.05), clamp01(center + 0.05)],
    good: [clamp01(center - 0.25), clamp01(center + 0.13)],
  };
}

/** 다음 스윙의 구간을 뽑는다. prev가 있으면 가운데가 CHARGE_CENTER_GAP 이상 떨어진 자리에서만 고른다(다시 뽑기 없이 허용 범위에서 바로 뽑음) */
export function rollChargeZone(rng: () => number, prev?: ChargeZone): ChargeZone {
  if (!prev) return chargeZoneAt(CHARGE_CENTER_MIN + rng() * (CHARGE_CENTER_MAX - CHARGE_CENTER_MIN));
  const p = (prev.perfect[0] + prev.perfect[1]) / 2;
  const left = Math.max(0, p - CHARGE_CENTER_GAP - CHARGE_CENTER_MIN);
  const right = Math.max(0, CHARGE_CENTER_MAX - (p + CHARGE_CENTER_GAP));
  const r = rng() * (left + right);
  return chargeZoneAt(r < left ? CHARGE_CENTER_MIN + r : p + CHARGE_CENTER_GAP + (r - left));
}

export interface ChargeReward {
  /** 탭 몇 번어치 */
  taps: number;
  /** 콤보에 더할 탭 수 */
  combo: number;
  /** 피버 충전량 */
  fever: number;
}

export const CHARGE_REWARD: Record<ChargeGrade, ChargeReward> = {
  perfect: { taps: 20, combo: 10, fever: 6 },
  good: { taps: 8, combo: 3, fever: 3 },
  miss: { taps: 2, combo: 0, fever: 1 },
};

/** 연속 퍼펙트 1회마다 퍼펙트 보상 탭 +2번어치, 최대 +10 */
export const CHARGE_STREAK_TAPS = 2;
export const CHARGE_STREAK_MAX = 5;
/** 연속 1회마다 표시 속도 +8%, 최대 5회분 */
export const CHARGE_STREAK_SPEED = 0.08;

/** 모으기 시작 후 elapsedMs 시점의 표시 위치(0~1, 삼각파) */
export function chargePos(elapsedMs: number, speed = 1): number {
  const cycle = CHARGE_SWEEP_MS * 2;
  const t = ((Math.max(0, elapsedMs) * speed) % cycle) / CHARGE_SWEEP_MS;
  return t <= 1 ? t : 2 - t;
}

export function chargeGrade(pos: number, zone: ChargeZone = CHARGE_ZONE_DEFAULT): ChargeGrade {
  if (pos >= zone.perfect[0] && pos <= zone.perfect[1]) return 'perfect';
  if (pos >= zone.good[0] && pos <= zone.good[1]) return 'good';
  return 'miss';
}

export function chargeSpeed(streak: number): number {
  return 1 + CHARGE_STREAK_SPEED * Math.min(streak, CHARGE_STREAK_MAX);
}

/** 이 판정이 주는 탭 수(streak은 이번 이전까지의 연속 퍼펙트 수) */
export function chargeTaps(grade: ChargeGrade, streak: number): number {
  const base = CHARGE_REWARD[grade].taps;
  return grade === 'perfect' ? base + CHARGE_STREAK_TAPS * Math.min(streak, CHARGE_STREAK_MAX) : base;
}

export interface ChargeRelease extends HeavyResult {
  grade: ChargeGrade;
  /** 이번 판정 반영 후 연속 퍼펙트 수 */
  streak: number;
  /** 콤보에 더할 탭 수(`comboAdd`) */
  comboAdd: number;
  /** 실제로 쓴 탭 수(`tapsMult` 반영) */
  taps: number;
}

/** 손을 뗀 자리 pos(0~1)의 판정 -> 묵직한 한 방. streak은 직전까지의 연속 퍼펙트 수. tapsMult(열기 강타 배율 등)는 숫자나 판정별 함수이며 탭 수에만 곱하고 피버 충전량은 표 그대로. zone은 이번 스윙의 구간(없으면 기본 구간) */
export function releaseCharge(
  state: GameState,
  rng: () => number,
  pos: number,
  streak: number,
  comboMult = 1,
  tapsMult: number | ((grade: ChargeGrade) => number) = 1,
  zone: ChargeZone = CHARGE_ZONE_DEFAULT,
): ChargeRelease {
  const grade = chargeGrade(pos, zone);
  const reward = CHARGE_REWARD[grade];
  const mult = typeof tapsMult === 'function' ? tapsMult(grade) : tapsMult;
  const taps = Math.round(chargeTaps(grade, streak) * mult);
  const h = heavyHit(state, rng, taps, comboMult, reward.fever);
  return { ...h, grade, streak: grade === 'perfect' ? streak + 1 : 0, comboAdd: reward.combo, taps };
}
