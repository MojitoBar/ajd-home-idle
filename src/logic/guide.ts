/** 첫 가이드: 손맛 요소가 하나씩 열리는 순서. 처음에는 탭과 공구 강화만 있고, 단계를 끝낼 때마다 요소가 하나 열려 수익이 한 계단씩 가팔라진다(J 커브). 첫 이사를 하면 끝나고 그 뒤는 전부 열린다. */
import { addToCollection, rollBox, type BoxResult } from './gacha';
import { multBreakdown, strikeCost, tapCost, tapStable } from './economy';
import { seededRng } from './perks';
import type { GameState, GuideState } from './state';

/** 가이드가 막았다 푸는 요소 */
export type GuideFeature =
  /** 콤보 배율 */
  | 'combo'
  /** 꾹 눌러 강타·열기 게이지 */
  | 'charge'
  /** 급소 */
  | 'weak'
  /** 피버 */
  | 'fever'
  /** 연쇄(강타·급소가 상자를 뚫음, 연쇄 보너스·상금)·오함마(강타 힘 강화) 카드 */
  | 'chain'
  /** 연속 퍼펙트 배수 */
  | 'streak'
  /** 특별 상자(황금·폭탄·시계) */
  | 'special'
  /** 영구 공구 카드 */
  | 'gear'
  /** 특전 상자 구매 */
  | 'perkBox';

/** 가이드 단계를 올리는 사건. `value` 사건은 지금 값(콤보·연쇄·연속 퍼펙트)을 알리고, 나머지는 1번 일어날 때마다 알린다 */
export type GuideEvent =
  | { type: 'tap' }
  | { type: 'upgrade' }
  | { type: 'unbox' }
  | { type: 'combo'; value: number }
  | { type: 'strike' }
  | { type: 'weak' }
  | { type: 'fever' }
  | { type: 'chain'; value: number }
  | { type: 'perfect'; value: number }
  | { type: 'boxBuy' }
  | { type: 'special' }
  | { type: 'gearBuy' }
  | { type: 'perkBoxBuy' }
  | { type: 'move' }
  /** 아무 일도 없음: 누적 포인트만 기다리던 단계가 끝났는지 확인한다 */
  | { type: 'tick' };

export type GuideEventType = GuideEvent['type'];

export interface GuideStepDef {
  id: string;
  /** 화면 문구(해요체) */
  text: string;
  /** 이 단계가 기다리는 사건 */
  event: GuideEventType;
  /** 목표 수. 횟수 사건은 누적, value 사건은 한 번에 닿은 값 */
  goal: number;
  /** 이 단계에 들어설 때 열리는 요소 */
  opens?: GuideFeature;
  /** 이 단계를 끝내려면 누적 포인트(이번 집)가 이만큼은 돼야 한다. 행동 목표를 채워도 모자라면 기다린다(천천히 시작해서 J 커브로 열리게 하는 속도 조절) */
  gate: number;
  /** 끝냈을 때 보상: 그때 탭 1회 수익(피버 제외)의 몇 번어치인가. 뒤 단계는 0(선물 상자로 준다) */
  rewardTaps: number;
  /** 끝냈을 때 받는 선물 상자 수(무료 상자 뽑기: 도감·살림 배율이 오른다). 없으면 0 */
  rewardBoxes?: number;
  /** 사건이 아니라 지금 state로 진행 수를 판정하는 단계(공구 Lv·살림·총 배율). 어떤 사건이 와도 다시 본다 */
  progress?: (state: GameState) => number;
}

const VALUE_EVENTS: readonly GuideEventType[] = ['combo', 'chain', 'perfect'];

/** 총 배율(피버 제외) */
const totalMult = (s: GameState): number => {
  const b = multBreakdown(s, 'tap');
  return b.total / b.fever;
};

export const GUIDE_STEPS: readonly GuideStepDef[] = [
  { id: 'tap', text: '상자를 10번 쳐 보세요', event: 'tap', goal: 10, gate: 0, rewardTaps: 40 },
  { id: 'upgrade', text: '공구를 강화해 보세요', event: 'upgrade', goal: 1, gate: 0, rewardTaps: 30 },
  { id: 'unbox', text: '계속 쳐서 큰 상자를 터뜨려요', event: 'unbox', goal: 1, gate: 4e3, rewardTaps: 60 },
  { id: 'combo', text: '쉬지 않고 10번 이어 쳐 보세요', event: 'combo', goal: 10, opens: 'combo', gate: 7e4, rewardTaps: 60 },
  { id: 'strike', text: '꾹 눌렀다 놓아 강타해 보세요', event: 'strike', goal: 1, opens: 'charge', gate: 1.2e5, rewardTaps: 100 },
  { id: 'weak', text: '반짝이는 급소를 눌러 보세요', event: 'weak', goal: 1, opens: 'weak', gate: 2.5e5, rewardTaps: 100 },
  { id: 'fever', text: '게이지를 채워 피버를 터뜨려요', event: 'fever', goal: 1, opens: 'fever', gate: 7e5, rewardTaps: 150 },
  { id: 'chain', text: '강타로 한 번에 상자 3개를 터뜨려요', event: 'chain', goal: 3, opens: 'chain', gate: 1e6, rewardTaps: 200 },
  { id: 'streak', text: '노란 칸에 놓아 퍼펙트를 2번 이어요', event: 'perfect', goal: 2, opens: 'streak', gate: 2.5e7, rewardTaps: 0, rewardBoxes: 2 },
  { id: 'boxBuy', text: '상자 탭에서 상자를 뽑아 보세요', event: 'boxBuy', goal: 1, gate: 1e8, rewardTaps: 0, rewardBoxes: 2 },
  { id: 'special', text: '황금·폭탄·시계 상자를 터뜨려요', event: 'special', goal: 1, opens: 'special', gate: 1.8e8, rewardTaps: 0, rewardBoxes: 2 },
  { id: 'gear', text: '강화 탭에서 영구 공구를 하나 사요', event: 'gearBuy', goal: 1, opens: 'gear', gate: 0, rewardTaps: 0, rewardBoxes: 3 },
  { id: 'perkBox', text: '상자 탭에서 특전 상자를 뽑아요', event: 'perkBoxBuy', goal: 1, opens: 'perkBox', gate: 0, rewardTaps: 0, rewardBoxes: 3 },
  { id: 'tapLv', text: '공구를 Lv 68까지 강화해요', event: 'tick', goal: 68, progress: (s) => s.tapLevel, gate: 0, rewardTaps: 0, rewardBoxes: 4 },
  { id: 'home', text: '살림 레벨 합계를 250까지 올려요', event: 'tick', goal: 250, progress: (s) => s.homeLv.reduce((a, b) => a + b, 0), gate: 0, rewardTaps: 0, rewardBoxes: 6 },
  { id: 'strikeLv', text: '오함마를 Lv 62까지 강화해요', event: 'tick', goal: 62, progress: (s) => s.strikeLevel, gate: 0, rewardTaps: 0, rewardBoxes: 6 },
  { id: 'mult', text: '총 배율을 x1500까지 올려요', event: 'tick', goal: 1500, progress: totalMult, gate: 0, rewardTaps: 0, rewardBoxes: 8 },
  { id: 'move', text: '목표를 채워 이사해요', event: 'move', goal: 1, gate: 0, rewardTaps: 0 },
];

/** 단계의 진행 수: state로 판정하는 단계는 지금 값과 지금까지 닿은 값 중 큰 쪽, 나머지는 사건이 쌓은 값 */
const stepN = (def: GuideStepDef, state: GameState): number => Math.min(def.goal, def.progress ? Math.max(state.guide.n, def.progress(state)) : state.guide.n);

const stepIndex = (id: string) => GUIDE_STEPS.findIndex((s) => s.id === id);

/** 가이드 중 지금 이 단계인가(끝났으면 false) */
export function guideAt(state: GameState, stepId: string): boolean {
  return !guideEnded(state) && state.guide.step === stepIndex(stepId);
}

/** 특별 상자 단계에서는 처음 20개 뒤 어느 상자에서든 곧 만나도록 확률을 올린다(못 만나 막히는 일이 없게) */
export const GUIDE_SPECIAL_RATE = 0.2;

/** 요소가 열리는 단계 번호 */
const OPEN_STEP: Record<GuideFeature, number> = Object.fromEntries(GUIDE_STEPS.flatMap((s, i) => (s.opens ? [[s.opens, i]] : []))) as Record<GuideFeature, number>;

export const initialGuide = (): GuideState => ({ step: 0, n: 0, done: false });

/** 가이드를 이미 마친 상태(옛 저장 변환·시험용) */
export const finishedGuide = (): GuideState => ({ step: GUIDE_STEPS.length, n: 0, done: true });

/** 가이드가 끝났나(마쳤거나 이사를 했다) */
export function guideEnded(state: GameState): boolean {
  return state.guide.done || state.moves > 0;
}

/** 가이드 중이고 이 id의 단계에 닿았나(끝난 뒤에는 false). 단계적 공개처럼 "가이드가 열어 주는" 판정용 */
export function guideReached(state: GameState, stepId: string): boolean {
  return !guideEnded(state) && state.guide.step >= stepIndex(stepId);
}

/** 이 요소가 열려 있나. 가이드가 끝났거나 이사했으면 전부 true */
export function featureOpen(state: GameState, feature: GuideFeature): boolean {
  return guideEnded(state) || state.guide.step >= OPEN_STEP[feature];
}

export interface GuideView {
  /** 지금 단계 번호(1부터) */
  no: number;
  total: number;
  text: string;
  /** 진행 수(목표를 넘지 않는다) */
  n: number;
  goal: number;
  /** 이 단계를 끝내려면 필요한 누적 포인트(0이면 없음). 행동 목표를 채워도 모자라면 기다린다 */
  gate: number;
  /** 지금 누적 포인트가 gate에 닿았나 */
  gateMet: boolean;
  /** 끝냈을 때 보상(탭 몇 번어치, 그 P 값) */
  rewardTaps: number;
  rewardPoints: number;
  /** 끝냈을 때 받는 선물 상자 수(없으면 0) */
  rewardBoxes: number;
  /** 이 단계에 들어서며 열린 요소(없으면 null) */
  opens: GuideFeature | null;
  /** 이 단계가 기다리는 사건 */
  event: GuideEventType;
  /** 연쇄 단계 보조 안내(강타가 약할 때). 없으면 null */
  hint: 'upgrade' | 'aim' | null;
}

/** 화면용: 지금 단계. 가이드가 끝났으면 null */
export function guideView(state: GameState): GuideView | null {
  if (guideEnded(state) || state.guide.step >= GUIDE_STEPS.length) return null;
  const def = GUIDE_STEPS[state.guide.step];
  return {
    no: state.guide.step + 1,
    total: GUIDE_STEPS.length,
    text: def.text,
    n: stepN(def, state),
    goal: def.goal,
    gate: def.gate,
    gateMet: state.earned >= def.gate,
    rewardTaps: def.rewardTaps,
    rewardPoints: def.rewardTaps * tapStable(state),
    rewardBoxes: def.rewardBoxes ?? 0,
    opens: def.opens ?? null,
    event: def.event,
    hint: chainHint(state),
  };
}

/** 연쇄 단계에서 강타가 이만큼 모자라면 보조 안내를 띄운다 */
export const CHAIN_WEAK_MISSES = 2;

/** 강타가 약해 3개를 못 터뜨리는 중이면 보조 안내 종류: 살 수 있는 강화가 있으면 'upgrade', 없으면 'aim'(노란 칸). 아니면 null */
export function chainHint(state: GameState): 'upgrade' | 'aim' | null {
  if (guideEnded(state)) return null;
  const def = GUIDE_STEPS[state.guide.step];
  if (def?.id !== 'chain' || state.guide.n >= def.goal || (state.guide.miss ?? 0) < CHAIN_WEAK_MISSES) return null;
  return strikeCost(state.strikeLevel) <= state.points || tapCost(state.tapLevel) <= state.points ? 'upgrade' : 'aim';
}

export interface GuideResult {
  state: GameState;
  /** 이번 사건으로 단계를 끝냈나 */
  completed: boolean;
  /** 끝낸 단계(끝내지 않았으면 null) */
  step: GuideStepDef | null;
  /** 받은 보상 P(없으면 0) */
  reward: number;
  /** 받은 선물 상자 수(없으면 0)와 그 뽑기 결과(화면이 보여 준다) */
  rewardBoxes: number;
  boxResults: BoxResult[];
  /** 다음 단계가 열어 준 요소(없으면 null). 화면이 "새로 열렸어요" 연출에 쓴다 */
  opened: GuideFeature | null;
}

/** 아무 일도 없던 결과 */
const ENDED = (state: GameState): GuideResult => ({ state, completed: false, step: null, reward: 0, rewardBoxes: 0, boxResults: [], opened: null });

/**
 * 화면이 사건을 알리면 지금 단계의 진행·완료·보상을 계산한다. 지금 단계가 기다리는 사건이 아니어도 목표를 이미 채워 둔 채 누적 포인트(gate)만 기다리던 단계는 이때 끝난다(그래서 화면은 탭마다 'tap'을 알린다).
 * 단계를 끝내면 보상 P(= 탭 1회 수익 x rewardTaps, 포인트·누적에 더함)를 주고 다음 단계로 간다. 한 번에 한 단계만 끝낸다.
 * 'move'는 이사를 한 뒤(moves가 오른 뒤)에 알려도 된다: 가이드가 끝난 것으로 표시한다.
 */
export function guideEvent(state: GameState, ev: GuideEvent): GuideResult {
  const g = state.guide;
  if (g.done) return ENDED(state);
  if (ev.type === 'move' && state.moves > 0) {
    return { state: { ...state, guide: { step: GUIDE_STEPS.length, n: 0, done: true } }, completed: true, step: GUIDE_STEPS[GUIDE_STEPS.length - 1], reward: 0, rewardBoxes: 0, boxResults: [], opened: null };
  }
  if (state.moves > 0) return ENDED(state);
  const def = GUIDE_STEPS[g.step];
  if (!def) return ENDED(state);
  if (def.id === 'chain' && ev.type === 'strike') return { ...ENDED(state), state: { ...state, guide: { ...g, miss: (g.miss ?? 0) + 1 } } };
  let n = g.n;
  if (def.progress) n = stepN(def, state);
  else if (def.event === ev.type) n = Math.min(def.goal, VALUE_EVENTS.includes(ev.type) ? Math.max(g.n, 'value' in ev ? ev.value : 0) : g.n + 1);
  // 행동 목표를 채웠어도 누적 포인트(gate)가 모자라면 기다린다. 아무 사건(보통 탭)이 올 때 다시 본다
  if (n < def.goal || state.earned < def.gate) {
    return n === g.n ? ENDED(state) : { state: { ...state, guide: { ...g, n } }, completed: false, step: null, reward: 0, rewardBoxes: 0, boxResults: [], opened: null };
  }
  // 완료: 보상은 이 단계를 끝낸 때의 탭 수익 기준
  const reward = def.rewardTaps * tapStable(state);
  // 선물 상자: 값을 모은 사건 수와 단계로 씨앗을 정해 같은 판이면 같은 상자가 나온다(상자 가격·해금에는 세지 않는다)
  const rng = seededRng(state.stats.totalTaps * 31 + state.stats.boxesOpened * 17 + g.step * 7919 + 5);
  let collection = state.collection;
  const boxResults: BoxResult[] = [];
  for (let i = 0; i < (def.rewardBoxes ?? 0); i++) {
    const { item, variant } = rollBox(rng);
    const added = addToCollection(collection, item, variant);
    collection = added.collection;
    boxResults.push(added.result);
  }
  const step = g.step + 1;
  const done = step >= GUIDE_STEPS.length;
  return {
    state: { ...state, collection, points: state.points + reward, earned: state.earned + reward, stats: { ...state.stats, totalEarned: state.stats.totalEarned + reward }, guide: { step, n: 0, done } },
    completed: true,
    step: def,
    reward,
    rewardBoxes: boxResults.length,
    boxResults,
    opened: GUIDE_STEPS[step]?.opens ?? null,
  };
}
