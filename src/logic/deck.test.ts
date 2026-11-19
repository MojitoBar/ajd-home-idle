import { describe, expect, it } from 'vitest';
import { CARDS, DECK_MARKS } from '../data/cards';
import { chooseCard, checkMarks, deckAfterMove, deckEffects, deckEvent, deckFull, deckSlots, deckStrikeMult, emptyDeck, markThreshold, marksPassed, rollCardOffer, type DeckState } from './deck';
import { gearEffects } from './gear';
import { houseInfo } from './house';
import { perkEffects } from './perks';
import { move } from './prestige';
import { releaseCharge } from './charge';
import { defaultState } from './testState';
import type { GameState } from './state';
import { endlessHp, heavyHit, tapAndHit } from './unpack';

const never = () => 0.99;
const withDeck = (over: Partial<DeckState>, extra: Partial<GameState> = {}): GameState => {
  const s = defaultState();
  return { ...s, moves: 1, ...extra, deck: { ...s.deck, ...over } };
};
const slot = (id: string) => ({ id, star: 1 });

describe('공구함 덱: 칸·효과', () => {
  it('1단계는 3칸', () => {
    expect([0, 1, 4, 9].map(deckSlots)).toEqual([3, 3, 3, 3]);
  });
  it('카드 4장(P2·C1·P3·C3)과 자료 구조 필드', () => {
    expect(CARDS.map((c) => c.id)).toEqual(['P2', 'C1', 'P3', 'C3']);
    for (const c of CARDS) expect(c.tags.length).toBeGreaterThan(0);
  });
  it('덱이 비면 효과가 0이고 특전·공구 값과 같다', () => {
    const s = defaultState();
    expect(deckEffects(s)).toEqual({ streakBonus: 0, chainCapAdd: 0 });
    expect(perkEffects(s).streakBonus).toBe(0);
    expect(gearEffects(s).chainCap).toBe(20);
  });
  it('P2는 연속 계수 +0.25, C1은 연쇄 상한 +30', () => {
    const s = withDeck({ slots: [slot('P2'), slot('C1')] });
    expect(perkEffects(s).streakBonus).toBeCloseTo(0.25);
    expect(gearEffects(s).chainCap).toBe(50);
  });
  it('P3는 연속 퍼펙트가 10의 배수인 퍼펙트 강타만 x3', () => {
    const s = withDeck({ slots: [slot('P3')] });
    expect(deckStrikeMult(s, 'perfect', 10)).toBe(3);
    expect(deckStrikeMult(s, 'perfect', 20)).toBe(3);
    expect(deckStrikeMult(s, 'perfect', 9)).toBe(1);
    expect(deckStrikeMult(s, 'good', 10)).toBe(1);
    expect(deckStrikeMult(defaultState(), 'perfect', 10)).toBe(1);
  });
  it('releaseCharge가 P3의 x3과 발동 기록을 붙인다', () => {
    const base = withDeck({}, { earned: 1 });
    const s = withDeck({ slots: [slot('P3')] }, { earned: 1 });
    const a = releaseCharge(base, never, 0.83, 9, 1);
    const b = releaseCharge(s, never, 0.83, 9, 1);
    expect(b.streak).toBe(10);
    expect(b.taps).toBe(a.taps * 3);
    expect(b.deckFires[0]).toEqual({ id: 'P3', times: 1, mult: 3 });
    expect(a.deckFires).toEqual([]);
  });
});

describe('공구함 덱: 강타 사건', () => {
  it('3,000연쇄 강타에서 C3는 한 줄 x30으로 묶인다(칸이 여러 개여도 카드당 한 줄)', () => {
    const s = withDeck({ slots: [slot('C3'), slot('C1'), slot('P2')] });
    expect(deckEvent(s, { chain: 3000 })).toEqual([{ id: 'C3', times: 30, taps: 600 }]);
    expect(deckEvent(s, { chain: 99 })).toEqual([]);
    expect(deckEvent(defaultState(), { chain: 3000 })).toEqual([]);
  });
  it('heavyHit이 보상을 P·누적에 더하고 기록에 gain을 채운다', () => {
    const endless = (deck: Partial<DeckState>): GameState => {
      const b = withDeck(deck, { moves: 1 });
      const u = { ...b.unpack, box: 100, roomDone: true };
      return { ...b, unpack: { ...u, hp: endlessHp({ ...b, unpack: u }, 100) } };
    };
    const plain = endless({ mark: 6 });
    const s = endless({ slots: [slot('C3')], mark: 6 });
    const a = heavyHit(plain, never, 20000);
    const b = heavyHit(s, never, 20000);
    expect(a.chain).toBeGreaterThanOrEqual(100);
    expect(b.chain).toBe(a.chain);
    expect(a.deckFires).toEqual([]);
    expect(b.deckFires).toHaveLength(1);
    const f = b.deckFires[0];
    expect(f.times).toBe(Math.floor(b.chain / 100));
    expect(f.gain).toBeGreaterThan(0);
    expect(b.state.points - a.state.points).toBeCloseTo(f.gain!, -3);
    expect(b.state.earned - a.state.earned).toBeCloseTo(f.gain!, -3);
    expect(b.state.stats.totalEarned - a.state.stats.totalEarned).toBeCloseTo(f.gain!, -3);
  });
});

describe('공구함 덱: 문턱·묶음', () => {
  it('문턱은 목표 쪽 자릿수 표이고 커진다', () => {
    const t = [1, 2, 3, 4, 5].map((k) => markThreshold(1, k));
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1]);
    expect(t[4]).toBeCloseTo(houseInfo(1).target * 10 ** -0.25, -3);
    expect(markThreshold(9, 1)).toBeCloseTo(houseInfo(9).target * 10 ** -1.47, -3);
  });
  it('첫 집은 문턱을 보지 않고 같은 상태를 돌려준다', () => {
    const s = { ...defaultState(), earned: 1e30 };
    expect(checkMarks(s)).toBe(s);
  });
  it('문턱을 넘으면 묶음 1개(서로 다른 3장), mark+1', () => {
    const s = withDeck({ mark: 1 }, { earned: markThreshold(1, 1) });
    const r = checkMarks(s);
    expect(r.deck.mark).toBe(2);
    expect(r.deck.offers).toHaveLength(1);
    expect(new Set(r.deck.offers[0]).size).toBe(3);
    expect(checkMarks(r)).toBe(r);
  });
  it('한 번에 문턱 여러 개를 넘어도 묶음은 1개', () => {
    const s = withDeck({ mark: 1 }, { earned: markThreshold(1, 5) * 2 });
    const r = checkMarks(s);
    expect(r.deck.mark).toBe(DECK_MARKS);
    expect(r.deck.offers).toHaveLength(1);
    expect(checkMarks(r)).toBe(r);
  });
  it('묶음은 안 낀 카드를 먼저 담는다', () => {
    const o = rollCardOffer([slot('P2'), slot('C1')], 5);
    expect(o).toHaveLength(3);
    expect(o).toContain('P3');
    expect(o).toContain('C3');
  });
  it('tapAndHit·heavyHit 안에서도 문턱이 처리된다', () => {
    const s = withDeck({ mark: 1 }, { earned: markThreshold(1, 1) });
    const r = tapAndHit(s, never);
    expect(r.deckOffered).toBe(true);
    expect(r.state.deck.offers).toHaveLength(1);
    expect(tapAndHit(r.state, never).deckOffered).toBe(false);
  });
});

describe('공구함 덱: 고르기·교체·건너뛰기', () => {
  const offer = (o: string[], slots: DeckState['slots'] = []): GameState => withDeck({ offers: [o], slots });
  it('빈 칸에는 뒤에 끼우고 묶음이 사라진다', () => {
    const r = chooseCard(offer(['P2', 'C1', 'P3']), 0, 'C1')!;
    expect(r.deck.slots).toEqual([slot('C1')]);
    expect(r.deck.offers).toEqual([]);
  });
  it('묶음에 없는 카드·없는 묶음·이미 낀 카드는 null', () => {
    expect(chooseCard(offer(['P2', 'C1', 'P3']), 0, 'C3')).toBeNull();
    expect(chooseCard(offer(['P2', 'C1', 'P3']), 1, 'P2')).toBeNull();
    expect(chooseCard(offer(['P2', 'C1', 'P3'], [slot('P2')]), 0, 'P2')).toBeNull();
  });
  it('칸이 차면 바꿀 칸을 줘야 하고 원래 카드는 버려진다', () => {
    const full = offer(['C3', 'C1', 'P3'], [slot('P2'), slot('C1'), slot('P3')]);
    expect(deckFull(full)).toBe(true);
    expect(chooseCard(full, 0, 'C3')).toBeNull();
    expect(chooseCard(full, 0, 'C3', 3)).toBeNull();
    const r = chooseCard(full, 0, 'C3', 1)!;
    expect(r.deck.slots.map((s) => s.id)).toEqual(['P2', 'C3', 'P3']);
    expect(r.deck.offers).toEqual([]);
  });
  it('건너뛰기는 묶음만 버린다', () => {
    const r = chooseCard(offer(['P2', 'C1', 'P3'], [slot('C3')]), 0, null)!;
    expect(r.deck.slots).toEqual([slot('C3')]);
    expect(r.deck.offers).toEqual([]);
  });
});

describe('공구함 덱: 이사', () => {
  const ready = (): GameState => ({ ...defaultState(), earned: 3.3e10 });
  it('이사하면 덱을 비우고 첫 묶음 1개·문턱 1·다시 받기 2', () => {
    const s = { ...ready(), deck: { ...emptyDeck(), slots: [slot('P2')], offers: [['C1', 'P3', 'C3']], mark: 4, rerolls: 0 } };
    const r = move(s)!;
    expect(r.deck.slots).toEqual([]);
    expect(r.deck.offers).toHaveLength(1);
    expect(r.deck.offers[0]).toHaveLength(3);
    expect(r.deck.mark).toBe(1);
    expect(r.deck.rerolls).toBe(2);
  });
  it('이사는 호출자의 난수열을 덱에 쓰지 않는다', () => {
    let calls = 0;
    const a = move(ready(), () => (calls++, 0.5))!;
    const calls2 = calls;
    calls = 0;
    const b = move({ ...ready(), deck: { ...emptyDeck(), slots: [slot('P2')] } }, () => (calls++, 0.5))!;
    expect(calls).toBe(calls2);
    expect(a.deck.offers).toEqual(b.deck.offers);
  });
  it('이사 직후 문턱은 아직 안 넘은 상태', () => {
    const r = deckAfterMove({ ...ready(), moves: 0 });
    expect(marksPassed(1, 0)).toBe(1);
    expect(r.mark).toBe(1);
  });
});

describe('덱이 없으면 기존 결과와 같다', () => {
  it('덱 필드가 없어도 효과 값은 그대로고, 빈 덱의 강타는 카드 기록이 없다', () => {
    for (const moves of [0, 1, 3]) {
      const s = { ...defaultState(), moves, earned: 5 };
      const noDeck = { ...s } as Partial<GameState>;
      delete noDeck.deck;
      expect(perkEffects(s)).toEqual(perkEffects(noDeck as GameState));
      expect(gearEffects(s)).toEqual(gearEffects(noDeck as GameState));
      const r = heavyHit({ ...s, deck: { ...s.deck, mark: DECK_MARKS } }, never, 50);
      expect(r.deckFires).toEqual([]);
      expect(r.deckOffered).toBe(false);
    }
  });
});
