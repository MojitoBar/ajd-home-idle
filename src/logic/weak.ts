/** 급소: 최근 탭을 치고 있을 때 상자 위에 잠깐 뜨는 표시를 맞히면 묵직한 한 방. 저장하지 않는 실행 중 상태. */
import { heavyHit, type HeavyResult } from './unpack';
import type { GameState } from './state';
import { strikeMult } from './economy';
import { gearEffects } from './gear';

export interface WeakState {
  /** 다음 급소까지 남은 시간(ms). 탭을 치고 있을 때만 준다 */
  nextInMs: number;
  /** 떠 있는 남은 시간(ms). 0이면 없음 */
  remainMs: number;
  /** 상자 그림 사각형 안의 자리(0~1). 안 떠 있으면 직전 자리 */
  u: number;
  v: number;
}

export const WEAK_NEXT_MIN_MS = 4000;
export const WEAK_NEXT_MAX_MS = 7000;
export const WEAK_SHOW_MS = 1800;
export const WEAK_POS_MIN = 0.15;
export const WEAK_POS_MAX = 0.85;
/** 직전 자리와 이만큼은 떨어진다(다시 뽑기 WEAK_RETRIES번까지) */
export const WEAK_MIN_DIST = 0.3;
export const WEAK_RETRIES = 6;

/** taps는 송곳 없을 때의 기본값(실제 값은 `gearEffects(state).weakTaps`) */
export const WEAK_REWARD = { taps: 8, combo: 5, fever: 3 } as const;

/** 다음 급소까지의 간격. mult는 송곳의 간격 배율 */
const nextDelay = (rng: () => number, mult = 1) => (WEAK_NEXT_MIN_MS + rng() * (WEAK_NEXT_MAX_MS - WEAK_NEXT_MIN_MS)) * mult;
const coord = (rng: () => number) => WEAK_POS_MIN + rng() * (WEAK_POS_MAX - WEAK_POS_MIN);

export function initialWeak(rng: () => number): WeakState {
  return { nextInMs: nextDelay(rng), remainMs: 0, u: 0.5, v: 0.5 };
}

export function weakVisible(w: WeakState): boolean {
  return w.remainMs > 0;
}

export interface WeakAdvance {
  weak: WeakState;
  /** 이번에 막 떴다 */
  appeared: boolean;
  /** 이번에 시간이 다 돼 사라졌다 */
  vanished: boolean;
}

/** active(최근에 탭을 치고 있음)일 때만 대기 시간이 준다. 떠 있는 급소는 active와 무관하게 시간이 간다 */
export function advanceWeak(w: WeakState, dtMs: number, active: boolean, rng: () => number, delayMult = 1): WeakAdvance {
  if (w.remainMs > 0) {
    const remainMs = w.remainMs - dtMs;
    if (remainMs > 0) return { weak: { ...w, remainMs }, appeared: false, vanished: false };
    return { weak: { ...w, remainMs: 0, nextInMs: nextDelay(rng, delayMult) }, appeared: false, vanished: true };
  }
  if (!active) return { weak: w, appeared: false, vanished: false };
  const nextInMs = w.nextInMs - dtMs;
  if (nextInMs > 0) return { weak: { ...w, nextInMs }, appeared: false, vanished: false };
  let u = coord(rng);
  let v = coord(rng);
  for (let i = 0; i < WEAK_RETRIES && Math.hypot(u - w.u, v - w.v) < WEAK_MIN_DIST; i++) {
    u = coord(rng);
    v = coord(rng);
  }
  return { weak: { nextInMs: 0, remainMs: WEAK_SHOW_MS, u, v }, appeared: true, vanished: false };
}

/** 떠 있고 (u, v)가 급소 자리에서 radius 안(경계 포함)이면 참 */
export function weakHitTest(w: WeakState, u: number, v: number, radius: number): boolean {
  return w.remainMs > 0 && Math.hypot(u - w.u, v - w.v) <= radius;
}

export interface WeakHit extends HeavyResult {
  weak: WeakState;
  /** 콤보에 더할 탭 수(`comboAdd`) */
  comboAdd: number;
}

/** 급소를 맞혔다: 묵직한 한 방 + 급소는 사라지고 다음 간격을 뽑는다(자리는 직전 자리로 남는다) */
export function hitWeak(state: GameState, rng: () => number, w: WeakState, comboMult = 1): WeakHit {
  const g = gearEffects(state);
  const h = heavyHit(state, rng, Math.round(g.weakTaps * strikeMult(state.strikeLevel)), comboMult, WEAK_REWARD.fever);
  return { ...h, weak: { ...w, remainMs: 0, nextInMs: nextDelay(rng, g.weakDelayMult) }, comboAdd: WEAK_REWARD.combo };
}
