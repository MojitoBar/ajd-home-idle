import { describe, expect, it } from 'vitest';
import { BOMB_BLAST, BOX_KINDS, GOLD_GAIN_MULT, RUSH_MAX_SEC, RUSH_SEC, SPECIAL_GAP, SPECIAL_WEIGHTS, type SpecialBox } from '../data/unpack';
import { tick, tapValue } from './economy';
import { applyOffline } from './offline';
import { move } from './prestige';
import { defaultState } from './testState';
import type { GameState } from './state';
import { boxHp, boxKind, boxSpecial, chainBonus, heavyHit, hitBox, rollSalt, rushTap, specialAt, tapAndHit, unpackPower } from './unpack';

const never = () => 0.99; // 치명타 아님

/** salt를 정해 k번째 상자를 다음 1타에 터지는 상태로 만든다 */
const lastWith = (salt: number, k: number, extra: Partial<GameState> = {}): GameState => {
  const s = defaultState();
  const hp = boxHp(k);
  return { ...s, ...extra, unpack: { ...s.unpack, ...extra.unpack, box: k, hp, damage: hp - 1, salt } };
};

const findSalt = (ok: (salt: number) => boolean): number => {
  for (let s = 1; s < 500000; s++) if (ok(s)) return s;
  throw new Error('조건에 맞는 salt 없음');
};

/** k번째가 kind이고 k+1..k+5가 휩쓸려도 연쇄 폭발·다른 특별 상자가 없는 salt (k % 10 === 4: 5번째 뒤가 큰 상자) */
const bombSalt = findSalt((s) => specialAt(s, 34) === 'bomb');
const plainSalt = findSalt((s) => specialAt(s, 34) === null && [35, 36, 37, 38, 39].every((k) => specialAt(s, k) === null));
const goldSalt = findSalt((s) => specialAt(s, 34) === 'gold');
const clockSalt = findSalt((s) => specialAt(s, 34) === 'clock');

describe('specialAt', () => {
  it('결정적이고 salt가 다르면 배치가 달라진다', () => {
    const a = Array.from({ length: 400 }, (_, k) => specialAt(7, k));
    expect(Array.from({ length: 400 }, (_, k) => specialAt(7, k))).toEqual(a);
    expect(Array.from({ length: 400 }, (_, k) => specialAt(8, k))).not.toEqual(a);
  });
  it('큰 상자 자리와 처음 20개에는 없다', () => {
    for (const salt of [0, 1, 2, 12345, 987654321]) {
      for (let k = 0; k < 3000; k++) {
        if (k < 20 || boxKind(k) === 'big') expect(specialAt(salt, k)).toBeNull();
      }
    }
  });
  it('특별 상자 뒤 4개는 일반 상자', () => {
    for (const salt of [0, 1, 2, 12345]) {
      let prev = -100;
      for (let k = 0; k < 5000; k++) {
        if (!specialAt(salt, k)) continue;
        expect(k - prev).toBeGreaterThan(SPECIAL_GAP);
        prev = k;
      }
    }
  });
  it('긴 구간에서 비율 약 5%(간격 규칙으로 조금 낮음)·가중치 5:3:2', () => {
    const count: Record<SpecialBox, number> = { gold: 0, bomb: 0, clock: 0 };
    let eligible = 0;
    for (let k = 20; k < 200000; k++) {
      if (boxKind(k) === 'big') continue;
      eligible++;
      const s = specialAt(3, k);
      if (s) count[s]++;
    }
    const total = count.gold + count.bomb + count.clock;
    expect(total / eligible).toBeGreaterThan(0.035);
    expect(total / eligible).toBeLessThan(0.055);
    const w = Object.values(SPECIAL_WEIGHTS).reduce((a, b) => a + b, 0);
    for (const kind of ['gold', 'bomb', 'clock'] as const) expect(Math.abs(count[kind] / total - SPECIAL_WEIGHTS[kind] / w)).toBeLessThan(0.03);
  });
  it('boxSpecial은 지금 상자와 다음 상자들의 종류', () => {
    const s = lastWith(bombSalt, 34);
    expect(boxSpecial(s)).toBe('bomb');
    expect(boxSpecial(s, 1)).toBeNull();
    expect(boxSpecial({ ...s, unpack: { ...s.unpack, box: 33 } }, 1)).toBe('bomb');
  });
  it('rollSalt는 0 이상 정수', () => {
    expect(rollSalt(() => 0)).toBe(0);
    expect(rollSalt(() => 0.9999999)).toBeLessThan(2 ** 31);
    expect(Number.isInteger(rollSalt(() => 0.37))).toBe(true);
  });
});

describe('황금 상자', () => {
  it('터지면 보상 x10, 연쇄 보너스와 곱해진다', () => {
    const g = hitBox(lastWith(goldSalt, 34), { crit: false, damped: false, feverMult: 1 });
    const p = hitBox(lastWith(plainSalt, 34), { crit: false, damped: false, feverMult: 1 });
    expect(g.burst?.special).toBe('gold');
    expect(p.burst?.special).toBeNull();
    expect(g.burst!.gain).toBeCloseTo(p.burst!.gain * GOLD_GAIN_MULT);
    const gc = hitBox(lastWith(goldSalt, 34), { crit: false, damped: false, feverMult: 1, gainMult: 1.5 });
    expect(gc.burst!.gain).toBeCloseTo(p.burst!.gain * GOLD_GAIN_MULT * 1.5);
  });
});

describe('폭탄 상자', () => {
  it('일반 탭으로도 뒤따르는 5개가 함께 터지고 연쇄 수·보너스·상금·부수 효과가 반영된다', () => {
    const s = lastWith(bombSalt, 34);
    const r = tapAndHit(s, never);
    expect(r.chain).toBe(1 + BOMB_BLAST);
    expect(r.bursts.map((b) => b.k)).toEqual([34, 35, 36, 37, 38, 39]);
    expect(r.bursts.map((b) => b.blast)).toEqual([false, true, true, true, true, true]);
    expect(r.bursts.map((b) => b.chain)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(r.burst).toBe(r.bursts[5]);
    const base = tapValue(s) / 1;
    r.bursts.forEach((b, i) => expect(b.gain).toBeCloseTo(base * BOX_KINDS[boxKind(b.k)].k * chainBonus(i)));
    expect(r.state.unpack.box).toBe(40);
    expect(r.state.unpack.damage).toBe(0);
    expect(r.prize?.tier).toBe(0);
    expect(r.state.homeLv[3]).toBe(1); // 39번째 큰 상자의 살림 칸
    expect(r.bursts[5].care).toMatchObject({ slot: 3, lv: 1 });
    expect(r.state.bestChain).toBe(6);
    // 상금까지 포함해 포인트가 정확히 늘었다
    const sum = r.bursts.reduce((a, b) => a + b.gain, 0);
    expect(r.state.points - s.points).toBeCloseTo(r.gain + sum + r.prize!.gain);
  });
  it('폭탄이 아니면 기존 탭 결과 모양 그대로(burst 하나)', () => {
    const r = tapAndHit(lastWith(plainSalt, 34), never);
    expect(r.bursts).toHaveLength(1);
    expect(r.chain).toBe(1);
    expect(r.prize).toBeNull();
    expect(r.state.bestChain).toBe(0);
    expect(tapAndHit(lastWith(plainSalt, 34), never, true).bursts).toEqual([]);
  });
  it('휩쓸린 폭탄이 다시 5개를 터뜨린다(연쇄 폭발)', () => {
    let k0 = -1;
    const salt = findSalt((s) => {
      for (const k of [20, 21, 22, 23, 30, 31, 32, 33, 40, 41, 42, 43]) {
        if (specialAt(s, k) === 'bomb' && specialAt(s, k + 5) === 'bomb' && specialAt(s, k + 10) === null && specialAt(s, k + 11) === null) {
          k0 = k;
          return true;
        }
      }
      return false;
    });
    const r = tapAndHit(lastWith(salt, k0), never);
    expect(r.chain).toBe(1 + BOMB_BLAST + BOMB_BLAST);
    expect(r.bursts[5]).toMatchObject({ k: k0 + 5, special: 'bomb', blast: true });
    expect(r.bursts[10].k).toBe(k0 + 10);
    expect(r.state.unpack.box).toBe(k0 + 11);
    expect(r.prize?.tier).toBe(1);
  });
  it('강타로 뚫다 만난 폭탄은 폭발이 끝난 뒤 남은 피해가 다음 상자에 이어진다', () => {
    const s = lastWith(bombSalt, 34);
    const r = heavyHit(s, never, 3);
    expect(r.chain).toBe(6);
    expect(r.state.unpack.box).toBe(40);
    expect(r.state.unpack.damage).toBe(2 * unpackPower(s));
  });
  it('폭탄이 없는 같은 상황은 폭발 없이 1개만', () => {
    const r = heavyHit(lastWith(plainSalt, 34), never, 3);
    expect(r.chain).toBe(1);
    expect(r.state.unpack.box).toBe(35);
  });
});

describe('시계 상자·러시', () => {
  it('터지면 러시 시간이 쌓이고 상한이 있다', () => {
    const r = tapAndHit(lastWith(clockSalt, 34), never);
    expect(r.burst?.special).toBe('clock');
    expect(r.state.unpack.rushSec).toBe(RUSH_SEC);
    const s = lastWith(clockSalt, 34);
    const r2 = tapAndHit({ ...s, unpack: { ...s.unpack, rushSec: 3 } }, never);
    expect(r2.state.unpack.rushSec).toBe(3 + RUSH_SEC);
    const r3 = tapAndHit({ ...s, unpack: { ...s.unpack, rushSec: RUSH_MAX_SEC - 1 } }, never);
    expect(r3.state.unpack.rushSec).toBe(RUSH_MAX_SEC);
  });
  it('tick이 러시 시간을 줄이고 0 아래로 내려가지 않는다', () => {
    const s = { ...defaultState(), unpack: { ...defaultState().unpack, rushSec: 5 } };
    expect(tick(s, 2).unpack.rushSec).toBe(3);
    expect(tick(s, 99).unpack.rushSec).toBe(0);
    const z = defaultState();
    expect(tick(z, 1).unpack).toBe(z.unpack);
  });
  it('이사하면 0으로 돌아가고 salt가 새로 뽑힌다', () => {
    const s = { ...defaultState(), earned: 3.7e15, unpack: { ...defaultState().unpack, rushSec: 8, salt: 4 } };
    const m = move(s, () => 0.5)!;
    expect(m.unpack.rushSec).toBe(0);
    expect(m.unpack.salt).toBe(rollSalt(() => 0.5));
  });
  it('오래 비웠다 돌아오면 러시 시간이 가득 찬다', () => {
    const s = { ...defaultState(1000), unpack: { ...defaultState().unpack, rushSec: 9 } };
    expect(applyOffline(s, 1000 + 3600_000).state.unpack.rushSec).toBe(RUSH_MAX_SEC);
  });
  it('rushTap은 일반 탭과 같은 보상·피해지만 피버 게이지를 올리지 않는다', () => {
    const s = lastWith(plainSalt, 10);
    const a = tapAndHit(s, never);
    const b = rushTap(s, never);
    expect(b.gain).toBeCloseTo(a.gain);
    expect(b.state.points).toBeCloseTo(a.state.points);
    expect(b.bursts).toHaveLength(1);
    expect(a.state.fever).not.toEqual(s.fever);
    expect(b.state.fever).toEqual(s.fever);
  });
  it('rushTap으로 터뜨린 시계·폭탄도 효과가 난다', () => {
    expect(rushTap(lastWith(clockSalt, 34), never).state.unpack.rushSec).toBe(RUSH_SEC);
    expect(rushTap(lastWith(bombSalt, 34), never).chain).toBe(6);
  });
});
