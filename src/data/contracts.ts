export type ContractKind = 'short' | 'normal' | 'long';

export interface ContractDef {
  kind: ContractKind;
  name: string;
  sec: number;
  mult: number;
  /** 위약금 기준 금액 = 체결 시점 현재 집 이사 목표 x 이 비율 */
  penaltyRate: number;
}

export const CONTRACTS: readonly ContractDef[] = [
  { kind: 'short', name: '짧게', sec: 300, mult: 1.5, penaltyRate: 0.02 },
  { kind: 'normal', name: '보통', sec: 900, mult: 2, penaltyRate: 0.05 },
  { kind: 'long', name: '길게', sec: 3600, mult: 3, penaltyRate: 0.15 },
];

export const BASE_CONTRACT_SLOTS = 2;

/**
 * 집(이사 횟수)별 위약금 보정 계수. 후반 집은 목표 대비 수익이 훨씬 낮아(목표÷수익이 초기 집의 수십 배)
 * 같은 비율이면 위약금이 수십 분어치가 되므로 낮춘다. 시뮬레이션(tools/sim.mjs)으로 보정.
 * 표 범위를 넘는 집은 마지막 값을 쓴다(미검증).
 */
export const PENALTY_HOUSE_SCALE: readonly number[] = [1, 1, 1, 0.07, 0.02];
