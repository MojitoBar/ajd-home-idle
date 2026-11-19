import type { GameState } from './state';
import { HOUSES, MOVE_TARGET_GROWTH_AFTER } from '../data/houses';

export interface HouseInfo {
  stage: number;
  name: string;
  target: number;
  theme: string;
}

export function houseInfo(stage: number): HouseInfo {
  const last = HOUSES.length - 1;
  if (stage <= last) return { stage, ...HOUSES[stage] };
  const n = stage - last;
  return {
    stage,
    name: `우주 끝 신도시 ${n}차`,
    target: HOUSES[last].target * MOVE_TARGET_GROWTH_AFTER ** n,
    theme: HOUSES[last].theme,
  };
}

/** 이 집의 실제 목표: 표 값 x 이사할 때 고정한 `deck.targetScale`(첫 집은 1). 목표를 쓰는 곳은 전부 이 함수를 쓴다 */
export function houseTarget(state: Pick<GameState, 'moves' | 'deck'>): number {
  return houseInfo(state.moves).target * (state.deck?.targetScale ?? 1);
}
