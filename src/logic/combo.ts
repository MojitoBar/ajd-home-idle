/** 콤보: 연속 탭 수가 단계를 올려 탭 수익 배율을 주고, 끝날 때 번 포인트의 일부를 정산 보너스로 한 번 더 준다. 저장하지 않는 실행 중 상태. */

export interface ComboState {
  /** 이어진 탭 수 */
  n: number;
  /** 마지막 탭 시각(ms) */
  lastMs: number;
  /** 이번 콤보 동안 탭으로 번 포인트 합 */
  earned: number;
}

export interface ComboTier {
  /** 이 탭 수부터 */
  at: number;
  /** 탭 수익 배율 */
  mult: number;
  /** 끝날 때 정산 비율(earned x 비율) */
  bonus: number;
}

/** 1~5단계. 10 미만은 0단계(x1, 정산 없음) */
export const COMBO_TIERS: readonly ComboTier[] = [
  { at: 10, mult: 1.2, bonus: 0.1 },
  { at: 25, mult: 1.5, bonus: 0.2 },
  { at: 50, mult: 2, bonus: 0.3 },
  { at: 100, mult: 3, bonus: 0.4 },
  { at: 200, mult: 5, bonus: 0.5 },
];

export const COMBO_WINDOW_MS = 1000;
export const COMBO_WINDOW_FEVER_MS = 2000;

export const initialCombo = (): ComboState => ({ n: 0, lastMs: 0, earned: 0 });

/** 콤보가 이어지는 최대 탭 간격. 피버 중엔 2배 */
export function comboWindowMs(feverActive: boolean): number {
  return feverActive ? COMBO_WINDOW_FEVER_MS : COMBO_WINDOW_MS;
}

/** 0(콤보 없음)~5 */
export function comboTier(n: number): number {
  let t = 0;
  for (let i = 0; i < COMBO_TIERS.length; i++) if (n >= COMBO_TIERS[i].at) t = i + 1;
  return t;
}

export function comboMult(n: number): number {
  const t = comboTier(n);
  return t === 0 ? 1 : COMBO_TIERS[t - 1].mult;
}

/** 다음 단계까지 남은 탭 수와 그 단계. 최고 단계면 null */
export function comboNext(n: number): { remain: number; tier: number; mult: number } | null {
  const t = comboTier(n);
  if (t >= COMBO_TIERS.length) return null;
  const next = COMBO_TIERS[t];
  return { remain: next.at - n, tier: t + 1, mult: next.mult };
}

/** 마지막 탭에서 windowMs가 넘게 지났으면 끝난 콤보. 정확히 windowMs면 아직 이어진다 */
export function comboExpired(c: ComboState, nowMs: number, windowMs: number): boolean {
  return c.n > 0 && nowMs - c.lastMs > windowMs;
}

export interface ComboHit {
  combo: ComboState;
  /** 이번 탭으로 오른 단계(오르지 않았으면 0) */
  tierUp: number;
  /** 이번 탭 때문에 끊긴 직전 콤보(없으면 null). 정산(`comboBonus`)에 쓴다 */
  ended: ComboState | null;
}

/** 탭 1회. 이 탭의 배율은 돌려준 `combo.n`으로 `comboMult`를 구한다. 감쇠 탭은 n을 올리지 않고 시간만 갱신한다 */
export function comboHit(c: ComboState, nowMs: number, windowMs: number, damped: boolean): ComboHit {
  const expired = comboExpired(c, nowMs, windowMs);
  const ended = expired ? c : null;
  if (damped) {
    if (c.n === 0 || expired) return { combo: initialCombo(), tierUp: 0, ended };
    return { combo: { ...c, lastMs: nowMs }, tierUp: 0, ended: null };
  }
  const n = c.n === 0 || expired ? 1 : c.n + 1;
  const base = n === 1 ? 0 : c.earned;
  const tierUp = comboTier(n) > comboTier(n === 1 ? 0 : c.n) ? comboTier(n) : 0;
  return { combo: { n, lastMs: nowMs, earned: base }, tierUp, ended };
}

/** 콤보를 끊지 않고 n을 add만큼 올린다(묵직한 한 방·급소 보너스). 만료 검사는 부르는 쪽 몫. add가 0이어도 lastMs는 갱신한다. n = 0이면 add부터 시작. tierUp은 넘은 가장 높은 단계, ended는 항상 null */
export function comboAdd(c: ComboState, nowMs: number, add: number): ComboHit {
  const n = c.n + add;
  const tierUp = comboTier(n) > comboTier(c.n) ? comboTier(n) : 0;
  return { combo: { n, lastMs: nowMs, earned: c.n === 0 ? 0 : c.earned }, tierUp, ended: null };
}

/** 탭 수익을 이번 콤보 합계에 더한다 */
export function addEarned(c: ComboState, gain: number): ComboState {
  return { ...c, earned: c.earned + gain };
}

/** 끝난 콤보의 정산 보너스(끝났을 때 단계 비율 x 번 포인트) */
export function comboBonus(c: ComboState): number {
  const t = comboTier(c.n);
  return t === 0 ? 0 : c.earned * COMBO_TIERS[t - 1].bonus;
}
