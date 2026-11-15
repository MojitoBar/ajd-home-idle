import { describe, expect, it } from 'vitest';
import { BUNDLES } from '../data/bundles';
import { PERKS } from '../data/perks';
import { SERVICES } from '../data/services';
import { bundleMultFor, bundleStatuses } from './bundle';
import { advanceContracts, contractBlock, contractSlots, freeContractSlots, startContract } from './contract';
import { contractExtraPps, multBreakdown, pps, serviceProd, tick } from './economy';
import { boxPrice } from './gacha';
import { applyOffline } from './offline';
import { choosePerk, discardPerkOffer, perkEffects, rollPerkOffer, seededRng } from './perks';
import { contractPenalty, move, moveStatus } from './prestige';
import { migrate, parseSave, sanitize, serialize } from './save';
import { defaultState, type GameState } from './state';

const T = 1_700_000_000_000;
const withLv = (services: number[], extra: Partial<GameState> = {}): GameState => ({ ...defaultState(), services, ...extra });

describe('결합 할인', () => {
  it('모든 서비스가 1~2개 결합에 속한다', () => {
    SERVICES.forEach((_, i) => {
      const n = BUNDLES.filter((b) => b.services.includes(i)).length;
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(2);
    });
  });
  it('단계 경계: 최소 레벨 10/25/50/100에서 x1.5/2/3/4', () => {
    const at = (min: number) => bundleStatuses(withLv([min, 0, 0, min + 50, 0, 0, 0, 0])).find((b) => b.id === 'comm')!;
    expect(at(9).mult).toBe(1);
    expect(at(10).mult).toBe(1.5);
    expect(at(24).mult).toBe(1.5);
    expect(at(25).mult).toBe(2);
    expect(at(50).mult).toBe(3);
    expect(at(99).mult).toBe(3);
    expect(at(100).mult).toBe(4);
  });
  it('두 결합에 속한 서비스는 두 배율을 곱한다', () => {
    // 인터넷(0)은 통신·알뜰 입문. 휴대폰 10 -> 통신 x1.5, 정수기·공기 25 -> 알뜰 x2
    const s = withLv([30, 30, 30, 10, 0, 0, 0, 0]);
    expect(bundleMultFor(s, 0)).toBe(1.5 * 2);
    expect(bundleMultFor(s, 3)).toBe(1.5);
  });
  it('다음 단계까지 부족한 서비스와 레벨', () => {
    const b = bundleStatuses(withLv([12, 0, 0, 30, 0, 0, 0, 0])).find((x) => x.id === 'comm')!;
    expect(b.nextLevel).toBe(25);
    expect(b.lacking).toEqual([{ index: 0, name: '인터넷', level: 12, need: 13 }]);
  });
  it('결합 달인 특전은 증가분을 키운다', () => {
    const s = withLv([10, 0, 0, 10, 0, 0, 0, 0], { perks: { bundle_boost: 4 } });
    expect(bundleMultFor(s, 0)).toBeCloseTo(1 + 0.5 * 2);
  });
  it('수익에 반영된다', () => {
    const a = withLv([10, 0, 0, 0, 0, 0, 0, 0]);
    const b = withLv([10, 0, 0, 10, 0, 0, 0, 0]);
    expect(serviceProd(b, 0)).toBeCloseTo(serviceProd(a, 0) * 1.5);
  });
});

describe('이사 특전 3택', () => {
  it('서로 다른 3개를 뽑고 최대 레벨은 제외', () => {
    const rng = seededRng(5);
    for (let i = 0; i < 50; i++) {
      const o = rollPerkOffer({}, rng);
      expect(o).toHaveLength(3);
      expect(new Set(o).size).toBe(3);
    }
    const maxed = Object.fromEntries(PERKS.slice(0, PERKS.length - 2).map((p) => [p.id, p.maxLevel]));
    expect(rollPerkOffer(maxed, seededRng(1))).toHaveLength(2);
  });
  it('이사하면 선택 대기가 생기고 저장·복원 후에도 같다', () => {
    const s = { ...defaultState(), earned: 7e7 };
    const m = move(s, seededRng(7))!;
    expect(m.perkOffers).toHaveLength(1);
    const loaded = parseSave(serialize(m, T)).state;
    expect(loaded.perkOffers).toEqual(m.perkOffers);
  });
  it('rng 없이도 결정적이다', () => {
    const s = { ...defaultState(), earned: 7e7 };
    expect(move(s)!.perkOffers).toEqual(move(s)!.perkOffers);
  });
  it('선택하면 레벨이 오르고 묶음이 사라지며, 묶음 밖 특전·최대 레벨은 거절', () => {
    let s: GameState = { ...defaultState(), perkOffers: [['tap_power', 'crit', 'svc_power'], ['tap_power', 'crit', 'svc_power']] };
    expect(choosePerk(s, 0, 'box_discount')).toBeNull();
    s = choosePerk(s, 0, 'tap_power')!;
    expect(s.perks.tap_power).toBe(1);
    expect(s.perkOffers).toHaveLength(1);
    s = { ...s, perks: { ...s.perks, tap_power: 5 } };
    expect(choosePerk(s, 0, 'tap_power')).toBeNull();
    expect(choosePerk(s, 0, 'crit')!.perks.crit).toBe(1);
  });
  it('모두 최대인 묶음만 버릴 수 있다', () => {
    const s: GameState = { ...defaultState(), perks: { tap_power: 5 }, perkOffers: [['tap_power']] };
    expect(discardPerkOffer(s, 0)!.perkOffers).toHaveLength(0);
    expect(discardPerkOffer({ ...s, perks: {} }, 0)).toBeNull();
  });
  it('선택 전에도 게임이 막히지 않는다(대기 중 이사 가능)', () => {
    const s: GameState = { ...defaultState(), earned: 4.6e8, perkOffers: [['crit', 'tap_power', 'svc_power']], moves: 1 };
    expect(moveStatus(s).ok).toBe(true);
  });
  it('특전 효과가 수치에 반영된다', () => {
    const e = perkEffects({ perks: { tap_power: 2, crit: 1, fever_long: 1, offline_cap: 1, contract_slot: 1, box_discount: 2 } });
    expect(e.tapMult).toBeCloseTo(3.2);
    expect(e.critChance).toBeCloseTo(0.08);
    expect(e.feverSec).toBe(14);
    expect(e.offlineCapSec).toBe(8 * 3600 + 7200);
    expect(e.extraSlots).toBe(1);
    expect(e.boxPriceMult).toBeCloseTo(0.84);
  });
});

describe('약정', () => {
  const base = () => withLv([20, 20, 5, 0, 0, 0, 0, 0]);
  it('칸 제한(기본 2, 특전 +1)·중복 불가·미보유 불가', () => {
    let s = base();
    expect(contractSlots(s)).toBe(2);
    s = startContract(s, 0, 'normal')!;
    expect(contractBlock(s, 0)).toBe('busy');
    expect(contractBlock(s, 3)).toBe('locked');
    s = startContract(s, 1, 'short')!;
    expect(freeContractSlots(s)).toBe(0);
    expect(startContract(s, 2, 'long')).toBeNull();
    expect(freeContractSlots({ ...s, perks: { contract_slot: 1 } })).toBe(1);
  });
  it('약정 배율은 해당 서비스에만, 배율 분해에 보인다', () => {
    const s = startContract(base(), 0, 'long')!;
    expect(serviceProd(s, 0)).toBeCloseTo(serviceProd(base(), 0) * 3);
    expect(serviceProd(s, 1)).toBeCloseTo(serviceProd(base(), 1));
    expect(multBreakdown(s, 0).contract).toBe(3);
    expect(multBreakdown(s, 1).contract).toBe(1);
    expect(multBreakdown(s, 0).total).toBeCloseTo(serviceProd(s, 0) / (SERVICES[0].baseProd * 20 * 2));
  });
  it('만료되면 사라지고 tick은 남은 시간만큼만 배율을 준다', () => {
    let s = startContract(base(), 0, 'short')!;
    const extra = contractExtraPps(s, 0);
    const none = { ...s, contracts: [] };
    const before = s.points;
    s = tick(s, 600);
    expect(s.contracts).toHaveLength(0);
    const gain = s.points - before;
    expect(gain).toBeCloseTo(pps(none) * 600 + extra * 300);
    expect(advanceContracts([{ service: 0, kind: 'short', remainSec: 10, totalSec: 300, penaltyBase: 1 }], 4)[0].remainSec).toBe(6);
  });
  it('오프라인: 남은 약정 시간만 배율 반영, 남은 초는 실제 경과만큼 감소', () => {
    const s0 = startContract({ ...base(), savedAt: T }, 0, 'short')!; // 300초
    const extra = contractExtraPps(s0, 0);
    const plain = pps({ ...s0, contracts: [] });
    const r = applyOffline(s0, T + 3600_000);
    expect(r.report!.gain).toBeCloseTo((3600 * plain + 300 * extra) * 0.5);
    expect(r.state.contracts).toHaveLength(0);
    const r2 = applyOffline(startContract({ ...base(), savedAt: T }, 0, 'long')!, T + 120_000);
    expect(r2.state.contracts[0].remainSec).toBe(3600 - 120);
  });
  it('저장·복원에 남은 초가 유지된다', () => {
    const s = startContract(base(), 1, 'normal')!;
    const back = parseSave(serialize(tick(s, 100), T)).state;
    expect(back.contracts).toEqual([{ service: 1, kind: 'normal', remainSec: 800, totalSec: 900, penaltyBase: 2.75e6 }]);
  });
});

describe('위약금', () => {
  const rich = (points: number) => {
    const s = startContract(withLv([30, 30, 0, 0, 0, 0, 0, 0], { earned: 7e7, points }), 0, 'long')!;
    return startContract(s, 1, 'normal')!;
  };
  it('위약금 = 기준 금액 x 남은 비율의 합', () => {
    const s = rich(0);
    expect(contractPenalty(s)).toBeCloseTo(5.5e7 * 0.15 + 5.5e7 * 0.05);
  });
  it('보유 P가 부족하면 이사할 수 없고, 충분하면 약정이 모두 사라진다', () => {
    const poor = rich(1);
    const st = moveStatus(poor);
    expect(st.ok).toBe(false);
    expect(st.reason).toBe('penalty');
    expect(st.penaltyShortfall).toBeGreaterThan(0);
    expect(move(poor)).toBeNull();
    const ok = rich(1e12);
    const m = move(ok)!;
    expect(m).not.toBeNull();
    expect(m.contracts).toEqual([]);
  });
  it('목표 미달이 우선 사유, 만료를 기다리면 위약금 0', () => {
    const s = { ...rich(0), earned: 1 };
    expect(moveStatus(s).reason).toBe('target');
    const expired = tick({ ...rich(0) }, 4000);
    expect(contractPenalty(expired)).toBe(0);
    expect(moveStatus(expired).ok).toBe(true);
  });
  it('위약금 협상 특전은 감면한다', () => {
    const s = rich(0);
    expect(contractPenalty({ ...s, perks: { penalty_cut: 2 } })).toBeCloseTo(contractPenalty(s) * 0.6);
  });
});

describe('상자 가격은 일시 배율에 흔들리지 않는다', () => {
  const s0 = withLv([20, 20, 10, 0, 0, 0, 0, 0]);
  it('피버·이벤트 배율·약정 중에도 같다', () => {
    const p = boxPrice(s0);
    expect(boxPrice({ ...s0, fever: { gauge: 0, activeSec: 5, cooldownSec: 0 } })).toBe(p);
    expect(boxPrice({ ...s0, event: { ...s0.event, remainSec: 30 } })).toBe(p);
    expect(boxPrice(startContract(s0, 0, 'long')!)).toBe(p);
  });
  it('영구·결합·특전은 반영한다', () => {
    expect(boxPrice({ ...s0, moves: 3 })).toBeGreaterThan(boxPrice(s0));
    expect(boxPrice({ ...s0, perks: { box_discount: 2 } })).toBeCloseTo(boxPrice(s0) * 0.84);
  });
});

describe('저장 v3 migrate', () => {
  it('2 -> 3: 이사 횟수만큼 선택 대기를 소급하고 나머지는 보존', () => {
    const v2 = { version: 2, savedAt: 9, points: 77, earned: 99, moves: 3, tapLevel: 2, services: [3, 0, 0, 0, 0, 0, 0, 0], collection: {}, event: { nextInSec: 300, remainSec: 0, streak: 1 }, stats: {}, settings: {} };
    const r = parseSave(JSON.stringify(v2));
    expect(r.kind).toBe('ok');
    expect(r.state.version).toBe(6);
    expect(r.state.points).toBe(77);
    expect(r.state.perkOffers).toHaveLength(3);
    r.state.perkOffers.forEach((o) => expect(new Set(o).size).toBe(3));
    expect(r.state.contracts).toEqual([]);
    expect(parseSave(JSON.stringify(v2)).state.perkOffers).toEqual(r.state.perkOffers);
    expect(migrate({ version: 2, moves: 0 })!.perkOffers).toEqual([]);
  });
  it('이상한 값은 걸러낸다', () => {
    const s = sanitize({
      perks: { tap_power: 99, nope: 3 },
      perkOffers: [['crit', 'crit', 'zzz'], 'x'],
      contracts: [{ service: 1, kind: 'short', remainSec: 99999 }, { service: 99, kind: 'short', remainSec: 5 }, { service: 1, kind: 'long', remainSec: 5 }],
    });
    expect(s.perks).toEqual({ tap_power: 5 });
    expect(s.perkOffers).toEqual([['crit']]);
    expect(s.contracts).toEqual([{ service: 1, kind: 'short', remainSec: 300, totalSec: 300, penaltyBase: 5.5e7 * 0.02 }]);
  });
});
