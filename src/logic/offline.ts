import { contractExtraPps, ppsNoContract } from './economy';
import { initialFever } from './fever';
import { OFFLINE_CAP_SEC_BASE, OFFLINE_RATE_BASE } from './offlineBase';
import { perkEffects } from './perks';
import type { GameState } from './state';

export const OFFLINE_CAP_SEC = OFFLINE_CAP_SEC_BASE;
export const OFFLINE_MIN_SEC = 60;
export const OFFLINE_RATE = OFFLINE_RATE_BASE;

export interface OfflineResult {
  gain: number;
  seconds: number;
  capped: boolean;
  savedAt: number;
}

export interface OfflineOptions {
  capSec?: number;
  rate?: number;
  /** 오프라인 보상 추가 배율(세트 효과) */
  mult?: number;
  /** 약정 추가 수익: 남은 초만큼만 반영 */
  extras?: { extraPps: number; remainSec: number }[];
}

/** 특전 반영 상한(초). 화면 문구용. */
export function offlineCapSec(state: GameState): number {
  return perkEffects(state).offlineCapSec;
}

/** 특전 반영 오프라인 효율(0~1). */
export function offlineRate(state: GameState): number {
  return perkEffects(state).offlineRate;
}

export function offlineReward(savedAt: number, now: number, ppsValue: number, opts: OfflineOptions = {}): OfflineResult {
  const capSec = opts.capSec ?? OFFLINE_CAP_SEC;
  const rate = opts.rate ?? OFFLINE_RATE;
  const correctedSavedAt = Math.min(savedAt, now);
  const elapsed = (now - correctedSavedAt) / 1000;
  if (!(elapsed >= OFFLINE_MIN_SEC)) return { gain: 0, seconds: 0, capped: false, savedAt: correctedSavedAt };
  const seconds = Math.min(elapsed, capSec);
  let base = seconds * ppsValue;
  for (const x of opts.extras ?? []) base += x.extraPps * Math.min(seconds, Math.max(0, x.remainSec));
  return { gain: base * rate * (opts.mult ?? 1), seconds, capped: elapsed > capSec, savedAt: correctedSavedAt };
}

/**
 * 오프라인 보상 적용. ppsValue는 약정을 뺀 수익이고, 약정은 남은 시간만큼만 따로 더한다.
 * 약정 남은 시간은 상한과 무관하게 실제 경과 시간만큼 줄어든다.
 */
export function applyOffline(state: GameState, now: number): { state: GameState; report: OfflineResult | null } {
  // 오프라인 중엔 이벤트 배율 E·피버를 적용하지 않는다
  const calm: GameState = { ...state, fever: initialFever(), event: { ...state.event, remainSec: 0 } };
  const fx = perkEffects(state);
  const r = offlineReward(state.savedAt, now, ppsNoContract(calm), {
    capSec: fx.offlineCapSec,
    rate: fx.offlineRate,
    mult: fx.offlineMult,
    extras: state.contracts.map((c) => ({ extraPps: contractExtraPps(calm, c.service), remainSec: c.remainSec })),
  });
  const elapsed = Math.max(0, (now - r.savedAt) / 1000);
  const next: GameState = { ...state, savedAt: r.savedAt };
  if (elapsed > 0 && state.contracts.length > 0) {
    next.contracts = state.contracts.map((c) => ({ ...c, remainSec: c.remainSec - elapsed })).filter((c) => c.remainSec > 0);
  }
  if (r.gain <= 0) return { state: next, report: null };
  next.points += r.gain;
  next.earned += r.gain;
  next.stats = { ...state.stats, totalEarned: state.stats.totalEarned + r.gain };
  return { state: next, report: r };
}
