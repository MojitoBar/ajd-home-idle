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
 * 집 시간의 대략 15·30·50·70·85%에 오도록 시뮬(현실 정책, 원형 4개 덱 x 시드 10개)의 집별 누적 P 곡선 중앙값에서 잡은 값이다. 3단계에서 목표가 `houseTarget`(보정 목표)로 바뀌고 덱 배율이 곡선을 바꿔 다시 잡았다(이전 값은 2단계 기록)(`DECK=정밀,연쇄,특별,피버`가 후보를 출력한다). 집마다 곡선이 달라 행이 따로다.
 */
export const DECK_MARK_DIGITS: readonly (readonly number[])[] = [
  [4.0, 2.75, 1.45, 0.8, 0.35],
  [3.85, 2.78, 1.3, 0.68, 0.32],
  [3.05, 2.08, 1.03, 0.52, 0.26],
  [3.17, 2.35, 1.08, 0.52, 0.24],
  [2.87, 1.68, 0.8, 0.41, 0.18],
];

/** 카드 배수 상한(★1 x4, ★ 하나당 +1) = 이 값 + ★ */
export const CARD_MULT_CAP_BASE = 3;
/** 충전 필요 눈금(희귀도별 첫 값). 지금 카드는 전부 일반으로 본다(`cardChargeNeed`) */
export const CARD_CHARGE_NEED: Record<CardRarity, number> = { common: 40, rare: 50, legend: 60 };
/** 집 길이 보정: 행은 이사 횟수 0~5(6 이상은 마지막 행). 필요 눈금 = `CARD_CHARGE_NEED` x 이 값. 시뮬로 맞춘 값(DESIGN-DECK.md 3단계 기록) */
export const CHARGE_NEED_SCALE: readonly number[] = [1, 0.35, 0.9, 1.05, 1.8, 1.05];
/** 이사할 때 `deck.targetScale`에 고정하는 집 목표 배수: 행은 새 이사 횟수 0~5(6 이상은 마지막 행). 시뮬로 집 2부터 하나씩 맞춘 값 */
export const DECK_TARGET_SCALE: readonly number[] = [1, 58, 85, 56, 112, 56];
/** 충전 조건 상수(DESIGN-DECK.md 13.3) */
export const CHARGE_RULES = {
  /** 정밀: 퍼펙트 강타 +1, 연속이 10의 배수면 +3 */
  precise: 1,
  preciseTen: 3,
  /** 연쇄: 한 강타의 per연쇄마다 +1, 강타당 최대 max */
  chainPer: 50,
  chainMax: 6,
  /** 특별: 터진 특별 상자 1개 +2 */
  special: 2,
  /** 피버: 피버 중 강타 +1, 피버가 켜질 때 +4 */
  feverStrike: 1,
  feverOn: 4,
} as const;

export function cardDef(id: string): CardDef | undefined {
  return CARDS.find((c) => c.id === id);
}
