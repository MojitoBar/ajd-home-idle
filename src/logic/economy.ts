import {
  TAPS_PER_SEC_ACCEPT,
  TAPS_PER_SEC_FULL,
  PERMANENT_MULT_PER_MOVE,
  TAP_BASE_COST,
  TAP_COST_RATE,
  STRIKE_BASE_COST,
  STRIKE_COST_RATE,
  STRIKE_MULT_PER_LEVEL,
  DAMPED_RATIO,
  HOME_MULT_PER_LV,
  TAP_MILESTONES,
  TAP_BOX_SCALE,
} from '../data/tap';
import { collectionMultOf, setEffects } from './collection';
import { advanceFever, advanceParcel, feverMultOf } from './fever';
import { dexBoostMult, homeBoostMult, perkEffects } from './perks';
import { featureOpen } from './guide';
import type { GameState } from './state';
import { tierOf } from './unpack';

export function milestoneMult(level: number, milestones: readonly number[]): number {
  let count = 0;
  for (const m of milestones) if (level >= m) count++;
  return 2 ** count;
}

export function permMult(moves: number): number {
  return 1 + PERMANENT_MULT_PER_MOVE * moves;
}

/** 도감 배율 C = 칸 기여 x 세트 곱 x 도감 특전 */
export function collectionMult(state: GameState): number {
  return collectionMultOf(state.collection) * dexBoostMult(state);
}

/** 살림 배율 H = (1 + 0.05 x sum(칸 Lv x 2^단계)) x 살림 특전. 탭 수익에만 곱한다(상자 피해 제외) */
export function homeMult(state: GameState): number {
  let sum = 0;
  for (const lv of state.homeLv) sum += lv * 2 ** tierOf(lv);
  return (1 + HOME_MULT_PER_LV * sum) * homeBoostMult(state);
}

export function globalMult(state: GameState): number {
  return permMult(state.moves) * collectionMult(state) * homeMult(state) * feverMultOf(state.fever);
}

export interface MultBreakdown {
  /** 영구(이사) */
  permanent: number;
  collection: number;
  home: number;
  fever: number;
  /** 탭 수익 특전 */
  perk: number;
  /** 도감 세트 효과(탭 수익 세트). perk에는 포함하지 않는다 */
  set: number;
  /** 위 항목의 곱 = tapValue/기본 */
  total: number;
}

/** 배율 분해. target은 'tap'만 쓴다. 치명타는 별도(perkEffects.critChance). collection은 세트 곱을 뺀 도감 몫 */
export function multBreakdown(state: GameState, _target: 'tap'): MultBreakdown {
  const setM = setEffects(state).dexMult;
  const b = {
    permanent: permMult(state.moves),
    collection: collectionMult(state) / setM,
    home: homeMult(state),
    fever: feverMultOf(state.fever),
    perk: perkEffects(state).tapMult,
    set: setM,
  };
  return { ...b, total: b.permanent * b.collection * b.home * b.fever * b.perk * b.set };
}

export function nextMilestone(level: number, milestones: readonly number[]): number | null {
  for (const m of milestones) if (level < m) return m;
  return null;
}

export function tapCost(level: number): number {
  return TAP_BASE_COST * TAP_COST_RATE ** level;
}

export function strikeCost(level: number): number {
  return STRIKE_BASE_COST * STRIKE_COST_RATE ** level;
}

/** 강타·급소 탭 수에 곱하는 배율 */
export function strikeMult(level: number): number {
  return 1 + STRIKE_MULT_PER_LEVEL * level;
}

export function tapBase(level: number): number {
  return (1 + level) * milestoneMult(level, TAP_MILESTONES);
}

/** 피버를 뺀 탭 1회 값 = tapBase x 영구 x 도감 x 살림 x 탭 특전 x 0.6. 상자 가격·택배의 기준 */
export function tapStable(state: GameState): number {
  return tapBase(state.tapLevel) * permMult(state.moves) * collectionMult(state) * homeMult(state) * perkEffects(state).tapMult * TAP_BOX_SCALE;
}

export interface TapBreakdown {
  /** 피버를 뺀 탭 1회 값(tapStable) */
  flat: number;
  /** 피버까지 곱한 탭 1회 값 = tapValue */
  total: number;
}

export function tapBreakdown(state: GameState): TapBreakdown {
  const flat = tapStable(state);
  return { flat, total: flat * feverMultOf(state.fever) };
}

/** 탭 1회 수익(치명타 제외). damped(초당 6회 초과 탭)면 x0.3 */
export function tapValue(state: GameState, damped = false): number {
  return tapStable(state) * feverMultOf(state.fever) * (damped ? DAMPED_RATIO : 1);
}

export function buyTapUpgrade(state: GameState): GameState | null {
  const cost = tapCost(state.tapLevel);
  if (!Number.isFinite(cost) || cost > state.points) return null;
  return { ...state, points: state.points - cost, tapLevel: state.tapLevel + 1 };
}

export function buyStrikeUpgrade(state: GameState): GameState | null {
  if (!featureOpen(state, 'chain')) return null;
  const cost = strikeCost(state.strikeLevel);
  if (!Number.isFinite(cost) || cost > state.points) return null;
  return { ...state, points: state.points - cost, strikeLevel: state.strikeLevel + 1 };
}

export function applyTap(state: GameState, damped = false): GameState {
  const v = tapValue(state, damped);
  return {
    ...state,
    points: state.points + v,
    earned: state.earned + v,
    stats: { ...state.stats, totalTaps: state.stats.totalTaps + 1, totalEarned: state.stats.totalEarned + v },
  };
}

/** rng는 택배 상자(60~120초) 타이머 재설정에만 쓰인다. 없으면 중간값 고정. */
export function tick(state: GameState, dt: number, rng?: () => number): GameState {
  if (!(dt > 0)) return state;
  return {
    ...state,
    fever: advanceFever(state.fever, dt),
    parcel: advanceParcel(state.parcel, dt, rng, perkEffects(state).parcelDelayScale),
    unpack: state.unpack.rushSec > 0 ? { ...state.unpack, rushSec: Math.max(0, state.unpack.rushSec - dt) } : state.unpack,
    stats: { ...state.stats, playSec: state.stats.playSec + dt },
  };
}

export interface TapGateState {
  /** 최근 1초 안에 접수된 탭 시각(ms) */
  recent: number[];
  /** 전액 탭 허용량(0~TAPS_PER_SEC_FULL). 초당 TAPS_PER_SEC_FULL개씩 연속으로 다시 찬다 */
  tokens: number;
  lastMs: number;
}

export interface TapGate extends TapGateState {
  /** 접수 여부. 초당 TAPS_PER_SEC_ACCEPT 초과면 false(탭 통째로 무시) */
  ok: boolean;
  /** 감쇠된 탭: 접수는 되지만 전액 허용량이 없어 기본값 몫만 받는다 */
  damped: boolean;
}

export const initialTapGate = (): TapGateState => ({ recent: [], tokens: TAPS_PER_SEC_FULL, lastMs: 0 });

export function tapGate(gate: TapGateState, nowMs: number): TapGate {
  const tokens = Math.min(TAPS_PER_SEC_FULL, gate.tokens + (Math.max(0, nowMs - gate.lastMs) / 1000) * TAPS_PER_SEC_FULL);
  const live = gate.recent.filter((t) => t > nowMs - 1000);
  if (live.length >= TAPS_PER_SEC_ACCEPT) return { ok: false, damped: false, recent: live, tokens, lastMs: nowMs };
  live.push(nowMs);
  const full = tokens >= 1;
  return { ok: true, damped: !full, recent: live, tokens: full ? tokens - 1 : tokens, lastMs: nowMs };
}
