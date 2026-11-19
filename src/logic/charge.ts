/** 꾹 눌러 강타: 길게 누르면 표시(marker)가 0 -> 1 -> 0을 왕복하고, 손을 뗀 자리가 판정이 된다. 저장하지 않는 실행 중 상태(연속 퍼펙트 streak 포함). */
import { DECK_PERFECT_HALF_HARD_MAX } from '../data/cards';
import { deckEffects, chargeOnPerfect, deckBuffAfterStrike, deckChargeResult, deckFeverFires, deckMultFires, deckPerfectFires, deckStrikeMult } from './deck';
import { feverMultOf } from './fever';
import { heavyHit, type HeavyResult } from './unpack';
import type { GameState } from './state';
import { strikeMult, tapValue } from './economy';
import { gearEffects } from './gear';
import { featureOpen } from './guide';
import { perkEffects } from './perks';
import { GEAR_PERFECT_HALF_BASE, GEAR_PERFECT_HALF_MAX } from '../data/gear';

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
/** 고정 자리의 퍼펙트 가운데 */
export const CHARGE_ZONE_CENTER = (CHARGE_PERFECT[0] + CHARGE_PERFECT[1]) / 2;

/** 스윙마다 뽑는 구간 가운데의 범위, 직전 스윙과 최소 간격 */
export const CHARGE_CENTER_MIN = 0.35;
export const CHARGE_CENTER_MAX = 0.87;
export const CHARGE_CENTER_GAP = 0.15;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** 퍼펙트 가운데가 center인 구간(굿 구간은 그대로, 퍼펙트 반폭 half는 수평계 상한 0.12(공구함 P1을 더한 값은 고정 상한 0.125)까지, 0~1로 자름) */
export function chargeZoneAt(center: number, half = GEAR_PERFECT_HALF_BASE): ChargeZone {
  const h = Math.min(half, half <= DECK_PERFECT_HALF_HARD_MAX ? DECK_PERFECT_HALF_HARD_MAX : GEAR_PERFECT_HALF_MAX);
  return {
    perfect: [clamp01(center - h), clamp01(center + h)],
    good: [clamp01(center - 0.25), clamp01(center + 0.13)],
  };
}

/** 다음 스윙의 구간을 뽑는다. prev가 있으면 가운데가 CHARGE_CENTER_GAP 이상 떨어진 자리에서만 고른다(다시 뽑기 없이 허용 범위에서 바로 뽑음) */
export function rollChargeZone(rng: () => number, prev?: ChargeZone, half?: number): ChargeZone {
  if (!prev) return chargeZoneAt(CHARGE_CENTER_MIN + rng() * (CHARGE_CENTER_MAX - CHARGE_CENTER_MIN), half);
  const p = (prev.perfect[0] + prev.perfect[1]) / 2;
  const left = Math.max(0, p - CHARGE_CENTER_GAP - CHARGE_CENTER_MIN);
  const right = Math.max(0, CHARGE_CENTER_MAX - (p + CHARGE_CENTER_GAP));
  const r = rng() * (left + right);
  return chargeZoneAt(r < left ? CHARGE_CENTER_MIN + r : p + CHARGE_CENTER_GAP + (r - left), half);
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

/** 연속 퍼펙트 1회마다 퍼펙트 보상 배수 +0.5(상한 없음) */
export const CHARGE_STREAK_STEP = 0.5;
/** 연속 1회마다 표시 속도 +8%, 최대 10회분(배수와 달리 속도만 상한) */
export const CHARGE_STREAK_SPEED = 0.08;
export const CHARGE_STREAK_SPEED_MAX = 10;

/** 연속 퍼펙트 streak(이번 이전까지)번째 퍼펙트에 곱하는 배수. bonus는 특전(`perkEffects().streakBonus`)이 계수에 더하는 값 */
export function streakMult(streak: number, bonus = 0): number {
  return 1 + (CHARGE_STREAK_STEP + bonus) * Math.max(0, streak);
}

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
  return 1 + CHARGE_STREAK_SPEED * Math.min(streak, CHARGE_STREAK_SPEED_MAX);
}

/** 이 판정이 주는 탭 수(streak은 이번 이전까지의 연속 퍼펙트 수) */
export function chargeTaps(grade: ChargeGrade, streak: number, bonus = 0): number {
  const base = CHARGE_REWARD[grade].taps;
  return grade === 'perfect' ? base * streakMult(streak, bonus) : base;
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

/** 손을 뗀 자리 pos(0~1)의 판정 -> 묵직한 한 방. streak은 직전까지의 연속 퍼펙트 수. tapsMult(열기 강타 배율 등)는 숫자나 판정별 함수이며 탭 수에만 곱하고 피버 충전량은 표 그대로. zone은 이번 스윙의 구간(없으면 기본 자리에 수평계 반폭을 적용한 구간) */
export function releaseCharge(
  state: GameState,
  rng: () => number,
  pos: number,
  streak: number,
  comboMult = 1,
  tapsMult: number | ((grade: ChargeGrade) => number) = 1,
  zone: ChargeZone = chargeZoneAt(CHARGE_ZONE_CENTER, gearEffects(state).perfectHalf),
): ChargeRelease {
  const grade = chargeGrade(pos, zone);
  const reward = CHARGE_REWARD[grade];
  const mult = typeof tapsMult === 'function' ? tapsMult(grade) : tapsMult;
  const fx = perkEffects(state);
  const nextStreak = grade === 'perfect' ? streak + 1 : 0;
  const deckMult = deckStrikeMult(state, grade, nextStreak);
  const taps = Math.round(chargeTaps(grade, featureOpen(state, 'streak') ? streak : 0, fx.streakBonus) * mult * strikeMult(state.strikeLevel) * fx.strikeMult * deckMult);
  const h = heavyHit(state, rng, taps, comboMult, reward.fever);
  const fev = deckFeverFires(state, grade);
  const pReward = deckPerfectFires(state, grade, nextStreak);
  const deckFires = deckMult > 1 || fev.sec > 0 || pReward.length > 0 ? [...deckMultFires(state, grade, nextStreak), ...fev.fires, ...pReward, ...h.deckFires] : h.deckFires;
  let fed = fev.sec > 0 && h.state.fever.activeSec > 0 ? { ...h.state, fever: { ...h.state.fever, activeSec: h.state.fever.activeSec + fev.sec } } : h.state;
  if (pReward.length > 0) {
    const unit = tapValue(state) / feverMultOf(state.fever, deckEffects(state).feverMultAdd);
    let gain = 0;
    for (const f of pReward) { f.gain = unit * (f.taps ?? 0); gain += f.gain; }
    fed = { ...fed, points: fed.points + gain, earned: fed.earned + gain, stats: { ...fed.stats, totalEarned: fed.stats.totalEarned + gain } };
  }
  const buffed = deckBuffAfterStrike(fed, grade, h.chain);
  const out = grade === 'perfect' ? chargeOnPerfect(buffed, nextStreak) : buffed;
  return { ...h, state: out, deckFires, deckCharge: deckChargeResult(state, out), grade, streak: nextStreak, comboAdd: reward.combo, taps };
}
