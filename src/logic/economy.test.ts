import { describe, expect, it } from 'vitest';
import { tapWithRng } from './variety';
import {
  buyTapUpgrade,
  globalMult,
  milestoneMult,
  collectionMult,
  homeMult,
  multBreakdown,
  tapStable,
  tapBase,
  tapBreakdown,
  tapCost,
  tapGate,
  initialTapGate,
  type TapGateState,
  tapValue,
  applyTap,
  tick,
} from './economy';
import { defaultState } from './testState';
import { DAMPED_RATIO, TAPS_PER_SEC_FULL, TAP_BOX_SCALE, TAP_COST_RATE, TAP_MILESTONES } from '../data/tap';
import { perkEffects } from './perks';

describe('마일스톤', () => {
  it('마일스톤 배수는 10·25·50·100·150·200·300·400에서 x2 누적', () => {
    expect(milestoneMult(9, TAP_MILESTONES)).toBe(1);
    expect(milestoneMult(10, TAP_MILESTONES)).toBe(2);
    expect(milestoneMult(24, TAP_MILESTONES)).toBe(2);
    expect(milestoneMult(25, TAP_MILESTONES)).toBe(4);
    expect(milestoneMult(100, TAP_MILESTONES)).toBe(16);
    expect(milestoneMult(149, TAP_MILESTONES)).toBe(16);
    expect(milestoneMult(150, TAP_MILESTONES)).toBe(32);
    expect(milestoneMult(299, TAP_MILESTONES)).toBe(64);
    expect(milestoneMult(400, TAP_MILESTONES)).toBe(256);
    expect(tapBase(400)).toBe(401 * 256);
  });
  it('영구 배율만 있으면 globalMult는 1 + 1.5 x 이사', () => {
    const s = { ...defaultState(), moves: 2 };
    expect(globalMult(s)).toBe(4);
  });
});

describe('살림 배율 H', () => {
  const home = (lv: number, boost = 0) => ({ ...defaultState(), homeLv: Array(8).fill(lv), perks: (boost ? { home_boost: boost } : {}) as Record<string, number> });
  it('살림이 없으면 x1, 8칸 모두 Lv1 x1.4 · Lv3 x3.4 · Lv12 약 x20(20.2)', () => {
    expect(homeMult(defaultState())).toBe(1);
    expect(homeMult(home(1))).toBeCloseTo(1.4, 10);
    expect(homeMult(home(3))).toBeCloseTo(3.4, 10);
    expect(homeMult(home(12))).toBeCloseTo(20.2, 10);
  });
  it('단계(Lv 3·12·48·192)가 오르면 그 칸의 기여가 2배', () => {
    const at = (lv: number) => ({ ...defaultState(), homeLv: [lv, 0, 0, 0, 0, 0, 0, 0] });
    expect((homeMult(at(3)) - 1) / (homeMult(at(2)) - 1)).toBeCloseTo((3 * 2) / 2, 10);
    expect((homeMult(at(12)) - 1) / (homeMult(at(11)) - 1)).toBeCloseTo((12 * 4) / (11 * 2), 10);
    expect(homeMult(at(48)) - 1).toBeCloseTo(0.05 * 48 * 8, 10);
    expect(homeMult(at(192)) - 1).toBeCloseTo(0.05 * 192 * 16, 10);
  });
  it('살림 장인 특전은 곱해지고 탭 수익에만 들어간다', () => {
    expect(homeMult(home(3, 2))).toBeCloseTo(3.4 * 1.5, 10);
    const a = { ...defaultState(), homeLv: Array(8).fill(3) };
    expect(tapValue(a)).toBeCloseTo(tapValue(defaultState()) * 3.4, 10);
    expect(multBreakdown(a, 'tap').home).toBeCloseTo(3.4, 10);
  });
});

describe('탭 식', () => {
  it('tapStable = tapBase x 영구 x 도감 x 살림 x 탭 특전 x 0.6, 피버 제외', () => {
    const s = {
      ...defaultState(),
      tapLevel: 12,
      moves: 1,
      homeLv: Array(8).fill(1),
      perks: { tap_power: 1 },
      collection: { fan: { base: 1, shiny: 0, gold: 0, rainbow: 0 } },
      fever: { gauge: 0, activeSec: 5, cooldownSec: 0 },
    };
    const want = tapBase(12) * 2.5 * collectionMult(s) * 1.4 * perkEffects(s).tapMult * TAP_BOX_SCALE;
    expect(tapStable(s)).toBeCloseTo(want, 10);
    expect(tapValue(s)).toBeCloseTo(want * 3, 10);
    expect(multBreakdown(s, 'tap').total * tapBase(12) * TAP_BOX_SCALE).toBeCloseTo(tapValue(s), 8);
  });
  it('감쇠 탭은 x0.3', () => {
    const s = { ...defaultState(), tapLevel: 9 };
    expect(tapValue(s, true)).toBeCloseTo(tapValue(s) * DAMPED_RATIO, 12);
    expect(DAMPED_RATIO).toBe(0.3);
  });
});

describe('탭', () => {
  it('비용 20*1.25^L, 기본값 (1+L)*2^마일스톤', () => {
    expect(tapCost(0)).toBe(20);
    expect(tapCost(2)).toBeCloseTo(20 * 1.5625);
    expect(tapBase(0)).toBe(1);
    expect(tapBase(9)).toBe(10);
    expect(tapBase(10)).toBe(22);
    expect(tapBase(25)).toBe(26 * 4);
    expect(milestoneMult(100, TAP_MILESTONES)).toBe(16);
  });
  it('탭은 points·earned에 G를 곱해 더함, 강화는 비용 차감', () => {
    const s = { ...defaultState(), moves: 1, points: 20 };
    expect(tapValue(s)).toBeCloseTo(2.5 * TAP_BOX_SCALE);
    const t = applyTap(s);
    expect(t.points).toBeCloseTo(20 + 2.5 * TAP_BOX_SCALE);
    expect(t.earned).toBeCloseTo(2.5 * TAP_BOX_SCALE);
    expect(t.stats.totalTaps).toBe(1);
    const up = buyTapUpgrade(s);
    expect(up?.tapLevel).toBe(1);
    expect(up?.points).toBe(0);
    expect(buyTapUpgrade({ ...s, points: 19 })).toBeNull();
  });
  it('탭 내역은 {flat, total}: flat = tapStable, total = tapValue', () => {
    const a = { ...defaultState(), tapLevel: 10, fever: { gauge: 0, activeSec: 5, cooldownSec: 0 } };
    const bd = tapBreakdown(a);
    expect(Object.keys(bd).sort()).toEqual(['flat', 'total']);
    expect(bd.flat).toBeCloseTo(tapStable(a), 10);
    expect(bd.total).toBeCloseTo(tapValue(a), 10);
  });
  it('피버는 탭 수익에 한 번만 곱해진다', () => {
    const base = { ...defaultState(), tapLevel: 12, };
    const fever = { ...base, fever: { ...base.fever, activeSec: 5 } };
    expect(tapValue(fever)).toBeCloseTo(tapValue(base) * 3, 8);
  });
  it('탭 특전은 탭 수익에 곱해진다', () => {
    const base = { ...defaultState(), tapLevel: 12, };
    const perked = { ...base, perks: { tap_power: 2 } };
    expect(tapValue(perked)).toBeCloseTo(tapValue(base) * perkEffects(perked).tapMult, 8);
  });
  it('강화 가격은 지수 곡선', () => {
    for (let l = 0; l < 150; l++) expect(tapCost(l + 1) / tapCost(l)).toBeCloseTo(TAP_COST_RATE, 10);
  });
  const run = (perSec: number, sec: number, from = 1000, gate: TapGateState = initialTapGate()) => {
    let g = gate;
    let full = 0;
    let damped = 0;
    let ignored = 0;
    const n = Math.round(perSec * sec);
    for (let i = 0; i < n; i++) {
      const r = tapGate(g, from + (i * 1000) / perSec);
      g = r;
      if (!r.ok) ignored++;
      else if (r.damped) damped++;
      else full++;
    }
    return { full, damped, ignored, gate: g };
  };
  it('초당 4·6회는 10초 동안 전부 전액', () => {
    for (const hz of [4, 6]) {
      const r = run(hz, 10);
      expect(r.damped).toBe(0);
      expect(r.ignored).toBe(0);
      expect(r.full).toBe(hz * 10);
    }
  });
  it('초당 10회로 10초면 전액 탭이 58~62개, 고르게 섞인다', () => {
    const warm = run(10, 2);
    const r = run(10, 10, 1000 + 2000, warm.gate);
    expect(r.ignored).toBe(0);
    expect(r.full).toBeGreaterThanOrEqual(58);
    expect(r.full).toBeLessThanOrEqual(62);
    expect(r.full + r.damped).toBe(100);
    const seq = run(10, 10).full; // 처음 6개 덤으로 최대 65
    expect(seq).toBeLessThanOrEqual(65);
  });
  it('초당 12회 초과분은 무시', () => {
    const r = run(20, 5);
    expect(r.ignored).toBeGreaterThan(0);
    expect(r.full + r.damped).toBeLessThanOrEqual(12 * 5 + 12);
  });
  it('5초 쉬었다 연타해도 처음 전액 탭은 6개를 넘지 않는다', () => {
    const warm = run(10, 3);
    const r = run(12, 0.5, 1000 + 8000, warm.gate);
    expect(r.full).toBeLessThanOrEqual(TAPS_PER_SEC_FULL + 1);
    let g = warm.gate;
    let fullRun = 0;
    for (let i = 0; i < 12; i++) {
      const t = tapGate(g, 20000 + i);
      g = t;
      if (t.ok && !t.damped) fullRun++;
    }
    expect(fullRun).toBe(TAPS_PER_SEC_FULL);
  });
  it('감쇠된 탭은 기본값 몫만 준다', () => {
    const s = { ...defaultState(), tapLevel: 12, };
    expect(tapValue(s, true)).toBeCloseTo(tapStable(s) * DAMPED_RATIO, 10);
    expect(tapValue(s, true)).toBeLessThanOrEqual(tapValue(s));
    expect(tapValue(s, false)).toBe(tapValue(s));
    const a = applyTap(s, true);
    expect(a.points - s.points).toBeCloseTo(tapStable(s) * DAMPED_RATIO, 10);
    expect(tapWithRng(s, () => 0.99, true).damped).toBe(true);
    expect(tapWithRng(s, () => 0.99, true).gain).toBeCloseTo(tapStable(s) * DAMPED_RATIO, 10);
    expect(tapWithRng(s, () => 0.99).damped).toBe(false);
    expect(tapWithRng(s, () => 0.99, true).state.fever.gauge).toBe(s.fever.gauge + 0.5);
    expect(tapWithRng(s, () => 0, true).crit).toBe(false);
    expect(tapWithRng(s, () => 0, true).gain).toBeCloseTo(tapStable(s) * DAMPED_RATIO, 10);
    expect(tapWithRng(s, () => 0.99).state.fever.gauge).toBeGreaterThan(s.fever.gauge);
  });
});

describe('tick', () => {
  it('자동 수익은 없고 플레이 시간만 쌓인다', () => {
    const s = defaultState();
    const t = tick(s, 2);
    expect(t.points).toBe(0);
    expect(t.earned).toBe(0);
    expect(t.stats.playSec).toBe(2);
    expect(tick(s, 0)).toBe(s);
  });
});
