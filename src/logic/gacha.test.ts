import { describe, expect, it } from 'vitest';
import { COLLECTIBLES, RARITIES, SLOT_TOTAL, VARIANTS } from '../data/collectibles';
import { applyTap, collectionMult as econC } from './economy';
import { boxPrice, collectionMult, collectionProgress, oddsTable, openBox, openBoxes, rollBox } from './gacha';
import { move } from './prestige';
import { defaultState } from './state';

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seq = (...v: number[]) => {
  let i = 0;
  return () => v[i++];
};
const rich = () => ({ ...defaultState(), points: 1e12 });

describe('데이터·확률표', () => {
  it('20종, 80슬롯, 희귀도별 종 수', () => {
    expect(COLLECTIBLES).toHaveLength(20);
    expect(SLOT_TOTAL).toBe(80);
    expect(oddsTable().rarities.map((r) => r.speciesCount)).toEqual([7, 6, 4, 2, 1]);
  });
  it('희귀도·변이 확률 합 100%', () => {
    expect(RARITIES.reduce((a, r) => a + r.prob, 0)).toBeCloseTo(1, 12);
    expect(VARIANTS.reduce((a, v) => a + v.prob, 0)).toBeCloseTo(1, 12);
    const t = oddsTable();
    expect(t.rarities.reduce((a, r) => a + r.prob, 0)).toBeCloseTo(1, 12);
    expect(t.rarities[3].percent).toBe('2.7%');
    expect(t.variants[3].percent).toBe('0.1%');
  });
});

describe('상자', () => {
  it('가격: 최소 5000, 개봉 수마다 x1.06', () => {
    const s = defaultState();
    expect(boxPrice(s)).toBe(5000);
    expect(boxPrice({ ...s, boxesThisRun: 2 })).toBeCloseTo(5000 * 1.06 ** 2, 6);
  });
  it('난수 경계: 0은 일반 첫 종·기본, 0.999..는 신화·무지개', () => {
    const lo = rollBox(() => 0);
    expect(lo.item.id).toBe('fan');
    expect(lo.variant).toBe('base');
    const hi = rollBox(() => 0.9999999999);
    expect(hi.item.rarity).toBe('myth');
    expect(hi.variant).toBe('rainbow');
  });
  it('희귀도 구간 경계', () => {
    expect(rollBox(seq(0.5999, 0, 0)).item.rarity).toBe('common');
    expect(rollBox(seq(0.6, 0, 0)).item.rarity).toBe('rare');
    expect(rollBox(seq(0.97, 0, 0)).item.rarity).toBe('legend');
    expect(rollBox(seq(0.997, 0, 0)).item.rarity).toBe('myth');
    expect(rollBox(seq(0, 0, 0.88)).variant).toBe('shiny');
    expect(rollBox(seq(0, 0, 0.98)).variant).toBe('gold');
    expect(rollBox(seq(0, 0, 0.999)).variant).toBe('rainbow');
  });
  it('P 부족이면 null, 개봉하면 P·개수·통계 반영', () => {
    expect(openBox(defaultState(), () => 0)).toBeNull();
    const r = openBox({ ...defaultState(), points: 5000 }, () => 0)!;
    expect(r.state.points).toBe(0);
    expect(r.state.boxesThisRun).toBe(1);
    expect(r.state.stats.boxesOpened).toBe(1);
    expect(r.result.isNew).toBe(true);
  });
  it('중복은 개수만 증가, P 환급 없음', () => {
    const a = openBox(rich(), () => 0)!;
    const b = openBox(a.state, () => 0)!;
    expect(b.result.isNew).toBe(false);
    expect(b.result.count).toBe(2);
    expect(b.state.collection.fan.base).toBe(2);
    expect(collectionProgress(b.state).registered).toBe(1);
    expect(b.state.points).toBeCloseTo(a.state.points - boxPrice(a.state), 3);
  });
  it('x10 연속 개봉: 돈이 모자라면 중간에 멈춤', () => {
    const r = openBoxes(rich(), mulberry(1), 10);
    expect(r.results).toHaveLength(10);
    expect(r.state.boxesThisRun).toBe(10);
    const few = openBoxes({ ...defaultState(), points: 5000 + 5500 }, () => 0, 10);
    expect(few.results).toHaveLength(2);
  });
  it('고정 시드 10만 회: 희귀도·변이 분포가 표의 +-0.5%p', () => {
    const rng = mulberry(20261114);
    const n = 100000;
    const rc: Record<string, number> = {};
    const vc: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const { item, variant } = rollBox(rng);
      rc[item.rarity] = (rc[item.rarity] ?? 0) + 1;
      vc[variant] = (vc[variant] ?? 0) + 1;
    }
    for (const r of RARITIES) expect(Math.abs((rc[r.id] ?? 0) / n - r.prob)).toBeLessThan(0.005);
    for (const v of VARIANTS) expect(Math.abs((vc[v.id] ?? 0) / n - v.prob)).toBeLessThan(0.005);
  });
});

describe('도감 배율 C', () => {
  it('처음 1, 슬롯 등록마다 w*x 가산(개수 3은 Lv 2라 x2)', () => {
    expect(collectionMult(defaultState())).toBe(1);
    const s = { ...defaultState(), collection: { fan: { base: 3, shiny: 0, gold: 1, rainbow: 0 }, space_purifier: { base: 0, shiny: 1, gold: 0, rainbow: 0 } } };
    expect(collectionMult(s)).toBeCloseTo((1 + 0.05 * 2 + 0.05 * 4 + 0.8 * 2) * 5, 10); // 신화 세트(1종) 완성 x5
    expect(econC(s)).toBe(collectionMult(s));
  });
  it('전부 등록(Lv 1)하면 (1 + 50.25) x 세트 곱 180 = 9225, 전부 Lv 5면 약 1.4e5', () => {
    const collection: Record<string, { base: number; shiny: number; gold: number; rainbow: number }> = {};
    for (const c of COLLECTIBLES) collection[c.id] = { base: 1, shiny: 1, gold: 1, rainbow: 1 };
    const s = { ...defaultState(), collection };
    expect(collectionMult(s)).toBeCloseTo(51.25 * 180, 8);
    expect(collectionProgress(s).registered).toBe(80);
    const max: Record<string, { base: number; shiny: number; gold: number; rainbow: number }> = {};
    for (const c of COLLECTIBLES) max[c.id] = { base: 31, shiny: 31, gold: 31, rainbow: 31 };
    expect(collectionMult({ ...s, collection: max })).toBeCloseTo((1 + 3.35 * 15 * 16) * 180, 6);
  });
  it('수익(탭)에 C가 곱해지고 이사 후에도 도감 유지', () => {
    const base = defaultState();
    const withC = { ...base, collection: { fan: { base: 1, shiny: 0, gold: 0, rainbow: 0 } } };
    expect(applyTap(withC).points).toBeCloseTo(applyTap(base).points * 1.05, 10);
    const moved = move({ ...withC, earned: 3.7e15, boxesThisRun: 5 })!;
    expect(moved.collection).toEqual(withC.collection);
    expect(moved.boxesThisRun).toBe(0);
  });
});
