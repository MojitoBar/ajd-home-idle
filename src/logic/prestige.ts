import { permMult } from './economy';
import { houseInfo } from './house';
import { initialFever } from './fever';
import { rollPerkOffer, seededRng } from './perks';
import { initialUnpack, type GameState } from './state';
import { rollSalt } from './unpack';

export { houseInfo, type HouseInfo } from './house';

export type MoveBlock = 'target';

export interface MoveStatus {
  /** 이사 가능(목표 달성) */
  ok: boolean;
  /** 막힌 사유 */
  reason: MoveBlock | null;
  targetReached: boolean;
}

export function moveStatus(state: GameState): MoveStatus {
  const targetReached = state.earned >= houseInfo(state.moves).target;
  return { ok: targetReached, reason: targetReached ? null : 'target', targetReached };
}

/** 목표 달성일 때만 true */
export function canMove(state: GameState): boolean {
  return moveStatus(state).ok;
}

export function moveProgress(state: GameState): number {
  return Math.min(1, state.earned / houseInfo(state.moves).target);
}

/** rng는 특전 3택 추첨용. 생략하면 이사 횟수 기반 결정적 시드. */
export function move(state: GameState, rng?: () => number): GameState | null {
  if (!canMove(state)) return null;
  const r = rng ?? seededRng(state.moves * 7919 + 13);
  const offer = rollPerkOffer(state.perks, r);
  return {
    ...state,
    points: 0,
    earned: 0,
    moves: state.moves + 1,
    tapLevel: 0,
    strikeLevel: 0,
    boxesThisRun: 0,
    perkOffers: offer.length > 0 ? [...state.perkOffers, offer] : state.perkOffers,
    fever: initialFever(),
    unpack: initialUnpack(rollSalt(r)),
  };
}

export function permMultAfterMove(state: GameState): number {
  return permMult(state.moves + 1);
}
