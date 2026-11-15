import { describe, expect, it } from 'vitest';
import { BOX_KINDS, ENDLESS_K_MULT } from '../data/unpack';
import { tapValue } from './economy';
import { move } from './prestige';
import { defaultState, type GameState } from './state';
import { boxCondition, boxHp, boxKind, endlessHp, hitBox, nextCareSlot, roomProgress, tapAndHit, tierOf, toolOf, unpackPower } from './unpack';

const never = () => 0.99; // 치명타 아님
const always = () => 0; // 치명타
const at = (k: number, damage = 0, extra: Partial<GameState> = {}): GameState => {
  const s: GameState = { ...defaultState(), ...extra, unpack: { box: k, damage, roomDone: k >= 80, hp: 0 } };
  return { ...s, unpack: { ...s.unpack, hp: k < 80 ? boxHp(k) : endlessHp(s, k) } };
};

/** 다음 1타에 터지는 상태 */
const last = (k: number, extra: Partial<GameState> = {}): GameState => {
  const s = at(k, 0, extra);
  return { ...s, unpack: { ...s.unpack, damage: s.unpack.hp - 1 } };
};

describe('상자 종류·내구도', () => {
  it('묶음 순서', () => {
    expect([...Array(10).keys()].map(boxKind)).toEqual(['small', 'small', 'normal', 'small', 'small', 'normal', 'small', 'small', 'normal', 'big']);
    expect([80, 82, 89, 90, 99].map(boxKind)).toEqual(['small', 'normal', 'big', 'small', 'big']);
  });
  it('HP 고정값', () => {
    expect(boxHp(0)).toBe(7);
    expect(boxHp(9)).toBe(56);
    expect(boxHp(39)).toBe(420);
    expect(boxHp(79)).toBe(6287);
  });
  it('손질 상자 HP = 힘 x 종류 탭 수 x 0.75^도구 단계', () => {
    const s = (tapLevel: number) => ({ ...defaultState(), tapLevel });
    expect(endlessHp(s(0), 80)).toBe(10);
    expect(endlessHp(s(0), 82)).toBe(20);
    expect(endlessHp(s(0), 89)).toBe(40);
    const p9 = unpackPower(s(9));
    const p10 = unpackPower(s(10));
    expect(endlessHp(s(9), 89)).toBe(p9 * 40);
    expect(endlessHp(s(10), 89)).toBe(Math.ceil(p10 * 40 * 0.75));
    expect(endlessHp(s(10), 89) / (p10 * 40)).toBeCloseTo(0.75, 1);
    // 도구가 바뀌면 지금 상자는 약 2배 빨리 깨지고, 다음 상자(0.75 곱)는 힘 대비 25% 적은 탭
    expect(endlessHp(s(10), 89) / p10).toBeCloseTo((endlessHp(s(9), 89) / p9) * 0.75, 5);
  });
  it('tierOf 경계', () => {
    expect([0, 2, 3, 11, 12, 47, 48, 191, 192, 767, 768].map(tierOf)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5]);
  });
  it('nextCareSlot: 단계가 낮은 칸 중 문턱에 가장 가까운 칸, 같으면 앞 칸', () => {
    const lv = (a: number[]) => ({ ...defaultState(), homeLv: a });
    expect(nextCareSlot(lv([2, 1, 1, 1, 1, 1, 1, 1]))).toBe(0);
    expect(nextCareSlot(lv([3, 2, 1, 1, 1, 1, 1, 1]))).toBe(1);
    expect(nextCareSlot(lv([3, 3, 3, 3, 3, 3, 3, 2]))).toBe(7);
    expect(nextCareSlot(lv([0, 0, 0, 0, 0, 0, 0, 0]))).toBe(0);
  });
  it('힘은 탭 강화·손목 단련만 반영', () => {
    expect(unpackPower(defaultState())).toBe(1);
    expect(unpackPower({ ...defaultState(), tapLevel: 10 })).toBe(22);
    expect(unpackPower({ ...defaultState(), tapLevel: 10, perks: { tap_power: 2 }, moves: 3 })).toBe(70);
  });
  it('도구 경계', () => {
    expect([0, 9, 10, 24, 25, 49, 50, 99, 100].map((l) => toolOf(l).name)).toEqual(['맨손', '맨손', '커터칼', '커터칼', '장도리', '장도리', '전동 드라이버', '전동 드라이버', '로봇 팔']);
  });
});

describe('탭 피해', () => {
  it('감쇠 탭은 피해 0, 상자 변화 없음', () => {
    const s = at(0, 0, { tapLevel: 50 });
    const r = tapAndHit(s, never, true);
    expect(r.state.unpack).toEqual(s.unpack);
    expect(r.burst).toBeNull();
    expect(r.damped).toBe(true);
  });
  it('비치명은 한 번에 최대 HP의 1/3(올림), 최소 3타', () => {
    let s = at(9, 0, { tapLevel: 99 });
    let hits = 0;
    while (s.unpack.box === 9) {
      const before = s.unpack.damage;
      const r = hitBox(s, { crit: false, damped: false, feverMult: 1 });
      s = r.state;
      hits++;
      if (!r.burst) expect(s.unpack.damage - before).toBe(Math.ceil(56 / 3));
    }
    expect(hits).toBe(3);
  });
  it('치명타는 상한 없이 한 방', () => {
    const s = at(9, 0, { tapLevel: 99 });
    const r = hitBox(s, { crit: true, damped: false, feverMult: 1 });
    expect(r.burst?.kind).toBe('big');
    expect(r.state.unpack.box).toBe(10);
  });
  it('피버 중 피해 x3, 덩어리는 그대로', () => {
    const base = at(2, 0, { tapLevel: 4 }); // 힘 5, 보통 상자 HP 19
    const a = hitBox(base, { crit: false, damped: false, feverMult: 1 });
    const b = hitBox(base, { crit: false, damped: false, feverMult: 3 });
    expect(a.state.unpack.damage).toBe(5);
    expect(b.state.unpack.damage).toBe(Math.min(15, 7));
    const lastB = at(2, 17, { tapLevel: 4 });
    const fever = { ...lastB, fever: { gauge: 0, activeSec: 5, cooldownSec: 0 } };
    const g1 = hitBox(lastB, { crit: false, damped: false, feverMult: 1 }).burst!.gain;
    const g3 = hitBox(fever, { crit: false, damped: false, feverMult: 3 }).burst!.gain;
    expect(g3).toBeCloseTo(g1);
  });
  it('피버 x3은 상한 안에서 피해를 키운다', () => {
    const base = at(39, 0, { tapLevel: 30 }); // 힘 62x... HP 420
    const p = unpackPower(base);
    const r = hitBox(base, { crit: false, damped: false, feverMult: 3 });
    expect(r.state.unpack.damage).toBe(Math.min(p * 3, 140));
  });
});

describe('터짐', () => {
  it('box+1, damage 0, P·earned 증가, 덩어리 = tapValue x K', () => {
    const s = at(0, 6);
    const r = hitBox(s, { crit: false, damped: false, feverMult: 1 });
    const gain = tapValue(s) * BOX_KINDS.small.k;
    expect(r.burst?.gain).toBeCloseTo(gain);
    expect(r.state.unpack).toEqual({ box: 1, damage: 0, roomDone: false, hp: boxHp(1) });
    expect(r.state.points).toBeCloseTo(s.points + gain);
    expect(r.state.earned).toBeCloseTo(s.earned + gain);
    expect(r.burst?.slotFill).toBeCloseTo(0.1);
    expect(r.burst?.item).toBeUndefined();
    expect(r.burst?.slot).toBe(0);
  });
  it('큰 상자는 살림 1점 완성', () => {
    const r = hitBox(at(19, 0, { tapLevel: 999 }), { crit: true, damped: false, feverMult: 1 });
    expect(r.burst?.item).toBe('washer');
    expect(r.burst?.slotFill).toBe(1);
    expect(r.burst?.roomDone).toBe(false);
  });
  it('80번째에서만 방 완성·무료 상자 1회', () => {
    const s = at(79, 0, { tapLevel: 999 });
    const r = hitBox(s, { crit: true, damped: false, feverMult: 1, rng: () => 0.5 });
    expect(r.burst?.roomDone).toBe(true);
    expect(r.burst?.freeBox).toBeDefined();
    expect(r.state.unpack.roomDone).toBe(true);
    expect(r.state.stats.boxesOpened).toBe(1);
    expect(r.state.boxesThisRun).toBe(0);
    const n = hitBox(at(78, 0, { tapLevel: 999 }), { crit: true, damped: false, feverMult: 1 });
    expect(n.burst?.roomDone).toBe(false);
    expect(n.burst?.freeBox).toBeUndefined();
    const again = hitBox({ ...r.state, unpack: { box: 79, damage: 0, roomDone: true, hp: boxHp(79) } }, { crit: true, damped: false, feverMult: 1 });
    expect(again.burst?.freeBox).toBeUndefined();
  });
  it('손질 큰 상자: 덩어리 x0.25, nextCareSlot 레벨 +1, 방 칸·item 없음', () => {
    const s = last(89, { tapLevel: 9999, homeLv: [2, 1, 1, 1, 1, 1, 1, 1] });
    const r = hitBox(s, { crit: true, damped: false, feverMult: 1 });
    expect(r.burst?.kind).toBe('big');
    expect(r.burst?.item).toBeUndefined();
    expect(r.burst?.slot).toBeUndefined();
    expect(r.burst?.slotFill).toBe(0);
    expect(r.burst?.roomDone).toBe(false);
    expect(r.burst!.gain).toBeCloseTo(tapValue(s) * BOX_KINDS.big.k * ENDLESS_K_MULT);
    expect(r.burst?.care).toEqual({ slot: 0, lv: 3, tierUp: true });
    expect(r.state.homeLv).toEqual([3, 1, 1, 1, 1, 1, 1, 1]);
    expect(r.state.unpack.box).toBe(90);
    expect(r.state.unpack.hp).toBe(endlessHp(r.state, 90));
  });
  it('손질 작은 상자는 레벨을 올리지 않는다', () => {
    const r = hitBox(last(80, { tapLevel: 9999 }), { crit: true, damped: false, feverMult: 1 });
    expect(r.burst?.care).toBeUndefined();
    expect(r.state.homeLv).toEqual(Array(8).fill(0));
    expect(r.burst!.freeBoxes).toEqual([]);
  });
  it('방 큰 상자는 그 칸 +1, 단계가 오를 때만 무료 상자 1개', () => {
    const plain = hitBox(at(19, 0, { tapLevel: 999, homeLv: [1, 1, 0, 0, 0, 0, 0, 0] }), { crit: true, damped: false, feverMult: 1 });
    expect(plain.burst?.care).toEqual({ slot: 1, lv: 2, tierUp: false });
    expect(plain.burst?.freeBoxes).toEqual([]);
    const s11 = at(19, 0, { tapLevel: 999, homeLv: [1, 11, 0, 0, 0, 0, 0, 0] });
    const up = hitBox(s11, { crit: true, damped: false, feverMult: 1, rng: () => 0.5 });
    expect(up.burst?.care).toEqual({ slot: 1, lv: 12, tierUp: true });
    expect(up.burst?.freeBoxes).toHaveLength(1);
    expect(up.burst?.freeBox).toBe(up.burst?.freeBoxes[0]);
    expect(up.state.stats.boxesOpened).toBe(1);
    const s2 = at(19, 0, { tapLevel: 999, homeLv: [1, 2, 0, 0, 0, 0, 0, 0] });
    expect(hitBox(s2, { crit: true, damped: false, feverMult: 1 }).burst?.care?.tierUp).toBe(true);
  });
  it('80번째 큰 상자가 단계도 올리면 무료 상자 2개(방 완성 -> 단계)', () => {
    const r = hitBox(at(79, 0, { tapLevel: 999, homeLv: [0, 0, 0, 0, 0, 0, 0, 2] }), { crit: true, damped: false, feverMult: 1, rng: () => 0.5 });
    expect(r.burst?.roomDone).toBe(true);
    expect(r.burst?.freeBoxes).toHaveLength(2);
    expect(r.state.stats.boxesOpened).toBe(2);
    expect(r.state.unpack.box).toBe(80);
    expect(r.state.unpack.hp).toBe(endlessHp(r.state, 80));
  });
  it('tapAndHit는 탭 P와 상자 보상을 함께 낸다', () => {
    let s = at(0, 6);
    const r = tapAndHit(s, always);
    expect(r.crit).toBe(true);
    expect(r.burst).not.toBeNull();
    expect(r.state.points).toBeCloseTo(r.gain + r.burst!.gain);
    s = r.state;
    expect(s.stats.totalTaps).toBe(1);
  });
});

describe('진행·겉모습·이사', () => {
  it('roomProgress', () => {
    expect(roomProgress(at(0))).toEqual({ opened: 0, total: 80, slotsDone: 0, slotFill: 0, complete: false, careStep: 0, lvSum: 0 });
    expect(roomProgress(at(23))).toMatchObject({ opened: 23, slotsDone: 2, slotFill: 0.3 });
    expect(roomProgress(at(85, 0, { homeLv: [2, 1, 1, 1, 1, 1, 1, 1] }))).toMatchObject({ opened: 80, slotsDone: 8, slotFill: 0, complete: true, careStep: 5, lvSum: 9 });
  });
  it('겉모습 단계', () => {
    expect(boxCondition(at(0, 0))).toMatchObject({ stage: 0, stages: 3, ratio: 1 });
    expect(boxCondition(at(9, 20)).stage).toBe(1); // 56 중 20 -> 0.64
    expect(boxCondition(at(9, 40)).stage).toBe(2);
    expect(boxCondition(at(9, 49)).stage).toBe(3);
    expect(boxCondition(at(9, 49)).stages).toBe(4);
    expect(boxCondition(at(0, 6)).stage).toBe(2);
  });
  it('이사하면 unpack 초기화, 도구는 맨손', () => {
    const s = { ...at(33, 5, { tapLevel: 40, homeLv: [4, 3, 3, 1, 0, 0, 0, 0] }), earned: 5.5e7 };
    const m = move(s)!;
    expect(m.unpack).toEqual({ box: 0, damage: 0, roomDone: false, hp: boxHp(0) });
    expect(m.homeLv).toEqual([4, 3, 3, 1, 0, 0, 0, 0]);
    expect(toolOf(m.tapLevel).name).toBe('맨손');
  });
});
