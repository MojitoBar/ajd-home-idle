/** 열기: 탭을 치면 오르고 가만히 두면 식는다. 달아오른 구간을 버티면 탭 수익이 오르고, 끝까지 차면 과열. 저장하지 않는 실행 중 상태. */
import type { ChargeGrade } from './charge';

export interface HeatState {
  /** 열기 0~100 */
  v: number;
  /** 과열이 끝날 때까지 남은 시간(ms). 0보다 크면 과열 중 */
  overMs: number;
}

export type HeatZone = 'cool' | 'warm' | 'hot' | 'over';

export const HEAT_MAX = 100;
/** 탭 한 번(약한 탭도 같다) */
export const HEAT_TAP = 6;
/** 급소를 맞혔을 때 */
export const HEAT_WEAK = 15;
export const HEAT_DECAY_PER_SEC = 12;
/** 이 위는 겉보기만 따뜻한 구간 */
export const HEAT_WARM = 40;
/** 이 위는 달아오름(탭 수익 배율) */
export const HEAT_HOT = 70;
export const HEAT_HOT_MULT = 1.5;
export const HEAT_OVER_MS = 3000;
/** 강타로 터뜨린 뒤 남는 열기 */
export const HEAT_AFTER_STRIKE = 20;
/** 강타 배율 = 1 + 열기 / 이 값(열기 100이면 x3) */
export const HEAT_STRIKE_DIV = 50;

export function initialHeat(): HeatState {
  return { v: 0, overMs: 0 };
}

export function heatZone(h: HeatState): HeatZone {
  if (h.overMs > 0) return 'over';
  if (h.v >= HEAT_HOT) return 'hot';
  if (h.v >= HEAT_WARM) return 'warm';
  return 'cool';
}

export interface HeatAdd {
  heat: HeatState;
  /** 이번에 막 과열이 시작됐다 */
  overheated: boolean;
}

/** 과열 중에는 오르지 않는다. HEAT_MAX에 닿으면 과열 시작 */
export function heatAdd(h: HeatState, amount: number): HeatAdd {
  if (h.overMs > 0) return { heat: h, overheated: false };
  const v = Math.min(HEAT_MAX, h.v + amount);
  if (v >= HEAT_MAX) return { heat: { v: HEAT_MAX, overMs: HEAT_OVER_MS }, overheated: true };
  return { heat: { v, overMs: 0 }, overheated: false };
}

export function heatTap(h: HeatState): HeatAdd {
  return heatAdd(h, HEAT_TAP);
}

export interface HeatAdvance {
  heat: HeatState;
  /** 이번에 과열이 끝났다 */
  recovered: boolean;
}

/** hold(강타를 모으는 중)면 식지 않는다. 과열 중에는 hold와 무관하게 과열 시간에 걸쳐 100 -> 0 */
export function advanceHeat(h: HeatState, dtMs: number, hold: boolean): HeatAdvance {
  if (h.overMs > 0) {
    const overMs = h.overMs - dtMs;
    if (overMs <= 0) return { heat: { v: 0, overMs: 0 }, recovered: true };
    return { heat: { v: (HEAT_MAX * overMs) / HEAT_OVER_MS, overMs }, recovered: false };
  }
  if (hold || h.v <= 0) return { heat: h, recovered: false };
  return { heat: { v: Math.max(0, h.v - (HEAT_DECAY_PER_SEC * dtMs) / 1000), overMs: 0 }, recovered: false };
}

/** 탭 수익 배율: 달아오름이면 HEAT_HOT_MULT, 아니면 1 */
export function heatTapMult(h: HeatState): number {
  return heatZone(h) === 'hot' ? HEAT_HOT_MULT : 1;
}

/** 과열 중이면 약한 탭(`tapAndHit`의 damped) */
export function heatDamped(h: HeatState): boolean {
  return h.overMs > 0;
}

/** 강타 배율: 퍼펙트·굿이면 1 + 열기 / 50, 빗나감·과열 중이면 1 */
export function heatStrikeMult(h: HeatState, grade: ChargeGrade): number {
  if (h.overMs > 0 || grade === 'miss') return 1;
  return 1 + h.v / HEAT_STRIKE_DIV;
}

/** 강타를 뗀 순간(판정 무관) 열기를 HEAT_AFTER_STRIKE까지 터뜨린다. 과열 중에는 그대로 */
export function ventHeat(h: HeatState): HeatState {
  if (h.overMs > 0 || h.v <= HEAT_AFTER_STRIKE) return h;
  return { v: HEAT_AFTER_STRIKE, overMs: 0 };
}
