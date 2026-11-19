import { BOX_KINDS, UNPACK_HP_BASE } from '../data/unpack';
import type { GearId } from '../data/gear';
import { emptyDeck, type DeckState } from './deck';
import { initialFever, initialParcel } from './fever';

export const CURRENT_VERSION = 14;

export interface CollectionSlot {
  base: number;
  shiny: number;
  gold: number;
  rainbow: number;
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

export interface UnpackState {
  /** 이 집에서 연 상자 수(다음 상자 순번 k) */
  box: number;
  /** 현재 상자에 쌓인 피해 */
  damage: number;
  /** 이 집 방 완성 보상을 받았는가 */
  roomDone: boolean;
  /** 현재 상자의 내구도(상자가 올 때 정해 저장). 1 미만이면 계산해서 쓴다 */
  hp: number;
  /** 특별 상자 배치를 가르는 정수. 새 게임·이사 때 새로 뽑는다 */
  salt: number;
  /** 시계 상자가 남긴 러시 시간(초). tick이 줄이고 이사·오프라인은 0 */
  rushSec: number;
}

export const initialUnpack = (salt = 0): UnpackState => ({ box: 0, damage: 0, roomDone: false, hp: Math.ceil(UNPACK_HP_BASE * BOX_KINDS.small.hpMult - 1e-9), salt, rushSec: 0 });

/** 첫 가이드 진행(저장됨). step = 지금 단계 번호(0부터, 단계 수가 되면 전부 끝), n = 그 단계의 진행 수, done = 가이드 끝(이사했거나 끝까지 마침, 옛 저장) */
export interface GuideState {
  step: number;
  n: number;
  done: boolean;
}

export const HOME_SLOTS = 8;

export interface GameState {
  version: number;
  savedAt: number;
  points: number;
  earned: number;
  moves: number;
  tapLevel: number;
  /** 강타 힘 강화 레벨(강타·급소 탭 수 배율). 이사하면 탭 강화처럼 0 */
  strikeLevel: number;
  boxesThisRun: number;
  collection: Record<string, CollectionSlot>;
  fever: FeverState;
  parcel: ParcelState;
  unpack: UnpackState;
  /** 살림 8점의 레벨(살림 손질). 이사해도 유지 */
  homeLv: number[];
  /** 공구 강화(상한 축) 레벨. 이사해도 유지 */
  gear: Partial<Record<GearId, number>>;
  /** 이사 특전 레벨 (perk id -> 레벨). 영구 */
  perks: Record<string, number>;
  /** 선택 대기 중인 특전 3택 묶음(오래된 순). 저장됨 */
  perkOffers: string[][];
  /** 공구함 덱(logic/deck.ts): 이 집에서만 쓰는 카드. 이사하면 초기화. 저장됨 */
  deck: DeckState;
  /** 이 집에서 산 특전 상자 수(가격이 오른다). 이사하면 0 */
  perkBoxBought: number;
  stats: { totalTaps: number; totalEarned: number; playSec: number; boxesOpened: number };
  settings: { reduceMotion: boolean };
  /** 최고 콤보(탭 수). 이사해도 유지 */
  bestCombo: number;
  /** 한 번의 강타·급소로 터뜨린 상자 최고 수. 이사해도 유지 */
  bestChain: number;
  /** 첫 가이드: 손맛 요소가 하나씩 열리는 순서(logic/guide.ts). 이사하면 끝난다 */
  guide: GuideState;
  /** 열린 화면 요소 id(단계적 공개). 없으면 예전 저장이라 조건에서 유도해 조용히 채운다. 한번 열리면 이사해도 유지 */
  unlocked?: string[];
  /** 저장 개편 안내(한 번 띄운 뒤 지운다). boxes = 서비스 보상으로 받은 무료 상자 수 */
  notice?: { kind: 'v9'; boxes: number };
}

export function defaultState(savedAt = 0, salt = 0): GameState {
  return {
    version: CURRENT_VERSION,
    savedAt,
    points: 0,
    earned: 0,
    moves: 0,
    tapLevel: 0,
    strikeLevel: 0,
    boxesThisRun: 0,
    collection: {},
    fever: initialFever(),
    parcel: initialParcel(),
    unpack: initialUnpack(salt),
    homeLv: Array(HOME_SLOTS).fill(0),
    gear: {},
    perks: {},
    perkOffers: [],
    deck: emptyDeck(),
    perkBoxBought: 0,
    stats: { totalTaps: 0, totalEarned: 0, playSec: 0, boxesOpened: 0 },
    settings: { reduceMotion: false },
    bestCombo: 0,
    bestChain: 0,
    guide: { step: 0, n: 0, done: false },
  };
}
