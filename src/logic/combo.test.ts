import { describe, expect, it } from 'vitest';
import { COMBO_TIERS, addEarned, comboAdd, comboBonus, comboExpired, comboHit, comboMult, comboNext, comboTier, comboWindowMs, initialCombo, type ComboState } from './combo';
import { tapValue } from './economy';
import { parseSave, serialize } from './save';
import { move } from './prestige';
import { defaultState, type GameState } from './state';
import { tapAndHit } from './unpack';

const never = () => 0.99;
const W = 1000;
const at = (n: number, lastMs = 0, earned = 0): ComboState => ({ n, lastMs, earned });

describe('단계·배율', () => {
  it('경계', () => {
    const t = [9, 10, 24, 25, 49, 50, 99, 100, 199, 200, 999].map(comboTier);
    expect(t).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    expect([0, 9, 10, 25, 50, 100, 200].map(comboMult)).toEqual([1, 1, 1.2, 1.5, 2, 3, 5]);
    expect(COMBO_TIERS).toHaveLength(5);
  });
  it('다음 단계까지', () => {
    expect(comboNext(0)).toEqual({ remain: 10, tier: 1, mult: 1.2 });
    expect(comboNext(24)).toEqual({ remain: 1, tier: 2, mult: 1.5 });
    expect(comboNext(200)).toBeNull();
  });
});

describe('시간 창', () => {
  it('피버 중 2000ms', () => {
    expect(comboWindowMs(false)).toBe(1000);
    expect(comboWindowMs(true)).toBe(2000);
  });
  it('정확히 경계는 이어지고 넘으면 끝', () => {
    const c = at(5, 100);
    expect(comboExpired(c, 1100, W)).toBe(false);
    expect(comboExpired(c, 1101, W)).toBe(true);
    expect(comboExpired(c, 2100, 2000)).toBe(false);
    expect(comboExpired(initialCombo(), 99999, W)).toBe(false);
  });
  it('이어지면 +1, 끊기면 1부터', () => {
    expect(comboHit(initialCombo(), 500, W, false).combo.n).toBe(1);
    const a = comboHit(at(5, 100, 50), 1100, W, false);
    expect(a.combo).toEqual({ n: 6, lastMs: 1100, earned: 50 });
    expect(a.ended).toBeNull();
    const b = comboHit(at(30, 100, 50), 1101, W, false);
    expect(b.combo).toEqual({ n: 1, lastMs: 1101, earned: 0 });
    expect(b.ended).toEqual(at(30, 100, 50));
    expect(b.tierUp).toBe(0);
  });
  it('단계가 오른 탭만 tierUp', () => {
    expect(comboHit(at(9, 0), 10, W, false).tierUp).toBe(1);
    expect(comboHit(at(10, 0), 10, W, false).tierUp).toBe(0);
    expect(comboHit(at(24, 0), 10, W, false).tierUp).toBe(2);
    expect(comboHit(at(199, 0), 10, W, false).tierUp).toBe(5);
  });
  it('감쇠 탭은 n 유지·시간만 갱신, 끊지 않음', () => {
    const r = comboHit(at(12, 100, 7), 900, W, true);
    expect(r.combo).toEqual({ n: 12, lastMs: 900, earned: 7 });
    expect(r.tierUp).toBe(0);
    expect(comboHit(initialCombo(), 50, W, true).combo.n).toBe(0);
    const late = comboHit(at(12, 100, 7), 1200, W, true);
    expect(late.combo.n).toBe(0);
    expect(late.ended?.n).toBe(12);
  });
});

describe('정산 보너스', () => {
  it('단계별 비율', () => {
    const rates = [0, 9, 10, 25, 50, 100, 200].map((n) => comboBonus(at(n, 0, 1000)));
    expect(rates).toEqual([0, 0, 100, 200, 300, 400, 500]);
  });
  it('addEarned', () => {
    expect(addEarned(at(3, 0, 5), 2.5).earned).toBe(7.5);
  });
});

describe('탭 배율', () => {
  it('gain에만 곱하고 상자 타격은 같다', () => {
    const s: GameState = { ...defaultState(), tapLevel: 5 };
    const a = tapAndHit(s, never, false);
    const b = tapAndHit(s, never, false, 3);
    expect(b.gain).toBeCloseTo(a.gain * 3, 10);
    expect(b.state.points).toBeCloseTo(a.state.points + a.gain * 2, 10);
    expect(b.state.unpack.damage).toBe(a.state.unpack.damage);
    expect(a.gain).toBeCloseTo(tapValue(s), 10);
  });
});

describe('bestCombo', () => {
  it('기본 0, 저장 왕복, 옛 저장은 0', () => {
    expect(defaultState().bestCombo).toBe(0);
    const s: GameState = { ...defaultState(), bestCombo: 137 };
    const r = parseSave(serialize(s, 1));
    expect(r.state.bestCombo).toBe(137);
    const old = JSON.parse(serialize(defaultState(), 1));
    delete old.bestCombo;
    expect(parseSave(JSON.stringify(old)).state.bestCombo).toBe(0);
    expect(parseSave(JSON.stringify({ version: 1, points: 5 })).state.bestCombo).toBe(0);
  });
  it('이사해도 남는다', () => {
    const s: GameState = { ...defaultState(), bestCombo: 50, earned: 1e30, points: 1e30 };
    expect(move(s)?.bestCombo).toBe(50);
  });
});

describe('comboAdd', () => {
  it('콤보를 끊지 않고 더하고 lastMs를 갱신한다', () => {
    const r = comboAdd(at(5, 100, 50), 400, 3);
    expect(r.combo).toEqual({ n: 8, lastMs: 400, earned: 50 });
    expect(r.tierUp).toBe(0);
    expect(r.ended).toBeNull();
  });
  it('단계를 넘으면 가장 높은 단계', () => {
    expect(comboAdd(at(8), 0, 3).tierUp).toBe(1);
    expect(comboAdd(at(20), 0, 35).tierUp).toBe(3);
    expect(comboAdd(at(30), 0, 3).tierUp).toBe(0);
  });
  it('0을 더해도 시간은 갱신, n = 0이면 add부터 시작', () => {
    expect(comboAdd(at(5, 100, 7), 900, 0).combo).toEqual({ n: 5, lastMs: 900, earned: 7 });
    const r = comboAdd(initialCombo(), 500, 10);
    expect(r.combo).toEqual({ n: 10, lastMs: 500, earned: 0 });
    expect(r.tierUp).toBe(1);
  });
});
