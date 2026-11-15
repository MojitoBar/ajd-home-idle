import { BASE_CONTRACT_SLOTS, CONTRACTS, PENALTY_HOUSE_SCALE, type ContractDef, type ContractKind } from '../data/contracts';
import { houseInfo } from './house';
import { perkEffects } from './perks';
import type { ContractState, GameState } from './state';

export function contractDef(kind: ContractKind): ContractDef {
  return CONTRACTS.find((c) => c.kind === kind)!;
}

export function contractSlots(state: GameState): number {
  return BASE_CONTRACT_SLOTS + perkEffects(state).extraSlots;
}

export function freeContractSlots(state: GameState): number {
  return Math.max(0, contractSlots(state) - state.contracts.length);
}

export function contractOf(state: GameState, serviceIndex: number): ContractState | null {
  return state.contracts.find((c) => c.service === serviceIndex && c.remainSec > 0) ?? null;
}

/** 서비스 하나의 현재 약정 배율(없으면 1) */
export function contractMultFor(state: GameState, serviceIndex: number): number {
  const c = contractOf(state, serviceIndex);
  return c ? contractDef(c.kind).mult : 1;
}

export type ContractBlock = 'locked' | 'busy' | 'full';

/** 약정 체결 가능 여부. 레벨 0(미보유)·이미 약정 중·빈 칸 없음이면 불가. */
export function contractBlock(state: GameState, serviceIndex: number): ContractBlock | null {
  if (!(state.services[serviceIndex] >= 1)) return 'locked';
  if (contractOf(state, serviceIndex)) return 'busy';
  if (freeContractSlots(state) <= 0) return 'full';
  return null;
}

/** 위약금 기준 금액 = 현재 집 이사 목표 x 약정 종류별 비율 x 집별 보정 계수. 체결 순간에 정해진다. */
export function contractPenaltyBase(moves: number, kind: ContractKind): number {
  const scale = PENALTY_HOUSE_SCALE[Math.min(moves, PENALTY_HOUSE_SCALE.length - 1)];
  return houseInfo(moves).target * contractDef(kind).penaltyRate * scale;
}

/** 약정 하나의 현재 위약금(특전 감면 전). 남은 시간에 비례해 줄어 만료 때 0. */
export function contractPenaltyNow(c: ContractState): number {
  if (!(c.totalSec > 0)) return 0;
  return c.penaltyBase * Math.min(1, Math.max(0, c.remainSec) / c.totalSec);
}

/** 지금 이 종류의 약정을 걸면 시작하는 위약금(P, 특전 감면 적용). 화면의 미리 보기용. */
export function contractPenaltyPreview(state: GameState, kind: ContractKind): number {
  return contractPenaltyBase(state.moves, kind) * perkEffects(state).penaltyMult;
}

/** 약정 체결. 불가하면 null. 중도 해지는 없다. */
export function startContract(state: GameState, serviceIndex: number, kind: ContractKind): GameState | null {
  if (contractBlock(state, serviceIndex)) return null;
  return {
    ...state,
    contracts: [...state.contracts, { service: serviceIndex, kind, remainSec: contractDef(kind).sec, totalSec: contractDef(kind).sec, penaltyBase: contractPenaltyBase(state.moves, kind) }],
  };
}

/** 실제 시간 dt초 경과. 만료된 약정은 제거한다. */
export function advanceContracts(contracts: ContractState[], dt: number): ContractState[] {
  if (contracts.length === 0) return contracts;
  return contracts.map((c) => ({ ...c, remainSec: c.remainSec - dt })).filter((c) => c.remainSec > 0);
}

export interface ContractStatus {
  service: number;
  kind: ContractKind;
  remainSec: number;
  mult: number;
  /** 이 약정의 지금 위약금(특전 감면 적용) */
  penalty: number;
}

export function contractStatuses(state: GameState): ContractStatus[] {
  return state.contracts.map((c) => ({ service: c.service, kind: c.kind, remainSec: c.remainSec, mult: contractDef(c.kind).mult, penalty: contractPenaltyNow(c) * perkEffects(state).penaltyMult }));
}
