import { describe, expect, it } from 'vitest';
import { boxHp, endlessHp } from './unpack';
import { exportString, importString, migrate, parseSave, sanitize, serialize } from './save';
import { defaultState } from './state';

describe('저장·불러오기', () => {
  it('직렬화 왕복', () => {
    const s = { ...defaultState(), points: 12345.6, earned: 9e20, moves: 2, services: [12, 3, 0, 0, 0, 0, 0, 0] };
    const r = parseSave(serialize(s, 777));
    expect(r.kind).toBe('ok');
    expect(r.state).toEqual({ ...s, savedAt: 777 });
  });
  it('빈 값·깨진 값은 기본 상태', () => {
    expect(parseSave(null).kind).toBe('empty');
    expect(parseSave('{broken').kind).toBe('corrupt');
    expect(parseSave('[1,2]').kind).toBe('corrupt');
    expect(parseSave('null').kind).toBe('corrupt');
  });
  it('누락 필드는 기본값, services 길이는 서비스 수에 맞춤', () => {
    const short = parseSave(JSON.stringify({ version: 1, points: 5, services: [1, 2] }));
    expect(short.state.points).toBe(5);
    expect(short.state.services).toEqual([1, 2, 0, 0, 0, 0, 0, 0]);
    expect(short.state.settings.reduceMotion).toBe(false);
    const long = parseSave(JSON.stringify({ version: 1, services: new Array(12).fill(3) }));
    expect(long.state.services).toHaveLength(8);
  });
  it('이상한 숫자는 기본값으로', () => {
    const r = parseSave('{"version":1,"points":-5,"moves":"x","tapLevel":2.7,"earned":null}');
    expect(r.state.points).toBe(0);
    expect(r.state.moves).toBe(0);
    expect(r.state.tapLevel).toBe(2);
    expect(r.state.earned).toBe(0);
  });
  it('구버전은 migrate 체인으로 올림', () => {
    const r = parseSave(JSON.stringify({ points: 9 }));
    expect(r.kind).toBe('ok');
    expect(r.state.points).toBe(9);
    expect(r.state.version).toBe(6);
  });
  it('migrate 체인은 순서대로 적용되고 빈 단계는 null', () => {
    const chain = {
      1: (s: Record<string, unknown>) => ({ ...s, a: 1 }),
      2: (s: Record<string, unknown>) => ({ ...s, b: (s.a as number) + 1 }),
    };
    expect(migrate({ version: 1 }, chain, 3)).toEqual({ version: 3, a: 1, b: 2 });
    expect(migrate({ version: 0 }, chain, 3)).toBeNull();
  });
  it('알 수 없는 상위 버전은 future로 반환하고 불러오지 않음', () => {
    const r = parseSave('{"version":99,"points":5}');
    expect(r.kind).toBe('future');
    expect(r.state.points).toBe(0);
  });
  it('내보내기 문자열 왕복과 잘못된 문자열', () => {
    const s = { ...defaultState(), points: 42 };
    const r = importString(exportString(s, 5));
    expect(r.kind).toBe('ok');
    expect(r.state.points).toBe(42);
    expect(importString('%%%').kind).toBe('corrupt');
  });
  it('약정이 칸 수를 넘으면 초과분을 버리고, 같은 서비스 중복도 버린다', () => {
    const c = (service: number, kind = 'short') => ({ service, kind, remainSec: 100 });
    const raw = { ...JSON.parse(serialize(defaultState(), 1)), contracts: [c(0), c(0), c(1), c(2), c(3)] };
    const r = parseSave(JSON.stringify(raw));
    expect(r.state.contracts.map((x) => x.service)).toEqual([0, 1]);
  });
  it('약정 칸 특전이 있으면 그만큼 더 남긴다', () => {
    const c = (service: number) => ({ service, kind: 'short', remainSec: 100 });
    const raw = { ...JSON.parse(serialize(defaultState(), 1)), perks: { contract_slot: 1 }, contracts: [c(0), c(1), c(2), c(3)] };
    const r = parseSave(JSON.stringify(raw));
    expect(r.state.contracts.map((x) => x.service)).toEqual([0, 1, 2]);
  });
  it('3->4: 기존 약정에 현재 집 목표 기준 위약금 기준 금액을 채운다', () => {
    const old = { ...JSON.parse(serialize(defaultState(), 1)), version: 3, moves: 1, contracts: [{ service: 0, kind: 'long', remainSec: 1800 }] };
    const r = parseSave(JSON.stringify(old));
    expect(r.state.version).toBe(6);
    expect(r.state.contracts[0].totalSec).toBe(3600);
    expect(r.state.contracts[0].penaltyBase).toBeCloseTo(4.6e8 * 0.15, 0);
  });
  it('sanitize: 위약금 기준 금액의 음수·NaN·누락·과대값을 고친다', () => {
    const c = (penaltyBase: unknown) => ({ service: 0, kind: 'long', remainSec: 100, penaltyBase });
    const max = 5.5e7 * 0.15;
    for (const bad of [-5, NaN, undefined, 'x', null]) {
      const s = sanitize({ ...JSON.parse(serialize(defaultState(), 1)), contracts: [c(bad)] });
      expect(s.contracts[0].penaltyBase).toBeCloseTo(max, 6);
      expect(s.contracts[0].totalSec).toBe(3600);
    }
    expect(sanitize({ ...JSON.parse(serialize(defaultState(), 1)), contracts: [c(1e30)] }).contracts[0].penaltyBase).toBeCloseTo(max, 6);
    expect(sanitize({ ...JSON.parse(serialize(defaultState(), 1)), contracts: [c(1000)] }).contracts[0].penaltyBase).toBe(1000);
  });
  it('4->5: unpack를 첫 상자 기본값으로 채운다, 나머지는 보존', () => {
    const { unpack, ...rest } = JSON.parse(serialize({ ...defaultState(), points: 77, moves: 2 }, 1));
    void unpack;
    const r = parseSave(JSON.stringify({ ...rest, version: 4 }));
    expect(r.kind).toBe('ok');
    expect(r.state.version).toBe(6);
    expect(r.state.unpack).toEqual({ box: 0, damage: 0, roomDone: false, hp: 7 });
    expect(r.state.points).toBe(77);
    expect(r.state.moves).toBe(2);
  });
  it('sanitize: unpack의 음수·소수·NaN·과대 피해를 고친다', () => {
    const base = JSON.parse(serialize(defaultState(), 1));
    const u = (unpack: unknown) => sanitize({ ...base, unpack }).unpack;
    expect(u({ box: -3, damage: -1, roomDone: 'yes' })).toEqual({ box: 0, damage: 0, roomDone: false, hp: 7 });
    expect(u({ box: 12.7, damage: 5.9, roomDone: true })).toEqual({ box: 12, damage: 5, roomDone: true, hp: boxHp(12) });
    expect(u({ box: 0, damage: 9999 }).damage).toBe(6);
    expect(u({ box: NaN, damage: NaN })).toEqual({ box: 0, damage: 0, roomDone: false, hp: 7 });
    expect(u(undefined)).toEqual({ box: 0, damage: 0, roomDone: false, hp: 7 });
    expect(u({ box: 5, damage: 50, hp: 20 })).toMatchObject({ hp: 20, damage: 19 });
    expect(parseSave(serialize({ ...defaultState(), unpack: { box: 33, damage: 4, roomDone: false, hp: boxHp(33) } }, 1)).state.unpack).toEqual({ box: 33, damage: 4, roomDone: false, hp: boxHp(33) });
  });
  it('sanitize: 손질 단계 hp는 계산해서 채우고 homeLv를 보정한다', () => {
    const base = JSON.parse(serialize(defaultState(), 1));
    const r = sanitize({ ...base, unpack: { box: 85, damage: 0 }, homeLv: [3, -1, 2.9, 'x'] });
    expect(r.unpack.hp).toBe(endlessHp({ ...defaultState(), unpack: r.unpack }, 85));
    expect(r.homeLv).toEqual([3, 0, 2, 0, 0, 0, 0, 0]);
    expect(sanitize({ ...base, homeLv: 'bad' }).homeLv).toEqual(Array(8).fill(0));
  });
  it('5->6: hp 0으로 비우고 푼 큰 상자 수만큼 homeLv 1', () => {
    const { homeLv, ...rest } = JSON.parse(serialize({ ...defaultState(), unpack: { box: 35, damage: 3, roomDone: false, hp: 9 } }, 1));
    void homeLv;
    const r = parseSave(JSON.stringify({ ...rest, version: 5, unpack: { box: 35, damage: 3, roomDone: false } }));
    expect(r.kind).toBe('ok');
    expect(r.state.version).toBe(6);
    expect(r.state.homeLv).toEqual([1, 1, 1, 0, 0, 0, 0, 0]);
    expect(r.state.unpack).toEqual({ box: 35, damage: 3, roomDone: false, hp: boxHp(35) });
    const done = parseSave(JSON.stringify({ ...rest, version: 5, unpack: { box: 200, damage: 0, roomDone: true } }));
    expect(done.state.homeLv).toEqual(Array(8).fill(1));
    expect(done.state.unpack.hp).toBeGreaterThanOrEqual(10);
  });
});
