import { permMult } from './economy';
import { deckAfterMove } from './deck';
import { houseInfo } from './house';
import { initialFever } from './fever';
import { movePerkBoxes, rollPerkOffer, seededRng } from './perks';
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

/** 이사 보상으로 특전 상자 `movePerkBoxes(moves)`개(3택 묶음)를 준다. rng는 특전 3택 추첨용. 생략하면 이사 횟수 기반 결정적 시드. */
export function move(state: GameState, rng?: () => number): GameState | null {
  if (!canMove(state)) return null;
  const r = rng ?? seededRng(state.moves * 7919 + 13);
  const offers: string[][] = [];
  for (let i = movePerkBoxes(state.moves); i > 0; i--) {
    const offer = rollPerkOffer(state.perks, r);
    if (offer.length > 0) offers.push(offer);
  }
  return {
    ...state,
    points: 0,
    earned: 0,
    moves: state.moves + 1,
    tapLevel: 0,
    strikeLevel: 0,
    boxesThisRun: 0,
    perkOffers: [...state.perkOffers, ...offers],
    deck: deckAfterMove(state),
    perkBoxBought: 0,
    fever: initialFever(),
    unpack: initialUnpack(rollSalt(r)),
  };
}

export function permMultAfterMove(state: GameState): number {
  return permMult(state.moves + 1);
}
