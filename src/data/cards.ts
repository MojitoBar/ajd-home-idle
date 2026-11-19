export type CardRarity = 'common' | 'rare' | 'legend';
/** 빌드 축(DESIGN-DECK.md 4절). 이중 태그 카드는 두 태그 모두에 센다 */
export type CardTag = 'precise' | 'chain' | 'special' | 'rush' | 'fever';

export interface CardDef {
  id: string;
  name: string;
  rarity: CardRarity;
  tags: readonly CardTag[];
  /** 효과 설명(★1) */
  desc: string;
  /** 기존 아이콘 이름 재사용 */
  icon: string;
  /** 상시: 연속 퍼펙트 배수 계수에 더하는 값 */
  streakBonus?: number;
  /** 상시: 연쇄 보너스 상한에 더하는 값 */
  chainCapAdd?: number;
  /** [발동] 연속 퍼펙트(이번 강타 포함)가 every의 배수인 퍼펙트 강타의 탭 수에 곱하는 배율 */
  streakEvery?: { every: number; mult: number };
  /** [발동] 한 강타의 연쇄 per개마다 탭 1회 x taps를 보상으로 준다 */
  chainEvery?: { per: number; taps: number };
  /** 상시: 퍼펙트 구간 반폭에 더하는 값(상한 `DECK_PERFECT_HALF_HARD_MAX`) */
  perfectHalfAdd?: number;
  /** 상시: 급소 한 방 탭 수에 곱하는 배율 */
  weakTapsMult?: number;
  /** 상시: 급소 다음 등장 간격에 곱하는 배율 */
  weakDelayMult?: number;
  /** 상시: 황금 상자 보상 배율에 더하는 값(기본 10) */
  goldMultAdd?: number;
  /** 상시: 특별 상자 확률에 곱하는 배율 */
  specialRateMult?: number;
  /** 상시: 피버 게이지 충전 배율에 더하는 값 */
  feverChargeAdd?: number;
  /** 상시: 피버 지속 시간에 더하는 초 */
  feverSecAdd?: number;
  /** [발동] 한 강타에서 황금 상자가 min개 이상이면 황금 수 x 탭 1회 x taps를 보상으로 준다 */
  goldEvery?: { min: number; taps: number };
  /** [발동] 피버 중 퍼펙트 강타마다 피버 시간 +sec초 */
  feverPerfectSec?: number;
}

/** 퍼펙트 구간 반폭의 고정 상한(수평계·P1·뒤 단계의 ★·공명과 상관없이. 굿 반폭 0.13보다 작다) */
export const DECK_PERFECT_HALF_HARD_MAX = 0.125;

/** 2단계까지의 카드 12장(DESIGN-DECK.md 5절). 뒤 단계 카드는 그 단계에서 더한다 */
export const CARDS: readonly CardDef[] = [
  { id: 'P2', name: '먹줄 튕기기', rarity: 'rare', tags: ['precise'], desc: '연속 퍼펙트 계수 +0.3', icon: 'perk-streak_coef', streakBonus: 0.3 },
  { id: 'C1', name: '긴 빠루', rarity: 'common', tags: ['chain'], desc: '연쇄 보너스 상한 +30', icon: 'tool/crowbar', chainCapAdd: 30 },
  { id: 'P3', name: '줄자 감기', rarity: 'common', tags: ['precise'], desc: '연속 퍼펙트가 10의 배수인 강타의 탭 수 x3', icon: 'tool/cutter', streakEvery: { every: 10, mult: 3 } },
  { id: 'C3', name: '줄줄이 짐', rarity: 'common', tags: ['chain'], desc: '한 강타의 100연쇄마다 탭 1회 x30', icon: 'bundle', chainEvery: { per: 100, taps: 30 } },
  { id: 'P1', name: '수평 맞추기', rarity: 'common', tags: ['precise'], desc: '퍼펙트 반폭 +0.01(상한 0.125)', icon: 'tool/level', perfectHalfAdd: 0.01 },
  { id: 'C4', name: '뚫어뻥', rarity: 'rare', tags: ['chain'], desc: '급소 탭 수 +50%, 급소 간격 x0.85', icon: 'tool/awl', weakTapsMult: 1.5, weakDelayMult: 0.85 },
  { id: 'S1', name: '금박 포장지', rarity: 'common', tags: ['special'], desc: '황금 배율 10 -> 25', icon: 'box/gold-small-1', goldMultAdd: 15 },
  { id: 'S3', name: '눈썰미', rarity: 'common', tags: ['special'], desc: '특별 상자 확률 x1.7', icon: 'tool/magnifier', specialRateMult: 1.7 },
  { id: 'S4', name: '황금 손잡이', rarity: 'rare', tags: ['special'], desc: '한 강타에서 황금 상자 3개 이상이면 황금 수 x 탭 1회 x150', icon: 'coin-pile', goldEvery: { min: 3, taps: 150 } },
  { id: 'F1', name: '불쏘시개', rarity: 'common', tags: ['fever'], desc: '피버 게이지 충전 +50%', icon: 'perk-fever_charge', feverChargeAdd: 0.5 },
  { id: 'F2', name: '숯불 유지', rarity: 'common', tags: ['fever'], desc: '피버 +8초', icon: 'fever', feverSecAdd: 8 },
  { id: 'F3', name: '풀무질', rarity: 'rare', tags: ['fever', 'precise'], desc: '피버 중 퍼펙트 강타마다 피버 +2초', icon: 'tool/hammer', feverPerfectSec: 2 },
];

export const CARD_OFFER_SIZE = 3;
/** 이 집에서 3택 묶음을 받는 진행 문턱 수(이사 직후 1회 + 진행 문턱 5곳) */
export const DECK_MARKS = 6;
/**
 * 진행 문턱(k=1..5)이 목표보다 몇 자릿수 아래인지(`earned >= target x 10^(-d)`). 행은 이사 횟수 1~5(6 이상은 마지막 행), 열은 k.
 * 집 시간의 대략 15·30·50·70·85%에 오도록 시뮬(현실 정책, 원형 4개 덱 x 시드 20개)의 집별 누적 P 곡선 중앙값에서 잡은 값이다(`DECK=정밀,연쇄,특별,피버`가 후보를 출력한다). 집마다 곡선이 달라 행이 따로다.
 */
export const DECK_MARK_DIGITS: readonly (readonly number[])[] = [
  [2.33, 1.66, 1.02, 0.54, 0.27],
  [2.48, 1.83, 1.25, 0.77, 0.33],
  [1.73, 1.2, 0.72, 0.39, 0.19],
  [1.65, 1.18, 0.74, 0.4, 0.21],
  [1.52, 1.12, 0.61, 0.3, 0.14],
];

export function cardDef(id: string): CardDef | undefined {
  return CARDS.find((c) => c.id === id);
}
