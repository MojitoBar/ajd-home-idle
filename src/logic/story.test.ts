import { describe, expect, it } from 'vitest';
import { migrate, parseSave, sanitize, serialize } from './save';
import { defaultState } from './state';
import { ENDING_MOVES, endingDue, introDue, noteDue, seeEnding, seeIntro, seeNote } from './story';
import { NOTES } from '../data/story';
import { HOUSES } from '../data/houses';

const v16 = (over: Record<string, unknown> = {}): Record<string, unknown> => {
  const { story, ...rest } = defaultState(5, 1) as unknown as Record<string, unknown>;
  void story;
  return { ...rest, version: 16, ...over };
};

describe('이야기 저장 v17', () => {
  it('새 저장 기본값: 아무것도 안 봄', () => {
    expect(defaultState().story).toEqual({ intro: false, notes: [], ending: false });
    expect(parseSave(null).state.story).toEqual({ intro: false, notes: [], ending: false });
  });
  it('v16 -> v17: 플레이한 저장은 인트로 봄 + 지금 집까지 쪽지 본 것, 엔딩은 안 봄', () => {
    const old = v16({ moves: 3, points: 123, homeLv: [1, 2, 3, 4, 5, 6, 7, 8], stats: { totalTaps: 99, totalEarned: 5, playSec: 1, boxesOpened: 4 } });
    const r = parseSave(JSON.stringify(old));
    expect(r.kind).toBe('ok');
    expect(r.state.version).toBe(17);
    expect(r.state.story).toEqual({ intro: true, notes: [1, 2, 3], ending: false });
    expect(r.state.moves).toBe(3);
    expect(r.state.points).toBe(123);
    expect(r.state.homeLv).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it('v16 -> v17은 이야기·가이드 2부 필드만 늘린다(나머지 진행 필드 불변)', () => {
    const old = v16({ moves: 5, points: 77, tapLevel: 4, bestChain: 9 });
    const after = migrate(old)!;
    const { story, version, guide2, ...rest } = after;
    const { version: v0, guide2: g0, ...rest0 } = old;
    void story, version, v0, g0;
    expect(guide2).toEqual({ step: 0, done: true });
    expect(rest).toEqual(rest0);
  });
  it('이사 8회를 넘긴 옛 저장도 쪽지는 8개까지만, 엔딩은 안 본 것', () => {
    const s = migrate(v16({ moves: 12 }))!;
    expect((s.story as { notes: number[] }).notes).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect((s.story as { ending: boolean }).ending).toBe(false);
  });
  it('v16 저장이어도 한 번도 안 한 새 게임이면 인트로는 아직 안 본 것', () => {
    expect(parseSave(JSON.stringify(v16())).state.story.intro).toBe(false);
  });
  it('v17 왕복, 깨진 story는 기본값', () => {
    const s = { ...defaultState(), story: { intro: true, notes: [2, 1], ending: true } };
    expect(parseSave(serialize(s, 1)).state.story).toEqual({ intro: true, notes: [1, 2], ending: true });
    const bad = sanitize({ ...(defaultState() as unknown as Record<string, unknown>), story: { intro: 'x', notes: [99, -1, 'a', 3], ending: 1 } });
    expect(bad.story).toEqual({ intro: false, notes: [3], ending: false });
  });
});

describe('이야기 판정', () => {
  const base = defaultState();
  it('인트로: 새 게임(탭·이사 0, 가이드 시작 전)에서만', () => {
    expect(introDue(base)).toBe(true);
    expect(introDue(seeIntro(base))).toBe(false);
    expect(introDue({ ...base, stats: { ...base.stats, totalTaps: 1 } })).toBe(false);
    expect(introDue({ ...base, moves: 1 })).toBe(false);
    expect(introDue({ ...base, guide: { step: 1, n: 0, done: false } })).toBe(false);
  });
  it('도착 쪽지: 1~8번 집에서 처음 한 번', () => {
    expect(noteDue({ ...base, moves: 0 })).toBeNull();
    expect(noteDue({ ...base, moves: 4 })).toBe(4);
    expect(noteDue(seeNote({ ...base, moves: 4 }, 4))).toBeNull();
    expect(noteDue({ ...base, moves: 9 })).toBeNull();
    for (let n = 1; n < HOUSES.length; n++) expect(NOTES[n]).toBeTruthy();
  });
  it('엔딩: 안 봤고 이사 8회 이상', () => {
    expect(ENDING_MOVES).toBe(HOUSES.length - 1);
    expect(endingDue({ ...base, moves: 7 })).toBe(false);
    expect(endingDue({ ...base, moves: 8 })).toBe(true);
    expect(endingDue({ ...base, moves: 11 })).toBe(true);
    expect(endingDue(seeEnding({ ...base, moves: 8 }))).toBe(false);
  });
});
