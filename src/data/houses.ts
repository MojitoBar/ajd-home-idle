export interface HouseDef {
  name: string;
  target: number;
  theme: string;
}

export const MOVE_TARGET_GROWTH_AFTER = 8;
export const MOON_STAGE = 4;

export const HOUSES: readonly HouseDef[] = [
  { name: '원룸', target: 3.3e10, theme: 'blue' },
  { name: '투룸', target: 1.5e14, theme: 'mint' },
  { name: '아파트', target: 3e17, theme: 'sunset' },
  { name: '펜트하우스', target: 4e19, theme: 'night' },
  { name: '달 기지', target: 5e21, theme: 'moon' },
  { name: '화성 별관', target: 5e22, theme: 'mars' },
  { name: '목성 위성 단지', target: 5e23, theme: 'jupiter' },
  { name: '은하 분양단지', target: 5e24, theme: 'nebula' },
  { name: '우주 끝 신도시', target: 5e25, theme: 'edge' },
];
