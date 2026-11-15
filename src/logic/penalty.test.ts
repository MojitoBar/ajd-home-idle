import { describe, expect, it } from 'vitest';
import { applyTap, buyService, buyTapUpgrade, contractExtraPps, tick } from './economy';
import { contractPenaltyBase, contractPenaltyPreview, contractStatuses, startContract } from './contract';
import { houseInfo } from './house';
import { applyOffline } from './offline';
import { canMove, contractPenalty, move, moveStatus } from './prestige';
import { parseSave, sanitize, serialize } from './save';
import { defaultState, type GameState } from './state';

const T = 1_700_000_000_000;
const withLv = (services: number[], extra: Partial<GameState> = {}): GameState => ({ ...defaultState(), services, ...extra });
const base = (points = 0, extra: Partial<GameState> = {}) => {
  const s = startContract(withLv([30, 30, 0, 0, 0, 0, 0, 0], { earned: 7e7, points, ...extra }), 0, 'long')!;
  return startContract(s, 1, 'normal')!;
};
const hot = (s: GameState): GameState => ({
  ...s,
  fever: { gauge: 0, activeSec: 5, cooldownSec: 0 },
  event: { ...s.event, remainSec: 30 },
});

const B_LONG = 5.5e7 * 0.15;
const B_NORMAL = 5.5e7 * 0.05;

describe('위약금: 일시 배율 불변', () => {
  it('피버·이벤트 활성 여부와 무관하게 같다', () => {
    const s = base();
    const p = contractPenalty(s);
    expect(p).toBeGreaterThan(0);
    expect(contractPenalty(hot(s))).toBe(p);
    expect(contractPenalty({ ...s, fever: hot(s).fever })).toBe(p);
    expect(contractPenalty({ ...s, event: hot(s).event })).toBe(p);
  });
  it('이사 판정도 피버·이벤트로 달라지지 않는다', () => {
    const p = contractPenalty(base());
    for (const pts of [p - 1, p, p + 1]) {
      const a = base(pts);
      const b = hot(a);
      expect(moveStatus(b)).toEqual(moveStatus(a));
      expect(canMove(b)).toBe(canMove(a));
    }
  });
});

describe('위약금: 시간 경과', () => {
  it('단조 감소하고 만료 시 정확히 0', () => {
    let s = base();
    let prev = contractPenalty(s);
    for (let i = 0; i < 80; i++) {
      s = tick(s, 50);
      const p = contractPenalty(s);
      expect(p).toBeLessThanOrEqual(prev);
      prev = p;
    }
    expect(s.contracts).toEqual([]);
    expect(contractPenalty(s)).toBe(0);
  });
  it('큰 dt 한 번과 작은 dt 여러 번이 같은 수익·남은 초(중간 만료 포함)', () => {
    const s0 = base();
    const one = tick(s0, 1000); // normal(900초)은 중간 만료
    let many = s0;
    for (let i = 0; i < 1000; i++) many = tick(many, 1);
    expect(many.earned).toBeCloseTo(one.earned, 3);
    expect(many.points).toBeCloseTo(one.points, 3);
    expect(many.contracts.map((c) => c.service)).toEqual([0]);
    expect(many.contracts[0].remainSec).toBeCloseTo(one.contracts[0].remainSec, 6);
    expect(one.contracts[0].remainSec).toBeCloseTo(2600, 6);
  });
  it('중간 만료 시 약정 추가 수익은 남은 초만큼만 반영', () => {
    const s0 = withLv([30, 0, 0, 0, 0, 0, 0, 0]);
    const s = startContract(s0, 0, 'short')!;
    const extra = contractExtraPps(s, 0);
    const noC = tick(s0, 400).earned;
    expect(tick(s, 400).earned).toBeCloseTo(noC + extra * 300, 4);
  });
});

describe('위약금: 오프라인', () => {
  it('남은 초가 실제 경과만큼 줄고 위약금도 비례해 줄며 약정 수익은 남은 시간만큼만', () => {
    const s0 = base(0, { savedAt: T });
    const extra0 = contractExtraPps(s0, 0);
    const extra1 = contractExtraPps(s0, 1);
    const plain = applyOffline({ ...s0, contracts: [] }, T + 600_000).state;
    const r = applyOffline(s0, T + 600_000).state;
    expect(r.contracts.map((c) => c.remainSec)).toEqual([3000, 300]);
    expect(r.points - plain.points).toBeCloseTo((extra0 * 600 + extra1 * 600) * 0.5, 4);
    expect(contractPenalty(r)).toBeCloseTo(B_LONG * (3000 / 3600) + B_NORMAL * (300 / 900), 4);
  });
  it('약정이 오프라인 중 만료되면 남은 시간만큼만 반영하고 제거', () => {
    const s0 = base(0, { savedAt: T });
    const extra1 = contractExtraPps(s0, 1);
    const extra0 = contractExtraPps(s0, 0);
    const plain = applyOffline({ ...s0, contracts: [] }, T + 1200_000).state;
    const r = applyOffline(s0, T + 1200_000).state;
    expect(r.contracts.map((c) => c.service)).toEqual([0]);
    expect(r.points - plain.points).toBeCloseTo((extra0 * 1200 + extra1 * 900) * 0.5, 4);
  });
  it('8시간 상한을 넘겨도 약정은 실제 경과만큼 줄고 이중 계산 없음', () => {
    const s0 = base(0, { savedAt: T });
    const r = applyOffline(s0, T + 20 * 3600_000).state;
    expect(r.contracts).toEqual([]);
    const plain = applyOffline({ ...s0, contracts: [] }, T + 20 * 3600_000).state;
    const extra = contractExtraPps(s0, 0) * 3600 + contractExtraPps(s0, 1) * 900;
    expect(r.points - plain.points).toBeCloseTo(extra * 0.5, 4);
  });
  it('피버·이벤트 중 저장해도 오프라인 위약금·수익은 같다', () => {
    const s0 = base(0, { savedAt: T });
    const a = applyOffline(s0, T + 300_000).state;
    const b = applyOffline(hot(s0), T + 300_000).state;
    expect(b.points).toBeCloseTo(a.points, 6);
    expect(contractPenalty(b)).toBeCloseTo(contractPenalty(a), 6);
  });
});

describe('위약금: 저장·불러오기', () => {
  it('왕복 후 약정과 위약금이 같다', () => {
    const s = base(123);
    const r = parseSave(serialize(s, T));
    expect(r.kind).toBe('ok');
    const back = r.state;
    expect(back.contracts).toEqual(s.contracts);
    expect(contractPenalty(back)).toBeCloseTo(contractPenalty(s), 6);
  });
  it('잘못된 저장값이어도 위약금이 유한한 비음수이고 이사가 영구히 막히지 않는다', () => {
    const raw: any = {
      ...base(0),
      earned: 1e15,
      contracts: [
        { service: 0, kind: 'long', remainSec: -5 },
        { service: 1, kind: 'normal', remainSec: NaN },
        { service: 99, kind: 'normal', remainSec: 100 },
        { service: -1, kind: 'normal', remainSec: 100 },
        { service: 0, kind: 'bogus', remainSec: 100 },
        { service: 0, kind: 'normal', remainSec: 1e12 },
        { service: 0, kind: 'short', remainSec: 200 },
        { service: 1, kind: 'short', remainSec: Infinity },
        { service: 2, kind: 'short', remainSec: 100 },
        { service: 1.7, kind: 'short', remainSec: 100 },
      ],
    };
    const s = sanitize(raw);
    const p = contractPenalty(s);
    expect(Number.isFinite(p)).toBe(true);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(new Set(s.contracts.map((c) => c.service)).size).toBe(s.contracts.length);
    for (const c of s.contracts) expect(c.remainSec).toBeLessThanOrEqual(c.kind === 'long' ? 3600 : c.kind === 'normal' ? 900 : 300);
    // 시간이 지나면 풀린다
    expect(canMove(tick(s, 4000))).toBe(true);
  });
  it('칸 수를 넘는 약정은 저장값에서 걸러져도 위약금은 유한하다', () => {
    const raw: any = {
      ...defaultState(),
      services: [5, 5, 5, 5, 5, 5, 5, 5],
      contracts: [0, 1, 2, 3, 4].map((service) => ({ service, kind: 'long', remainSec: 3000 })),
    };
    const s = sanitize(raw);
    expect(Number.isFinite(contractPenalty(s))).toBe(true);
  });
});

describe('위약금: 레벨·결합 변화, 특전, 이사', () => {
  it('체결 때 기준 금액이 고정된다: 집 목표 x 종류별 비율, 레벨 0·약정 없음이면 0', () => {
    const s = startContract(withLv([10, 0, 0, 0, 0, 0, 0, 0]), 0, 'long')!;
    expect(s.contracts[0].penaltyBase).toBeCloseTo(B_LONG, 6);
    expect(s.contracts[0].totalSec).toBe(3600);
    expect(contractPenalty(s)).toBeCloseTo(B_LONG, 6);
    expect(contractPenalty(withLv([10, 0, 0, 0, 0, 0, 0, 0]))).toBe(0);
    const later = startContract(withLv([10, 0, 0, 0, 0, 0, 0, 0], { moves: 2 }), 0, 'short')!;
    expect(later.contracts[0].penaltyBase).toBeCloseTo(houseInfo(2).target * 0.02, 0);
  });
  it('서비스 레벨·결합 단계가 올라도 위약금은 그대로', () => {
    const s = startContract(withLv([10, 0, 0, 0, 0, 0, 0, 0]), 0, 'long')!;
    const before = contractPenalty(s);
    for (let lv = 0; lv <= 300; lv += 7) {
      expect(contractPenalty({ ...s, services: [lv, lv, lv, lv, lv, lv, lv, lv] })).toBe(before);
    }
  });
  it('서비스 구매·탭 강화·탭·피버·이벤트·도감 배율이 있어도 절대 늘지 않는다', () => {
    let s = startContract(withLv([20, 5, 0, 0, 0, 0, 0, 0], { points: 1e9, earned: 1e6 }), 0, 'normal')!;
    let prev = contractPenalty(s);
    const check = () => {
      const p = contractPenalty(s);
      expect(p).toBeLessThanOrEqual(prev);
      prev = p;
    };
    for (let i = 0; i < 20; i++) {
      s = buyService(s, 0, 5) ?? s; check();
      s = buyService(s, 1, 5) ?? s; check();
      s = buyTapUpgrade(s) ?? s; check();
      s = applyTap(s); check();
      s = { ...s, fever: { gauge: 0, activeSec: 5, cooldownSec: 0 }, event: { ...s.event, remainSec: 30 } }; check();
      s = { ...s, collection: { ...s.collection, a: { base: 9, shiny: 9, gold: 9, rainbow: 9 } } }; check();
      s = tick(s, 20); check();
    }
  });
  it('남은 시간에 비례해 줄고 절반 지나면 절반', () => {
    const s = startContract(withLv([10, 0, 0, 0, 0, 0, 0, 0]), 0, 'long')!;
    expect(contractPenalty(tick(s, 1800))).toBeCloseTo(B_LONG / 2, 4);
  });
  it('협상 특전 최대 레벨(-60%)에서 감면이 맞고 음수가 아니다', () => {
    const s = base();
    const p = contractPenalty(s);
    for (let lv = 0; lv <= 3; lv++) {
      const v = contractPenalty({ ...s, perks: { penalty_cut: lv } });
      expect(v).toBeCloseTo(p * (1 - 0.2 * lv), 6);
      expect(v).toBeGreaterThanOrEqual(0);
    }
    expect(contractPenalty(sanitize({ ...s, perks: { penalty_cut: 99 } }))).toBeGreaterThanOrEqual(0);
  });
  it('약정 칸 특전으로 늘어난 칸의 약정도 합산된다', () => {
    let s = withLv([30, 30, 30, 30, 0, 0, 0, 0], { perks: { contract_slot: 2 } });
    for (let i = 0; i < 4; i++) s = startContract(s, i, 'long')!;
    expect(s.contracts.length).toBe(4);
    expect(contractPenalty(s)).toBeCloseTo(4 * B_LONG, 4);
  });
  it('이사 직후 약정 없음·위약금 0, 새 집에서 바로 약정 가능', () => {
    const m = move(base(1e12))!;
    expect(m.contracts).toEqual([]);
    expect(contractPenalty(m)).toBe(0);
    const n = { ...m, services: [1, 0, 0, 0, 0, 0, 0, 0] };
    expect(startContract(n, 0, 'short')).not.toBeNull();
  });
  it('보유 P가 위약금과 정확히 같으면 이사 가능, 조금 모자라면 불가', () => {
    const p = contractPenalty(base());
    expect(canMove(base(p))).toBe(true);
    expect(canMove(base(p * (1 - 1e-9)))).toBe(false);
    expect(move(base(p))).not.toBeNull();
  });
});

describe('위약금: 조회 함수', () => {
  it('미리 보기는 체결 직후 위약금과 같고 특전 감면을 반영', () => {
    const s0 = withLv([10, 0, 0, 0, 0, 0, 0, 0]);
    expect(contractPenaltyPreview(s0, 'short')).toBeCloseTo(5.5e7 * 0.02, 6);
    expect(contractPenaltyPreview(s0, 'long')).toBeCloseTo(contractPenalty(startContract(s0, 0, 'long')!), 6);
    expect(contractPenaltyPreview({ ...s0, perks: { penalty_cut: 2 } }, 'long')).toBeCloseTo(B_LONG * 0.6, 6);
    expect(contractPenaltyBase(1, 'normal')).toBeCloseTo(houseInfo(1).target * 0.05, 0);
  });
  it('후반 집은 집별 보정 계수가 곱해지고 표를 넘는 집은 마지막 값', () => {
    expect(contractPenaltyBase(3, 'long')).toBeCloseTo(houseInfo(3).target * 0.15 * 0.07, 0);
    expect(contractPenaltyBase(7, 'long')).toBeCloseTo(houseInfo(7).target * 0.15 * 0.02, 0);
  });
  it('contractStatuses가 약정별 현재 위약금을 준다', () => {
    const s = tick(base(), 900);
    const st = contractStatuses(s);
    expect(st).toHaveLength(1);
    expect(st[0].penalty).toBeCloseTo(B_LONG * (2700 / 3600), 4);
    expect(contractStatuses({ ...s, perks: { penalty_cut: 1 } })[0].penalty).toBeCloseTo(st[0].penalty * 0.8, 6);
  });
});
