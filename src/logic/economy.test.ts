import { describe, expect, it } from 'vitest';
import { tapWithRng } from './variety';
import {
  buyService,
  buyTapUpgrade,
  bulkCost,
  globalMult,
  maxAffordable,
  milestoneMult,
  pps,
  serviceCost,
  nextTapRatio,
  tapBase,
  tapBreakdown,
  tapCost,
  tapFlatValue,
  tapGate,
  initialTapGate,
  type TapGateState,
  tapRatio,
  tapValue,
  applyTap,
  tick,
} from './economy';
import { defaultState } from './state';
import { TAPS_PER_SEC_FULL, SERVICE_MILESTONES, TAP_BOX_SCALE, TAP_COST_RATE, TAP_MILESTONES } from '../data/services';
import { perkEffects } from './perks';

describe('서비스 비용·수익', () => {
  it('비용은 기본*1.15^레벨', () => {
    expect(serviceCost(0, 0)).toBe(15);
    expect(serviceCost(0, 1)).toBeCloseTo(17.25);
    expect(serviceCost(1, 2)).toBeCloseTo(120 * 1.15 ** 2);
  });
  it('마일스톤 배수는 10·25·50·100·200·400에서 x2 누적', () => {
    expect(milestoneMult(9, SERVICE_MILESTONES)).toBe(1);
    expect(milestoneMult(10, SERVICE_MILESTONES)).toBe(2);
    expect(milestoneMult(24, SERVICE_MILESTONES)).toBe(2);
    expect(milestoneMult(25, SERVICE_MILESTONES)).toBe(4);
    expect(milestoneMult(400, SERVICE_MILESTONES)).toBe(64);
  });
  it('수익 = 기본*레벨*마일스톤*G', () => {
    const s = defaultState();
    s.services[0] = 10;
    expect(pps(s)).toBeCloseTo(0.5 * 10 * 2);
    s.moves = 2;
    expect(globalMult(s)).toBe(4);
    expect(pps(s)).toBeCloseTo(0.5 * 10 * 2 * 4);
  });
  it('벌크 비용과 MAX 구매 수량', () => {
    let sum = 0;
    for (let l = 3; l < 13; l++) sum += serviceCost(2, l);
    expect(bulkCost(2, 3, 10)).toBeCloseTo(sum, 6);
    const pts = 5000;
    const n = maxAffordable(1, 4, pts);
    expect(bulkCost(1, 4, n)).toBeLessThanOrEqual(pts);
    expect(bulkCost(1, 4, n + 1)).toBeGreaterThan(pts);
    expect(maxAffordable(0, 0, 14.9)).toBe(0);
  });
  it('구매: 포인트 차감, 부족하면 null, 미해금이면 null', () => {
    const s = defaultState();
    s.points = 15;
    const b = buyService(s, 0, 1);
    expect(b?.points).toBe(0);
    expect(b?.services[0]).toBe(1);
    expect(buyService(s, 1, 1)).toBeNull();
    expect(buyService({ ...s, points: 14 }, 0, 1)).toBeNull();
    const u = { ...s, points: 1000, services: [1, 0, 0, 0, 0, 0, 0, 0] };
    expect(buyService(u, 1, 1)?.services[1]).toBe(1);
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
  it('서비스가 없으면 탭 수익은 기본값뿐(예전과 동일)', () => {
    for (const lv of [0, 5, 10, 30]) {
      const s = { ...defaultState(), tapLevel: lv };
      expect(tapValue(s)).toBeCloseTo(tapBase(lv) * TAP_BOX_SCALE);
      expect(tapBreakdown(s).fromPps).toBe(0);
    }
  });
  it('탭 수익 = 기본값 + 탭 비율 x 초당 수익(서비스 수에 비례)', () => {
    const a = { ...defaultState(), tapLevel: 10, services: [10, 0, 0, 0, 0, 0, 0, 0] };
    const b = { ...a, services: [20, 0, 0, 0, 0, 0, 0, 0] };
    const bd = tapBreakdown(a);
    expect(bd.ratio).toBe(tapRatio(10));
    expect(bd.fromPps).toBeCloseTo(tapRatio(10) * pps(a) * TAP_BOX_SCALE, 10);
    expect(tapBreakdown(b).fromPps).toBeCloseTo(bd.fromPps * 2, 10);
    expect(bd.total).toBeCloseTo(tapValue(a), 10);
    expect(tapFlatValue(a)).toBeCloseTo(bd.flat, 10);
  });
  it('피버·이벤트는 탭 수익에 한 번만 곱해진다', () => {
    const base = { ...defaultState(), tapLevel: 12, services: [20, 5, 0, 0, 0, 0, 0, 0] };
    const fever = { ...base, fever: { ...base.fever, activeSec: 5 } };
    const event = { ...base, event: { ...base.event, remainSec: 30 } };
    expect(tapValue(fever)).toBeCloseTo(tapValue(base) * 3, 8);
    expect(tapValue(event)).toBeCloseTo(tapValue(base) * 3, 8);
  });
  it('약정은 탭 수익에 영향 없음', () => {
    const base = { ...defaultState(), tapLevel: 12, services: [20, 5, 0, 0, 0, 0, 0, 0] };
    const withC = { ...base, contracts: [{ service: 0, kind: 'normal' as const, remainSec: 100, totalSec: 900, penaltyBase: 1 }] };
    expect(tapValue(withC)).toBe(tapValue(base));
  });
  it('탭 특전은 기본값 몫과 비율 몫 모두에 곱해진다', () => {
    const base = { ...defaultState(), tapLevel: 12, services: [20, 5, 0, 0, 0, 0, 0, 0] };
    const perked = { ...base, perks: { tap_power: 2 } };
    expect(tapValue(perked)).toBeCloseTo(tapValue(base) * perkEffects(perked).tapMult, 8);
  });
  it('탭 비율은 레벨마다 단조 증가하고 레벨 0에서 1%, 마일스톤에서 크게 뛴다', () => {
    expect(tapRatio(0)).toBeCloseTo(0.01, 12);
    let prev = tapRatio(0);
    for (let l = 1; l <= 200; l++) {
      const r = tapRatio(l);
      expect(r).toBeGreaterThan(prev);
      prev = r;
    }
    for (const m of TAP_MILESTONES) expect(tapRatio(m) - tapRatio(m - 1)).toBeGreaterThan(tapRatio(m - 1) - tapRatio(m - 2) + 0.005);
    expect(nextTapRatio(7)).toBe(tapRatio(8));
    expect(tapRatio(100)).toBeLessThan(0.5);
  });
  it('강화 가격은 초당 수익과 무관한 지수 곡선', () => {
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
  it('감쇠된 탭은 기본값 몫만 준다(초당 수익 비례 몫 없음)', () => {
    const s = { ...defaultState(), tapLevel: 12, services: [20, 5, 0, 0, 0, 0, 0, 0] };
    expect(tapValue(s, true)).toBeCloseTo(tapFlatValue(s), 10);
    expect(tapValue(s, true)).toBeLessThan(tapValue(s));
    expect(tapValue(s, false)).toBe(tapValue(s));
    const a = applyTap(s, true);
    expect(a.points - s.points).toBeCloseTo(tapFlatValue(s), 10);
    expect(tapWithRng(s, () => 0.99, true).damped).toBe(true);
    expect(tapWithRng(s, () => 0.99, true).gain).toBeCloseTo(tapFlatValue(s), 10);
    expect(tapWithRng(s, () => 0.99).damped).toBe(false);
    expect(tapWithRng(s, () => 0.99, true).state.fever.gauge).toBe(s.fever.gauge + 0.5);
    expect(tapWithRng(s, () => 0, true).crit).toBe(false);
    expect(tapWithRng(s, () => 0, true).gain).toBeCloseTo(tapFlatValue(s), 10);
    expect(tapWithRng(s, () => 0.99).state.fever.gauge).toBeGreaterThan(s.fever.gauge);
  });
});

describe('tick', () => {
  it('pps*dt를 points와 earned에 더함', () => {
    const s = { ...defaultState(), services: [4, 0, 0, 0, 0, 0, 0, 0] };
    const t = tick(s, 2);
    expect(t.points).toBeCloseTo(4);
    expect(t.earned).toBeCloseTo(4);
    expect(tick(s, 0)).toBe(s);
  });
});
