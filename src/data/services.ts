export interface ServiceDef {
  id: string;
  name: string;
  emoji: string;
  baseCost: number;
  costRate: number;
  baseProd: number;
}

export const SERVICES: readonly ServiceDef[] = [
  { id: 'internet', name: '인터넷', emoji: '', baseCost: 15, costRate: 1.15, baseProd: 0.5 },
  { id: 'water', name: '정수기', emoji: '', baseCost: 120, costRate: 1.15, baseProd: 4 },
  { id: 'air', name: '공기청정기', emoji: '', baseCost: 1300, costRate: 1.15, baseProd: 30 },
  { id: 'phone', name: '휴대폰', emoji: '', baseCost: 15000, costRate: 1.15, baseProd: 220 },
  { id: 'clean', name: '청소', emoji: '', baseCost: 190000, costRate: 1.15, baseProd: 1700 },
  { id: 'interior', name: '인테리어', emoji: '', baseCost: 2.6e6, costRate: 1.15, baseProd: 14000 },
  { id: 'robot', name: '로봇청소기', emoji: '', baseCost: 4e7, costRate: 1.15, baseProd: 120000 },
  { id: 'home', name: '내 집 마련 상담', emoji: '', baseCost: 7e8, costRate: 1.15, baseProd: 1000000 },
];

export const SERVICE_MILESTONES = [10, 25, 50, 100, 200, 400];
export const TAP_MILESTONES = [10, 25, 50, 100];
export const TAP_BASE_COST = 20;
export const TAP_COST_RATE = 1.25;
/** 탭 비율(탭 1회가 현재 초당 수익의 몇 배를 더 버는가) = BASE + PER_LEVEL x 레벨 + 도달한 마일스톤마다 보너스 */
export const TAP_RATIO_BASE = 0.01;
export const TAP_RATIO_PER_LEVEL = 0.0005;
export const TAP_RATIO_MILESTONE_BONUS = [0.01, 0.02, 0.03, 0.05];
/** 초당 이 횟수까지는 탭 수익 전액(기본값 몫 + 초당 수익 비례 몫) */
export const TAPS_PER_SEC_FULL = 6;
/** 초당 이 횟수까지 탭을 받는다. FULL을 넘는 탭은 기본값 몫만, 이 횟수를 넘으면 무시 */
export const TAPS_PER_SEC_ACCEPT = 12;
export const PERMANENT_MULT_PER_MOVE = 1.5;
/** 탭 1회 P에 곱하는 바깥 배율. 덜어 낸 몫은 상자가 터질 때 몰아서 준다(src/data/unpack.ts) */
export const TAP_BOX_SCALE = 0.6;
