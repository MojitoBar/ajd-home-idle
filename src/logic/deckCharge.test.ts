import { describe, expect, it } from 'vitest';
import { CARD_MULT_CAP_BASE, DECK_TARGET_SCALE } from '../data/cards';
import { addCharge, cardChargeNeed, cardMult, chargeOnPerfect, chargeOnStrike, chooseCard, deckAllFull, deckChargeResult, deckMult, deckSlotViews, deckTargetScale, markThreshold, type DeckState } from './deck';
import { multBreakdown, tapStable } from './economy';
import { houseInfo, houseTarget } from './house';
import { moveProgress, moveStatus, move } from './prestige';
import { releaseCharge } from './charge';
import { parseSave, serialize } from './save';
import { defaultState } from './testState';
import type { GameState } from './state';
import { endlessHp, heavyHit, rushTap, tapAndHit } from './unpack';

const never = () => 0.99;
const withDeck = (over: Partial<DeckState>, extra: Partial<GameState> = {}): GameState => {
  const s = defaultState();
  return { ...s, moves: 1, ...extra, deck: { ...s.deck, ...over } };
};
const slot = (id: string, charge = 0, star = 1) => ({ id, star, charge });
const charges = (s: GameState) => s.deck.slots.map((x) => x.charge);
const NEED = cardChargeNeed(1);
const ev = { chain: 0, specials: 0, feverBefore: false, feverAfter: false };

describe('공구함 배율: 충전 조건', () => {
  it('정밀: 퍼펙트 강타 +1, 연속이 10의 배수면 +3. 다른 태그는 안 찬다', () => {
    const s = withDeck({ slots: [slot('P2'), slot('C1'), slot('S1'), slot('F1')] });
    expect(charges(chargeOnPerfect(s, 3))).toEqual([1, 0, 0, 0]);
    expect(charges(chargeOnPerfect(s, 10))).toEqual([3, 0, 0, 0]);
  });
  it('연쇄: 50연쇄마다 +1, 강타당 최대 +6', () => {
    const s = withDeck({ slots: [slot('C1'), slot('P2')] });
    expect(charges(chargeOnStrike(s, { ...ev, chain: 49 }))).toEqual([0, 0]);
    expect(charges(chargeOnStrike(s, { ...ev, chain: 120 }))).toEqual([2, 0]);
    expect(charges(chargeOnStrike(s, { ...ev, chain: 3000 }))).toEqual([6, 0]);
  });
  it('특별: 터진 특별 상자 1개 +2', () => {
    const s = withDeck({ slots: [slot('S1'), slot('C1')] });
    expect(charges(chargeOnStrike(s, { ...ev, specials: 3 }))).toEqual([6, 0]);
  });
  it('피버: 피버 중 강타 +1, 피버가 켜질 때 +4', () => {
    const s = withDeck({ slots: [slot('F1'), slot('S1')] });
    expect(charges(chargeOnStrike(s, { ...ev, feverBefore: true, feverAfter: true }))).toEqual([1, 0]);
    expect(charges(chargeOnStrike(s, { ...ev, feverBefore: false, feverAfter: true }))).toEqual([4, 0]);
    expect(charges(chargeOnStrike(s, ev))).toEqual([0, 0]);
  });
  it('이중 태그 카드(F3: 피버+정밀)는 두 조건 모두로 찬다', () => {
    const s = withDeck({ slots: [slot('F3')] });
    expect(charges(chargeOnPerfect(s, 1))).toEqual([1]);
    expect(charges(chargeOnStrike(s, { ...ev, feverBefore: true, feverAfter: true }))).toEqual([1]);
  });
  it('필요 눈금에서 멈추고 꽉 찬 카드·덱 전체 결과를 알려 준다', () => {
    const s = withDeck({ slots: [slot('P2', NEED - 1), slot('C1', NEED), slot('S1', NEED)] });
    const t = chargeOnPerfect(s, 1);
    expect(charges(t)).toEqual([NEED, NEED, NEED]);
    const r = deckChargeResult(s, t);
    expect(r.full).toEqual(['P2']);
    expect(r.allFull).toBe(true);
    expect(r.before).toBeCloseTo(4 * 4 * (1 + 3 * ((NEED - 1) / NEED)));
    expect(r.after).toBe(64);
    expect(deckChargeResult(t, chargeOnPerfect(t, 1)).allFull).toBe(false);
    expect(deckAllFull(withDeck({ slots: [slot('P2', NEED), slot('C1', NEED)] }))).toBe(false);
  });
});

describe('공구함 배율: 배수·연결', () => {
  it('카드 배수는 1부터 상한 x4(★은 +1)까지 선형', () => {
    expect(CARD_MULT_CAP_BASE + 1).toBe(4);
    expect(cardMult(1, 0, 40)).toBe(1);
    expect(cardMult(1, 20, 40)).toBe(2.5);
    expect(cardMult(1, 40, 40)).toBe(4);
    expect(cardMult(1, 400, 40)).toBe(4);
    expect(cardMult(2, 40, 40)).toBe(5);
  });
  it('deckMult는 낀 카드 배수의 곱이고 꽉 찬 3칸은 x64', () => {
    expect(deckMult(defaultState())).toBe(1);
    expect(deckMult(withDeck({ slots: [slot('P2'), slot('C1')] }))).toBe(1);
    expect(deckMult(withDeck({ slots: [slot('P2', NEED / 2), slot('C1', NEED)] }))).toBeCloseTo(2.5 * 4);
    expect(deckMult(withDeck({ slots: [slot('P2', NEED), slot('C1', NEED), slot('S1', NEED)] }))).toBe(64);
    const v = deckSlotViews(withDeck({ slots: [slot('P2', NEED / 2), slot('C1', NEED)] }));
    expect(v.map((x) => [x.id, x.full, x.mult])).toEqual([['P2', false, 2.5], ['C1', true, 4]]);
    expect(v[0].need).toBe(NEED);
  });
  it('카드를 바꾸면 그 칸의 눈금은 0, 다른 칸은 그대로', () => {
    const s = withDeck({ slots: [slot('P2', 30), slot('C1', 10), slot('S1', 5)], offers: [['F1', 'F2', 'P1']] });
    const n = chooseCard(s, 0, 'F1', 1)!;
    expect(charges(n)).toEqual([30, 0, 5]);
  });
  it('tapStable에는 곱해지지만 총 배율 분해(머리 칩)에는 안 섞인다', () => {
    const a = withDeck({});
    const b = withDeck({ slots: [slot('P2', NEED), slot('C1', NEED)] });
    expect(tapStable(b)).toBeCloseTo(tapStable(a) * 16);
    expect(multBreakdown(b, 'tap')).toEqual(multBreakdown(a, 'tap'));
  });
  it('충전은 강타 정산에서만: 일반 탭·러시는 안 찬다, 강타는 찬다', () => {
    const s = withDeck({ slots: [slot('F1'), slot('P2')] }, { fever: { ...defaultState().fever, activeSec: 5 } });
    expect(charges(tapAndHit(s, never).state)).toEqual([0, 0]);
    expect(charges(rushTap(s, never).state)).toEqual([0, 0]);
    expect(tapAndHit(s, never).deckCharge.full).toEqual([]);
    const h = heavyHit(s, never, 5);
    expect(charges(h.state)).toEqual([1, 0]);
    const r = releaseCharge(s, never, 0.83, 3, 1);
    expect(r.grade).toBe('perfect');
    expect(charges(r.state)).toEqual([1, 1]);
    expect(r.deckCharge.after).toBeGreaterThan(r.deckCharge.before);
  });
  it('heavyHit의 연쇄 충전: 연쇄 100이면 C1 +2', () => {
    const b = withDeck({ slots: [slot('C1')], mark: 6 });
    const u = { ...b.unpack, box: 100, roomDone: true };
    const s = { ...b, unpack: { ...u, hp: endlessHp({ ...b, unpack: u }, 100) } };
    const h = heavyHit(s, never, 20000);
    expect(h.state.deck.slots[0].charge).toBe(Math.min(6, Math.floor(h.chain / 50)));
    expect(h.state.deck.slots[0].charge).toBeGreaterThan(0);
  });
  it('addCharge는 바뀐 게 없으면 같은 state', () => {
    const s = withDeck({ slots: [slot('P2')] });
    expect(addCharge(s, () => 0)).toBe(s);
  });
});

describe('집 목표 보정', () => {
  it('houseTarget = 표 목표 x deck.targetScale, 첫 집은 x1', () => {
    expect(houseTarget(defaultState())).toBe(houseInfo(0).target);
    const s = withDeck({ targetScale: 3 }, { moves: 2 });
    expect(houseTarget(s)).toBeCloseTo(houseInfo(2).target * 3);
  });
  it('이사·진행 막대·문턱·특전 상자가 보정 목표를 쓴다', () => {
    const s = withDeck({ targetScale: 4 }, { moves: 1, earned: houseInfo(1).target });
    expect(moveStatus(s).ok).toBe(false);
    expect(moveProgress(s)).toBeCloseTo(0.25);
    expect(markThreshold(s, 1)).toBeCloseTo(markThreshold({ ...s, deck: { ...s.deck, targetScale: 1 } }, 1) * 4);
    expect(moveStatus({ ...s, earned: houseInfo(1).target * 4 }).ok).toBe(true);
  });
  it('이사하면 새 집의 표 값을 고정한다(표가 바뀌어도 이미 정한 집은 그대로)', () => {
    const s = withDeck({ targetScale: 1 }, { moves: 0, earned: houseInfo(0).target });
    const n = move(s)!;
    expect(n.deck.targetScale).toBe(deckTargetScale(1));
    expect(n.deck.targetScale).toBe(DECK_TARGET_SCALE[1]);
    expect(houseTarget(n)).toBeCloseTo(houseInfo(1).target * DECK_TARGET_SCALE[1]);
    expect(n.deck.slots).toEqual([]);
  });
});

describe('저장 v12 -> v13', () => {
  const v12 = (deck: Record<string, unknown>, over: Record<string, unknown> = {}) => {
    const raw = JSON.parse(serialize(defaultState(), 1));
    return JSON.stringify({ ...raw, version: 12, moves: 2, earned: houseInfo(2).target / 2, ...over, deck });
  };
  it('낀 카드는 눈금 0, targetScale 1이라 목표·진행 막대가 그대로', () => {
    const r = parseSave(v12({ slots: [{ id: 'P2', star: 1 }, { id: 'C1', star: 1 }], offers: [['S1', 'S3', 'F1']], rerolls: 1, mark: 3, seen: ['P2'] }));
    expect(r.kind).toBe('ok');
    const s = r.state;
    expect(s.version).toBe(13);
    expect(s.deck.slots).toEqual([{ id: 'P2', star: 1, charge: 0 }, { id: 'C1', star: 1, charge: 0 }]);
    expect(s.deck.targetScale).toBe(1);
    expect(s.deck.mark).toBe(3);
    expect(s.deck.offers).toEqual([['S1', 'S3', 'F1']]);
    expect(deckMult(s)).toBe(1);
    expect(houseTarget(s)).toBe(houseInfo(2).target);
    expect(moveProgress(s)).toBeCloseTo(0.5);
  });
  it('v13 저장은 눈금·목표 배수가 왕복하고, 눈금은 필요 눈금으로 자른다', () => {
    const s = withDeck({ slots: [slot('P2', 7)], targetScale: 5 });
    const back = parseSave(serialize(s, 1)).state;
    expect(back.deck.slots).toEqual([slot('P2', 7)]);
    expect(back.deck.targetScale).toBe(5);
    const big = JSON.parse(serialize(s, 1));
    big.deck.slots[0].charge = 1e9;
    expect(parseSave(JSON.stringify(big)).state.deck.slots[0].charge).toBe(NEED);
  });
});
