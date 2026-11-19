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
}

/** 1단계 카드 4장(DESIGN-DECK.md 5절 P2·C1·P3·C3). 뒤 단계 카드는 그 단계에서 더한다 */
export const CARDS: readonly CardDef[] = [
  { id: 'P2', name: '먹줄 튕기기', rarity: 'rare', tags: ['precise'], desc: '연속 퍼펙트 계수 +0.25', icon: 'perk-streak_coef', streakBonus: 0.25 },
  { id: 'C1', name: '긴 빠루', rarity: 'common', tags: ['chain'], desc: '연쇄 보너스 상한 +30', icon: 'tool/crowbar', chainCapAdd: 30 },
  { id: 'P3', name: '줄자 감기', rarity: 'common', tags: ['precise'], desc: '연속 퍼펙트가 10의 배수인 강타의 탭 수 x3', icon: 'tool/cutter', streakEvery: { every: 10, mult: 3 } },
  { id: 'C3', name: '줄줄이 짐', rarity: 'common', tags: ['chain'], desc: '한 강타의 100연쇄마다 탭 1회 x20', icon: 'bundle', chainEvery: { per: 100, taps: 20 } },
];

export const CARD_OFFER_SIZE = 3;
/** 이 집에서 3택 묶음을 받는 진행 문턱 수(이사 직후 1회 + 진행 문턱 5곳) */
export const DECK_MARKS = 6;
/**
 * 진행 문턱(k=1..5)이 목표보다 몇 자릿수 아래인지(`earned >= target x 10^(-d)`). 행은 이사 횟수 1~5(6 이상은 마지막 행), 열은 k.
 * 집 시간의 대략 15·30·50·70·85%에 오도록 시뮬(현실 정책, 카드 안 고름)의 집별 누적 P 곡선에서 잡은 값이다. 집마다 곡선이 달라 행이 따로다.
 */
export const DECK_MARK_DIGITS: readonly (readonly number[])[] = [
  [2.05, 1.46, 0.91, 0.6, 0.25],
  [2.4, 1.78, 1.2, 0.82, 0.32],
  [1.68, 1.15, 0.67, 0.36, 0.16],
  [1.65, 1.17, 0.71, 0.41, 0.23],
  [1.47, 1.08, 0.58, 0.28, 0.13],
];

export function cardDef(id: string): CardDef | undefined {
  return CARDS.find((c) => c.id === id);
}
