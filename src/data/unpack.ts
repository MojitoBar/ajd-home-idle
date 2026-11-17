export const UNPACK_HP_BASE = 10;
export const UNPACK_HP_GROWTH = 1.07;
/** 치명타가 아닌 탭 1회가 한 상자에서 깎을 수 있는 최대 비율(최소 3타) */
export const NONCRIT_CAP = 1 / 3;
/** 연쇄 보너스: 한 번의 강타에서 i번째(0부터) 터진 상자 보상에 1 + STEP x min(i, CAP)를 곱한다 */
export const CHAIN_BONUS_STEP = 0.1;
export const CHAIN_BONUS_CAP = 20;
/** 연쇄 상금: 한 번에 n개 이상 터지면 가장 높은 단계 하나. 상금 = 탭 1회 수익(피버 제외) x taps */
export const CHAIN_PRIZES = [
  { n: 5, taps: 10 },
  { n: 10, taps: 40 },
  { n: 20, taps: 150 },
];
/** 한 집의 유한 상자 수. 이후는 덤 짐(작은 상자만, 살림 없음) */
export const ROOM_BOXES = 80;

/** 살림 손질(80개 뒤) 상자 기본 탭 수: 작은·보통·큰 */
export const ENDLESS_TAPS: Record<'small' | 'normal' | 'big', number> = { small: 10, normal: 20, big: 40 };
/** 도구 단계가 오를 때마다 손질 상자 HP에 곱하는 값 */
export const ENDLESS_TOOL_STEP = 0.75;
/** 손질 상자 P 덩어리 배율(방 단계 대비) */
export const ENDLESS_K_MULT = 0.25;
/** 살림 단계 첫 문턱 레벨(Lv 3부터 은) */
export const TIER_BASE = 3;
/** 단계 문턱이 단계마다 몇 배가 되는가 */
export const TIER_STEP = 4;

export type BoxKind = 'small' | 'normal' | 'big';

export interface BoxKindDef {
  kind: BoxKind;
  name: string;
  /** 내구도 배율 */
  hpMult: number;
  /** 터질 때 받는 P 덩어리 = tapValue(피버 제외) x K */
  k: number;
}

export const BOX_KINDS: Record<BoxKind, BoxKindDef> = {
  small: { kind: 'small', name: '작은 상자', hpMult: 0.7, k: 2 },
  normal: { kind: 'normal', name: '보통 상자', hpMult: 1.6, k: 3 },
  big: { kind: 'big', name: '큰 상자', hpMult: 3, k: 12 },
};

/** 10개 한 묶음의 순서(난수 없음): 3·6·9번째 보통, 10번째 큰, 나머지 작은 */
export const BOX_PATTERN: readonly BoxKind[] = ['small', 'small', 'normal', 'small', 'small', 'normal', 'small', 'small', 'normal', 'big'];

export interface RoomItemDef {
  id: string;
  name: string;
  /** public/assets/px/ 아래 살림 그림 이름(확장자 제외) */
  image: string;
}

/** 원룸 살림 8종. 칸 순서대로 찬다 */
export const ROOM_ITEMS: readonly RoomItemDef[] = [
  { id: 'fridge', name: '냉장고', image: 'item/fridge' },
  { id: 'washer', name: '세탁기', image: 'item/washer' },
  { id: 'smart_tv', name: '스마트 TV', image: 'item/smart_tv' },
  { id: 'fan', name: '선풍기', image: 'item/fan' },
  { id: 'rice_cooker', name: '밥솥', image: 'item/rice_cooker' },
  { id: 'kettle', name: '전기포트', image: 'item/kettle' },
  { id: 'air_purifier', name: '공기청정기', image: 'item/air_purifier' },
  { id: 'coffee_machine', name: '커피머신', image: 'item/coffee_machine' },
];

export interface ToolDef {
  /** 이 탭 강화 레벨부터 */
  minLevel: number;
  /** 독·카드의 data-tool 값 */
  id: string;
  name: string;
  /** public/assets/px/ 아래 도구 그림(24x24 도트) */
  icon: string;
}

export const TOOLS: readonly ToolDef[] = [
  { minLevel: 0, id: 'gloves', name: '맨손', icon: 'tool/gloves' },
  { minLevel: 10, id: 'cutter', name: '커터칼', icon: 'tool/cutter' },
  { minLevel: 25, id: 'hammer', name: '장도리', icon: 'tool/hammer' },
  { minLevel: 50, id: 'drill', name: '전동 드라이버', icon: 'tool/drill' },
  { minLevel: 100, id: 'robot-arm', name: '로봇 팔', icon: 'tool/robot-arm' },
];

export type SpecialBox = 'gold' | 'bomb' | 'clock';

/** 특별 상자 등장 확률(큰 상자 자리·처음 SPECIAL_FREE_BOXES개 제외) */
export const SPECIAL_RATE = 0.05;
/** 한 집의 처음 이 개수(k < 20)에는 특별 상자가 없다 */
export const SPECIAL_FREE_BOXES = 20;
/** 특별 상자 뒤 이 개수의 상자는 일반 상자(몰려 나오지 않게) */
export const SPECIAL_GAP = 4;
/** 종류 가중치: 황금 5 : 폭탄 3 : 시계 2 */
export const SPECIAL_WEIGHTS: Record<SpecialBox, number> = { gold: 5, bomb: 3, clock: 2 };
/** 황금 상자 보상 배율(연쇄 보너스와 곱해진다) */
export const GOLD_GAIN_MULT = 10;
/** 폭탄 상자가 터질 때 뒤따라 함께 터지는 상자 수 */
export const BOMB_BLAST = 5;
/** 시계 상자가 더하는 러시 시간(초)과 상한 */
export const RUSH_SEC = 5;
export const RUSH_MAX_SEC = 15;
/** 이 시간(초)보다 오래 비웠다 돌아오면 러시를 가득 채워 준다 */
export const RETURN_RUSH_AWAY_SEC = 1800;
/** 러시 중 화면이 부를 초당 탭 수 */
export const RUSH_RATE = 10;
