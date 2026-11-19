// 단계적 공개: 처음에는 방과 공구만 보이고, 조건이 처음 충족될 때 하나씩 열린다. 한번 열리면 다시 숨기지 않는다.
import { BOX_MIN_PRICE, boxPrice } from './gacha';
import { collectionMult, homeMult } from './economy';
import { formatNumber } from './format';
import { guideEnded, guideReached } from './guide';
import type { GameState } from './state';

export const UNLOCK_IDS = ['box', 'home', 'dex', 'mult', 'badge', 'perk', 'deck'] as const;
export type UnlockId = (typeof UNLOCK_IDS)[number];

/** 토스트에 쓰는 이름("새로 열렸어요 · 결합") */
export const UNLOCK_NAME: Record<UnlockId, string> = {
  box: '상자',
  home: '살림',
  dex: '도감',
  mult: '배율 내역',
  badge: '총 배율',
  perk: '특전',
  deck: '공구함',
};

/** 문턱값. 새 게임에서 초당 4탭으로 쉬지 않고 한 사람 기준 시각은 UI-GUIDE.md 표 */
export const UNLOCK_RULE = {
  /** 상자: 이 집에서 번 포인트가 상자 최저가의 이 배수에 닿으면(절약하는 사람이 없어도 멈추지 않게) */
  boxEarnedMult: 3,
} as const;

function multChanged(s: GameState): boolean {
  if (collectionMult(s) !== 1 || homeMult(s) !== 1) return true;
  return Object.keys(s.perks).length > 0;
}

const RULES: Record<UnlockId, (s: GameState) => boolean> = {
  // 가이드 중에는 상자 단계에서만 열린다(그 앞에서 상자를 사지 않고 가이드를 순서대로 따라가게)
  box: (s) =>
    guideEnded(s)
      ? s.points >= boxPrice(s) / 2 || s.earned >= BOX_MIN_PRICE * UNLOCK_RULE.boxEarnedMult || s.unpack.roomDone || Object.keys(s.collection).length > 0 || s.stats.boxesOpened > 0
      : guideReached(s, 'boxBuy'),
  home: (s) => s.homeLv.some((v) => v > 0),
  dex: (s) => Object.keys(s.collection).length > 0,
  mult: multChanged,
  badge: multChanged,
  perk: (s) => s.perkOffers.length > 0 || Object.keys(s.perks).length > 0,
  // 첫 이사 뒤에만 열린다(isMet이 moves > 0이면 전부 충족으로 본다)
  deck: () => false,
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
  const prog: Partial<Record<UnlockId, { ratio: number; cond: string }>> = {
    box: { ratio: state.earned / (BOX_MIN_PRICE * UNLOCK_RULE.boxEarnedMult), cond: `누적 ${formatNumber(BOX_MIN_PRICE * UNLOCK_RULE.boxEarnedMult)} P` },
  };
  let best: { id: UnlockId; cond: string; ratio: number } | null = null;
  for (const id of UNLOCK_IDS) {
    const p = prog[id];
    if (!p || isOpen(state, id) || isMet(state, id)) continue;
    if (!best || p.ratio > best.ratio) best = { id, ...p };
  }
  return best && { id: best.id, cond: best.cond };
}
