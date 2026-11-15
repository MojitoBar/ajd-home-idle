export type Rarity = 'common' | 'rare' | 'epic' | 'legend' | 'myth';
export type Variant = 'base' | 'shiny' | 'gold' | 'rainbow';

export interface RarityDef {
  id: Rarity;
  name: string;
  prob: number;
  weight: number;
}

export interface VariantDef {
  id: Variant;
  name: string;
  emoji: string;
  prob: number;
  weight: number;
}

export interface CollectibleDef {
  id: string;
  name: string;
  emoji: string;
  rarity: Rarity;
}

export const RARITIES: readonly RarityDef[] = [
  { id: 'common', name: '일반', prob: 0.6, weight: 0.01 },
  { id: 'rare', name: '레어', prob: 0.27, weight: 0.02 },
  { id: 'epic', name: '에픽', prob: 0.1, weight: 0.04 },
  { id: 'legend', name: '전설', prob: 0.027, weight: 0.08 },
  { id: 'myth', name: '신화', prob: 0.003, weight: 0.16 },
];

export const VARIANTS: readonly VariantDef[] = [
  { id: 'base', name: '기본', emoji: '', prob: 0.88, weight: 1 },
  { id: 'shiny', name: '반짝', emoji: '', prob: 0.1, weight: 2 },
  { id: 'gold', name: '황금', emoji: '', prob: 0.019, weight: 4 },
  { id: 'rainbow', name: '무지개', emoji: '', prob: 0.001, weight: 8 },
];

export const COLLECTIBLES: readonly CollectibleDef[] = [
  { id: 'fan', name: '선풍기', emoji: '', rarity: 'common' },
  { id: 'kettle', name: '전기포트', emoji: '', rarity: 'common' },
  { id: 'toaster', name: '토스터', emoji: '', rarity: 'common' },
  { id: 'heating_pad', name: '전기장판', emoji: '', rarity: 'common' },
  { id: 'hair_dryer', name: '헤어드라이어', emoji: '', rarity: 'common' },
  { id: 'humidifier', name: '가습기', emoji: '', rarity: 'common' },
  { id: 'rice_cooker', name: '전기밥솥', emoji: '', rarity: 'common' },
  { id: 'water_purifier', name: '정수기', emoji: '', rarity: 'rare' },
  { id: 'air_purifier', name: '공기청정기', emoji: '', rarity: 'rare' },
  { id: 'air_fryer', name: '에어프라이어', emoji: '', rarity: 'rare' },
  { id: 'vacuum', name: '청소기', emoji: '', rarity: 'rare' },
  { id: 'coffee_machine', name: '커피머신', emoji: '', rarity: 'rare' },
  { id: 'dishwasher', name: '식기세척기', emoji: '', rarity: 'rare' },
  { id: 'air_conditioner', name: '에어컨', emoji: '', rarity: 'epic' },
  { id: 'washer', name: '세탁기', emoji: '', rarity: 'epic' },
  { id: 'smart_tv', name: '스마트 TV', emoji: '', rarity: 'epic' },
  { id: 'fridge', name: '냉장고', emoji: '', rarity: 'epic' },
  { id: 'massage_chair', name: '안마의자', emoji: '', rarity: 'legend' },
  { id: 'robot_vacuum', name: '로봇청소기', emoji: '', rarity: 'legend' },
  { id: 'space_purifier', name: '우주 정수기', emoji: '', rarity: 'myth' },
];

export const SLOT_TOTAL = COLLECTIBLES.length * VARIANTS.length;

export type SetEffectKey = 'tapMult' | 'serviceMult' | 'offlineMult' | 'feverSec' | 'critMult';

export interface SetDef {
  rarity: Rarity;
  name: string;
  effect: SetEffectKey;
  /** 효과량: 배율이면 곱할 값, 초·배율 가산이면 더할 값 */
  value: number;
  /** 화면용 효과 문구 */
  desc: string;
}

/** 등급 세트: 그 등급의 모든 종을 변이와 상관없이 1개 이상 가지면 켜진다. */
export const SETS: readonly SetDef[] = [
  { rarity: 'common', name: '일반 세트', effect: 'tapMult', value: 1.5, desc: '탭 수익 x1.5' },
  { rarity: 'rare', name: '레어 세트', effect: 'serviceMult', value: 1.25, desc: '서비스 수익 x1.25' },
  { rarity: 'epic', name: '에픽 세트', effect: 'offlineMult', value: 1.5, desc: '오프라인 보상 x1.5' },
  { rarity: 'legend', name: '전설 세트', effect: 'feverSec', value: 5, desc: '피버 시간 +5초' },
  { rarity: 'myth', name: '신화 세트', effect: 'critMult', value: 2, desc: '치명타 배율 +2' },
];
