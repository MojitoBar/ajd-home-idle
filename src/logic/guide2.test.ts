import { describe, expect, it } from 'vitest';
import { GUIDE2_STEPS, finishedGuide2, guide2Active, guide2At, guide2Settle, guide2Update, guide2View } from './guide2';
import { defaultState, type GameState } from './state';
import { finishedGuide } from './guide';
import { emptyDeck, type DeckSlot } from './deck';
import { parseSave, serialize } from './save';
import { CARDS, STACK_PICK_EVERY } from '../data/cards';

const slot = (id: string, stacks = 0): DeckSlot => ({ id, star: 1, charge: 0, stacks });
const base = (extra: Partial<GameState> = {}, deck: Partial<GameState['deck']> = {}): GameState => ({ ...defaultState(0, 1), moves: 1, guide: finishedGuide(), deck: { ...emptyDeck(), ...deck }, ...extra });

describe('가이드 2부 판정', () => {
  it('5단계, 이사 1회일 때만 돈다', () => {
    expect(GUIDE2_STEPS).toHaveLength(5);
    expect(guide2Active(base())).toBe(true);
    expect(guide2Active({ ...base(), moves: 0 })).toBe(false);
    expect(guide2Active({ ...base(), moves: 2 })).toBe(false);
    expect(guide2Active({ ...base(), guide2: finishedGuide2() })).toBe(false);
    expect(guide2View(base())?.text).toBe('공구함 카드를 하나 골라요');
  });

  it('1단계: 카드를 고르면 끝, 다음 단계는 눈금 채우기', () => {
    const s = base();
    expect(guide2Update(s).completed).toBeNull();
    const r = guide2Update(base({}, { slots: [slot('a')] }));
    expect(r.completed?.id).toBe('pick');
    expect(r.no).toBe(1);
    expect(r.state.guide2.step).toBe(1);
  });

  it('2단계: 스택이 1이 되면 끝', () => {
    const s = base({ guide2: { step: 1, done: false } }, { slots: [slot('a')] });
    expect(guide2Update(s).completed).toBeNull();
    const r = guide2Update(base({ guide2: { step: 1, done: false } }, { slots: [slot('a', 1)] }));
    expect(r.completed?.id).toBe('stack');
    expect(r.state.guide2.step).toBe(2);
  });

  it('3단계: 낀 카드 3장이면 끝', () => {
    const at = (n: number) => base({ guide2: { step: 2, done: false } }, { slots: Array.from({ length: n }, (_, i) => slot(`c${i}`, 1)) });
    expect(guide2Update(at(2)).completed).toBeNull();
    expect(guide2Update(at(3)).completed?.id).toBe('cards');
  });

  it('4단계: 강화 고르기를 끝내면(건너뛰기 포함) 끝', () => {
    const slots = [slot('a', 1), slot('b', 1), slot('c', 1)];
    const at = (deck: object) => base({ guide2: { step: 3, done: false } }, { slots, ...deck });
    expect(guide2Update(at({ chargedStacks: 6, boostMade: 1, boostPacks: 1 })).completed).toBeNull();
    expect(guide2Update(at({ chargedStacks: 6, boostMade: 1, boostPacks: 0 })).completed?.id).toBe('boost');
    expect(guide2View(at({ chargedStacks: 4 }))).toMatchObject({ n: 4, goal: STACK_PICK_EVERY });
  });

  it('5단계: 이사 2회가 되면 2부가 끝난다', () => {
    const s = base({ guide2: { step: 4, done: false } }, { slots: [slot('a', 1)] });
    expect(guide2Update(s).completed).toBeNull();
    const r = guide2Update({ ...s, moves: 2 });
    expect(r.finished).toBe(true);
    expect(r.completed?.id).toBe('move');
    expect(r.state.guide2.done).toBe(true);
    expect(guide2Active(r.state)).toBe(false);
  });

  it('이미 끝난 일은 연출 없이 건너뛴다', () => {
    const slots = [slot('a', 2), slot('b'), slot('c')];
    const s = base({}, { slots });
    // 1단계가 끝나는 순간 2·3단계는 이미 끝나 있어 4단계로 간다
    const r = guide2Update(s);
    expect(r.completed?.id).toBe('pick');
    expect(r.state.guide2.step).toBe(3);
    // 불러올 때도 조용히 같은 단계로 간다
    expect(guide2Settle(s).guide2.step).toBe(3);
    // 이사 단계는 이사해야만 끝난다
    const all = base({}, { slots, boostMade: 1, boostPacks: 0 });
    expect(guide2Settle(all).guide2.step).toBe(4);
    expect(guide2At(guide2Settle(all), 'move')).toBe(true);
  });
});

describe('가이드 2부 저장 이전(v16 -> v17)', () => {
  const v16 = (moves: number, deck: Record<string, unknown> = {}) => {
    const s = { ...defaultState(0, 1), moves, guide: finishedGuide() } as unknown as Record<string, unknown>;
    delete s.guide2;
    delete s.story;
    return JSON.stringify({ ...s, version: 16, deck: { ...emptyDeck(), ...deck } });
  };
  it('이사 0회는 아직 시작 전, 1회는 지금 상태에 맞는 단계, 2회 이상은 끝', () => {
    expect(parseSave(v16(0)).state.guide2).toEqual({ step: 0, done: false });
    expect(parseSave(v16(1)).state.guide2).toEqual({ step: 0, done: false });
    expect(parseSave(v16(1, { slots: [slot(CARDS[0].id, 1), slot(CARDS[1].id), slot(CARDS[2].id)] })).state.guide2).toEqual({ step: 3, done: false });
    expect(parseSave(v16(2)).state.guide2.done).toBe(true);
    expect(parseSave(v16(7)).state.guide2.done).toBe(true);
  });
  it('저장하고 다시 읽어도 그대로', () => {
    const s = base({ guide2: { step: 2, done: false } }, { slots: [slot('a', 1)] });
    const back = parseSave(serialize(s, 1)).state;
    expect(back.guide2).toEqual({ step: 2, done: false });
  });
});
