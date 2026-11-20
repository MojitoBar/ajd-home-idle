import { describe, expect, it } from 'vitest';
import { AMP_DEX_MAX, CARDS, RARITY_ODDS } from '../data/cards';
import { addCharge, cardChargeNeed, chargeOnPerfect, chooseCard, deckMult, deckOfferOdds, deckResonance, deckSlotViews, isStarUp, rollCardOffer, slotCapBonuses, type DeckState } from './deck';
import { COLLECTIBLES, SETS } from '../data/collectibles';
import { parseSave, serialize } from './save';
import { defaultState } from './testState';
import type { GameState } from './state';

const withDeck = (over: Partial<DeckState>, extra: Partial<GameState> = {}): GameState => {
  const s = defaultState();
  return { ...s, moves: 0, ...extra, deck: { ...s.deck, ...over } };
};
const slot = (id: string, charge = 0, star = 1) => ({ id, star, charge, stacks: 0 });
const need = (id: string, moves = 0) => cardChargeNeed(moves, CARDS.find((c) => c.id === id)!.rarity);
/** 도감 세트 n개를 완성한 것으로 만든다 */
const withSets = (s: GameState, n: number): GameState => {
  const collection: GameState['collection'] = { ...s.collection };
  for (const def of SETS.slice(0, n)) for (const c of COLLECTIBLES.filter((x) => x.rarity === def.rarity)) collection[c.id] = { base: 1, shiny: 0, gold: 0, rainbow: 0 };
  return { ...s, collection };
};

describe('희귀도 추첨', () => {
  it('확률은 합 1이고 화면 API가 가중치를 그대로 보여 준다', () => {
    const o = deckOfferOdds(withDeck({}));
    expect(o.common + o.rare + o.legend).toBeCloseTo(1);
    expect(o.common).toBeCloseTo(RARITY_ODDS.common);
    expect(o.rare).toBeCloseTo(RARITY_ODDS.rare);
    expect(o.legend).toBeCloseTo(RARITY_ODDS.legend);
  });
  it('전설을 ★3으로 다 껴도 중복 후보가 남아 확률이 그대로 60·32·8이다', () => {
    const all3 = CARDS.filter((c) => c.rarity === 'legend').map((c) => slot(c.id, 0, 3));
    const o = deckOfferOdds(withDeck({ slots: all3 }));
    expect(o.legend).toBeCloseTo(RARITY_ODDS.legend);
    expect(o.common + o.rare + o.legend).toBeCloseTo(1);
  });
  it('세 칸 모두 희귀도를 따로 굴려 분포가 60·32·8에 가깝고 묶음은 서로 다른 3장이다', () => {
    const n = { common: 0, rare: 0, legend: 0 };
    const N = 6000;
    for (let seed = 0; seed < N; seed++) {
      const o = rollCardOffer([], seed * 7 + 1);
      expect(new Set(o).size).toBe(3);
      for (const id of o) n[CARDS.find((c) => c.id === id)!.rarity]++;
    }
    const t = N * 3;
    expect(n.common / t).toBeGreaterThan(0.55);
    expect(n.common / t).toBeLessThan(0.65);
    expect(n.rare / t).toBeGreaterThan(0.27);
    expect(n.rare / t).toBeLessThan(0.37);
    expect(n.legend / t).toBeGreaterThan(0.05);
    expect(n.legend / t).toBeLessThan(0.11);
  });
  it('첫 칸은 가진 태그 카드(낀 카드면 ★ 후보)에서, ★3 카드도 나온다(중복 후보)', () => {
    const held = [slot('P3'), slot('C1', 0, 3)];
    let star = 0;
    let dup = 0;
    for (let seed = 0; seed < 400; seed++) {
      const o = rollCardOffer(held, seed);
      if (o.includes('C1')) dup++;
      if (o.some((id) => isStarUp(withDeck({ slots: held }), id))) star++;
    }
    expect(star).toBeGreaterThan(0);
    expect(dup).toBeGreaterThan(0);
  });
});

describe('★', () => {
  const offer = (ids: string[], slots: ReturnType<typeof slot>[]) => withDeck({ offers: [ids], slots });
  it('낀 카드를 또 고르면 칸을 안 쓰고 ★+1, 눈금은 그대로이며 ★3 뒤에는 스택 +3', () => {
    const full = offer(['P3', 'C3', 'S1'], [slot('P3', 7), slot('C1'), slot('S3'), slot('F1')]);
    const a = chooseCard(full, 0, 'P3')!;
    expect(a.deck.slots.map((s) => [s.id, s.star, s.charge])).toEqual([['P3', 2, 7], ['C1', 1, 0], ['S3', 1, 0], ['F1', 1, 0]]);
    expect(a.deck.offers).toEqual([]);
    const b = chooseCard({ ...a, deck: { ...a.deck, offers: [['P3']] } }, 0, 'P3')!;
    expect(b.deck.slots[0].star).toBe(3);
    const c = chooseCard({ ...b, deck: { ...b.deck, offers: [['P3']] } }, 0, 'P3')!;
    expect([c.deck.slots[0].star, c.deck.slots[0].stacks, c.deck.slots.length]).toEqual([3, 3, 4]);
  });
  it('상한 x4·x5·x6: 꽉 찬 ★1~3 카드의 배수', () => {
    const m = (star: number) => deckMult(withDeck({ slots: [slot('P3', need('P3'), star)] }));
    expect([m(1), m(2), m(3)]).toEqual([4, 5, 6]);
    expect(deckSlotViews(withDeck({ slots: [slot('P3', 0, 3)] }))[0].cap).toBe(6);
  });
});

describe('공명', () => {
  it('같은 태그 2·3·4장이면 충전 속도 x1.5·x2·x3, 상한은 그대로', () => {
    const base = (ids: string[]) => withDeck({ slots: ids.map((id) => slot(id)) });
    const g = (ids: string[]) => chargeOnPerfect(base(ids), 1).deck.slots[0].charge;
    expect(g(['P3'])).toBe(4);
    expect(g(['P3', 'P2'])).toBe(6);
    expect(g(['P3', 'P2', 'P1'])).toBe(8);
    expect(g(['P3', 'P2', 'P1', 'P4'])).toBe(12);
    expect(deckResonance(base(['P3', 'P2', 'P1', 'P4']))).toEqual([{ tag: 'precise', count: 4, level: 3, speed: 3 }]);
    expect(deckMult(withDeck({ slots: ['P3', 'P2', 'P1', 'P4'].map((id) => slot(id, need(id))) }))).toBe(256);
  });
  it('이중 태그 카드는 태그별 충전량에 그 태그의 공명을 곱해 합친다', () => {
    const s = withDeck({ slots: [slot('S2'), slot('C1'), slot('C3')] });
    const t = addCharge(s, (tag) => (tag === 'special' ? 2 : tag === 'chain' ? 4 : 0));
    expect(t.deck.slots[0].charge).toBe(2 * 1 + 4 * 2);
    expect(t.deck.slots[1].charge).toBe(4 * 2);
  });
});

describe('증폭 전설', () => {
  const dexN = (n: number) => withSets(withDeck({ slots: [slot('A2', need('A2')), slot('P3', need('P3'))] }), n);
  it('공구 장인(A1): 꽉 찬 다른 카드 1장마다 상한 +1', () => {
    const s = withDeck({ slots: [slot('A1', need('A1')), slot('P3', need('P3')), slot('C1', need('C1')), slot('S1', 1)] });
    expect(slotCapBonuses(s)).toEqual([2, 0, 0, 0]);
    expect(deckSlotViews(s)[0].cap).toBe(4 + 2);
    expect(deckMult(withDeck({ slots: [slot('A1', need('A1')), slot('P3', need('P3')), slot('C1', need('C1')), slot('S1', need('S1'))] }))).toBe(7 * 4 * 4 * 4);
  });
  it('수집 노트(A2): 완성 세트 1개마다 +1(최대 3)이고 도감이 바뀌면 캐시가 갱신된다', () => {
    const s0 = dexN(0);
    expect(slotCapBonuses(s0)[0]).toBe(0);
    const s2 = { ...s0, collection: dexN(2).collection };
    expect(slotCapBonuses(s2)[0]).toBe(2);
    expect(deckMult(s0)).toBe(4 * 4);
    expect(deckMult(s2)).toBe(6 * 4);
    expect(slotCapBonuses(dexN(SETS.length))[0]).toBe(AMP_DEX_MAX);
  });
  it('증폭 카드는 어떤 태그 조건으로도 찬다(충전량 중 최댓값)', () => {
    const s = withDeck({ slots: [slot('A1'), slot('P3')] });
    expect(chargeOnPerfect(s, 1).deck.slots.map((x) => x.charge)).toEqual([4, 4]);
  });
  it('최대 공구함 배율은 폭주하지 않는다(7번 고르기: 칸 4 + ★ 3)', () => {
    // 상한 = 3 + ★ + 보너스. 증폭 2장(보너스 최대 +3)과 일반 2장에 ★ 3개를 가장 세게 나눠도 1,500 안
    let best = 0;
    const stars = [1, 2, 3];
    for (const a of stars) for (const b of stars) for (const c of stars) for (const d of stars) {
      if (a + b + c + d - 4 > 3) continue;
      best = Math.max(best, (3 + a + 3) * (3 + b + AMP_DEX_MAX) * (3 + c) * (3 + d));
    }
    expect(best).toBeLessThanOrEqual(1500);
    const rich = withSets(withDeck({ slots: [slot('A1', need('A1'), 1), slot('A2', need('A2'), 1), slot('P3', need('P3'), 3), slot('C1', need('C1'), 2)] }), SETS.length);
    expect(deckMult(rich)).toBeLessThanOrEqual(best);
  });
});

describe('저장 v14 -> v15', () => {
  it('희귀도별 필요 눈금으로 옮겨도 공구함 배율이 그대로다(레어 반쯤 찬 카드)', () => {
    const moves = 3;
    const oldNeed = 40 * 1.5;
    const raw = JSON.parse(serialize(defaultState(), 1));
    const v14 = JSON.stringify({ ...raw, version: 14, moves, deck: { slots: [{ id: 'P2', star: 1, charge: oldNeed / 2, stacks: 0 }, { id: 'C1', star: 1, charge: oldNeed, stacks: 0 }], offers: [], rerolls: 1, mark: 4, seen: [], targetScale: 330 } });
    const r = parseSave(v14);
    expect(r.kind).toBe('ok');
    const s = r.state;
    expect(s.version).toBe(16);
    const m = deckMult(s);
    expect(m).toBeCloseTo((1 + 3 * 0.5) * 4);
    expect(s.deck.slots[0].charge).toBeCloseTo(need('P2', moves) / 2);
    expect(s.deck.targetScale).toBe(330);
    expect(s.deck.buff).toEqual({ nextStrike: false, forceBomb: false, perfects: 0, boxesInFever: 0 });
  });
});
