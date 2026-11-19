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
  /** 상시: 안전모 실드 칸 수에 더하는 값 */
  shieldAdd?: number;
  /** 상시: 실드가 한 칸 차는 데 필요한 퍼펙트 수(기본 8)를 이 값으로 줄인다 */
  shieldChargePerfects?: number;
  /** 상시: 연쇄 보너스 계수(기본 0.1)를 이 값으로 바꾼다 */
  chainStep?: number;
  /** 상시: 폭탄이 함께 터뜨리는 수(기본 5)를 이 값으로 바꾼다 */
  bombBlast?: number;
  /** 상시: 피버 배율(기본 x3)에 더하는 값 */
  feverMultAdd?: number;
  /** [발동] 퍼펙트 강타마다 탭 1회 x (연속 퍼펙트 수 x perStreak)를 보상으로 준다 */
  perfectReward?: { perStreak: number };
  /** [발동] 한 강타가 min연쇄 이상이면 다음 강타 탭 수 x mult(1회, 쌓이지 않음) */
  bigChainNext?: { min: number; mult: number };
  /** [발동] 퍼펙트 강타 every번마다 다음 일반 상자 1개를 폭탄으로 바꾼다 */
  bombEvery?: number;
  /** [발동] 피버가 끝날 때 피버 동안 터진 상자 수 x 탭 1회 x taps */
  feverEndTaps?: number;
  /** 증폭 전설: 태그가 없고, 이 카드의 상한을 올린다. tool = 꽉 찬 다른 카드 1장마다 +1, dex = 완성한 도감 세트 1개마다 +1(최대 `AMP_DEX_MAX`) */
  amp?: 'tool' | 'dex';
}

/** 퍼펙트 구간 반폭의 고정 상한(수평계·P1·뒤 단계의 ★·공명과 상관없이. 굿 반폭 0.13보다 작다) */
export const DECK_PERFECT_HALF_HARD_MAX = 0.125;

/** 5단계까지의 카드 22장(DESIGN-DECK.md 5절 + 증폭 전설 2장). 러시·양날 카드는 6단계에서 더한다 */
export const CARDS: readonly CardDef[] = [
  { id: 'P2', name: '먹줄 튕기기', rarity: 'rare', tags: ['precise'], desc: '연속 퍼펙트 계수 +0.3', icon: 'perk-streak_coef', streakBonus: 0.3 },
  { id: 'C1', name: '긴 빠루', rarity: 'common', tags: ['chain'], desc: '연쇄 보너스 상한 +30', icon: 'tool/crowbar', chainCapAdd: 30 },
  { id: 'P3', name: '줄자 감기', rarity: 'common', tags: ['precise'], desc: '연속 퍼펙트가 10의 배수인 강타의 탭 수 x3', icon: 'tool/cutter', streakEvery: { every: 10, mult: 3 } },
  { id: 'C3', name: '줄줄이 짐', rarity: 'common', tags: ['chain'], desc: '한 강타의 100연쇄마다 탭 1회 x30', icon: 'bundle', chainEvery: { per: 100, taps: 30 } },
  { id: 'P1', name: '수평 맞추기', rarity: 'common', tags: ['precise'], desc: '퍼펙트 반폭 +0.01(상한 0.125)', icon: 'tool/level', perfectHalfAdd: 0.01 },
  { id: 'C4', name: '뚫어뻥', rarity: 'rare', tags: ['chain'], desc: '급소 탭 수 +50%, 급소 간격 x0.85', icon: 'tool/awl', weakTapsMult: 1.5, weakDelayMult: 0.85 },
  { id: 'S1', name: '금박 포장지', rarity: 'common', tags: ['special'], desc: '황금 배율 10 → 25', icon: 'box/gold-small-1', goldMultAdd: 15 },
  { id: 'S3', name: '눈썰미', rarity: 'common', tags: ['special'], desc: '특별 상자 확률 x1.7', icon: 'tool/magnifier', specialRateMult: 1.7 },
  { id: 'S4', name: '황금 손잡이', rarity: 'rare', tags: ['special'], desc: '한 강타에서 황금 상자 3개 이상이면 황금 수 x 탭 1회 x150', icon: 'coin-pile', goldEvery: { min: 3, taps: 150 } },
  { id: 'F1', name: '불쏘시개', rarity: 'common', tags: ['fever'], desc: '피버 게이지 충전 +50%', icon: 'perk-fever_charge', feverChargeAdd: 0.5 },
  { id: 'F2', name: '숯불 유지', rarity: 'common', tags: ['fever'], desc: '피버 +8초', icon: 'fever', feverSecAdd: 8 },
  { id: 'P4', name: '여분 안전모', rarity: 'rare', tags: ['precise'], desc: '실드 +1칸, 실드 충전 8 → 6퍼펙트', icon: 'tool/hardhat', shieldAdd: 1, shieldChargePerfects: 6 },
  { id: 'P5', name: '장인의 호흡', rarity: 'legend', tags: ['precise'], desc: '퍼펙트 강타마다 탭 1회 x (연속 수 x 2)', icon: 'perk-tap_crit_power', perfectReward: { perStreak: 2 } },
  { id: 'C2', name: '도미노 쌓기', rarity: 'rare', tags: ['chain'], desc: '연쇄 보너스 계수 0.1 → 0.15', icon: 'box/normal-1', chainStep: 0.15 },
  { id: 'C5', name: '이삿짐 행렬', rarity: 'legend', tags: ['chain'], desc: '1,000연쇄 이상이면 다음 강타 탭 수 x2(1회)', icon: 'tool/sledge', bigChainNext: { min: 1000, mult: 2 } },
  { id: 'S2', name: '큰 폭죽', rarity: 'rare', tags: ['special', 'chain'], desc: '폭탄이 터뜨리는 상자 5개 → 8개', icon: 'box/bomb-small-1', bombBlast: 8 },
  { id: 'S5', name: '폭탄 공장', rarity: 'legend', tags: ['special', 'chain'], desc: '퍼펙트 강타 5번마다 다음 일반 상자 1개를 폭탄으로 바꿈', icon: 'box/bomb-normal-1', bombEvery: 5 },
  { id: 'F4', name: '불꽃 축제', rarity: 'rare', tags: ['fever'], desc: '피버 배율 x3 → x4', icon: 'perk-tap_power', feverMultAdd: 1 },
  { id: 'F5', name: '용광로', rarity: 'legend', tags: ['fever', 'chain'], desc: '피버가 끝날 때 피버 동안 터진 상자 수 x 탭 1회 x2', icon: 'crit', feverEndTaps: 2 },
  { id: 'A1', name: '공구 장인', rarity: 'legend', tags: [], desc: '꽉 찬 다른 카드 1장마다 이 카드 상한 +1', icon: 'tool/robot-arm', amp: 'tool' },
  { id: 'A2', name: '수집 노트', rarity: 'legend', tags: [], desc: '완성한 도감 세트 1개마다 이 카드 상한 +1(최대 +3)', icon: 'perk', amp: 'dex' },
  { id: 'F3', name: '풀무질', rarity: 'rare', tags: ['fever', 'precise'], desc: '피버 중 퍼펙트 강타마다 피버 +2초', icon: 'tool/hammer', feverPerfectSec: 2 },
];

export const CARD_OFFER_SIZE = 3;
/** 덱 칸 수(4단계. 5·6칸은 7단계) */
export const DECK_SLOTS = 4;
/** 이 집에서 고르는 횟수 = 칸 수(4) + 3(교체 기회). 이사 직후 1회 + 진행 문턱 6곳 */
export const DECK_MARKS = 7;
/**
 * 진행 문턱(k=1..6)이 목표보다 몇 자릿수 아래인지(`earned >= target x 10^(-d)`). 행은 이사 횟수 1~5(6 이상은 마지막 행), 열은 k.
 * 시뮬(현실 정책, 원형 4개 덱 x 시드 20개)의 집별 누적 P 곡선 중앙값에서 잡은 값이다. 4단계에서 4칸·문턱 6곳에 맞춰 다시 잡았다. 시점은 집 시간의 대략 9·19·31·46·63·80%(`DECK=정밀,연쇄,특별,피버`가 후보를 출력한다). 집마다 곡선이 달라 행이 따로다.
 */
export const DECK_MARK_DIGITS: readonly (readonly number[])[] = [
  [5.1, 4.07, 2.96, 1.85, 1.15, 0.53],
  [5.0, 4.27, 2.97, 1.73, 1.05, 0.49],
  [4.18, 3.43, 2.39, 1.43, 0.9, 0.48],
  [4.25, 3.57, 2.35, 1.33, 0.78, 0.35],
  [3.73, 3.15, 1.98, 1.07, 0.54, 0.26],
];

/** 카드 배수 상한(★1 x4, ★ 하나당 +1) = 이 값 + ★ */
export const CARD_MULT_CAP_BASE = 3;
/** 충전 필요 눈금(희귀도별 첫 값, `cardChargeNeed`) */
export const CARD_CHARGE_NEED: Record<CardRarity, number> = { common: 40, rare: 50, legend: 60 };
/** 집 길이 보정: 행은 이사 횟수 0~5(6 이상은 마지막 행). 필요 눈금 = `CARD_CHARGE_NEED` x 이 값. 시뮬로 맞춘 값(DESIGN-DECK.md 13.6·13.7) */
export const CHARGE_NEED_SCALE: readonly number[] = [1, 0.35, 1.27, 1.5, 4.5, 2.6];
/** 이사할 때 `deck.targetScale`에 고정하는 집 목표 배수: 행은 새 이사 횟수 0~5(6 이상은 마지막 행). 시뮬로 집 2부터 하나씩 맞춘 값 */
export const DECK_TARGET_SCALE: readonly number[] = [1, 270, 390, 330, 450, 200];
/** 뽑기 희귀도 가중치(고르기 3장 모두 따로 굴린다. 합 1). 화면에 그대로 보인다(`deckOfferOdds`) */
export const RARITY_ODDS: Record<CardRarity, number> = { common: 0.6, rare: 0.32, legend: 0.08 };
/** ★ 최대 */
export const CARD_STAR_MAX = 3;
/** 공명: 같은 태그 카드 N장일 때 그 태그 카드들의 충전 속도 배율(인덱스 = 장수, 4 이상은 마지막) */
export const RESONANCE_SPEED: readonly number[] = [1, 1, 1.5, 2, 3];
/** 수집 노트(A2)의 상한 보너스 최대 */
export const AMP_DEX_MAX = 3;
/** 충전 조건 상수(DESIGN-DECK.md 13.3) */
export const CHARGE_RULES = {
  /** 정밀: 퍼펙트 강타 +4, 연속 퍼펙트가 10의 배수면 +9 */
  precise: 4,
  preciseTen: 9,
  /** 연쇄: 한 강타의 연쇄 chainPer(150)마다 +1, 강타당 최대 chainMax(2) */
  chainPer: 150,
  chainMax: 2,
  /** 특별: 터진 특별 상자 1개 +special, 강타당 최대 specialMax */
  special: 1,
  specialMax: 1,
  /** 피버: 피버 중 강타 +1, 피버가 켜지는 강타에 +4 */
  feverStrike: 1,
  feverOn: 4,
} as const;

export function cardDef(id: string): CardDef | undefined {
  return CARDS.find((c) => c.id === id);
}
