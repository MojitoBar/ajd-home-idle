import { BOX_KINDS, UNPACK_HP_BASE } from '../data/unpack';
import { SERVICES } from '../data/services';
import type { ContractKind } from '../data/contracts';
import { initialFever, initialParcel } from './fever';

export const CURRENT_VERSION = 6;

export interface CollectionSlot {
  base: number;
  shiny: number;
  gold: number;
  rainbow: number;
}

export type CardId = 'A' | 'B';

export interface EventQuestion {
  months: number;
  /** A 카드(고정형): 월 fixedMonthly콩 */
  fixedMonthly: number;
  /** B 카드(할인형): 처음 promoMonths개월 promoFirst콩, 이후 promoAfter콩 */
  promoMonths: number;
  promoFirst: number;
  promoAfter: number;
  totalA: number;
  totalB: number;
  /** 화면 배치(왼쪽, 오른쪽). 라벨 A=고정형, B=할인형은 배치와 무관 */
  order: [CardId, CardId];
  answer: CardId;
  trap: boolean;
}

export interface EventResult {
  correct: boolean;
  /** 고른 카드. 시간 초과면 null */
  choice: CardId | null;
  timedOut: boolean;
  answer: CardId;
  totalA: number;
  totalB: number;
  /** 정답일 때 받은 E 지속 시간(초), 오답이면 0 */
  rewardSec: number;
}

export interface EventState {
  /** 다음 배너까지 남은 초(대기 중에만 감소) */
  nextInSec: number;
  /** 이벤트 배율 E(x3) 남은 초 */
  remainSec: number;
  streak: number;
  /** 배너 남은 초(0이면 배너 없음) */
  bannerSec: number;
  question: EventQuestion | null;
  /** 문제 남은 초 */
  questionSec: number;
  /** 마지막 결과(해설 표시용). UI가 닫을 때 clearEventResult */
  result: EventResult | null;
}

export interface FeverState {
  /** 충전된 탭 수(0~FEVER_TAPS). 탭을 멈추면 줄어든다 */
  gauge: number;
  /** 피버 남은 초(0이면 비발동) */
  activeSec: number;
  /** 피버 종료 후 재충전 제한 남은 초 */
  cooldownSec: number;
}

export interface ParcelState {
  /** 다음 등장까지 남은 초(떠 있는 동안엔 0) */
  nextInSec: number;
  /** 떠 있는 남은 초(0이면 없음) */
  remainSec: number;
}

export interface ContractState {
  /** SERVICES 인덱스 */
  service: number;
  kind: ContractKind;
  /** 남은 실제 시간(초). 오프라인 중에도 흐른다 */
  remainSec: number;
  /** 약정 전체 기간(초). 체결 때 고정 */
  totalSec: number;
  /** 위약금 기준 금액(P). 체결 때 고정, 이후 변하지 않는다 */
  penaltyBase: number;
}

export interface UnpackState {
  /** 이 집에서 연 상자 수(다음 상자 순번 k) */
  box: number;
  /** 현재 상자에 쌓인 피해 */
  damage: number;
  /** 이 집 방 완성 보상을 받았는가 */
  roomDone: boolean;
  /** 현재 상자의 내구도(상자가 올 때 정해 저장). 1 미만이면 계산해서 쓴다 */
  hp: number;
}

export const initialUnpack = (): UnpackState => ({ box: 0, damage: 0, roomDone: false, hp: Math.ceil(UNPACK_HP_BASE * BOX_KINDS.small.hpMult - 1e-9) });

export const HOME_SLOTS = 8;

export interface GameState {
  version: number;
  savedAt: number;
  points: number;
  earned: number;
  moves: number;
  tapLevel: number;
  services: number[];
  boxesThisRun: number;
  collection: Record<string, CollectionSlot>;
  event: EventState;
  fever: FeverState;
  parcel: ParcelState;
  unpack: UnpackState;
  /** 살림 8점의 레벨(살림 손질). 이사해도 유지 */
  homeLv: number[];
  /** 이사 특전 레벨 (perk id -> 레벨). 영구 */
  perks: Record<string, number>;
  /** 선택 대기 중인 특전 3택 묶음(오래된 순). 저장됨 */
  perkOffers: string[][];
  /** 진행 중인 약정. 저장됨(남은 초) */
  contracts: ContractState[];
  stats: { totalTaps: number; totalEarned: number; playSec: number; boxesOpened: number };
  settings: { reduceMotion: boolean };
  /** 열린 화면 요소 id(단계적 공개). 없으면 예전 저장이라 조건에서 유도해 조용히 채운다. 한번 열리면 이사해도 유지 */
  unlocked?: string[];
}

export function defaultState(savedAt = 0): GameState {
  return {
    version: CURRENT_VERSION,
    savedAt,
    points: 0,
    earned: 0,
    moves: 0,
    tapLevel: 0,
    services: SERVICES.map(() => 0),
    boxesThisRun: 0,
    collection: {},
    event: { nextInSec: 540, remainSec: 0, streak: 0, bannerSec: 0, question: null, questionSec: 0, result: null },
    fever: initialFever(),
    parcel: initialParcel(),
    unpack: initialUnpack(),
    homeLv: Array(HOME_SLOTS).fill(0),
    perks: {},
    perkOffers: [],
    contracts: [],
    stats: { totalTaps: 0, totalEarned: 0, playSec: 0, boxesOpened: 0 },
    settings: { reduceMotion: false },
  };
}
