import type { CardId, EventQuestion, EventResult, EventState, GameState } from './state';

export const EVENT_MULT = 3;
export const EVENT_BASE_SEC = 120;
export const EVENT_STREAK_BONUS_SEC = 30;
export const EVENT_MAX_SEC = 210;
export const EVENT_INTERVAL_MIN_SEC = 480;
export const EVENT_INTERVAL_MAX_SEC = 720;
export const EVENT_BANNER_SEC = 20;
export const EVENT_QUESTION_SEC = 15;
export const EVENT_MIN_GAP = 0.08;

const MONTHS = [6, 12, 24];
const PROMO_MONTHS = [3, 6];
const MAX_TRIES = 2000;

export function eventMultOf(event: EventState): number {
  return event.remainSec > 0 ? EVENT_MULT : 1;
}

/** 다음 발생까지의 대기 시간(8~12분). */
export function nextEventDelay(rng?: () => number): number {
  const r = rng ? rng() : 0.5;
  return EVENT_INTERVAL_MIN_SEC + r * (EVENT_INTERVAL_MAX_SEC - EVENT_INTERVAL_MIN_SEC);
}

const randInt = (rng: () => number, lo: number, hi: number) => lo + Math.min(hi - lo, Math.floor(rng() * (hi - lo + 1)));

export function questionTotals(q: Pick<EventQuestion, 'months' | 'fixedMonthly' | 'promoMonths' | 'promoFirst' | 'promoAfter'>) {
  return {
    totalA: q.fixedMonthly * q.months,
    totalB: q.promoFirst * q.promoMonths + q.promoAfter * (q.months - q.promoMonths),
  };
}

function build(
  months: number,
  fixedMonthly: number,
  promoMonths: number,
  promoFirst: number,
  promoAfter: number,
  trap: boolean,
  swap: boolean,
): EventQuestion {
  const { totalA, totalB } = questionTotals({ months, fixedMonthly, promoMonths, promoFirst, promoAfter });
  return {
    months,
    fixedMonthly,
    promoMonths,
    promoFirst,
    promoAfter,
    totalA,
    totalB,
    order: swap ? ['B', 'A'] : ['A', 'B'],
    answer: totalA < totalB ? 'A' : 'B',
    trap,
  };
}

/** 문제 생성. 함정 50%, 총액 차이 >= 큰 쪽의 8%, 정답 위치 50:50. 난수는 rng에서만 뽑는다. */
export function generateQuestion(rng: () => number): EventQuestion {
  const trap = rng() < 0.5;
  const swap = rng() < 0.5;
  for (let i = 0; i < MAX_TRIES; i++) {
    const months = MONTHS[Math.min(MONTHS.length - 1, Math.floor(rng() * MONTHS.length))];
    const a = randInt(rng, 10, 40);
    const p = PROMO_MONTHS[Math.min(PROMO_MONTHS.length - 1, Math.floor(rng() * PROMO_MONTHS.length))];
    if (p >= months) continue; // p < M (6개월 기간에서 p=6 제외)
    let b1: number;
    let b2: number;
    if (trap) {
      b1 = randInt(rng, 1, a - 1);
      b2 = randInt(rng, a + 1, 60);
    } else {
      b1 = randInt(rng, 1, 60);
      b2 = randInt(rng, 1, 60);
    }
    const { totalA, totalB } = questionTotals({ months, fixedMonthly: a, promoMonths: p, promoFirst: b1, promoAfter: b2 });
    if (totalA === totalB) continue;
    if (trap ? !(totalB > totalA) : !(totalB < totalA)) continue;
    if (Math.abs(totalA - totalB) < EVENT_MIN_GAP * Math.max(totalA, totalB)) continue;
    return build(months, a, p, b1, b2, trap, swap);
  }
  return trap ? build(12, 20, 3, 10, 26, true, swap) : build(12, 30, 3, 10, 20, false, swap);
}

/** 대기 중 타이머 만료 -> 배너 표시. 배너 만료 -> 소멸 후 타이머 재시작. 문제 시간 초과 -> 오답 처리. */
export function advanceEvent(ev: EventState, dt: number, rng?: () => number): EventState {
  let e = ev;
  if (e.remainSec > 0) e = { ...e, remainSec: Math.max(0, e.remainSec - dt) };
  if (e.question) {
    const left = e.questionSec - dt;
    if (left > 0) return { ...e, questionSec: left };
    return resolve(e, null, rng);
  }
  if (e.bannerSec > 0) {
    const left = e.bannerSec - dt;
    if (left > 0) return { ...e, bannerSec: left };
    return { ...e, bannerSec: 0, nextInSec: nextEventDelay(rng) };
  }
  const left = e.nextInSec - dt;
  if (left > 0) return { ...e, nextInSec: left };
  return { ...e, bannerSec: EVENT_BANNER_SEC };
}

/** 배너를 눌러 문제 시작. 배너가 없거나 이미 진행 중이면 null. */
export function startQuestion(state: GameState, rng: () => number): GameState | null {
  const e = state.event;
  if (!(e.bannerSec > 0) || e.question) return null;
  return {
    ...state,
    event: { ...e, bannerSec: 0, question: generateQuestion(rng), questionSec: EVENT_QUESTION_SEC, result: null, nextInSec: nextEventDelay(rng) },
  };
}

export function rewardDuration(streakBefore: number): number {
  return Math.min(EVENT_MAX_SEC, EVENT_BASE_SEC + EVENT_STREAK_BONUS_SEC * streakBefore);
}

function resolve(e: EventState, choice: CardId | null, rng?: () => number): EventState {
  const q = e.question!;
  const correct = choice !== null && choice === q.answer;
  const rewardSec = correct ? rewardDuration(e.streak) : 0;
  const result: EventResult = { correct, choice, timedOut: choice === null, answer: q.answer, totalA: q.totalA, totalB: q.totalB, rewardSec };
  return {
    ...e,
    question: null,
    questionSec: 0,
    bannerSec: 0,
    nextInSec: nextEventDelay(rng),
    remainSec: correct ? rewardSec : e.remainSec,
    streak: correct ? e.streak + 1 : 0,
    result,
  };
}

/** 카드 선택. 진행 중인 문제가 없으면 null. 정답이면 remainSec을 갱신(합산 아님). */
export function answerQuestion(state: GameState, choice: CardId, rng?: () => number): GameState | null {
  if (!state.event.question) return null;
  return { ...state, event: resolve(state.event, choice, rng) };
}

export function clearEventResult(state: GameState): GameState {
  return state.event.result ? { ...state, event: { ...state.event, result: null } } : state;
}
