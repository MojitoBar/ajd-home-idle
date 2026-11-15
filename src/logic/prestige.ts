import { SERVICES } from '../data/services';
import { permMult } from './economy';
import { houseInfo } from './house';
import { contractPenaltyNow } from './contract';
import { initialFever } from './fever';
import { rollPerkOffer, perkEffects, seededRng } from './perks';
import { initialUnpack, type GameState } from './state';

export { houseInfo, type HouseInfo } from './house';

/** 약정 중도 이사 위약금(P) = Σ 기준 금액 x (남은 초 / 전체 기간) x 특전 감면. 서비스 레벨·수익과 무관해 늘지 않는다. */
export function contractPenalty(state: GameState): number {
  if (state.contracts.length === 0) return 0;
  let sum = 0;
  for (const c of state.contracts) sum += contractPenaltyNow(c);
  return sum * perkEffects(state).penaltyMult;
}

export type MoveBlock = 'target' | 'penalty';

export interface MoveStatus {
  /** 이사 가능(목표 달성 && 위약금 이하 보유) */
  ok: boolean;
  /** 막힌 사유. 목표 미달이 우선 */
  reason: MoveBlock | null;
  targetReached: boolean;
  penalty: number;
  /** 위약금 부족분(0이면 충분) */
  penaltyShortfall: number;
}

export function moveStatus(state: GameState): MoveStatus {
  const targetReached = state.earned >= houseInfo(state.moves).target;
  const penalty = contractPenalty(state);
  const penaltyShortfall = Math.max(0, penalty - state.points);
  const reason: MoveBlock | null = !targetReached ? 'target' : penaltyShortfall > 0 ? 'penalty' : null;
  return { ok: reason === null, reason, targetReached, penalty, penaltyShortfall };
}

/** 목표 달성 + 위약금 지불 가능일 때만 true */
export function canMove(state: GameState): boolean {
  return moveStatus(state).ok;
}

export function moveProgress(state: GameState): number {
  return Math.min(1, state.earned / houseInfo(state.moves).target);
}

/** rng는 특전 3택 추첨용. 생략하면 이사 횟수 기반 결정적 시드. */
export function move(state: GameState, rng?: () => number): GameState | null {
  if (!canMove(state)) return null;
  const offer = rollPerkOffer(state.perks, rng ?? seededRng(state.moves * 7919 + 13));
  return {
    ...state,
    points: 0,
    earned: 0,
    moves: state.moves + 1,
    tapLevel: 0,
    services: SERVICES.map(() => 0),
    boxesThisRun: 0,
    contracts: [],
    perkOffers: offer.length > 0 ? [...state.perkOffers, offer] : state.perkOffers,
    fever: initialFever(),
    unpack: initialUnpack(),
    event: { ...state.event, remainSec: 0, bannerSec: 0, question: null, questionSec: 0, result: null },
  };
}

export function permMultAfterMove(state: GameState): number {
  return permMult(state.moves + 1);
}
