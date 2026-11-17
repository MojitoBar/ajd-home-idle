import { describe, expect, it } from 'vitest';
import { boxHp, endlessHp } from './unpack';
import { exportString, importString, migrate, parseSave, sanitize, serialize } from './save';
import { defaultState } from './state';
import { houseInfo } from './house';

describe('저장·불러오기', () => {
  it('직렬화 왕복', () => {
    const s = { ...defaultState(), points: 12345.6, earned: 9e20, moves: 2 };
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
  it('누락 필드는 기본값, 예전 services·contracts는 버린다', () => {
    const short = parseSave(JSON.stringify({ version: 1, points: 5, services: [1, 2] }));
    expect(short.state.points).toBe(5);
    expect(short.state).not.toHaveProperty('services');
    expect(short.state).not.toHaveProperty('contracts');
    expect(short.state.settings.reduceMotion).toBe(false);
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
    expect(r.state.version).toBe(9);
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
  it('sanitize: 안내 표시는 v9 형태만 남기고 개수를 정수로 고친다', () => {
    const base = JSON.parse(serialize(defaultState(), 1));
    expect(sanitize({ ...base, notice: { kind: 'v9', boxes: 4.8 } }).notice).toEqual({ kind: 'v9', boxes: 4 });
    expect(sanitize({ ...base, notice: { kind: 'zzz', boxes: 4 } }).notice).toBeUndefined();
    expect(sanitize({ ...base, notice: 'v9' }).notice).toBeUndefined();
  });
  it('3->4: 약정이 있던 예전 저장도 약정 필드 없이 v9로 올라온다', () => {
    const old = { ...JSON.parse(serialize(defaultState(), 1)), version: 3, moves: 1, contracts: [{ service: 0, kind: 'long', remainSec: 1800 }] };
    const r = parseSave(JSON.stringify(old));
    expect(r.state.version).toBe(9);
    expect(r.state).not.toHaveProperty('contracts');
  });
  it('4->5: unpack를 첫 상자 기본값으로 채운다, 나머지는 보존', () => {
    const { unpack, ...rest } = JSON.parse(serialize({ ...defaultState(), points: 77, moves: 2 }, 1));
    void unpack;
    const r = parseSave(JSON.stringify({ ...rest, version: 4 }));
    expect(r.kind).toBe('ok');
    expect(r.state.version).toBe(9);
    expect(r.state.unpack).toMatchObject({ box: 0, damage: 0, roomDone: false, hp: 7, rushSec: 0 });
    expect(r.state.points).toBe(77);
    expect(r.state.moves).toBe(2);
  });
  it('sanitize: unpack의 음수·소수·NaN·과대 피해를 고친다', () => {
    const base = JSON.parse(serialize(defaultState(), 1));
    const u = (unpack: unknown) => sanitize({ ...base, unpack }).unpack;
    expect(u({ box: -3, damage: -1, roomDone: 'yes' })).toEqual({ box: 0, damage: 0, roomDone: false, hp: 7, salt: 0, rushSec: 0 });
    expect(u({ box: 12.7, damage: 5.9, roomDone: true })).toEqual({ box: 12, damage: 5, roomDone: true, hp: boxHp(12), salt: 0, rushSec: 0 });
    expect(u({ box: 0, damage: 9999 }).damage).toBe(6);
    expect(u({ box: NaN, damage: NaN })).toEqual({ box: 0, damage: 0, roomDone: false, hp: 7, salt: 0, rushSec: 0 });
    expect(u(undefined)).toEqual({ box: 0, damage: 0, roomDone: false, hp: 7, salt: 0, rushSec: 0 });
    expect(u({ box: 5, damage: 50, hp: 20 })).toMatchObject({ hp: 20, damage: 19 });
    expect(parseSave(serialize({ ...defaultState(), unpack: { box: 33, damage: 4, roomDone: false, hp: boxHp(33), salt: 0, rushSec: 0 } }, 1)).state.unpack).toEqual({ box: 33, damage: 4, roomDone: false, hp: boxHp(33), salt: 0, rushSec: 0 });
  });
  it('sanitize: 손질 단계 hp는 계산해서 채우고 homeLv를 보정한다', () => {
    const base = JSON.parse(serialize(defaultState(), 1));
    const r = sanitize({ ...base, unpack: { box: 85, damage: 0 }, homeLv: [3, -1, 2.9, 'x'] });
    expect(r.unpack.hp).toBe(endlessHp({ ...defaultState(), unpack: r.unpack }, 85));
    expect(r.homeLv).toEqual([3, 0, 2, 0, 0, 0, 0, 0]);
    expect(sanitize({ ...base, homeLv: 'bad' }).homeLv).toEqual(Array(8).fill(0));
  });
  it('6->7: 강타 힘 강화·최고 연쇄가 0으로 채워진다', () => {
    const { strikeLevel, bestChain, ...rest } = JSON.parse(serialize(defaultState(), 1));
    void strikeLevel;
    void bestChain;
    const r = parseSave(JSON.stringify({ ...rest, version: 6 }));
    expect(r.state.version).toBe(9);
    expect([r.state.strikeLevel, r.state.bestChain]).toEqual([0, 0]);
  });
  it('7->8: unpack에 salt(비음수 정수)와 러시 0이 채워지고 나머지는 보존', () => {
    const base = JSON.parse(serialize({ ...defaultState(), moves: 3, unpack: { box: 33, damage: 4, roomDone: false, hp: 9, salt: 0, rushSec: 0 } }, 1));
    const { salt, rushSec, ...old } = base.unpack;
    void salt;
    void rushSec;
    const r = parseSave(JSON.stringify({ ...base, version: 7, unpack: old }));
    expect(r.state.version).toBe(9);
    expect(r.state.unpack).toMatchObject({ box: 33, damage: 4, hp: 9, rushSec: 0, salt: (3 * 7919 + 33 * 31 + 17) & 0x7fffffff });
    expect(Number.isInteger(r.state.unpack.salt) && r.state.unpack.salt >= 0).toBe(true);
  });
  it('sanitize: salt·rushSec를 정수·상한으로 고친다', () => {
    const base = JSON.parse(serialize(defaultState(), 1));
    const u = (unpack: unknown) => sanitize({ ...base, unpack }).unpack;
    expect(u({ salt: -5, rushSec: -1 })).toMatchObject({ salt: 0, rushSec: 0 });
    expect(u({ salt: 12.9, rushSec: 999 })).toMatchObject({ salt: 12, rushSec: 15 });
  });
  it('5->6: hp 0으로 비우고 푼 큰 상자 수만큼 homeLv 1', () => {
    const { homeLv, ...rest } = JSON.parse(serialize({ ...defaultState(), unpack: { box: 35, damage: 3, roomDone: false, hp: 9, salt: 0, rushSec: 0 } }, 1));
    void homeLv;
    const r = parseSave(JSON.stringify({ ...rest, version: 5, unpack: { box: 35, damage: 3, roomDone: false } }));
    expect(r.kind).toBe('ok');
    expect(r.state.version).toBe(9);
    expect(r.state.homeLv).toEqual([1, 1, 1, 0, 0, 0, 0, 0]);
    expect(r.state.unpack).toMatchObject({ box: 35, damage: 3, roomDone: false, hp: boxHp(35) });
    const done = parseSave(JSON.stringify({ ...rest, version: 5, unpack: { box: 200, damage: 0, roomDone: true } }));
    expect(done.state.homeLv).toEqual(Array(8).fill(1));
    expect(done.state.unpack.hp).toBeGreaterThanOrEqual(10);
  });
});

describe('8->9: 서비스·결합·약정 삭제', () => {
  const v8 = (over: Record<string, unknown> = {}) => {
    const { notice, ...base } = JSON.parse(serialize({ ...defaultState(), moves: 2 }, 1));
    void notice;
    return { ...base, version: 8, services: [100, 50, 30, 20, 10, 5, 0, 0], contracts: [{ service: 0, kind: 'short', remainSec: 100 }], ...over };
  };
  const total = (c: Record<string, { base: number; shiny: number; gold: number; rainbow: number }>) =>
    Object.values(c).reduce((a, x) => a + x.base + x.shiny + x.gold + x.rainbow, 0);
  const load = (raw: unknown) => {
    const r = parseSave(JSON.stringify(raw));
    expect(r.kind).toBe('ok');
    return r.state;
  };
  it('버전 9, services·contracts 없음, 안내 표시가 붙는다', () => {
    const s = load(v8());
    expect(s.version).toBe(9);
    expect(s).not.toHaveProperty('services');
    expect(s).not.toHaveProperty('contracts');
    expect(s.notice).toEqual({ kind: 'v9', boxes: 8 }); // 레벨 합 215 / 25 = 8
  });
  it('서비스 레벨 25마다 무료 상자 1개가 도감에 들어가고, 두 번 불러도 같다', () => {
    const a = load(v8());
    const b = load(v8());
    expect(total(a.collection)).toBe(8);
    expect(a.collection).toEqual(b.collection);
  });
  it('기존 도감에 더해지고 상자는 최대 30개', () => {
    const own = { fan: { base: 5, shiny: 0, gold: 0, rainbow: 0 } };
    const s = load(v8({ collection: own, services: [9999, 0, 0, 0, 0, 0, 0, 0] }));
    expect(s.notice).toEqual({ kind: 'v9', boxes: 30 });
    expect(total(s.collection)).toBe(35);
    expect(load(v8({ services: [24, 0, 0, 0, 0, 0, 0, 0] })).notice).toEqual({ kind: 'v9', boxes: 0 });
  });
  it('points는 새 목표의 30%, earned는 새 목표로 잘린다', () => {
    const target = houseInfo(2).target;
    const big = load(v8({ points: 1e30, earned: 1e30 }));
    expect(big.points).toBeCloseTo(target * 0.3, 0);
    expect(big.earned).toBeCloseTo(target, 0);
    const small = load(v8({ points: 10, earned: 20 }));
    expect([small.points, small.earned]).toEqual([10, 20]);
  });
  it('안내 표시는 저장하고 불러와도 남는다', () => {
    expect(parseSave(serialize(load(v8()), 1)).state.notice).toEqual({ kind: 'v9', boxes: 8 });
  });
});

describe('8->9: 죽은 특전·이벤트 정리', () => {
  const v8 = (over: Record<string, unknown> = {}) => {
    const { notice, ...base } = JSON.parse(serialize({ ...defaultState(), moves: 2 }, 1));
    void notice;
    return { ...base, version: 8, services: [], contracts: [], event: { nextInSec: 100, remainSec: 5, streak: 2 }, ...over };
  };
  const load = (raw: unknown) => {
    const r = parseSave(JSON.stringify(raw));
    expect(r.kind).toBe('ok');
    return r.state;
  };
  it('event가 없다', () => {
    const s = load(v8());
    expect(s).not.toHaveProperty('event');
    expect(JSON.parse(serialize(s, 1))).not.toHaveProperty('event');
  });
  it('죽은 특전 레벨 1마다 3택 묶음이 늘고, 죽은 id는 사라지며, 두 번 불러도 같다', () => {
    const raw = v8({ perks: { svc_power: 3, offline_cap: 1, tap_power: 2 }, perkOffers: [['tap_power', 'crit', 'fever_long']] });
    const a = load(raw);
    const b = load(raw);
    expect(a.perkOffers).toEqual(b.perkOffers);
    expect(a.perkOffers).toHaveLength(1 + 4);
    expect(a.perks).toEqual({ tap_power: 2 });
    for (const o of a.perkOffers) {
      expect(o).toHaveLength(3);
      expect(o.some((id) => ['svc_power', 'offline_cap'].includes(id))).toBe(false);
    }
  });
  it('기존 묶음에서 죽은 id를 빼고 3개가 안 되면 다시 뽑는다', () => {
    const s = load(v8({ perkOffers: [['contract_slot', 'crit', 'tap_power'], ['crit', 'fever_long', 'box_discount']] }));
    expect(s.perkOffers).toHaveLength(2);
    expect(s.perkOffers[0]).toHaveLength(3);
    expect(s.perkOffers[0]).not.toContain('contract_slot');
    expect(s.perkOffers[1]).toEqual(['crit', 'fever_long', 'box_discount']);
  });
  it('sanitize: 정의에 없는 특전 id는 버린다', () => {
    const s = sanitize({ ...v8(), version: 9, perks: { nope: 3, home_boost: 9 }, perkOffers: [['nope', 'dex_boost']] });
    expect(s.perks).toEqual({ home_boost: 4 });
    expect(s.perkOffers).toEqual([['dex_boost']]);
  });
});
