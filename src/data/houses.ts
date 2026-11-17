export interface HouseDef {
  name: string;
  target: number;
  theme: string;
}

export const MOVE_TARGET_GROWTH_AFTER = 8;
export const MOON_STAGE = 4;

export const HOUSES: readonly HouseDef[] = [
  { name: '원룸', target: 3.7e15, theme: 'blue' },
  { name: '투룸', target: 9e16, theme: 'mint' },
  { name: '아파트', target: 3e19, theme: 'sunset' },
  { name: '펜트하우스', target: 1.15e21, theme: 'night' },
  { name: '달 기지', target: 2e22, theme: 'moon' },
  { name: '화성 별관', target: 1.6e23, theme: 'mars' },
  { name: '목성 위성 단지', target: 1.28e24, theme: 'jupiter' },
  { name: '은하 분양단지', target: 1.02e25, theme: 'nebula' },
  { name: '우주 끝 신도시', target: 8.2e25, theme: 'edge' },
];
