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
