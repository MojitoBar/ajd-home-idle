export type PerkCategory = 'tap' | 'idle' | 'luck' | 'strategy';

export interface PerkDef {
  id: string;
  name: string;
  emoji: string;
  category: PerkCategory;
  /** 한 레벨당 효과 설명 */
  desc: string;
  /** 레벨 상한. 배수 특전은 Infinity(끝없이 성장) */
  maxLevel: number;
  /** 레벨당 효과량 (perks.ts의 perkEffects가 해석) */
  per: number;
}

export const PERK_OFFER_SIZE = 3;

/** 특전 상자 가격 = 이 집 목표 x PERK_BOX_FRAC x PERK_BOX_GROWTH ^ (이번 집에서 산 개수) */
export const PERK_BOX_FRAC = 0.0025;
export const PERK_BOX_GROWTH = 2;
/** 이사 보상 특전 상자 수 = min(BASE + 이사 전 횟수, MAX) */
export const MOVE_PERK_BOXES_BASE = 2;
export const MOVE_PERK_BOXES_MAX = 5;

export const PERKS: readonly PerkDef[] = [
  { id: 'tap_power', name: '손목 단련', emoji: '', category: 'tap', desc: '탭 수익 +110%', maxLevel: Infinity, per: 1.1 },
  { id: 'crit', name: '촉이 좋은 손가락', emoji: '', category: 'tap', desc: '치명타 확률 +3%', maxLevel: 5, per: 0.03 },
  { id: 'fever_long', name: '오래가는 열기', emoji: '', category: 'tap', desc: '피버 지속 +4초', maxLevel: 4, per: 4 },
  { id: 'box_discount', name: '상자 단골 쿠폰', emoji: '', category: 'luck', desc: '상자 가격 -8%', maxLevel: 4, per: 0.08 },
  { id: 'parcel_freq', name: '택배 기사님 친구', emoji: '', category: 'luck', desc: '택배 상자 등장 간격 -15%', maxLevel: 3, per: 0.15 },
  { id: 'home_boost', name: '살림 장인', emoji: '', category: 'strategy', desc: '살림 배율 +25%', maxLevel: Infinity, per: 0.25 },
  { id: 'dex_boost', name: '도감 수집가', emoji: '', category: 'strategy', desc: '도감 배율 +25%', maxLevel: Infinity, per: 0.25 },
  { id: 'tap_crit_power', name: '대박 한 방', emoji: '', category: 'tap', desc: '치명타 배율 +1 (기본 x6)', maxLevel: 3, per: 1 },
  { id: 'strike_power', name: '강타 단련', emoji: '', category: 'tap', desc: '강타·급소 수익 +30%', maxLevel: Infinity, per: 0.3 },
  { id: 'streak_coef', name: '손에 익은 리듬', emoji: '', category: 'tap', desc: '연속 퍼펙트 배수 +0.1씩 더 붙어요', maxLevel: 5, per: 0.1 },
  { id: 'special_freq', name: '특별 상자 단골', emoji: '', category: 'luck', desc: '특별 상자가 +25% 더 자주 나와요', maxLevel: 4, per: 0.25 },
  { id: 'fever_charge', name: '불씨 모으기', emoji: '', category: 'tap', desc: '피버 게이지 충전 +15%', maxLevel: 5, per: 0.15 },
];
