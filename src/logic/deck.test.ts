import { describe, expect, it } from 'vitest';
import { CARDS, CARD_OFFER_SIZE, DECK_MARKS, DECK_MARK_DIGITS, DECK_PERFECT_HALF_HARD_MAX } from '../data/cards';
import { chooseCard, checkMarks, deckAfterMove, deckEffects, deckEvent, deckFeverFires, deckFull, deckPicksLeft, deckNextMark, deckSlots, deckStrikeMult, emptyDeck, markThreshold, marksPassed, rollCardOffer, type DeckState } from './deck';
import { deckMult } from './deck';
import { gearEffects } from './gear';
import { houseInfo } from './house';
import { perkEffects } from './perks';
import { move } from './prestige';
import { chargeZoneAt, releaseCharge } from './charge';
import { defaultState } from './testState';
import type { GameState } from './state';
import { boxSpecial, endlessHp, heavyHit, hitBox, tapAndHit } from './unpack';

const never = () => 0.99;
const withDeck = (over: Partial<DeckState>, extra: Partial<GameState> = {}): GameState => {
  const s = defaultState();
  return { ...s, moves: 1, ...extra, deck: { ...s.deck, ...over } };
};
const mt = (moves: number, k: number) => markThreshold({ moves, deck: emptyDeck() }, k);
const slot = (id: string) => ({ id, star: 1, charge: 0, stacks: 0 });

describe('공구함 덱: 칸·효과', () => {
  it('1단계는 3칸', () => {
    expect([0, 1, 4, 9].map(deckSlots)).toEqual([4, 4, 4, 4]);
  });
  it('카드 22장: 증폭 전설 2장만 태그가 없다', () => {
    expect(CARDS).toHaveLength(22);
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(22);
    expect(CARDS.filter((c) => c.tags.length === 0).map((c) => c.id)).toEqual(['A1', 'A2']);
  });
  it('덱이 비면 효과가 0이고 특전·공구 값과 같다', () => {
    const s = defaultState();
    expect(deckEffects(s)).toEqual({ streakBonus: 0, chainCapAdd: 0, perfectHalfAdd: 0, weakTapsMult: 1, weakDelayMult: 1, goldMultAdd: 0, specialRateMult: 1, feverChargeAdd: 0, feverSecAdd: 0, shieldAdd: 0, shieldChargePerfects: 8, chainStep: 0.1, bombBlast: 5, feverMultAdd: 0 });
    expect(perkEffects(s).streakBonus).toBe(0);
    expect(gearEffects(s).chainCap).toBe(20);
  });
  it('P2는 연속 계수 +0.3, C1은 연쇄 상한 +30', () => {
    const s = withDeck({ slots: [slot('P2'), slot('C1')] });
    expect(perkEffects(s).streakBonus).toBeCloseTo(0.3);
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
    expect(deckEvent(s, { chain: 3000 })).toEqual([{ id: 'C3', times: 30, taps: 900 }]);
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
    const t = [1, 2, 3, 4, 5, 6].map((k) => mt(1, k));
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1]);
    expect(t[5]).toBeCloseTo(houseInfo(1).target * 10 ** -DECK_MARK_DIGITS[0][5], -3);
    expect(mt(9, 1)).toBeCloseTo(houseInfo(9).target * 10 ** -DECK_MARK_DIGITS[8][0], -3);
  });
  it('첫 집은 문턱을 보지 않고 같은 상태를 돌려준다', () => {
    const s = { ...defaultState(), earned: 1e30 };
    expect(checkMarks(s)).toBe(s);
  });
  it('문턱을 넘으면 묶음 1개(서로 다른 3장), mark+1', () => {
    const s = withDeck({ mark: 1 }, { earned: mt(1, 1) });
    const r = checkMarks(s);
    expect(r.deck.mark).toBe(2);
    expect(r.deck.offers).toHaveLength(1);
    expect(new Set(r.deck.offers[0]).size).toBe(3);
    expect(checkMarks(r)).toBe(r);
  });
  it('고르기 횟수 = 칸 수 + 3이고, 한 번에 문턱 여러 개를 넘어도 묶음이 하나씩 쌓인다', () => {
    expect(DECK_MARKS).toBe(deckSlots(1) + 3);
    const s = withDeck({ mark: 1 }, { earned: mt(1, DECK_MARKS - 1) * 2 });
    const r = checkMarks(s);
    expect(r.deck.mark).toBe(DECK_MARKS);
    expect(r.deck.offers).toHaveLength(DECK_MARKS - 1);
    expect(deckPicksLeft(r)).toBe(DECK_MARKS - 1);
    const two = checkMarks(withDeck({ mark: 1 }, { earned: mt(1, 2) }));
    expect(two.deck.mark).toBe(3);
    expect(two.deck.offers).toHaveLength(2);
    expect(checkMarks(r)).toBe(r);
  });
  it('다음 문턱 진행률은 0~1이고 문턱을 다 지나면 null', () => {
    expect(deckNextMark(withDeck({ mark: 1 }, { earned: 0 }))).toMatchObject({ k: 1, progress: 0 });
    const mid = deckNextMark(withDeck({ mark: 3 }, { earned: Math.sqrt(mt(1, 2) * mt(1, 3)) }))!;
    expect(mid.k).toBe(3);
    expect(mid.progress).toBeCloseTo(0.5);
    expect(deckNextMark(withDeck({ mark: DECK_MARKS }, { earned: 1e30 }))).toBeNull();
    expect(deckPicksLeft(withDeck({ mark: 1 }))).toBe(DECK_MARKS - 1);
    expect(deckPicksLeft({ ...defaultState(), moves: 0 })).toBe(0);
  });
  it('4칸이 다 차고 꽉 차면 공구함 배율의 최대는 256', () => {
    const full = withDeck({ slots: ['P2', 'C1', 'P3', 'C3'].map((id) => ({ ...slot(id), charge: 1e9 })) });
    expect(deckMult(full)).toBe(256);
  });
  it('묶음은 안 낀 카드를 먼저 담는다', () => {
    const o = rollCardOffer([slot('P2'), slot('C1')], 5);
    expect(o).toHaveLength(3);
    expect(o).not.toContain('P2');
    expect(o).not.toContain('C1');
  });
  it('묶음은 서로 다른 3장이고 ★3 카드도 나온다(중복 후보)', () => {
    const held = [{ ...slot('P2'), star: 3 }, slot('C1'), slot('F3')];
    let dup = 0;
    for (let seed = 0; seed < 300; seed++) {
      const o = rollCardOffer(held, seed);
      expect(o).toHaveLength(CARD_OFFER_SIZE);
      expect(new Set(o).size).toBe(CARD_OFFER_SIZE);
      if (o.includes('P2')) dup++;
    }
    expect(dup).toBeGreaterThan(0);
  });
  it('tapAndHit·heavyHit 안에서도 문턱이 처리된다', () => {
    const s = withDeck({ mark: 1 }, { earned: mt(1, 1) });
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
  it('묶음에 없는 카드·없는 묶음은 null', () => {
    expect(chooseCard(offer(['P2', 'C1', 'P3']), 0, 'C3')).toBeNull();
    expect(chooseCard(offer(['P2', 'C1', 'P3']), 1, 'P2')).toBeNull();
  });
  it('칸이 차면 바꿀 칸을 줘야 하고 원래 카드는 버려진다', () => {
    const full = offer(['C3', 'C1', 'P3'], [slot('P2'), slot('C1'), slot('P3'), slot('S1')]);
    expect(deckFull(full)).toBe(true);
    expect(chooseCard(full, 0, 'C3')).toBeNull();
    expect(chooseCard(full, 0, 'C3', 4)).toBeNull();
    const r = chooseCard(full, 0, 'C3', 1)!;
    expect(r.deck.slots.map((s) => s.id)).toEqual(['P2', 'C3', 'P3', 'S1']);
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
    expect(marksPassed({ moves: 1, deck: emptyDeck() }, 0)).toBe(1);
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

describe('공구함 덱: 2단계 카드 8장', () => {
  it('P1: 퍼펙트 반폭 +0.01, 수평계가 최대여도 고정 상한 0.125', () => {
    const base = withDeck({}, { gear: { level: 3 } });
    const s = withDeck({ slots: [slot('P1')] }, { gear: { level: 3 } });
    expect(gearEffects(s).perfectHalf - gearEffects(base).perfectHalf).toBeCloseTo(0.01);
    const max = withDeck({ slots: [slot('P1')] }, { gear: { level: 50 } });
    expect(gearEffects(withDeck({}, { gear: { level: 50 } })).perfectHalf).toBeCloseTo(0.12);
    expect(gearEffects(max).perfectHalf).toBe(DECK_PERFECT_HALF_HARD_MAX);
    expect(DECK_PERFECT_HALF_HARD_MAX).toBe(0.125);
    const z = chargeZoneAt(0.5, gearEffects(max).perfectHalf);
    expect(z.perfect[1] - z.perfect[0]).toBeCloseTo(0.25);
    expect(chargeZoneAt(0.5, 0.2).perfect[1] - chargeZoneAt(0.5, 0.2).perfect[0]).toBeCloseTo(0.24);
  });
  it('C4: 급소 탭 수 x1.5, 급소 간격 x0.85', () => {
    const base = withDeck({}, { gear: { awl: 2 } });
    const s = withDeck({ slots: [slot('C4')] }, { gear: { awl: 2 } });
    expect(gearEffects(s).weakTaps).toBe(Math.round(gearEffects(base).weakTaps * 1.5));
    expect(gearEffects(s).weakDelayMult).toBeCloseTo(gearEffects(base).weakDelayMult * 0.85);
  });
  it('S3: 특별 상자 확률 x1.7', () => {
    const base = withDeck({});
    const s = withDeck({ slots: [slot('S3')] });
    expect(perkEffects(s).specialRateMult).toBeCloseTo(perkEffects(base).specialRateMult * 1.7);
    expect(gearEffects(s).specialRate).toBeCloseTo(gearEffects(base).specialRate * 1.7);
  });
  it('F1: 피버 충전 +50%, F2: 피버 +8초', () => {
    const base = withDeck({});
    expect(perkEffects(withDeck({ slots: [slot('F1')] })).feverCharge).toBeCloseTo(perkEffects(base).feverCharge + 0.5);
    expect(perkEffects(withDeck({ slots: [slot('F2')] })).feverSec).toBe(perkEffects(base).feverSec + 8);
    expect(perkEffects(withDeck({ slots: [slot('F1'), slot('F2')] })).feverSec).toBe(perkEffects(base).feverSec + 8);
  });
  const goldBox = (deck: Partial<DeckState>): GameState => {
    for (let salt = 0; salt < 2000; salt++) {
      const b = withDeck(deck, { moves: 1 });
      for (const box of [200, 201, 202, 203, 204, 205]) {
        const u = { ...b.unpack, salt, box, roomDone: true };
        const s = { ...b, unpack: { ...u, hp: endlessHp({ ...b, unpack: u }, box) } };
        if (boxSpecial(s) === 'gold') return s;
      }
    }
    throw new Error('황금 상자를 못 찾음');
  };
  it('S1: 황금 상자 보상 배율 10 -> 25', () => {
    const base = goldBox({});
    const s = { ...base, deck: { ...base.deck, slots: [slot('S1')] } };
    const a = hitBox(base, { crit: false, damped: false, feverMult: 1, force: true }).burst!;
    const b = hitBox(s, { crit: false, damped: false, feverMult: 1, force: true }).burst!;
    expect(a.special).toBe('gold');
    expect(b.gain / a.gain).toBeCloseTo(2.5);
  });
  it('S4: 황금 상자 2개면 미발동, 3개면 황금 수 x 탭 1회 x150(한 줄, times는 황금 수)', () => {
    const s = withDeck({ slots: [slot('S4'), slot('C3')] });
    expect(deckEvent(s, { chain: 500, gold: 2 }).map((f) => f.id)).toEqual(['C3']);
    expect(deckEvent(s, { chain: 500 }).map((f) => f.id)).toEqual(['C3']);
    expect(deckEvent(s, { chain: 500, gold: 3 })).toEqual([{ id: 'S4', times: 3, taps: 450 }, { id: 'C3', times: 5, taps: 150 }]);
    expect(deckEvent(s, { chain: 40, gold: 4 })).toEqual([{ id: 'S4', times: 4, taps: 600 }]);
    expect(deckEvent(withDeck({}), { chain: 40, gold: 4 })).toEqual([]);
  });
  it('S4: heavyHit이 황금 수를 세어 보상을 P·누적에 더한다', () => {
    const endless = (deck: Partial<DeckState>, salt: number): GameState => {
      const b = withDeck(deck, { moves: 1 });
      const u = { ...b.unpack, salt, box: 100, roomDone: true };
      return { ...b, unpack: { ...u, hp: endlessHp({ ...b, unpack: u }, 100) } };
    };
    let tested = 0;
    for (let salt = 1; salt < 60 && tested < 2; salt++) {
      const a = heavyHit(endless({ mark: 6 }, salt), never, 3000);
      const gold = a.bursts.filter((b) => b.special === 'gold').length;
      const b = heavyHit(endless({ slots: [slot('S4')], mark: 6 }, salt), never, 3000);
      if (gold < 3) {
        expect(b.deckFires).toEqual([]);
        continue;
      }
      tested++;
      expect(b.deckFires).toHaveLength(1);
      const f = b.deckFires[0];
      expect(f).toMatchObject({ id: 'S4', times: gold, taps: gold * 150 });
      expect(f.gain).toBeGreaterThan(0);
      expect(b.state.points - a.state.points).toBeCloseTo(f.gain!, -3);
      expect(b.state.earned - a.state.earned).toBeCloseTo(f.gain!, -3);
      expect(b.state.stats.totalEarned - a.state.stats.totalEarned).toBeCloseTo(f.gain!, -3);
    }
    expect(tested).toBeGreaterThan(0);
  });
  it('F3: 피버 중 퍼펙트 강타만 피버 +2초(기록은 times 1, sec 2)', () => {
    const s = withDeck({ slots: [slot('F3')] });
    const fever = { ...s.fever, activeSec: 5 };
    expect(deckFeverFires({ deck: s.deck, fever }, 'perfect')).toEqual({ sec: 2, fires: [{ id: 'F3', times: 1, sec: 2 }] });
    expect(deckFeverFires({ deck: s.deck, fever }, 'good').sec).toBe(0);
    expect(deckFeverFires({ deck: s.deck, fever: { ...s.fever, activeSec: 0 } }, 'perfect')).toEqual({ sec: 0, fires: [] });
    expect(deckFeverFires({ deck: emptyDeck(), fever }, 'perfect').sec).toBe(0);
  });
  it('F3: releaseCharge가 피버 시간을 더하고 피버 밖에서는 건드리지 않는다', () => {
    const inFever = (deck: Partial<DeckState>): GameState => {
      const s = withDeck(deck, { earned: 1 });
      return { ...s, fever: { ...s.fever, activeSec: 5 } };
    };
    const a = releaseCharge(inFever({}), never, 0.83, 0, 1);
    const b = releaseCharge(inFever({ slots: [slot('F3')] }), never, 0.83, 0, 1);
    expect(b.state.fever.activeSec - a.state.fever.activeSec).toBe(2);
    expect(b.deckFires[0]).toEqual({ id: 'F3', times: 1, sec: 2 });
    const g = releaseCharge(inFever({ slots: [slot('F3')] }), never, 0.1, 0, 1);
    expect(g.state.fever.activeSec).toBe(5);
    expect(g.deckFires).toEqual([]);
    const outside = withDeck({ slots: [slot('F3')] }, { earned: 1 });
    const o = releaseCharge(outside, never, 0.83, 0, 1);
    expect(o.state.fever.activeSec).toBe(outside.fever.activeSec);
    expect(o.deckFires.find((f) => f.id === 'F3')).toBeUndefined();
  });
});

describe('공구함 덱: 성능', () => {
  it('3,000연쇄 강타 한 번의 계산 시간이 덱이 없을 때와 비슷하다(상자마다 도는 경로의 카드 포함)', () => {
    const endless = (deck: Partial<DeckState>): GameState => {
      const b = withDeck(deck, { moves: 1 });
      const u = { ...b.unpack, box: 100, roomDone: true };
      return { ...b, unpack: { ...u, hp: endlessHp({ ...b, unpack: u }, 100) } };
    };
    const full = endless({ slots: [slot('C1'), slot('S1'), slot('S3'), slot('F2')], mark: 6 });
    const none = endless({ mark: 6 });
    const time = (s: GameState) => {
      let best = Infinity;
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        const r = heavyHit(s, never, 20000);
        best = Math.min(best, performance.now() - t0);
        expect(r.chain).toBeGreaterThan(1000);
      }
      return best;
    };
    time(none);
    time(full);
    const a = time(none);
    const b = time(full);
    expect(b).toBeLessThan(a * 1.5 + 20);
  });
});
