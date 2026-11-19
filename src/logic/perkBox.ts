/** 특전 상자: 이번 집 목표에 비례해 가격이 오르는 살 수 있는 상자. 열면 특전 3택 묶음 1개가 대기열에 쌓인다. 영구 공구(`gear.ts`)와 같은 방식의 가격. */
import { PERK_BOX_FRAC, PERK_BOX_GROWTH } from '../data/perks';
import { featureOpen } from './guide';
import { houseTarget } from './house';
import { rollPerkOffer, seededRng } from './perks';
import type { GameState } from './state';

/** 다음 특전 상자 가격 = 이 집 목표 x PERK_BOX_FRAC x PERK_BOX_GROWTH ^ 이 집에서 산 개수 */
export function perkBoxCost(state: GameState): number {
  return houseTarget(state) * PERK_BOX_FRAC * PERK_BOX_GROWTH ** state.perkBoxBought;
}

/** 가이드의 특전 상자 단계에 닿았거나 가이드가 끝났나 */
export function perkBoxUnlocked(state: GameState): boolean {
  return featureOpen(state, 'perkBox');
}

/** 살 수 있나(열려 있고 포인트가 충분) */
export function canBuyPerkBox(state: GameState): boolean {
  return perkBoxUnlocked(state) && state.points >= perkBoxCost(state);
}

/** 특전 상자 1개 구매: 포인트를 깎고 3택 묶음 1개를 대기열 끝에 넣는다. 잠겼거나 모자라면 null. rng를 생략하면 구매 수·탭 수 기반 결정적 시드 */
export function buyPerkBox(state: GameState, rng?: () => number): GameState | null {
  if (!canBuyPerkBox(state)) return null;
  const r = rng ?? seededRng(state.moves * 7919 + state.perkBoxBought * 104729 + state.stats.totalTaps * 31 + 29);
  const offer = rollPerkOffer(state.perks, r);
  if (offer.length === 0) return null;
  return { ...state, points: state.points - perkBoxCost(state), perkBoxBought: state.perkBoxBought + 1, perkOffers: [...state.perkOffers, offer] };
}
