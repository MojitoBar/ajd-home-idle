import { describe, expect, it } from 'vitest';
import { tick, pps } from './economy';
import { applyOffline } from './offline';
import { move } from './prestige';
import { parseSave, serialize } from './save';
import { defaultState, type GameState } from './state';
import {
  answerQuestion, clearEventResult, EVENT_BANNER_SEC, EVENT_MAX_SEC, EVENT_QUESTION_SEC, eventMultOf, generateQuestion, nextEventDelay,
  rewardDuration, startQuestion,
} from './event';

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('문제 생성', () => {
  it('300개 시드: 범위·8% 차이·함정 50%·정답 위치 50%', () => {
    let trap = 0;
    let rightFirst = 0;
    const N = 3000;
    for (let seed = 1; seed <= N; seed++) {
      const q = generateQuestion(mulberry(seed));
      expect([6, 12, 24]).toContain(q.months);
      expect(q.fixedMonthly).toBeGreaterThanOrEqual(10);
      expect(q.fixedMonthly).toBeLessThanOrEqual(40);
      expect([3, 6]).toContain(q.promoMonths);
      expect(q.promoMonths).toBeLessThan(q.months);
      expect(q.totalA).toBe(q.fixedMonthly * q.months);
      expect(q.totalB).toBe(q.promoFirst * q.promoMonths + q.promoAfter * (q.months - q.promoMonths));
      expect(Math.abs(q.totalA - q.totalB)).toBeGreaterThanOrEqual(0.08 * Math.max(q.totalA, q.totalB));
      expect(q.answer).toBe(q.totalA < q.totalB ? 'A' : 'B');
      if (q.trap) {
        trap++;
        expect(q.promoFirst).toBeLessThan(q.fixedMonthly);
        expect(q.promoAfter).toBeGreaterThan(q.fixedMonthly);
        expect(q.totalB).toBeGreaterThan(q.totalA);
        expect(q.answer).toBe('A');
      } else {
        expect(q.totalB).toBeLessThan(q.totalA);
      }
      if (q.order[0] === q.answer) rightFirst++;
    }
    expect(Math.abs(trap / N - 0.5)).toBeLessThan(0.05);
    expect(Math.abs(rightFirst / N - 0.5)).toBeLessThan(0.05);
  });
  it('난수 경계(0, 0.999..)에서도 조건 만족', () => {
    for (const v of [0, 0.9999999999]) {
      const q = generateQuestion(() => v);
      expect(Math.abs(q.totalA - q.totalB)).toBeGreaterThanOrEqual(0.08 * Math.max(q.totalA, q.totalB));
    }
  });
});

function toBanner(s: GameState): GameState {
  return tick(s, s.event.nextInSec + 0.1);
}

describe('이벤트 진행', () => {
  it('대기 -> 배너 -> 20초 지나면 소멸하고 타이머 재시작(8~12분)', () => {
    let s = toBanner(defaultState());
    expect(s.event.bannerSec).toBe(EVENT_BANNER_SEC);
    s = tick(s, 10);
    expect(s.event.bannerSec).toBeCloseTo(10, 6);
    s = tick(s, 10.5, () => 0);
    expect(s.event.bannerSec).toBe(0);
    expect(s.event.nextInSec).toBe(480);
    expect(nextEventDelay(() => 1)).toBe(720);
  });
  it('배너를 누르면 문제 시작, 배너 없으면 null', () => {
    expect(startQuestion(defaultState(), mulberry(1))).toBeNull();
    const s = startQuestion(toBanner(defaultState()), mulberry(1))!;
    expect(s.event.question).not.toBeNull();
    expect(s.event.questionSec).toBe(EVENT_QUESTION_SEC);
    expect(startQuestion(s, mulberry(2))).toBeNull();
  });
  it('정답: E=3x 120초, 연속이면 +30초(최대 210), 갱신(합산 아님)', () => {
    expect([0, 1, 2, 3, 4, 9].map(rewardDuration)).toEqual([120, 150, 180, 210, 210, 210]);
    let s = startQuestion(toBanner(defaultState()), mulberry(3))!;
    const q = s.event.question!;
    s = answerQuestion(s, q.answer)!;
    expect(s.event.remainSec).toBe(120);
    expect(s.event.streak).toBe(1);
    expect(s.event.result?.correct).toBe(true);
    expect(eventMultOf(s.event)).toBe(3);
    // 수익에 x3
    const base = { ...defaultState(), services: [10, 0, 0, 0, 0, 0, 0, 0] };
    expect(pps({ ...base, event: s.event })).toBeCloseTo(pps(base) * 3, 8);
    // 진행 중 두 번째 정답: 합산이 아니라 150으로 갱신
    s = tick(s, 50);
    s = startQuestion(toBanner(s), mulberry(4))!;
    s = answerQuestion(s, s.event.question!.answer)!;
    expect(s.event.remainSec).toBe(150);
    expect(s.event.streak).toBe(2);
    expect(EVENT_MAX_SEC).toBe(210);
  });
  it('오답·시간 초과: 보너스 없음, 연속 0, 해설 결과', () => {
    let s = { ...startQuestion(toBanner({ ...defaultState(), event: { ...defaultState().event, streak: 2 } }), mulberry(5))! };
    const q = s.event.question!;
    const wrong = answerQuestion(s, q.answer === 'A' ? 'B' : 'A')!;
    expect(wrong.event.remainSec).toBe(0);
    expect(wrong.event.streak).toBe(0);
    expect(wrong.event.result).toMatchObject({ correct: false, timedOut: false, answer: q.answer, totalA: q.totalA, totalB: q.totalB });
    s = tick(s, EVENT_QUESTION_SEC + 0.1);
    expect(s.event.question).toBeNull();
    expect(s.event.streak).toBe(0);
    expect(s.event.result).toMatchObject({ correct: false, timedOut: true, choice: null });
    expect(clearEventResult(s).event.result).toBeNull();
    expect(answerQuestion(s, 'A')).toBeNull();
  });
  it('만료: remainSec이 줄어 0이 되면 E=1', () => {
    let s = startQuestion(toBanner(defaultState()), mulberry(6))!;
    s = answerQuestion(s, s.event.question!.answer)!;
    s = tick(s, 119);
    expect(eventMultOf(s.event)).toBe(3);
    s = tick(s, 2);
    expect(s.event.remainSec).toBe(0);
    expect(eventMultOf(s.event)).toBe(1);
  });
  it('이사: 진행 중 이벤트 초기화, 연속 정답 유지', () => {
    const s = startQuestion(toBanner({ ...defaultState(), earned: 5.5e7, event: { ...defaultState().event, remainSec: 50, streak: 4 } }), mulberry(7))!;
    const m = move(s)!;
    expect(m.event).toMatchObject({ remainSec: 0, bannerSec: 0, question: null, questionSec: 0, result: null, streak: 4 });
  });
  it('오프라인 보상에는 E를 적용하지 않음', () => {
    const base = { ...defaultState(), services: [10, 0, 0, 0, 0, 0, 0, 0], savedAt: 0 };
    const a = applyOffline(base, 3600_000).report!.gain;
    const b = applyOffline({ ...base, event: { ...base.event, remainSec: 100 } }, 3600_000).report!.gain;
    expect(b).toBeCloseTo(a, 8);
  });
});

describe('저장 v2', () => {
  it('도감·이벤트 왕복, 진행 중 문제는 저장하지 않음', () => {
    const s0 = startQuestion(toBanner(defaultState()), mulberry(8))!;
    const s = { ...s0, collection: { fan: { base: 2, shiny: 0, gold: 0, rainbow: 0 } }, event: { ...s0.event, streak: 3, remainSec: 40 } };
    const r = parseSave(serialize(s, 5));
    expect(r.kind).toBe('ok');
    expect(r.state.collection).toEqual(s.collection);
    expect(r.state.event).toMatchObject({ streak: 3, remainSec: 40, bannerSec: 0, question: null, result: null });
    expect(r.state.event.nextInSec).toBeGreaterThan(0);
  });
  it('1차 저장 데이터(v1)를 불러와도 깨지지 않음', () => {
    const v1 = { version: 1, savedAt: 9, points: 77, earned: 99, moves: 1, tapLevel: 2, services: [3, 0, 0, 0, 0, 0, 0, 0], boxesThisRun: 0, collection: {}, event: { nextInSec: 300, remainSec: 0, streak: 1 }, stats: { totalTaps: 1, totalEarned: 2, playSec: 3, boxesOpened: 0 }, settings: { reduceMotion: true } };
    const r = parseSave(JSON.stringify(v1));
    expect(r.kind).toBe('ok');
    expect(r.state.version).toBe(6);
    expect(r.state.points).toBe(77);
    expect(r.state.event).toEqual({ nextInSec: 300, remainSec: 0, streak: 1, bannerSec: 0, question: null, questionSec: 0, result: null });
    expect(r.state.collection).toEqual({});
  });
});
