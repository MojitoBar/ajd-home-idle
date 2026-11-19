import { describe, expect, it } from 'vitest';
import { BOMB_BLAST } from '../data/unpack';
import { SHIELD_CHARGE_PERFECTS } from '../data/gear';
import { chargeGrade, chargeZoneAt, CHARGE_ZONE_CENTER, releaseCharge, type ChargeGrade } from './charge';
import { deckBuffAfterStrike, deckCountFeverBoxes, deckEffects, deckFeverEnd, deckPerfectFires, deckStrikeMult, emptyBuff, type DeckBuff, type DeckState } from './deck';
import { tapStable, tick } from './economy';
import { feverMultOf } from './fever';
import { gearEffects, initialShield, resolveStreak } from './gear';
import { houseInfo } from './house';
import { move } from './prestige';
import { defaultState } from './testState';
import type { GameState } from './state';
import { chainBonus, heavyHit, hitBox, boxSpecial } from './unpack';

const never = () => 0.99;
const slot = (id: string, charge = 0, star = 1) => ({ id, star, charge });
const withDeck = (over: Partial<DeckState>, extra: Partial<GameState> = {}): GameState => {
  const s = defaultState();
  return { ...s, moves: 1, ...extra, deck: { ...s.deck, ...over } };
};
const buffOf = (o: Partial<DeckBuff>): DeckBuff => ({ ...emptyBuff(), ...o });
const inFever = (s: GameState, sec = 5): GameState => ({ ...s, fever: { ...s.fever, activeSec: sec } });
const zone = chargeZoneAt(CHARGE_ZONE_CENTER, gearEffects(defaultState()).perfectHalf);
const posOf = (g: ChargeGrade): number => {
  for (let p = 0; p <= 1; p += 0.005) if (chargeGrade(p, zone) === g) return p;
  throw new Error(g);
};
const PERFECT = posOf('perfect');
const GOOD = posOf('good');
const MISS = posOf('miss');
/** 다음 상자가 자연 특별 상자가 아닌 상태(S5 예약 폭탄 시험용) */
const plainBox = (s: GameState): GameState => {
  for (let salt = 0; salt < 200; salt++) {
    const t = { ...s, unpack: { ...s.unpack, salt } };
    if (boxSpecial(t) === null) return t;
  }
  throw new Error('salt');
};

describe('P4 여분 안전모', () => {
  it('실드 +1칸, 충전 퍼펙트 수 8 -> 6', () => {
    const a = withDeck({});
    const b = withDeck({ slots: [slot('P4')] });
    expect(deckEffects(a).shieldAdd).toBe(0);
    expect(deckEffects(a).shieldChargePerfects).toBe(SHIELD_CHARGE_PERFECTS);
    expect(deckEffects(b).shieldAdd).toBe(1);
    expect(deckEffects(b).shieldChargePerfects).toBe(6);
    expect(gearEffects(b).shieldMax).toBe(gearEffects(a).shieldMax + 1);
  });
  it('충전 퍼펙트 수를 넘기면 그 수만큼 퍼펙트에서 한 칸 찬다(넘기지 않으면 8)', () => {
    const run = (need: number, n: number) => {
      let sh = { n: 0, toNext: need };
      for (let i = 0; i < n; i++) sh = resolveStreak(i, 'perfect', sh, 5, need).shield;
      return sh;
    };
    expect(run(6, 5).n).toBe(0);
    expect(run(6, 6)).toEqual({ n: 1, toNext: 6 });
    expect(run(6, 12).n).toBe(2);
    expect(resolveStreak(0, 'perfect', { n: 0, toNext: 1 }, 5).shield).toEqual({ n: 1, toNext: SHIELD_CHARGE_PERFECTS });
    expect(initialShield(2, 6)).toEqual({ n: 2, toNext: 6 });
    expect(initialShield(2)).toEqual({ n: 2, toNext: SHIELD_CHARGE_PERFECTS });
  });
});

describe('C2 도미노 쌓기', () => {
  it('연쇄 보너스 계수 0.1 -> 0.15, 상한은 그대로', () => {
    const b = withDeck({ slots: [slot('C2')] });
    expect(deckEffects(withDeck({})).chainStep).toBe(0.1);
    expect(deckEffects(b).chainStep).toBe(0.15);
    expect(chainBonus(10, 30, deckEffects(b).chainStep)).toBeCloseTo(2.5);
    expect(chainBonus(100, 30, deckEffects(b).chainStep)).toBeCloseTo(5.5);
  });
  it('강타로 터진 상자의 P 덩어리가 끼지 않았을 때보다 커진다(첫 상자는 같다)', () => {
    const base = withDeck({});
    const s = { ...base, unpack: { ...base.unpack, box: 100, roomDone: true } };
    const a = heavyHit(s, never, 400);
    const b = heavyHit({ ...s, deck: { ...s.deck, slots: [slot('C2')] } }, never, 400);
    expect(a.chain).toBeGreaterThan(3);
    expect(b.chain).toBe(a.chain);
    expect(b.bursts[0].gain).toBeCloseTo(a.bursts[0].gain);
    const last = a.chain - 1;
    expect(b.bursts[last].gain / a.bursts[last].gain).toBeCloseTo(chainBonus(last, gearEffects(b.state).chainCap, 0.15) / chainBonus(last, gearEffects(b.state).chainCap, 0.1));
    expect(b.bursts[last].gain).toBeGreaterThan(a.bursts[last].gain);
  });
});

describe('S2 큰 폭죽', () => {
  it('폭탄이 터뜨리는 상자 5개 → 8개', () => {
    expect(deckEffects(withDeck({})).bombBlast).toBe(BOMB_BLAST);
    expect(deckEffects(withDeck({ slots: [slot('S2')] })).bombBlast).toBe(8);
  });
  it('예약 폭탄이 터지면 휩쓸리는 상자 수 = 폭탄 수 x blast', () => {
    const run = (slots: DeckState['slots']) => {
      const s0 = plainBox(withDeck({ slots, buff: buffOf({ forceBomb: true }) }));
      const s = { ...s0, unpack: { ...s0.unpack, box: 100, roomDone: true } };
      return heavyHit(plainBox(s), never, 50);
    };
    const a = run([]);
    const b = run([slot('S2')]);
    const bombs = (h: ReturnType<typeof heavyHit>) => h.bursts.filter((x) => x.special === 'bomb').length;
    const blasted = (h: ReturnType<typeof heavyHit>) => h.bursts.filter((x) => x.blast).length;
    expect(a.bursts[0].special).toBe('bomb');
    expect(b.bursts[0].special).toBe('bomb');
    expect(blasted(a)).toBe(BOMB_BLAST * bombs(a));
    expect(blasted(b)).toBe(8 * bombs(b));
    expect(blasted(b)).toBeGreaterThanOrEqual(8);
  });
});

describe('F4 불꽃 축제', () => {
  it('피버 배율 x3 -> x4, 피버가 아니면 x1', () => {
    const a = withDeck({});
    const b = withDeck({ slots: [slot('F4')] });
    expect(deckEffects(b).feverMultAdd).toBe(1);
    expect(feverMultOf(inFever(a).fever, deckEffects(a).feverMultAdd)).toBe(3);
    expect(feverMultOf(inFever(b).fever, deckEffects(b).feverMultAdd)).toBe(4);
    expect(feverMultOf(b.fever, deckEffects(b).feverMultAdd)).toBe(1);
  });
  it('피버 중 탭 1회 수익은 4/3배, 안정 수익(피버 제외)은 그대로', () => {
    const a = withDeck({});
    const b = withDeck({ slots: [slot('F4')] });
    expect(tapStable(b)).toBeCloseTo(tapStable(a));
    const hit = (s: GameState) => heavyHit(inFever(s), never, 1).state.points - s.points;
    expect(hit(b) / hit(a)).toBeCloseTo(4 / 3, 5);
  });
});

describe('P5 장인의 호흡', () => {
  const gain = (s: GameState, pos: number, streak: number) => releaseCharge(s, never, pos, streak, 1).state.points - s.points;
  it('퍼펙트 강타마다 탭 1회 x (연속 수 x 2)를 더 준다', () => {
    const a = withDeck({});
    const b = withDeck({ slots: [slot('P5')] });
    const unit = tapStable(b);
    expect(gain(b, PERFECT, 3) - gain(a, PERFECT, 3)).toBeCloseTo(unit * 4 * 2);
    expect(gain(b, PERFECT, 0) - gain(a, PERFECT, 0)).toBeCloseTo(unit * 1 * 2);
    const r = releaseCharge(b, never, PERFECT, 3, 1);
    expect(r.deckFires.find((f) => f.id === 'P5')?.taps).toBe(8);
  });
  it('굿·미스에서는 주지 않는다', () => {
    const b = withDeck({ slots: [slot('P5')] });
    const a = withDeck({});
    for (const pos of [GOOD, MISS]) {
      expect(gain(b, pos, 5)).toBeCloseTo(gain(a, pos, 5));
      expect(releaseCharge(b, never, pos, 5, 1).deckFires.some((f) => f.id === 'P5')).toBe(false);
    }
    expect(deckPerfectFires(b, 'good', 5)).toEqual([]);
    expect(deckPerfectFires(b, 'miss', 5)).toEqual([]);
    expect(deckPerfectFires(b, 'perfect', 0)).toEqual([]);
  });
});

describe('C5 이삿짐 행렬', () => {
  const C5 = () => withDeck({ slots: [slot('C5')] });
  it('999연쇄는 예약 안 하고 1,000연쇄는 예약한다', () => {
    expect(deckBuffAfterStrike(C5(), 'perfect', 999).deck.buff.nextStrike).toBe(false);
    expect(deckBuffAfterStrike(C5(), 'perfect', 1000).deck.buff.nextStrike).toBe(true);
    expect(deckBuffAfterStrike(C5(), 'miss', 1500).deck.buff.nextStrike).toBe(true);
  });
  it('예약된 다음 강타는 탭 수 x2, 쓰고 나면 사라져 그다음 강타는 x1', () => {
    const armed = withDeck({ slots: [slot('C5')], buff: buffOf({ nextStrike: true }) });
    const plain = withDeck({ slots: [slot('C5')] });
    expect(deckStrikeMult(armed, 'good', 0)).toBe(2);
    expect(deckStrikeMult(plain, 'good', 0)).toBe(1);
    const r1 = releaseCharge(armed, never, GOOD, 0, 1);
    const r0 = releaseCharge(plain, never, GOOD, 0, 1);
    expect(r1.taps).toBe(r0.taps * 2);
    expect(r1.deckFires.some((f) => f.id === 'C5' && f.mult === 2)).toBe(true);
    expect(r1.state.deck.buff.nextStrike).toBe(false);
    expect(releaseCharge(r1.state, never, GOOD, 0, 1).taps).toBe(r0.taps);
  });
  it('카드가 없으면 예약 값이 있어도 배율은 1', () => {
    expect(deckStrikeMult(withDeck({ buff: buffOf({ nextStrike: true }) }), 'perfect', 1)).toBe(1);
  });
});

describe('S5 폭탄 공장', () => {
  const S5 = () => withDeck({ slots: [slot('S5')] });
  it('퍼펙트 4번째까지는 예약이 없고 5번째에 생기며 세기는 0으로 돌아간다', () => {
    let s = S5();
    for (let i = 1; i <= 4; i++) {
      s = deckBuffAfterStrike(s, 'perfect', 1);
      expect(s.deck.buff.forceBomb).toBe(false);
      expect(s.deck.buff.perfects).toBe(i);
    }
    s = deckBuffAfterStrike(s, 'perfect', 1);
    expect(s.deck.buff.forceBomb).toBe(true);
    expect(s.deck.buff.perfects).toBe(0);
  });
  it('굿·미스는 세지지 않는다(같은 state)', () => {
    const s = deckBuffAfterStrike(deckBuffAfterStrike(S5(), 'perfect', 1), 'perfect', 1);
    expect(deckBuffAfterStrike(s, 'good', 1)).toBe(s);
    expect(deckBuffAfterStrike(s, 'miss', 1)).toBe(s);
    expect(s.deck.buff.perfects).toBe(2);
  });
  it('releaseCharge 퍼펙트 5번이면 예약, 다음 일반 상자가 폭탄으로 터지고 예약은 사라진다', () => {
    let s = plainBox(S5());
    for (let i = 0; i < 5; i++) {
      const r = releaseCharge(s, never, PERFECT, i, 1);
      s = r.state;
      expect(s.deck.buff.forceBomb).toBe(i === 4);
    }
    const h = hitBox(s, { crit: false, damped: false, feverMult: 1, rng: never, force: true });
    expect(h.burst?.special).toBe('bomb');
    expect(h.state.deck.buff.forceBomb).toBe(false);
  });
});

describe('F5 용광로', () => {
  const F5 = (b: Partial<DeckBuff> = {}) => withDeck({ slots: [slot('F5')], buff: buffOf(b) });
  it('피버 중 터진 상자만 센다(피버가 아니거나 카드가 없으면 같은 state)', () => {
    const s = F5();
    expect(deckCountFeverBoxes(s, 7)).toBe(s);
    const f = inFever(s);
    expect(deckCountFeverBoxes(f, 0)).toBe(f);
    expect(deckCountFeverBoxes(inFever(s), 7).deck.buff.boxesInFever).toBe(7);
    expect(deckCountFeverBoxes(inFever(deckCountFeverBoxes(inFever(s), 7)), 3).deck.buff.boxesInFever).toBe(10);
    const none = inFever(withDeck({}));
    expect(deckCountFeverBoxes(none, 5)).toBe(none);
  });
  it('강타로 터진 상자가 피버 중에만 쌓인다', () => {
    const base = F5();
    const s = { ...base, unpack: { ...base.unpack, box: 100, roomDone: true } };
    expect(heavyHit(s, never, 30).state.deck.buff.boxesInFever).toBe(0);
    const h = heavyHit(inFever(s, 50), never, 30);
    expect(h.chain).toBeGreaterThan(0);
    expect(h.state.deck.buff.boxesInFever).toBe(h.chain);
  });
  it('피버가 끝날 때 한 번만 터진 상자 수 x 2 탭을 주고 세기를 비운다', () => {
    const s = inFever(F5({ boxesInFever: 10 }), 0.5);
    const end = deckFeverEnd(s)!;
    expect(end.taps).toBe(20);
    expect(end.state.deck.buff.boxesInFever).toBe(0);
    expect(deckFeverEnd(end.state)).toBeNull();
    const t1 = tick(s, 1);
    expect(t1.fever.activeSec).toBe(0);
    expect(t1.points - s.points).toBeCloseTo(tapStable(s) * 20);
    expect(t1.deck.buff.boxesInFever).toBe(0);
    const t2 = tick(t1, 1);
    expect(t2.points).toBe(t1.points);
  });
  it('피버가 계속 중이면 안 주고, 터진 상자가 0이면 안 준다', () => {
    const s = inFever(F5({ boxesInFever: 10 }), 5);
    const t = tick(s, 1);
    expect(t.points).toBe(s.points);
    expect(t.deck.buff.boxesInFever).toBe(10);
    const z = inFever(F5({ boxesInFever: 0 }), 0.5);
    expect(tick(z, 1).points).toBe(z.points);
  });
});

describe('이사·첫 집', () => {
  it('이사하면 buff가 비워진다', () => {
    const s = withDeck({ slots: [slot('C5'), slot('S5'), slot('F5')], buff: buffOf({ nextStrike: true, forceBomb: true, perfects: 3, boxesInFever: 9 }) }, { moves: 0, earned: houseInfo(0).target });
    const n = move(s)!;
    expect(n.deck.buff).toEqual(emptyBuff());
    expect(n.deck.slots).toEqual([]);
  });
  it('덱이 빈 첫 집은 어떤 카드 효과도 0이다', () => {
    const s = defaultState();
    expect(s.moves).toBe(0);
    expect(s.deck.buff).toEqual(emptyBuff());
    expect(deckEffects(s)).toEqual({
      streakBonus: 0, chainCapAdd: 0, perfectHalfAdd: 0, weakTapsMult: 1, weakDelayMult: 1, goldMultAdd: 0, specialRateMult: 1,
      feverChargeAdd: 0, feverSecAdd: 0, shieldAdd: 0, shieldChargePerfects: SHIELD_CHARGE_PERFECTS, chainStep: 0.1, bombBlast: BOMB_BLAST, feverMultAdd: 0,
    });
    expect(deckStrikeMult(s, 'perfect', 10)).toBe(1);
    expect(deckPerfectFires(s, 'perfect', 5)).toEqual([]);
    expect(deckBuffAfterStrike(s, 'perfect', 5000)).toBe(s);
    expect(deckCountFeverBoxes(inFever(s), 9)).toEqual(inFever(s));
    expect(deckFeverEnd(s)).toBeNull();
    expect(feverMultOf(inFever(s).fever, deckEffects(s).feverMultAdd)).toBe(3);
    const r = releaseCharge(s, never, PERFECT, 2, 1);
    expect(r.state.deck.buff).toEqual(emptyBuff());
    expect(r.deckFires).toEqual([]);
  });
});
