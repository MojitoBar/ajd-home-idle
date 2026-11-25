/** 가이드 2부: 첫 이사 뒤 공구함(덱)을 익히는 5단계. 1부(guide.ts)와 달리 진행은 전부 지금 state에서 읽는다(사건·보상·잠금 없음). 안내일 뿐 진행을 막지 않는다. */
import type { GameState, Guide2State } from './state';
import { STACK_PICK_EVERY } from '../data/cards';

export interface Guide2StepDef {
  id: string;
  /** 화면 문구(해요체) */
  text: string;
  /** 이 단계의 일이 이미 끝났나 */
  met: (s: GameState) => boolean;
  /** 진행 수와 목표(줄 오른쪽 숫자) */
  progress: (s: GameState) => { n: number; goal: number };
}

export const GUIDE2_STEPS: readonly Guide2StepDef[] = [
  { id: 'pick', text: '공구함 카드를 하나 골라요', met: (s) => s.deck.slots.length >= 1, progress: (s) => ({ n: Math.min(1, s.deck.slots.length), goal: 1 }) },
  { id: 'stack', text: '카드 눈금을 채워 스택을 쌓아요', met: (s) => s.deck.slots.some((sl) => sl.stacks >= 1), progress: (s) => ({ n: Math.min(1, Math.max(0, ...s.deck.slots.map((sl) => sl.stacks))), goal: 1 }) },
  { id: 'cards', text: '카드를 2장 더 끼워요', met: (s) => s.deck.slots.length >= 3, progress: (s) => ({ n: Math.min(3, s.deck.slots.length), goal: 3 }) },
  { id: 'boost', text: `스택 ${STACK_PICK_EVERY}개를 모아 강화 고르기를 열어요`, met: boostPicked, progress: (s) => ({ n: s.deck.boostMade > 0 ? STACK_PICK_EVERY : Math.min(STACK_PICK_EVERY, s.deck.chargedStacks), goal: STACK_PICK_EVERY }) },
  { id: 'move', text: '목표를 채워 아파트로 이사해요', met: (s) => s.moves >= 2, progress: (s) => ({ n: Math.min(1, Math.max(0, s.moves - 1)), goal: 1 }) },
];

/** 이 집에서 강화 고르기를 한 번이라도 끝냈나(건너뛰기도 센다) */
function boostPicked(s: GameState): boolean {
  return s.deck.boostMade - s.deck.boostPacks >= 1;
}

export const initialGuide2 = (): Guide2State => ({ step: 0, done: false });

/** 2부가 끝난 상태(이사 2회 이상·옛 저장) */
export const finishedGuide2 = (): Guide2State => ({ step: GUIDE2_STEPS.length, done: true });

/** 2부가 지금 도는 중인가: 첫 이사를 했고(1부 끝) 두 번째 이사 전, 아직 안 끝났을 때 */
export function guide2Active(s: GameState): boolean {
  return s.moves === 1 && !s.guide2.done;
}

export interface Guide2View {
  /** 지금 단계 번호(1부터) */
  no: number;
  total: number;
  text: string;
  n: number;
  goal: number;
  id: string;
}

/** 화면용: 지금 단계. 2부가 아니면 null */
export function guide2View(s: GameState): Guide2View | null {
  if (!guide2Active(s)) return null;
  const def = GUIDE2_STEPS[s.guide2.step];
  if (!def) return null;
  return { no: s.guide2.step + 1, total: GUIDE2_STEPS.length, text: def.text, id: def.id, ...def.progress(s) };
}

/** 지금 2부의 id 단계인가 */
export function guide2At(s: GameState, id: string): boolean {
  return guide2Active(s) && GUIDE2_STEPS[s.guide2.step]?.id === id;
}

/** 이미 끝난 단계는 연출 없이 건너뛴다(마지막 이사 단계는 이사해야만 끝난다) */
export function guide2Settle(s: GameState): GameState {
  if (s.guide2.done) return s;
  if (s.moves >= 2) return { ...s, guide2: finishedGuide2() };
  if (s.moves !== 1) return s;
  let step = s.guide2.step;
  while (step < GUIDE2_STEPS.length - 1 && GUIDE2_STEPS[step].met(s)) step++;
  return step === s.guide2.step ? s : { ...s, guide2: { step, done: false } };
}

export interface Guide2Result {
  state: GameState;
  /** 이번에 끝낸 단계(없으면 null) */
  completed: Guide2StepDef | null;
  /** 끝낸 단계 번호(1부터, 없으면 0) */
  no: number;
  /** 2부가 이번에 전부 끝났나 */
  finished: boolean;
}

/** 지금 단계가 끝났는지 본다. 끝났으면 다음으로 넘기고, 그다음 단계들 중 이미 끝난 것은 조용히 건너뛴다. 한 번에 한 단계만 알린다 */
export function guide2Update(s: GameState): Guide2Result {
  const none: Guide2Result = { state: s, completed: null, no: 0, finished: false };
  if (s.guide2.done) return none;
  if (s.moves >= 2) {
    // 두 번째 이사로 끝난 순간만 알린다(더 뒤 저장은 조용히 끝난 것으로)
    const now = s.moves === 2;
    return { state: { ...s, guide2: finishedGuide2() }, completed: now ? GUIDE2_STEPS[GUIDE2_STEPS.length - 1] : null, no: now ? GUIDE2_STEPS.length : 0, finished: now };
  }
  if (!guide2Active(s)) return none;
  const def = GUIDE2_STEPS[s.guide2.step];
  if (!def || !def.met(s)) return none;
  const next = guide2Settle({ ...s, guide2: { step: s.guide2.step + 1, done: false } });
  return { state: next, completed: def, no: s.guide2.step + 1, finished: false };
}
