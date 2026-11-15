import {
  TAPS_PER_SEC_ACCEPT,
  TAPS_PER_SEC_FULL,
  PERMANENT_MULT_PER_MOVE,
  SERVICES,
  SERVICE_MILESTONES,
  TAP_BASE_COST,
  TAP_COST_RATE,
  TAP_RATIO_BASE,
  TAP_RATIO_MILESTONE_BONUS,
  TAP_RATIO_PER_LEVEL,
  TAP_MILESTONES,
  TAP_BOX_SCALE,
} from '../data/services';
import { bundleMultFor } from './bundle';
import { collectionMultOf, setEffects } from './collection';
import { advanceContracts, contractMultFor } from './contract';
import { advanceEvent, eventMultOf } from './event';
import { advanceFever, advanceParcel, feverMultOf } from './fever';
import { perkEffects } from './perks';
import type { GameState } from './state';

export function milestoneMult(level: number, milestones: readonly number[]): number {
  let count = 0;
  for (const m of milestones) if (level >= m) count++;
  return 2 ** count;
}

export function permMult(moves: number): number {
  return 1 + PERMANENT_MULT_PER_MOVE * moves;
}

export function collectionMult(state: GameState): number {
  return collectionMultOf(state.collection);
}

export function eventMult(state: GameState): number {
  return eventMultOf(state.event);
}

export function globalMult(state: GameState): number {
  return permMult(state.moves) * collectionMult(state) * eventMult(state) * feverMultOf(state.fever);
}

export function serviceCost(index: number, level: number): number {
  const s = SERVICES[index];
  return s.baseCost * s.costRate ** level;
}

export function serviceBaseProd(index: number, level: number): number {
  return SERVICES[index].baseProd * level * milestoneMult(level, SERVICE_MILESTONES);
}

/** 영구·도감·결합·특전만 반영한 서비스 배율(일시 배율·약정 제외). */
function serviceStableMult(state: GameState, index: number): number {
  return permMult(state.moves) * collectionMult(state) * bundleMultFor(state, index) * perkEffects(state).serviceMult;
}

/** 약정을 뺀 서비스 수익(초당). 피버·이벤트 포함. */
export function serviceProdNoContract(state: GameState, index: number): number {
  return (
    serviceBaseProd(index, state.services[index]) *
    serviceStableMult(state, index) *
    eventMult(state) *
    feverMultOf(state.fever)
  );
}

export function serviceProd(state: GameState, index: number): number {
  return serviceProdNoContract(state, index) * contractMultFor(state, index);
}

/** 약정으로 늘어난 서비스 수익(초당) = 약정 포함 - 약정 제외 */
export function contractExtraPps(state: GameState, index: number): number {
  return serviceProd(state, index) - serviceProdNoContract(state, index);
}

export function pps(state: GameState): number {
  let sum = 0;
  for (let i = 0; i < SERVICES.length; i++) sum += serviceProd(state, i);
  return sum;
}

/** 약정을 뺀 초당 수익(오프라인·tick 계산용) */
export function ppsNoContract(state: GameState): number {
  let sum = 0;
  for (let i = 0; i < SERVICES.length; i++) sum += serviceProdNoContract(state, i);
  return sum;
}

/** 일시 배율(피버·이벤트 E·약정)을 뺀 기본 초당 수익. 상자 가격 기준. */
export function ppsStable(state: GameState): number {
  let sum = 0;
  for (let i = 0; i < SERVICES.length; i++) sum += serviceBaseProd(i, state.services[i]) * serviceStableMult(state, i);
  return sum;
}

export interface MultBreakdown {
  /** 영구(이사) */
  permanent: number;
  collection: number;
  event: number;
  fever: number;
  /** 결합(서비스 대상일 때만, 탭은 1) */
  bundle: number;
  /** 약정(서비스 대상일 때만, 탭은 1) */
  contract: number;
  /** 특전(서비스 대상이면 서비스 수익 특전, 탭이면 탭 수익 특전) */
  perk: number;
  /** 도감 세트 효과(서비스면 서비스 수익 세트, 탭이면 탭 수익 세트). perk에는 포함하지 않는다 */
  set: number;
  /** 위 항목의 곱 = 서비스 수익이면 serviceProd/기본, 탭이면 tapValue/기본 */
  total: number;
}

/** 배율 분해. target은 서비스 인덱스 또는 'tap'. 치명타는 별도(perkEffects.critChance). */
export function multBreakdown(state: GameState, target: number | 'tap'): MultBreakdown {
  const e = perkEffects(state);
  const isTap = target === 'tap';
  const set = setEffects(state);
  const setM = isTap ? set.tapMult : set.serviceMult;
  const b = {
    permanent: permMult(state.moves),
    collection: collectionMult(state),
    event: eventMult(state),
    fever: feverMultOf(state.fever),
    bundle: isTap ? 1 : bundleMultFor(state, target),
    contract: isTap ? 1 : contractMultFor(state, target),
    perk: (isTap ? e.tapMult : e.serviceMult) / setM,
    set: setM,
  };
  return { ...b, total: b.permanent * b.collection * b.event * b.fever * b.bundle * b.contract * b.perk * b.set };
}

export function isUnlocked(state: GameState, index: number): boolean {
  return index === 0 || state.services[index - 1] >= 1;
}

export function nextMilestone(level: number, milestones: readonly number[]): number | null {
  for (const m of milestones) if (level < m) return m;
  return null;
}

export function bulkCost(index: number, level: number, count: number): number {
  const s = SERVICES[index];
  const r = s.costRate;
  return (s.baseCost * r ** level * (r ** count - 1)) / (r - 1);
}

export function maxAffordable(index: number, level: number, points: number): number {
  const s = SERVICES[index];
  const r = s.costRate;
  const first = s.baseCost * r ** level;
  if (!(points >= first)) return 0;
  let n = Math.floor(Math.log(1 + (points * (r - 1)) / first) / Math.log(r));
  while (n > 0 && bulkCost(index, level, n) > points) n--;
  while (bulkCost(index, level, n + 1) <= points) n++;
  return n;
}

export function tapCost(level: number): number {
  return TAP_BASE_COST * TAP_COST_RATE ** level;
}

export function tapBase(level: number): number {
  return (1 + level) * milestoneMult(level, TAP_MILESTONES);
}

/** 탭 비율: 레벨 L에서 탭 1회가 (기본값 외에) 더 버는 초당 수익(ppsStable) 배수. 레벨에 선형 + 마일스톤 가산(곱 아님). */
export function tapRatio(level: number): number {
  let r = TAP_RATIO_BASE + TAP_RATIO_PER_LEVEL * level;
  TAP_MILESTONES.forEach((m, i) => {
    if (level >= m) r += TAP_RATIO_MILESTONE_BONUS[i] ?? 0;
  });
  return r;
}

export function nextTapRatio(level: number): number {
  return tapRatio(level + 1);
}

/**
 * 탭 1회 수익 = (기본값 몫 + 비율 몫) x 탭 특전 x 이벤트 x 피버. 치명타 제외.
 * 기본값 몫 = tapBase x 영구 x 도감, 비율 몫 = tapRatio x ppsStable(영구·도감·결합만 포함, 서비스 특전·피버·이벤트·약정 제외).
 * 피버·이벤트는 끝에서 한 번만 곱하고, 약정은 탭 몫에 넣지 않는다.
 */
export interface TapBreakdown {
  level: number;
  ratio: number;
  /** 기본값 몫(탭 특전·이벤트·피버 적용 후) */
  flat: number;
  /** 초당 수익 몫(같은 배율 적용 후) */
  fromPps: number;
  total: number;
}

export function tapBreakdown(state: GameState): TapBreakdown {
  const level = state.tapLevel;
  const ratio = tapRatio(level);
  const outer = perkEffects(state).tapMult * eventMult(state) * feverMultOf(state.fever) * TAP_BOX_SCALE;
  const flat = tapBase(level) * permMult(state.moves) * collectionMult(state) * outer;
  const fromPps = ratio * (ppsStable(state) / perkEffects(state).serviceMult) * outer;
  return { level, ratio, flat, fromPps, total: flat + fromPps };
}

/** damped(초당 6회 초과 탭)면 초당 수익 비례 몫 없이 기본값 몫만 */
export function tapValue(state: GameState, damped = false): number {
  const b = tapBreakdown(state);
  return damped ? b.flat : b.total;
}

/** 탭 1회 수익 중 서비스 없이도 얻는 기본값 몫(택배 상자 최소 보장 기준) */
export function tapFlatValue(state: GameState): number {
  return tapBreakdown(state).flat;
}

export function buyService(state: GameState, index: number, count: number): GameState | null {
  if (count < 1 || !isUnlocked(state, index)) return null;
  const cost = bulkCost(index, state.services[index], count);
  if (!Number.isFinite(cost) || cost > state.points) return null;
  const services = state.services.slice();
  services[index] += count;
  return { ...state, points: state.points - cost, services };
}

export function buyTapUpgrade(state: GameState): GameState | null {
  const cost = tapCost(state.tapLevel);
  if (!Number.isFinite(cost) || cost > state.points) return null;
  return { ...state, points: state.points - cost, tapLevel: state.tapLevel + 1 };
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

/** rng는 이벤트(8~12분)·택배 상자(60~120초) 타이머 재설정에만 쓰인다. 없으면 중간값 고정. */
export function tick(state: GameState, dt: number, rng?: () => number): GameState {
  if (!(dt > 0)) return state;
  let gain = ppsNoContract(state) * dt;
  for (const c of state.contracts) gain += contractExtraPps(state, c.service) * Math.min(dt, Math.max(0, c.remainSec));
  return {
    ...state,
    event: advanceEvent(state.event, dt, rng),
    fever: advanceFever(state.fever, dt),
    parcel: advanceParcel(state.parcel, dt, rng, perkEffects(state).parcelDelayScale),
    contracts: advanceContracts(state.contracts, dt),
    points: state.points + gain,
    earned: state.earned + gain,
    stats: { ...state.stats, totalEarned: state.stats.totalEarned + gain, playSec: state.stats.playSec + dt },
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
