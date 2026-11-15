export interface HouseDef {
  name: string;
  target: number;
  theme: string;
}

export const MOVE_TARGET_GROWTH_AFTER = 40;
export const MOON_STAGE = 4;

export const HOUSES: readonly HouseDef[] = [
  { name: '원룸', target: 5.5e7, theme: 'blue' },
  { name: '투룸', target: 4.6e8, theme: 'mint' },
  { name: '아파트', target: 3e12, theme: 'sunset' },
  { name: '펜트하우스', target: 8e14, theme: 'night' },
  { name: '달 기지', target: 8e15, theme: 'moon' },
  { name: '화성 별관', target: 1.4e17, theme: 'mars' },
  { name: '목성 위성 단지', target: 5.6e18, theme: 'jupiter' },
  { name: '은하 분양단지', target: 2.24e20, theme: 'nebula' },
  { name: '우주 끝 신도시', target: 8.96e21, theme: 'edge' },
];
