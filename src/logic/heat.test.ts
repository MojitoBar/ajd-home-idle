import { describe, expect, it } from 'vitest';
import {
  HEAT_AFTER_STRIKE,
  HEAT_HOT_MULT,
  HEAT_MAX,
  HEAT_OVER_MS,
  HEAT_TAP,
  HEAT_WEAK,
  advanceHeat,
  heatAdd,
  heatDamped,
  heatStrikeMult,
  heatTap,
  heatTapMult,
  heatZone,
  initialHeat,
  ventHeat,
  type HeatState,
} from './heat';

const at = (v: number): HeatState => ({ v, overMs: 0 });
const over = (overMs: number): HeatState => ({ v: (HEAT_MAX * overMs) / HEAT_OVER_MS, overMs });

describe('열기 오르기', () => {
  it('탭 한 번 +6, 급소 +15', () => {
    expect(heatTap(initialHeat()).heat.v).toBe(HEAT_TAP);
    expect(heatAdd(initialHeat(), HEAT_WEAK).heat.v).toBe(15);
    expect(heatTap(at(10)).overheated).toBe(false);
  });
  it('100에 닿는 순간 과열 시작', () => {
    const r = heatTap(at(94));
    expect(r.overheated).toBe(true);
    expect(r.heat).toEqual({ v: 100, overMs: HEAT_OVER_MS });
    expect(heatTap(at(93)).overheated).toBe(false);
    expect(heatAdd(at(90), 50).heat.v).toBe(100);
  });
  it('과열 중에는 오르지 않고 다시 과열도 안 된다', () => {
    const o = over(2000);
    const r = heatTap(o);
    expect(r.heat).toEqual(o);
    expect(r.overheated).toBe(false);
  });
});

describe('열기 식기', () => {
  it('초당 12씩 식고 0 아래로는 안 내려간다', () => {
    expect(advanceHeat(at(50), 1000, false).heat.v).toBeCloseTo(38);
    expect(advanceHeat(at(50), 500, false).heat.v).toBeCloseTo(44);
    expect(advanceHeat(at(5), 1000, false).heat.v).toBe(0);
    expect(advanceHeat(at(0), 1000, false)).toEqual({ heat: at(0), recovered: false });
  });
  it('hold 중에는 식지 않는다', () => {
    expect(advanceHeat(at(50), 5000, true).heat.v).toBe(50);
  });
  it('과열 중 3초에 걸쳐 100 -> 0, 끝나면 recovered (hold 무관)', () => {
    let h = heatTap(at(94)).heat;
    const a = advanceHeat(h, 1500, true);
    expect(a.heat.v).toBeCloseTo(50);
    expect(a.heat.overMs).toBe(1500);
    expect(a.recovered).toBe(false);
    const b = advanceHeat(a.heat, 1499, false);
    expect(b.recovered).toBe(false);
    expect(b.heat.v).toBeGreaterThan(0);
    const c = advanceHeat(b.heat, 1, false);
    expect(c).toEqual({ heat: at(0), recovered: true });
    h = c.heat;
    expect(heatZone(h)).toBe('cool');
  });
  it('과열이 끝난 뒤 다시 오른다', () => {
    const done = advanceHeat(over(10), 10, false).heat;
    expect(heatTap(done).heat.v).toBe(HEAT_TAP);
  });
});

describe('구간·배율', () => {
  it('구간 경계', () => {
    expect([0, 39, 40, 69, 70, 99].map((v) => heatZone(at(v)))).toEqual(['cool', 'cool', 'warm', 'warm', 'hot', 'hot']);
    expect(heatZone(over(1000))).toBe('over');
  });
  it('heatTapMult: 달아오름만 x1.5', () => {
    expect([0, 69, 70, 99].map((v) => heatTapMult(at(v)))).toEqual([1, 1, HEAT_HOT_MULT, HEAT_HOT_MULT]);
    expect(heatTapMult(over(1000))).toBe(1);
  });
  it('heatDamped: 과열 중만', () => {
    expect(heatDamped(at(99))).toBe(false);
    expect(heatDamped(over(1))).toBe(true);
  });
  it('heatStrikeMult', () => {
    expect(heatStrikeMult(at(0), 'perfect')).toBe(1);
    expect(heatStrikeMult(at(50), 'good')).toBe(2);
    expect(heatStrikeMult(at(100), 'perfect')).toBe(3);
    expect(heatStrikeMult(at(100), 'miss')).toBe(1);
    expect(heatStrikeMult(over(1500), 'perfect')).toBe(1);
  });
});

describe('ventHeat', () => {
  it('높으면 20으로, 낮으면 그대로, 과열 중이면 그대로', () => {
    expect(ventHeat(at(90))).toEqual(at(HEAT_AFTER_STRIKE));
    expect(ventHeat(at(10))).toEqual(at(10));
    const o = over(2000);
    expect(ventHeat(o)).toEqual(o);
  });
});
