import { describe, expect, it } from 'vitest';
import { CARDS, CARD_CHARGE_NEED, CARD_OFFER_SIZE, CHARGE_NEED_SCALE, DECK_TARGET_SCALE, STACK_BOOST, STACK_DUP, STACK_NEED_GROWTH, STACK_PICK_EVERY, STACK_STEP } from '../data/cards';
import { addCharge, boostOffer, cardChargeNeed, cardMult, chargeOnPerfect, checkMarks, chooseBoost, chooseCard, deckAfterMove, deckBoostIn, deckBoostPacks, deckChargeResult, deckMult, deckSlotViews, deckStackSum, isStackDup, rollCardOffer, slotCapBonuses, type DeckSlot, type DeckState } from './deck';
import { CHARGE_ZONE_CENTER, releaseCharge } from './charge';
import { parseSave, serialize } from './save';
import { heavyHit, tapAndHit } from './unpack';
import { defaultState } from './testState';
import type { GameState } from './state';

const withDeck = (over: Partial<DeckState>, extra: Partial<GameState> = {}): GameState => {
  const s = defaultState();
  return { ...s, moves: 0, ...extra, deck: { ...s.deck, ...over } };
};
const slot = (id: string, charge = 0, star = 1, stacks = 0): DeckSlot => ({ id, star, charge, stacks });
const need = (id: string, moves = 0) => cardChargeNeed(moves, CARDS.find((c) => c.id === id)!.rarity);
const HOLD4 = [slot('P3'), slot('C1'), slot('S1'), slot('F1')];
/** 정밀 카드(P3, 일반: 필요 14)에 정밀 충전 +4를 n번 준다 */
const perfects = (s: GameState, n: number) => { for (let i = 0; i < n; i++) s = chargeOnPerfect(s, 1); return s; };

describe('넘침 스택: 충전', () => {
  it('필요 눈금에 닿으면 스택 +1, 남은 눈금은 이어서 다시 찬다', () => {
    const s = chargeOnPerfect(withDeck({ slots: [slot('P3', need('P3') - 2)] }), 1);
    expect(s.deck.slots[0].stacks).toBe(1);
    expect(s.deck.slots[0].charge).toBeCloseTo(2);
  });
  it('필요 눈금 직전에서는 스택이 오르지 않고 눈금만 찬다', () => {
    const s = chargeOnPerfect(withDeck({ slots: [slot('P3', need('P3') - 5)] }), 1);
    expect(s.deck.slots[0]).toEqual(slot('P3', need('P3') - 1));
  });
  it('한 번의 큰 충전으로 여러 스택을 넘는다', () => {
    const n = need('P3');
    const big = n + n * STACK_NEED_GROWTH + 0.4 * n * STACK_NEED_GROWTH ** 2;
    const s = addCharge(withDeck({ slots: [slot('P3')] }), (t) => (t === 'precise' ? big : 0));
    expect(s.deck.slots[0].stacks).toBe(2);
    expect(s.deck.slots[0].charge).toBeCloseTo(0.4 * n * STACK_NEED_GROWTH ** 2);
    expect(s.deck.chargedStacks).toBe(2);
  });
  it('다음 스택 필요량이 STACK_NEED_GROWTH배씩 늘어난다', () => {
    const n = need('C1');
    for (const k of [0, 1, 2, 3, 5]) {
      const v = deckSlotViews(withDeck({ slots: [slot('C1', 0, 1, k)] }))[0];
      expect(v.stackNeed).toBeCloseTo(n * STACK_NEED_GROWTH ** k);
      expect(v.stacks).toBe(k);
    }
  });
  it('스택 k를 올리는 데 드는 충전은 k가 클수록 많다', () => {
    let s = withDeck({ slots: [slot('P3')] });
    const at: number[] = [];
    for (let i = 0; i < 80 && at.length < 4; i++) {
      s = chargeOnPerfect(s, 1);
      if (s.deck.slots[0].stacks > at.length) at.push(i + 1);
    }
    expect(at).toHaveLength(4);
    const gaps = at.map((v, i) => v - (at[i - 1] ?? 0));
    expect(gaps[3]).toBeGreaterThan(gaps[1]);
  });
  it('스택이 1 이상이면 눈금이 0이어도 꽉 찬 것으로 센다(공구 장인 A1·full)', () => {
    const s = withDeck({ slots: [slot('A1'), slot('C1', 0, 1, 1), slot('S1', 0, 1, 0)] });
    expect(slotCapBonuses(s)[0]).toBe(1);
    expect(deckSlotViews(s).map((v) => v.full)).toEqual([false, true, false]);
  });
  it('태그가 없는 증폭 전설도 넘친다', () => {
    const s = chargeOnPerfect(withDeck({ slots: [slot('A1', need('A1') - 1)] }), 1);
    expect(s.deck.slots[0].stacks).toBe(1);
  });
});

describe('넘침 스택: 배율', () => {
  it('카드 배수 = 꽉 찬 값 x (1 + 0.15 x 스택)', () => {
    const n = need('P3');
    expect(cardMult(1, n, n, 0, 0)).toBe(4);
    expect(cardMult(1, 0, n, 0, 2)).toBeCloseTo(4 * (1 + 2 * STACK_STEP));
    expect(deckMult(withDeck({ slots: [slot('P3', 0, 2, 3)] }))).toBeCloseTo(5 * (1 + 3 * STACK_STEP));
  });
  it('넘침 전후로 카드 배수가 줄지 않는다(눈금이 0으로 돌아가도)', () => {
    const n = need('P3');
    const before = deckMult(withDeck({ slots: [slot('P3', n - 1)] }));
    const after = deckMult(chargeOnPerfect(withDeck({ slots: [slot('P3', n - 1)] }), 1));
    expect(after).toBeGreaterThan(before);
  });
  it('연속 충전 200회 동안 공구함 배율이 단조 증가하고 스택은 줄지 않는다', () => {
    let s = withDeck({ slots: [slot('P3'), slot('F3'), slot('A1'), slot('C1')] });
    let m = deckMult(s);
    let st = 0;
    for (let i = 0; i < 200; i++) {
      s = chargeOnPerfect(s, i % 10 === 9 ? 10 : 1);
      const now = deckMult(s);
      const sum = s.deck.slots.reduce((a, x) => a + x.stacks, 0);
      expect(now).toBeGreaterThanOrEqual(m);
      expect(sum).toBeGreaterThanOrEqual(st);
      m = now;
      st = sum;
    }
    expect(st).toBeGreaterThan(5);
  });
});

describe('넘침 스택: 강화 고르기 묶음', () => {
  it('충전 스택이 6의 배수에 닿을 때마다 묶음 1개가 쌓인다', () => {
    let s = withDeck({ slots: [slot('P3', 0, 1, 0)] });
    let packs = 0;
    const seen: number[] = [];
    while (s.deck.chargedStacks < STACK_PICK_EVERY * 2 + 1) {
      s = chargeOnPerfect(s, 1);
      if (s.deck.boostPacks !== packs) { packs = s.deck.boostPacks; seen.push(s.deck.chargedStacks); }
    }
    expect(seen).toEqual([STACK_PICK_EVERY, STACK_PICK_EVERY * 2]);
    expect(deckBoostPacks(s)).toBe(2);
  });
  it('한 번의 충전이 6을 두 번 넘으면 묶음도 그만큼 쌓인다', () => {
    const s = addCharge(withDeck({ slots: [slot('P3')], chargedStacks: 5 }), (t) => (t === 'precise' ? 4000 : 0));
    expect(s.deck.chargedStacks).toBeGreaterThanOrEqual(5 + 2 * STACK_PICK_EVERY - 5);
    expect(s.deck.boostPacks).toBe(Math.floor(s.deck.chargedStacks / STACK_PICK_EVERY));
  });
  it('다음 묶음까지 남은 스택 수', () => {
    expect(deckBoostIn(withDeck({ chargedStacks: 0 }))).toBe(6);
    expect(deckBoostIn(withDeck({ chargedStacks: 4 }))).toBe(2);
    expect(deckBoostIn(withDeck({ chargedStacks: 6 }))).toBe(6);
  });
  it('고르기·중복·강화로 얻은 스택은 묶음을 부르지 않는다', () => {
    let s = withDeck({ slots: [slot('P3', 0, 3), slot('C1')], offers: [['P3', 'C1', 'S1']] });
    for (let i = 0; i < 6; i++) s = chooseCard({ ...s, deck: { ...s.deck, offers: [['P3', 'C1', 'S1']] } }, 0, 'P3')!;
    expect(s.deck.slots[0].stacks).toBe(6 * STACK_DUP);
    expect(s.deck.chargedStacks).toBe(0);
    expect(s.deck.boostPacks).toBe(0);
    const b = chooseBoost({ ...s, deck: { ...s.deck, boostPacks: 1, boostMade: 1 } }, 0)!;
    expect(b.deck.boostPacks).toBe(0);
    expect(b.deck.chargedStacks).toBe(0);
  });
  it('이어받은 스택도 충전 스택 누계에 안 들어간다', () => {
    const s = withDeck({ slots: [slot('P3', 0, 1, 8), slot('C1'), slot('S1'), slot('F1')], offers: [['C3', 'S3', 'F2']] });
    const r = chooseCard(s, 0, 'C3', 0)!;
    expect(r.deck.slots[0]).toEqual(slot('C3', 0, 1, 4));
    expect(r.deck.chargedStacks).toBe(0);
    expect(r.deck.boostPacks).toBe(0);
  });
});

describe('강화 고르기 후보와 고르기', () => {
  const packed = (slots: DeckSlot[], extra: Partial<DeckState> = {}) => withDeck({ slots, boostPacks: 1, boostMade: 1, ...extra });
  it('묶음이 없으면 후보도 없고 고를 수 없다', () => {
    const s = withDeck({ slots: HOLD4 });
    expect(boostOffer(s)).toEqual([]);
    expect(chooseBoost(s, 0)).toBeNull();
  });
  it('낀 카드 둘에 +2, 새 카드 하나(3택)', () => {
    for (let made = 1; made < 40; made++) {
      const o = boostOffer(packed(HOLD4, { boostMade: made }));
      expect(o).toHaveLength(CARD_OFFER_SIZE);
      const boosts = o.filter((x) => x.kind === 'boost');
      expect(boosts).toHaveLength(2);
      expect(new Set(boosts.map((b) => b.kind === 'boost' && b.slot)).size).toBe(2);
      expect(boosts.every((b) => b.kind === 'boost' && b.stacks === STACK_BOOST && b.slot >= 0 && b.slot < 4)).toBe(true);
      const cards = o.filter((x) => x.kind === 'card');
      expect(cards).toHaveLength(1);
      expect(HOLD4.some((h) => cards[0].kind === 'card' && h.id === cards[0].id)).toBe(false);
    }
  });
  it('낀 카드가 1장이면 boost 1개 + 카드 2장, 0장이면 카드 3장', () => {
    const one = boostOffer(packed([slot('P3')]));
    expect(one.map((x) => x.kind).sort()).toEqual(['boost', 'card', 'card']);
    const none = boostOffer(packed([]));
    expect(none.map((x) => x.kind)).toEqual(['card', 'card', 'card']);
    expect(new Set(none.map((x) => (x.kind === 'card' ? x.id : ''))).size).toBe(3);
  });
  it('후보는 탭 수가 늘어도 바뀌지 않는다(같은 묶음)', () => {
    const s = packed(HOLD4);
    const t = { ...s, stats: { ...s.stats, totalTaps: s.stats.totalTaps + 999 } };
    expect(boostOffer(t)).toEqual(boostOffer(s));
  });
  it('boost를 고르면 그 칸이 +2, 묶음 1개 소모, 눈금·★은 그대로', () => {
    const s = packed(HOLD4.map((x, i) => ({ ...x, charge: i })));
    const o = boostOffer(s);
    const i = o.findIndex((x) => x.kind === 'boost');
    const b = o[i] as { slot: number };
    const r = chooseBoost(s, i)!;
    expect(r.deck.slots[b.slot].stacks).toBe(STACK_BOOST);
    expect(r.deck.slots.reduce((n, x) => n + x.stacks, 0)).toBe(STACK_BOOST);
    expect(r.deck.slots.map((x) => x.charge)).toEqual([0, 1, 2, 3]);
    expect(r.deck.boostPacks).toBe(0);
  });
  it('card를 고르면 빈 칸에 들어가고, 칸이 다 찼으면 바꿀 칸이 필요하며 스택 절반을 이어받는다', () => {
    const open = packed([slot('P3')]);
    const ci = boostOffer(open).findIndex((x) => x.kind === 'card');
    const id = (boostOffer(open)[ci] as { id: string }).id;
    const r = chooseBoost(open, ci)!;
    expect(r.deck.slots.map((x) => x.id)).toEqual(['P3', id]);
    const full = packed([slot('P3', 0, 1, 5), slot('C1'), slot('S1'), slot('F1')]);
    const fi = boostOffer(full).findIndex((x) => x.kind === 'card');
    expect(chooseBoost(full, fi)).toBeNull();
    const rf = chooseBoost(full, fi, 0)!;
    expect(rf.deck.slots[0]).toEqual(slot((boostOffer(full)[fi] as { id: string }).id, 0, 1, 2));
    expect(rf.deck.boostPacks).toBe(0);
  });
  it('null이면 묶음만 버리고, 잘못된 후보 번호는 null', () => {
    const s = packed(HOLD4);
    expect(chooseBoost(s, null)!.deck.boostPacks).toBe(0);
    expect(chooseBoost(s, 3)).toBeNull();
  });
});

describe('중복(★3)', () => {
  it('★3 카드도 고르기 후보에 나온다', () => {
    const held = [slot('P3', 0, 3), slot('C1')];
    let hit = 0;
    for (let seed = 0; seed < 300; seed++) if (rollCardOffer(held, seed).includes('P3')) hit++;
    expect(hit).toBeGreaterThan(0);
    expect(isStackDup(withDeck({ slots: held }), 'P3')).toBe(true);
    expect(isStackDup(withDeck({ slots: held }), 'C1')).toBe(false);
  });
  it('고르면 칸을 안 쓰고 스택 +3, ★·눈금·칸 수는 그대로', () => {
    const s = withDeck({ slots: [slot('P3', 5, 3, 1), slot('C1')], offers: [['P3', 'S1', 'F1']] });
    const r = chooseCard(s, 0, 'P3')!;
    expect(r.deck.slots).toHaveLength(2);
    expect(r.deck.slots[0]).toEqual(slot('P3', 5, 3, 1 + STACK_DUP));
    expect(r.deck.offers).toEqual([]);
  });
});

describe('교체·이사·저장', () => {
  it('교체하면 눈금 0, 스택은 절반(내림)을 새 카드가 이어받는다', () => {
    for (const [from, to] of [[7, 3], [6, 3], [1, 0], [0, 0]]) {
      const s = withDeck({ slots: [slot('P3', 9, 1, from), slot('C1'), slot('S1'), slot('F1')], offers: [['C3', 'S3', 'F2']] });
      const r = chooseCard(s, 0, 'C3', 0)!;
      expect(r.deck.slots[0]).toEqual(slot('C3', 0, 1, to));
      expect(r.deck.slots[1]).toEqual(slot('C1'));
    }
  });
  it('이사하면 스택·충전 누계·강화 묶음이 0이다(도감은 이어받는다)', () => {
    const s = perfects(withDeck({ slots: HOLD4.slice(0, 1), seen: ['P3'] }), 60);
    expect(s.deck.slots[0].stacks).toBeGreaterThan(0);
    const d = deckAfterMove({ ...s, deck: { ...s.deck, boostPacks: 2, boostMade: 3 } });
    expect(d.slots).toEqual([]);
    expect([d.chargedStacks, d.boostPacks, d.boostMade]).toEqual([0, 0, 0]);
    expect(d.seen).toEqual(['P3']);
  });
  it('v15 -> v16: 스택 0·새 필드 0, 눈금·★·묶음 그대로, 공구함 배율이 같다', () => {
    const n = need('P3', 2);
    const raw = JSON.parse(serialize(defaultState(), 1));
    const old = { slots: [{ id: 'P3', star: 2, charge: n / 2 }, { id: 'C1', star: 1, charge: need('C1', 2) }, { id: 'S1', star: 1, charge: 3 }], offers: [['F1', 'F2', 'P1']], rerolls: 1, mark: 4, seen: ['P3'], buff: { nextStrike: false, forceBomb: false, perfects: 0, boxesInFever: 0 }, targetScale: 330 };
    const r = parseSave(JSON.stringify({ ...raw, version: 15, moves: 2, deck: old }));
    expect(r.kind).toBe('ok');
    const d = r.state.deck;
    expect(r.state.version).toBe(16);
    expect(d.slots.map((x) => x.stacks)).toEqual([0, 0, 0]);
    expect(d.slots.map((x) => [x.star, x.charge])).toEqual([[2, n / 2], [1, need('C1', 2)], [1, 3]]);
    expect([d.chargedStacks, d.boostPacks, d.boostMade, d.mark, d.targetScale]).toEqual([0, 0, 0, 4, 330]);
    expect(d.offers).toEqual([['F1', 'F2', 'P1']]);
    const expected = (1 + (3 + 2 - 1) * 0.5) * 4 * (1 + 3 * (3 / need('S1', 2)));
    expect(deckMult(r.state)).toBeCloseTo(expected);
  });
  it('저장이 왕복하고 눈금이 스택 필요량까지 보존된다', () => {
    const s = withDeck({ slots: [slot('P3', need('P3') * STACK_NEED_GROWTH ** 2 - 1, 1, 2)], chargedStacks: 2, boostPacks: 1, boostMade: 1 });
    expect(parseSave(serialize(s, 5)).state.deck).toEqual(s.deck);
  });
  it('이사 0회(덱 없음)에서는 충전해도 아무것도 바뀌지 않는다', () => {
    const s = defaultState();
    expect(s.moves).toBe(0);
    expect(chargeOnPerfect(s, 1)).toBe(s);
    expect(addCharge(s, () => 99)).toBe(s);
    expect(deckMult(s)).toBe(1);
    expect(s.deck.slots).toEqual([]);
    expect([s.deck.chargedStacks, s.deck.boostPacks]).toEqual([0, 0]);
  });
});

describe('불변 조건', () => {
  const mulberry = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const sum = (s: GameState) => s.deck.slots.reduce((a, x) => a + x.stacks, 0);

  it('첫 집(이사 0회): 표 첫 행이 1이고 정산을 돌려도 덱이 그대로다', () => {
    expect(CHARGE_NEED_SCALE[0]).toBe(1);
    expect(DECK_TARGET_SCALE[0]).toBe(1);
    let s = defaultState();
    const rng = mulberry(7);
    for (let i = 0; i < 300; i++) {
      s = i % 5 === 4 ? heavyHit(s, rng, 20).state : tapAndHit(s, rng).state;
      s = chargeOnPerfect(s, 3);
    }
    expect(s.deck).toEqual(defaultState().deck);
    expect(deckMult(s)).toBe(1);
  });

  describe('v15 저장을 불러오면 뒤로 가지 않는다', () => {
    // v15까지의 필요 눈금 보정표(이 표로 저장된 눈금이 들어 있다)
    const OLD_SCALE = [1, 0.35, 1.27, 1.5, 4.5, 2.6];
    const oldNeed = (id: string, moves: number) => CARD_CHARGE_NEED[CARDS.find((c) => c.id === id)!.rarity] * OLD_SCALE[Math.min(moves, 5)];
    const ids = ['P3', 'C1', 'S1', 'F1']; // 일반
    const ids2 = ['P2', 'C3', 'S3', 'F2']; // 레어·일반 섞임(증폭 아님)
    it('낀 카드·★·눈금이 그대로이고, 배율·문턱 진행이 줄지 않는다', () => {
      for (const moves of [1, 2, 3, 4, 5, 6, 9]) {
        for (const frac of [0, 0.3, 0.7, 1]) {
          for (const list of [ids, ids2]) {
            const raw = JSON.parse(serialize(defaultState(), 1));
            const slots = list.map((id, i) => ({ id, star: 1 + (i % 3), charge: frac * oldNeed(id, moves) }));
            const deck = { slots, offers: [], rerolls: 1, mark: 3, seen: [], buff: { nextStrike: false, forceBomb: false, perfects: 0, boxesInFever: 0 }, targetScale: 300 };
            const r = parseSave(JSON.stringify({ ...raw, version: 15, moves, deck }));
            expect(r.kind).toBe('ok');
            const st = r.state;
            expect(st.deck.slots.map((x) => [x.id, x.star])).toEqual(slots.map((x) => [x.id, x.star]));
            expect(st.deck.slots.every((x) => x.stacks === 0)).toBe(true);
            const oldMult = slots.reduce((m, x) => m * (1 + (3 + x.star - 1) * Math.min(1, x.charge / oldNeed(x.id, moves))), 1);
            expect(deckMult(st)).toBeGreaterThanOrEqual(oldMult - 1e-9);
            expect(st.deck.mark).toBe(3);
            expect(st.deck.targetScale).toBe(300);
            // 정산을 돌려도(문턱 확인 포함) 문턱 진행·배율이 줄지 않는다
            let t = { ...st, earned: 1e12 };
            const m0 = deckMult(t);
            t = checkMarks(chargeOnPerfect(t, 1));
            expect(t.deck.mark).toBeGreaterThanOrEqual(3);
            expect(deckMult(t)).toBeGreaterThanOrEqual(m0);
          }
        }
      }
    });
  });

  describe('스택이 줄어드는 경로가 없다', () => {
    it('충전·강화·중복·★ 올리기·교체를 무작위로 섞어도, 그대로 남은 카드의 스택과 충전 스택 누계는 줄지 않는다', () => {
      for (let seed = 1; seed <= 20; seed++) {
        const rng = mulberry(seed);
        let s = withDeck({ slots: [slot('P3'), slot('C1'), slot('S1'), slot('F1')] }, { moves: 3 });
        for (let i = 0; i < 400; i++) {
          const prev = s;
          const x = rng();
          if (x < 0.7) s = chargeOnPerfect(s, 1 + Math.floor(rng() * 10));
          else if (x < 0.8 && s.deck.boostPacks > 0) s = chooseBoost(s, Math.floor(rng() * 3), Math.floor(rng() * 4)) ?? s;
          else if (x < 0.9) {
            // 이미 낀 카드를 고르는 중복·★ 올리기(★3이면 스택 +3)
            const held = s.deck.slots[Math.floor(rng() * 4)].id;
            const r = chooseCard({ ...s, deck: { ...s.deck, offers: [[held, 'A2', 'S5']] } }, 0, held);
            if (r) s = r;
          } else {
            s = { ...s, deck: { ...s.deck, slots: s.deck.slots.map((sl) => ({ ...sl, star: 3 })) } };
          }
          s.deck.slots.forEach((sl, k) => { if (sl.id === prev.deck.slots[k].id) expect(sl.stacks).toBeGreaterThanOrEqual(prev.deck.slots[k].stacks); });
          expect(s.deck.chargedStacks).toBeGreaterThanOrEqual(prev.deck.chargedStacks);
          expect(s.deck.boostMade).toBeGreaterThanOrEqual(prev.deck.boostMade);
        }
        expect(sum(s)).toBeGreaterThan(0);
      }
    });
    it('교체로 사라지는 것은 바뀐 칸의 스택 절반뿐이고, 나머지 칸·충전 누계는 그대로다', () => {
      const s = withDeck({ slots: [slot('P3', 5, 1, 9), slot('C1', 3, 2, 4), slot('S1', 0, 1, 7), slot('F1', 1, 1, 2)], offers: [['C3', 'S3', 'F2']], chargedStacks: 22, boostMade: 3 });
      const r = chooseCard(s, 0, 'C3', 2)!;
      expect(r.deck.slots.map((x) => x.stacks)).toEqual([9, 4, 3, 2]);
      expect([r.deck.chargedStacks, r.deck.boostMade]).toEqual([22, 3]);
    });
    it('중복 고르기는 스택을 더하기만 한다(칸·★·눈금 그대로)', () => {
      const s = withDeck({ slots: [slot('P3', 4, 3, 5), slot('C1')], offers: [['P3', 'S3', 'F2']] });
      const r = chooseCard(s, 0, 'P3')!;
      expect(r.deck.slots[0]).toEqual(slot('P3', 4, 3, 5 + STACK_DUP));
      expect(r.deck.slots).toHaveLength(2);
    });
    it('이사하면 새 집은 스택 0에서 시작한다(영구로 남는 것은 도감뿐)', () => {
      const s = withDeck({ slots: [slot('P3', 0, 1, 40)], seen: ['P3'] });
      expect(deckAfterMove(s).slots).toEqual([]);
    });
  });

  describe('스택 상한이 없다', () => {
    it('스택 100(·3000)이어도 배율·화면 값이 유한하고 충전해도 NaN이 안 된다', () => {
      for (const n of [100, 3000]) {
        let s = withDeck({ slots: [slot('P3', 1, 3, n), slot('C1', 1, 3, n), slot('S1', 1, 3, n), slot('A1', 1, 3, n)] });
        s = chargeOnPerfect(s, 5);
        expect(Number.isFinite(deckMult(s))).toBe(true);
        expect(deckMult(s)).toBeGreaterThan(1);
        for (const v of deckSlotViews(s)) {
          for (const x of [v.mult, v.nextStackMult, v.stackMult, v.stackNeed, v.charge]) expect(Number.isNaN(x)).toBe(false);
          expect(v.mult).toBeGreaterThan(0);
          expect(Number.isFinite(v.mult)).toBe(true);
        }
        expect(s.deck.slots.every((x) => x.stacks >= n && !Number.isNaN(x.charge))).toBe(true);
      }
    });
  });
});

describe('화면용 조회·스택 사건', () => {
  it('칸별 값: 스택·눈금·필요·배수·다음 스택 배수, 덱 스택 합', () => {
    const s = withDeck({ slots: [slot('P3', 3, 1, 2), slot('C1', 0, 2, 0)] });
    const [a, b] = deckSlotViews(s);
    expect([a.stacks, a.charge, a.need, a.stackNeed]).toEqual([2, 3, need('P3'), need('P3') * STACK_NEED_GROWTH ** 2]);
    expect(a.mult).toBeCloseTo(4 * (1 + 2 * STACK_STEP));
    expect(a.nextStackMult).toBeCloseTo(4 * (1 + 3 * STACK_STEP));
    expect(b.nextStackMult).toBeCloseTo(5 * (1 + STACK_STEP));
    expect(b.nextStackMult).toBeGreaterThan(b.mult);
    expect(deckStackSum(s)).toBe(2);
  });
  it('정산 결과에 "방금 스택이 올랐다"가 칸 번호·이전·이후로 실려 나온다', () => {
    const before = withDeck({ slots: [slot('C1'), slot('P3', need('P3', 4) * STACK_NEED_GROWTH ** 5 - 1, 1, 5)], chargedStacks: 5 }, { moves: 4 });
    const after = chargeOnPerfect(before, 1);
    const res = deckChargeResult(before, after);
    expect(res.stacked).toEqual([{ slot: 1, id: 'P3', from: 5, to: 6 }]);
    expect(res.boostPacks).toBe(1);
    expect(res.stackSum).toBe(6);
    expect(deckChargeResult(before, before).stacked).toEqual([]);
  });
  it('heavyHit·release 경로의 deckCharge에도 같은 사건이 실린다', () => {
    const before = withDeck({ slots: [slot('P3', need('P3', 4) - 1)] }, { moves: 4 });
    const r = releaseCharge(before, () => 0.5, CHARGE_ZONE_CENTER, 1);
    expect(r.grade).toBe('perfect');
    expect(r.deckCharge.stacked).toEqual([{ slot: 0, id: 'P3', from: 0, to: 1 }]);
    expect(r.deckCharge.stackSum).toBe(1);
  });
});
