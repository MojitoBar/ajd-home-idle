export const TAP_MILESTONES = [10, 25, 50, 100, 150, 200, 300, 400];
export const TAP_BASE_COST = 20;
export const TAP_COST_RATE = 1.25;
/** 강타 힘 강화(무한 레벨): 비용 = BASE x RATE^레벨, 강타·급소 탭 수 배율 = 1 + PER_LEVEL x 레벨 */
export const STRIKE_BASE_COST = 60;
export const STRIKE_COST_RATE = 1.3;
export const STRIKE_MULT_PER_LEVEL = 0.2;
/** 초당 이 횟수까지는 탭 수익 전액 */
export const TAPS_PER_SEC_FULL = 6;
/** 초당 이 횟수까지 탭을 받는다. FULL을 넘는 탭은 DAMPED_RATIO만, 이 횟수를 넘으면 무시 */
export const TAPS_PER_SEC_ACCEPT = 12;
export const PERMANENT_MULT_PER_MOVE = 1.5;
/** 탭 1회 P에 곱하는 바깥 배율. 덜어 낸 몫은 상자가 터질 때 몰아서 준다(src/data/unpack.ts) */
export const TAP_BOX_SCALE = 0.6;
/** 감쇠 탭(초당 TAPS_PER_SEC_FULL 초과)이 받는 비율 */
export const DAMPED_RATIO = 0.3;
/** 살림 배율: 칸 레벨 합(단계마다 2배 가중)당 가산 */
export const HOME_MULT_PER_LV = 0.05;
