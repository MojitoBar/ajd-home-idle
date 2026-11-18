import { describe, expect, it } from 'vitest';
import { GEARS, GEAR_IDS, SHIELD_CHARGE_PERFECTS } from '../data/gear';
import { chargeGrade, chargeZoneAt, releaseCharge, rollChargeZone } from './charge';
import { tapValue } from './economy';
import { buyGear, canBuyGear, gearCost, gearEffects, gearUnlocked, initialShield, resolveStreak } from './gear';
import { houseInfo } from './house';
import { move } from './prestige';
import { parseSave, sanitize, serialize } from './save';
import { defaultState } from './testState';
import type { GameState } from './state';
import { chainBonus, specialAt } from './unpack';
import { advanceWeak, hitWeak, type WeakState } from './weak';

const never = () => 0.99;
const rich = (extra: Partial<GameState> = {}): GameState => ({ ...defaultState(), points: 1e30, moves: 1, ...extra });

describe('공구 비용·해금·구매', () => {
  it('비용 = 집 목표 × frac × 2.2^레벨', () => {
    const s = { ...defaultState(), moves: 1 };
    const t = houseInfo(1).target;
    expect(gearCost(s, 'level')).toBeCloseTo(t * 0.01);
    expect(gearCost({ ...s, gear: { level: 2 } }, 'level')).toBeCloseTo(t * 0.01 * 2.2 ** 2);
    expect(gearCost(s, 'helmet')).toBeCloseTo(t * 0.015);
    expect(gearCost(s, 'awl')).toBeCloseTo(t * 0.0075);
  });
  it('집이 바뀌면 비용도 그 집 목표를 따른다', () => {
    const s = { ...defaultState(), moves: 2 };
    expect(gearCost(s, 'crowbar')).toBeCloseTo(houseInfo(2).target * 0.01);
  });
  it('상한이면 Infinity', () => {
    expect(gearCost({ ...defaultState(), gear: { helmet: 3 } }, 'helmet')).toBe(Infinity);
  });
  it('해금: 상자 수 또는 이사 경험', () => {
    const s = defaultState();
    const at = (box: number): GameState => ({ ...s, unpack: { ...s.unpack, box } });
    expect(gearUnlocked(at(14), 'level')).toBe(false);
    expect(gearUnlocked(at(15), 'level')).toBe(true);
    expect(gearUnlocked(at(44), 'helmet')).toBe(false);
    expect(gearUnlocked(at(45), 'helmet')).toBe(true);
    expect(gearUnlocked(at(54), 'awl')).toBe(false);
    expect(gearUnlocked({ ...s, moves: 1 }, 'awl')).toBe(true);
  });
  it('구매: 포인트 차감과 레벨 +1', () => {
    const s = rich({ points: 1e30 });
    const cost = gearCost(s, 'level');
    const n = buyGear(s, 'level')!;
    expect(n.gear.level).toBe(1);
    expect(n.points).toBeCloseTo(s.points - cost, -10);
  });
  it('구매 거부: 상한·해금 전·포인트 부족', () => {
    expect(buyGear(rich({ gear: { level: 5 } }), 'level')).toBeNull();
    expect(buyGear({ ...defaultState(), points: 1e30 }, 'level')).toBeNull();
    expect(canBuyGear(rich({ points: 1 }), 'level')).toBe(false);
  });
  it('상자 해금 순서 정의 5종', () => {
    expect(GEAR_IDS).toEqual(['level', 'helmet', 'crowbar', 'awl', 'loupe']);
    expect(GEARS.map((g) => g.unlockBox)).toEqual([15, 45, 35, 55, 25]);
  });
});

describe('효과 값', () => {
  const lv = (id: string, n: number) => gearEffects({ ...defaultState(), gear: { [id]: n } });
  it('기본값', () => {
    expect(gearEffects(defaultState())).toEqual({ perfectHalf: 0.05, shieldMax: 0, chainCap: 20, weakTaps: 8, weakDelayMult: 1, specialRate: 0.05 });
  });
  it('수평계: 반폭 0.05 + 0.012×lv (Lv5 0.11)', () => {
    expect(lv('level', 3).perfectHalf).toBeCloseTo(0.086);
    expect(lv('level', 5).perfectHalf).toBeCloseTo(0.11);
  });
  it('안전모 칸 수 = 레벨', () => expect(lv('helmet', 2).shieldMax).toBe(2));
  it('빠루: 20 + 10×lv', () => expect(lv('crowbar', 5).chainCap).toBe(70));
  it('송곳: 탭 수 8 + 4×lv, 간격 ×(1 − 0.08×lv)', () => {
    expect(lv('awl', 5).weakTaps).toBe(28);
    expect(lv('awl', 5).weakDelayMult).toBeCloseTo(0.6);
  });
  it('돋보기: 5% + 1%×lv', () => expect(lv('loupe', 5).specialRate).toBeCloseTo(0.1));
});

describe('실드 규칙', () => {
  const max = 2;
  it('굿·미스 모두 연속을 지키고 칸을 쓴다(+1 없음)', () => {
    for (const g of ['good', 'miss'] as const) {
      const r = resolveStreak(5, g, initialShield(max), max);
      expect(r).toEqual({ streak: 5, shield: { n: 1, toNext: SHIELD_CHARGE_PERFECTS }, saved: true });
    }
  });
  it('0칸이면 끊긴다', () => {
    const r = resolveStreak(5, 'miss', { n: 0, toNext: 3 }, max);
    expect(r).toEqual({ streak: 0, shield: { n: 0, toNext: 3 }, saved: false });
  });
  it('연속이 0일 때는 칸을 쓰지 않는다', () => {
    const r = resolveStreak(0, 'miss', initialShield(max), max);
    expect(r.streak).toBe(0);
    expect(r.shield.n).toBe(2);
    expect(r.saved).toBe(false);
  });
  it('퍼펙트 8회마다 한 칸 찬다', () => {
    let sh = { n: 0, toNext: SHIELD_CHARGE_PERFECTS };
    let st = 0;
    for (let i = 0; i < SHIELD_CHARGE_PERFECTS - 1; i++) {
      const r = resolveStreak(st, 'perfect', sh, max);
      st = r.streak;
      sh = r.shield;
    }
    expect(sh.n).toBe(0);
    const r = resolveStreak(st, 'perfect', sh, max);
    expect(r.shield).toEqual({ n: 1, toNext: SHIELD_CHARGE_PERFECTS });
    expect(r.streak).toBe(SHIELD_CHARGE_PERFECTS);
  });
  it('최대 칸에서는 더 차지 않는다', () => {
    const r = resolveStreak(3, 'perfect', { n: max, toNext: 1 }, max);
    expect(r.shield.n).toBe(max);
    expect(r.shield.toNext).toBe(SHIELD_CHARGE_PERFECTS);
  });
  it('퍼펙트는 saved가 아니다', () => expect(resolveStreak(3, 'perfect', initialShield(1), 1).saved).toBe(false));
});

describe('연결점', () => {
  it('chargeZoneAt 반폭 인자: 굿 구간은 그대로, 상한 0.12', () => {
    const z = chargeZoneAt(0.5, 0.11);
    expect(z.perfect[1] - z.perfect[0]).toBeCloseTo(0.22);
    expect(z.good).toEqual(chargeZoneAt(0.5).good);
    const w = chargeZoneAt(0.5, 0.3);
    expect(w.perfect[1] - w.perfect[0]).toBeCloseTo(0.24);
    const d = chargeZoneAt(0.5);
    expect(d.perfect[1] - d.perfect[0]).toBeCloseTo(0.1);
  });
  it('rollChargeZone 반폭 인자', () => {
    const z = rollChargeZone(() => 0.5, undefined, 0.11);
    expect(z.perfect[1] - z.perfect[0]).toBeCloseTo(0.22);
    const z2 = rollChargeZone(() => 0.5, z, 0.11);
    expect(z2.perfect[1] - z2.perfect[0]).toBeCloseTo(0.22);
  });
  it('releaseCharge 기본 구간은 수평계 반폭으로 퍼펙트를 판정한다', () => {
    const pos = 0.83 + 0.09;
    expect(releaseCharge(defaultState(), never, pos, 0).grade).toBe('good');
    expect(releaseCharge({ ...defaultState(), gear: { level: 5 } }, never, pos, 0).grade).toBe('perfect');
    expect(chargeGrade(pos, chargeZoneAt(0.83, 0.11))).toBe('perfect');
  });
  it('chainBonus cap', () => {
    expect(chainBonus(50)).toBeCloseTo(3);
    expect(chainBonus(50, 70)).toBeCloseTo(6);
    expect(chainBonus(100, 70)).toBeCloseTo(8);
  });
  it('specialAt rate: 결정적이고 확률을 올리면 더 자주 나온다', () => {
    const count = (rate?: number) => Array.from({ length: 2000 }, (_, k) => specialAt(7, k, rate)).filter(Boolean).length;
    expect(count(0.1)).toBe(count(0.1));
    expect(count()).toBe(count(0.05));
    expect(count(0.1)).toBeGreaterThan(count(0.05));
  });
  it('송곳: 급소 탭 수와 등장 간격', () => {
    const w: WeakState = { nextInMs: 100, remainMs: 900, u: 0.3, v: 0.7 };
    const s = { ...defaultState(), gear: { awl: 5 } };
    expect(hitWeak(s, never, w, 1).gain).toBeCloseTo(tapValue(s) * 28);
    expect(hitWeak(s, () => 0, w, 1).weak.nextInMs).toBeCloseTo(4000 * 0.6);
    expect(advanceWeak({ ...w, remainMs: 10 }, 20, true, () => 0, 0.6).weak.nextInMs).toBeCloseTo(2400);
  });
});

describe('저장·이사', () => {
  it('정의에 없는 id는 버리고 최대 레벨로 자른다', () => {
    const raw = { ...JSON.parse(serialize(defaultState(), 1)), gear: { level: 9, helmet: 2.7, bogus: 4, awl: -3, loupe: 'x' } };
    const s = sanitize(raw);
    expect(s.gear).toEqual({ level: 5, helmet: 2 });
  });
  it('gear가 없는 저장은 빈 객체', () => {
    const { gear, ...rest } = JSON.parse(serialize(defaultState(), 1));
    void gear;
    expect(parseSave(JSON.stringify(rest)).state.gear).toEqual({});
  });
  it('새 게임은 gear {}', () => expect(defaultState().gear).toEqual({}));
  it('이사해도 유지', () => {
    const s = { ...defaultState(), gear: { level: 3, helmet: 1 }, earned: houseInfo(0).target };
    expect(move(s)!.gear).toEqual({ level: 3, helmet: 1 });
  });
});
