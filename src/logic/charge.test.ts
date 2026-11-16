import { describe, expect, it } from 'vitest';
import {
  CHARGE_CENTER_GAP,
  CHARGE_CENTER_MAX,
  CHARGE_CENTER_MIN,
  CHARGE_GOOD,
  CHARGE_PERFECT,
  CHARGE_REWARD,
  CHARGE_ZONE_DEFAULT,
  chargeZoneAt,
  rollChargeZone,
  chargeGrade,
  chargePos,
  chargeSpeed,
  chargeTaps,
  releaseCharge,
} from './charge';
import { defaultState } from './state';
import { tapValue } from './economy';

const never = () => 0.99;
const always = () => 0;

describe('chargePos', () => {
  it('0 -> 1 -> 0 왕복', () => {
    expect([0, 300, 600, 900, 1200, 1500].map((t) => chargePos(t))).toEqual([0, 0.5, 1, 0.5, 0, 0.5]);
  });
  it('속도가 붙으면 빨라진다', () => {
    expect(chargePos(300, 2)).toBe(1);
    expect(chargePos(450, 2)).toBeCloseTo(0.5);
  });
});

describe('판정·보상', () => {
  it('경계값', () => {
    expect(chargeGrade(0.57)).toBe('miss');
    expect(chargeGrade(0.58)).toBe('good');
    expect(chargeGrade(0.77)).toBe('good');
    expect(chargeGrade(0.78)).toBe('perfect');
    expect(chargeGrade(0.88)).toBe('perfect');
    expect(chargeGrade(0.89)).toBe('good');
    expect(chargeGrade(0.96)).toBe('good');
    expect(chargeGrade(0.97)).toBe('miss');
    expect(chargeGrade(0)).toBe('miss');
  });
  it('보상 표', () => {
    expect(CHARGE_REWARD.perfect).toEqual({ taps: 20, combo: 10, fever: 6 });
    expect(CHARGE_REWARD.good).toEqual({ taps: 8, combo: 3, fever: 3 });
    expect(CHARGE_REWARD.miss).toEqual({ taps: 2, combo: 0, fever: 1 });
  });
  it('연속 퍼펙트 가산·상한, 속도', () => {
    expect([0, 1, 3, 5, 9].map((s) => chargeTaps('perfect', s))).toEqual([20, 22, 26, 30, 30]);
    expect(chargeTaps('good', 5)).toBe(8);
    expect(chargeSpeed(0)).toBe(1);
    expect(chargeSpeed(3)).toBeCloseTo(1.24);
    expect(chargeSpeed(5)).toBeCloseTo(1.4);
    expect(chargeSpeed(50)).toBeCloseTo(1.4);
  });
});

describe('releaseCharge', () => {
  it('퍼펙트: 연속 +1, 수익 = 탭 수익 x 탭 수 x 배율, 콤보·피버', () => {
    const s = defaultState();
    const r = releaseCharge(s, never, 0.8, 2, 1.5);
    expect(r.grade).toBe('perfect');
    expect(r.streak).toBe(3);
    expect(r.comboAdd).toBe(10);
    expect(r.gain).toBeCloseTo(tapValue(s) * 24 * 1.5);
    expect(r.state.fever.gauge).toBe(6);
  });
  it('굿·빗나감은 연속을 0으로', () => {
    const s = defaultState();
    const g = releaseCharge(s, never, 0.6, 4, 1);
    expect(g.grade).toBe('good');
    expect(g.streak).toBe(0);
    expect(g.comboAdd).toBe(3);
    expect(g.gain).toBeCloseTo(tapValue(s) * 8);
    const m = releaseCharge(s, never, 0.1, 4, 1);
    expect([m.grade, m.streak, m.comboAdd, m.state.fever.gauge]).toEqual(['miss', 0, 0, 1]);
    expect(m.gain).toBeCloseTo(tapValue(s) * 2);
  });
  it('치명타는 한 번만', () => {
    const s = defaultState();
    const n = releaseCharge(s, never, 0.8, 0, 1);
    const c = releaseCharge(s, always, 0.8, 0, 1);
    expect(c.crit).toBe(true);
    expect(c.gain / n.gain).toBeCloseTo(6);
  });
  it('tapsMult: 탭 수만 배율, 피버는 표 그대로, 기본값이면 기존과 같다', () => {
    const s = defaultState();
    const base = releaseCharge(s, never, 0.8, 0, 1);
    expect(base.taps).toBe(20);
    expect(releaseCharge(s, never, 0.8, 0, 1, 1).gain).toBeCloseTo(base.gain);
    const r = releaseCharge(s, never, 0.8, 0, 1, 2);
    expect(r.taps).toBe(40);
    expect(r.gain / base.gain).toBeCloseTo(2);
    expect(r.state.fever.gauge).toBe(base.state.fever.gauge);
    expect(releaseCharge(s, never, 0.6, 0, 1, 1.5).taps).toBe(12);
  });
  it('tapsMult 함수: 판정을 받아 배율을 정한다', () => {
    const s = defaultState();
    const f = (g: string) => (g === 'miss' ? 1 : 3);
    expect(releaseCharge(s, never, 0.8, 0, 1, f).taps).toBe(60);
    expect(releaseCharge(s, never, 0.1, 0, 1, f).taps).toBe(2);
  });
});

describe('스윙마다 바뀌는 구간', () => {
  const seeded = (seed: number) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const mid = (z: { perfect: readonly [number, number] }) => (z.perfect[0] + z.perfect[1]) / 2;

  it('기본 구간은 지금의 고정 구간, chargeZoneAt(0.83)과 같다', () => {
    expect(CHARGE_ZONE_DEFAULT.perfect).toEqual(CHARGE_PERFECT);
    expect(CHARGE_ZONE_DEFAULT.good).toEqual(CHARGE_GOOD);
    const z = chargeZoneAt(0.83);
    [...z.perfect, ...z.good].forEach((v, i) =>
      expect(v).toBeCloseTo([...CHARGE_PERFECT, ...CHARGE_GOOD][i], 10),
    );
  });
  it('chargeZoneAt은 폭을 유지하고 0~1로 자른다', () => {
    const z = chargeZoneAt(0.5);
    expect(z.perfect[0]).toBeCloseTo(0.45, 10);
    expect(z.perfect[1]).toBeCloseTo(0.55, 10);
    expect(z.good[0]).toBeCloseTo(0.25, 10);
    expect(z.good[1]).toBeCloseTo(0.63, 10);
    const low = chargeZoneAt(0.1);
    expect(low.perfect[0]).toBeCloseTo(0.05, 10);
    expect(low.good[0]).toBe(0);
    expect(low.good[1]).toBeCloseTo(0.23, 10);
    expect(chargeZoneAt(0.98).perfect[1]).toBe(1);
    expect(chargeZoneAt(0.98).good[1]).toBe(1);
  });
  it('rollChargeZone은 범위 안, prev와 간격 유지(200번, 여러 시드)', () => {
    for (const seed of [1, 7, 42, 1234]) {
      const rng = seeded(seed);
      let prev = rollChargeZone(rng);
      for (let i = 0; i < 200; i++) {
        const z = rollChargeZone(rng, prev);
        const c = mid(z);
        expect(c).toBeGreaterThanOrEqual(CHARGE_CENTER_MIN - 1e-9);
        expect(c).toBeLessThanOrEqual(CHARGE_CENTER_MAX + 1e-9);
        expect(Math.abs(c - mid(prev))).toBeGreaterThanOrEqual(CHARGE_CENTER_GAP - 1e-9);
        prev = z;
      }
    }
  });
  it('rng가 양 끝값이어도 간격과 범위를 지킨다', () => {
    for (const prev of [chargeZoneAt(0.35), chargeZoneAt(0.61), chargeZoneAt(0.87)]) {
      for (const r of [0, 0.5, 0.999999]) {
        const c = mid(rollChargeZone(() => r, prev));
        expect(Math.abs(c - mid(prev))).toBeGreaterThanOrEqual(CHARGE_CENTER_GAP - 1e-9);
        expect(c).toBeGreaterThanOrEqual(CHARGE_CENTER_MIN - 1e-9);
        expect(c).toBeLessThanOrEqual(CHARGE_CENTER_MAX + 1e-9);
      }
    }
  });
  it('chargeGrade는 넘긴 구간을 따르고, 안 넘기면 기존과 같다', () => {
    const z = chargeZoneAt(0.4);
    expect(chargeGrade(0.4, z)).toBe('perfect');
    expect(chargeGrade(0.2, z)).toBe('good');
    expect(chargeGrade(0.9, z)).toBe('miss');
    expect(chargeGrade(0.83)).toBe('perfect');
    expect(chargeGrade(0.4)).toBe('miss');
    expect(chargeGrade(0.83, CHARGE_ZONE_DEFAULT)).toBe('perfect');
  });
  it('releaseCharge는 구간을 따르고, 안 넘기면 기존과 같다', () => {
    const z = chargeZoneAt(0.4);
    const s = defaultState();
    expect(releaseCharge(s, never, 0.4, 0, 1, 1, z).grade).toBe('perfect');
    expect(releaseCharge(s, never, 0.83, 0, 1, 1, z).grade).toBe('miss');
    expect(releaseCharge(s, never, 0.83, 0).grade).toBe('perfect');
    expect(releaseCharge(s, never, 0.4, 0).grade).toBe('miss');
  });
});
