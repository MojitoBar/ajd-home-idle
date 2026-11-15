import { describe, expect, it } from 'vitest';
import { canMove, houseInfo, move, moveProgress, permMultAfterMove } from './prestige';
import { defaultState } from './state';
import { permMult } from './economy';

describe('이사', () => {
  it('영구 배율 1+1.5*moves', () => {
    expect([0, 1, 2, 3, 4, 5].map(permMult)).toEqual([1, 2.5, 4, 5.5, 7, 8.5]);
  });
  it('집 단계 목표는 표와 같고 9단계 이후는 x40', () => {
    expect(houseInfo(0).target).toBe(5.5e7);
    expect(houseInfo(4).name).toBe('달 기지');
    expect(houseInfo(8).target).toBeCloseTo(8.96e21, -10);
    expect(houseInfo(9).target / houseInfo(8).target).toBeCloseTo(40);
    expect(houseInfo(10).target / houseInfo(9).target).toBeCloseTo(40);
    expect(houseInfo(9).name).toBe('우주 끝 신도시 1차');
  });
  it('조건 미달이면 이사 불가', () => {
    const s = { ...defaultState(), earned: 7999999 };
    expect(canMove(s)).toBe(false);
    expect(move(s)).toBeNull();
    expect(moveProgress(s)).toBeLessThan(1);
  });
  it('earned 기준으로 판정(소비해도 안 줄어듦)', () => {
    const s = { ...defaultState(), earned: 5.5e7, points: 0 };
    expect(canMove(s)).toBe(true);
  });
  it('초기화 범위와 유지 범위', () => {
    const s = {
      ...defaultState(1234),
      points: 5e5,
      earned: 6e7,
      moves: 0,
      tapLevel: 7,
      services: [12, 3, 1, 0, 0, 0, 0, 0],
      boxesThisRun: 4,
      collection: { fan: { base: 2, shiny: 1, gold: 0, rainbow: 0 } },
      event: { ...defaultState().event, nextInSec: 300, remainSec: 50, streak: 3 },
      stats: { totalTaps: 100, totalEarned: 3e6, playSec: 900, boxesOpened: 9 },
      settings: { reduceMotion: true },
    };
    const m = move(s)!;
    expect(m.points).toBe(0);
    expect(m.earned).toBe(0);
    expect(m.tapLevel).toBe(0);
    expect(m.services).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(m.boxesThisRun).toBe(0);
    expect(m.event.remainSec).toBe(0);
    expect(m.moves).toBe(1);
    expect(m.collection).toEqual(s.collection);
    expect(m.stats).toEqual(s.stats);
    expect(m.settings).toEqual(s.settings);
    expect(m.event.streak).toBe(3);
    expect(permMultAfterMove(s)).toBe(2.5);
  });
});
