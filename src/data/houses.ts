export interface HouseDef {
  name: string;
  target: number;
  theme: string;
}

export const MOVE_TARGET_GROWTH_AFTER = 8;
export const MOON_STAGE = 4;

export const HOUSES: readonly HouseDef[] = [
  { name: '원룸', target: 2.4e10, theme: 'blue' },
  { name: '투룸', target: 2.5e12, theme: 'mint' },
  { name: '아파트', target: 1e15, theme: 'sunset' },
  { name: '펜트하우스', target: 1e17, theme: 'night' },
  { name: '달 기지', target: 1.2e19, theme: 'moon' },
  { name: '화성 별관', target: 1.2e20, theme: 'mars' },
  { name: '목성 위성 단지', target: 1.2e21, theme: 'jupiter' },
  { name: '은하 분양단지', target: 1.2e22, theme: 'nebula' },
  { name: '우주 끝 신도시', target: 1.2e23, theme: 'edge' },
];
