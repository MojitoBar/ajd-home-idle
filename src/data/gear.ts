/** 공구 강화(상한 축 5종) 정의. 영구 강화라 이사해도 남는다. 비용 = 현재 집 목표 × frac × GEAR_COST_GROWTH^lv */
export type GearId = 'level' | 'helmet' | 'crowbar' | 'awl' | 'loupe';

export interface GearDef {
  id: GearId;
  name: string;
  maxLevel: number;
  /** 집 목표에 곱하는 1레벨 비용 비율 */
  frac: number;
  /** 이 집 상자를 이만큼 열었거나 이사를 한 번이라도 했으면 카드가 보인다 */
  unlockBox: number;
  /** 효과 설명(카드용) */
  desc: string;
}

export const GEAR_COST_GROWTH = 2.2;

/** 수평계: 퍼펙트 반폭 */
export const GEAR_PERFECT_HALF_BASE = 0.05;
export const GEAR_PERFECT_HALF_STEP = 0.012;
/** 구간 반폭 상한(굿 오른쪽 0.13 안쪽) */
export const GEAR_PERFECT_HALF_MAX = 0.12;
/** 안전모: 실드가 한 칸 차는 데 필요한 퍼펙트 수 */
export const SHIELD_CHARGE_PERFECTS = 8;
/** 빠루: 연쇄 보너스 상한 */
export const GEAR_CHAIN_CAP_BASE = 20;
export const GEAR_CHAIN_CAP_STEP = 10;
/** 송곳: 급소 탭 수, 등장 간격 배율 */
export const GEAR_WEAK_TAPS_BASE = 8;
export const GEAR_WEAK_TAPS_STEP = 4;
export const GEAR_WEAK_DELAY_STEP = 0.08;
/** 돋보기: 특별 상자 확률 */
export const GEAR_SPECIAL_RATE_BASE = 0.05;
export const GEAR_SPECIAL_RATE_STEP = 0.01;

export const GEARS: readonly GearDef[] = [
  { id: 'level', name: '수평계', maxLevel: 5, frac: 0.02, unlockBox: 15, desc: '퍼펙트 칸이 넓어져요' },
  { id: 'helmet', name: '안전모', maxLevel: 3, frac: 0.03, unlockBox: 45, desc: '틀려도 연속 퍼펙트를 지켜 줘요' },
  { id: 'crowbar', name: '빠루', maxLevel: 5, frac: 0.02, unlockBox: 35, desc: '연쇄 보너스가 더 오래 올라가요' },
  { id: 'awl', name: '송곳', maxLevel: 5, frac: 0.015, unlockBox: 55, desc: '급소가 더 세고 더 자주 떠요' },
  { id: 'loupe', name: '돋보기', maxLevel: 5, frac: 0.02, unlockBox: 25, desc: '특별 상자가 더 자주 나와요' },
];

export const GEAR_IDS: readonly GearId[] = GEARS.map((g) => g.id);

export function gearDef(id: GearId): GearDef {
  return GEARS.find((g) => g.id === id)!;
}
