// 단계적 공개: 처음에는 방과 서비스만 보이고, 조건이 처음 충족될 때 하나씩 열린다. 한번 열리면 다시 숨기지 않는다.
import { BOX_MIN_PRICE, boxPrice } from './gacha';
import { houseInfo } from './house';
import { bundleStatuses } from './bundle';
import { contractBlock } from './contract';
import { collectionMult } from './economy';
import { formatNumber } from './format';
import { SERVICES } from '../data/services';
import type { GameState } from './state';

export const UNLOCK_IDS = ['tap', 'bundle', 'box', 'dex', 'move', 'contract', 'mult', 'badge', 'perk'] as const;
export type UnlockId = (typeof UNLOCK_IDS)[number];

/** 토스트에 쓰는 이름("새로 열렸어요 · 결합") */
export const UNLOCK_NAME: Record<UnlockId, string> = {
  tap: '공구 강화',
  bundle: '결합',
  box: '상자',
  dex: '도감',
  move: '이사',
  contract: '약정',
  mult: '배율 내역',
  badge: '영구 배율',
  perk: '특전',
};

/** 문턱값. 새 게임에서 초당 4탭으로 쉬지 않고 한 사람 기준 시각은 UI-GUIDE.md 표 */
export const UNLOCK_RULE = {
  /** 공구 강화: 이 집에서 터뜨린 상자 수 */
  tapBoxes: 10,
  /** 결합: 가진 서비스 종류 */
  bundleServices: 3,
  /** 상자: 이 집에서 번 포인트가 상자 최저가의 이 배수에 닿으면(절약하는 사람이 없어도 멈추지 않게) */
  boxEarnedMult: 3,
  /** 이사 줄: 이사 목표 대비 번 포인트 */
  moveRatio: 0.01,
  /** 약정 칸: 같은 비율(이사 줄이 열린 뒤 따로 열리게) */
  contractRatio: 0.03,
} as const;

const ownedServices = (s: GameState): number => s.services.filter((v) => v > 0).length;

function multChanged(s: GameState): boolean {
  if (collectionMult(s) !== 1) return true;
  if (s.contracts.length > 0 || Object.keys(s.perks).length > 0) return true;
  return bundleStatuses(s).some((b) => b.stage > 0);
}

const RULES: Record<UnlockId, (s: GameState) => boolean> = {
  tap: (s) => s.unpack.box >= UNLOCK_RULE.tapBoxes || s.tapLevel > 0,
  bundle: (s) => ownedServices(s) >= UNLOCK_RULE.bundleServices || bundleStatuses(s).some((b) => b.stage > 0),
  box: (s) => s.points >= boxPrice(s) / 2 || s.earned >= BOX_MIN_PRICE * UNLOCK_RULE.boxEarnedMult || s.unpack.roomDone || Object.keys(s.collection).length > 0 || s.stats.boxesOpened > 0,
  dex: (s) => Object.keys(s.collection).length > 0,
  move: (s) => s.earned >= houseInfo(s.moves).target * UNLOCK_RULE.moveRatio,
  contract: (s) => s.earned >= houseInfo(s.moves).target * UNLOCK_RULE.contractRatio && SERVICES.some((_, i) => contractBlock(s, i) === null),
  mult: multChanged,
  badge: () => false,
  perk: (s) => s.perkOffers.length > 0 || Object.keys(s.perks).length > 0,
};

/** 지금 조건이 충족돼 있는가. 이사를 한 번이라도 했으면 전부 충족(이미 겪은 사람) */
export function isMet(state: GameState, id: UnlockId): boolean {
  return state.moves > 0 || RULES[id](state);
}

/** 지금 충족된 모든 항목(저장 데이터 이어받기용) */
export function metIds(state: GameState): UnlockId[] {
  return UNLOCK_IDS.filter((id) => isMet(state, id));
}

export function isOpen(state: GameState, id: UnlockId): boolean {
  return state.unlocked?.includes(id) ?? false;
}

/** 조건은 충족됐지만 아직 열림 기록이 없는 항목(공개 순서대로) */
export function pendingUnlocks(state: GameState): UnlockId[] {
  return UNLOCK_IDS.filter((id) => !isOpen(state, id) && isMet(state, id));
}

/** 다음에 열리는 것 하나와 그 조건 문구. 아직 안 열렸고 조건도 미충족인 항목 중 진행률이 가장 높은 것(같으면 공개 순서) */
export function nextUnlock(state: GameState): { id: UnlockId; cond: string } | null {
  const moveTarget = houseInfo(state.moves).target;
  const prog: Partial<Record<UnlockId, { ratio: number; cond: string }>> = {
    tap: { ratio: state.unpack.box / UNLOCK_RULE.tapBoxes, cond: `상자 ${UNLOCK_RULE.tapBoxes}개 열기` },
    bundle: { ratio: ownedServices(state) / UNLOCK_RULE.bundleServices, cond: `서비스 ${UNLOCK_RULE.bundleServices}종 사기` },
    box: { ratio: state.earned / (BOX_MIN_PRICE * UNLOCK_RULE.boxEarnedMult), cond: `누적 ${formatNumber(BOX_MIN_PRICE * UNLOCK_RULE.boxEarnedMult)} P` },
    move: { ratio: state.earned / (moveTarget * UNLOCK_RULE.moveRatio), cond: `누적 ${formatNumber(moveTarget * UNLOCK_RULE.moveRatio)} P` },
    contract: { ratio: state.earned / (moveTarget * UNLOCK_RULE.contractRatio), cond: `누적 ${formatNumber(moveTarget * UNLOCK_RULE.contractRatio)} P` },
  };
  let best: { id: UnlockId; cond: string; ratio: number } | null = null;
  for (const id of UNLOCK_IDS) {
    const p = prog[id];
    if (!p || isOpen(state, id) || isMet(state, id)) continue;
    if (!best || p.ratio > best.ratio) best = { id, ...p };
  }
  return best && { id: best.id, cond: best.cond };
}
