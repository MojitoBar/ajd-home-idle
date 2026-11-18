import { describe, expect, it } from 'vitest';
import { GUIDE_SPECIAL_RATE, GUIDE_STEPS, featureOpen, finishedGuide, guideEvent, guideView, type GuideFeature } from './guide';
import { defaultState } from './state';
import { buyStrikeUpgrade, tapStable } from './economy';
import { tapWithRng } from './variety';
import { releaseCharge, CHARGE_ZONE_CENTER } from './charge';
import { gearEffects, gearUnlocked } from './gear';
import { boxSpecial, tapAndHit } from './unpack';
import { comboMult, comboMultOf } from './combo';
import { isMet } from './unlock';
import { BOX_MIN_PRICE } from './gacha';
import { SPECIAL_RATE } from '../data/unpack';

const FEATURES: GuideFeature[] = ['combo', 'charge', 'weak', 'fever', 'chain', 'streak', 'special', 'gear', 'perkBox'];
const at = (step: number, extra: object = {}) => ({ ...defaultState(0, 1), guide: { step, n: 0, done: false }, ...extra });
const idx = (id: string) => GUIDE_STEPS.findIndex((s) => s.id === id);
const rng = () => 0.5;

describe('가이드 단계표', () => {
  it('단계는 10~18개, 목표·보상이 정해져 있고 열리는 요소는 한 번씩만', () => {
    expect(GUIDE_STEPS.length).toBeGreaterThanOrEqual(10);
    expect(GUIDE_STEPS.length).toBeLessThanOrEqual(18);
    for (const s of GUIDE_STEPS) {
      expect(s.goal).toBeGreaterThan(0);
      expect(s.rewardTaps).toBeGreaterThanOrEqual(0);
      expect(s.rewardBoxes ?? 0).toBeGreaterThanOrEqual(0);
    }
    const opens = GUIDE_STEPS.flatMap((s) => (s.opens ? [s.opens] : []));
    expect(new Set(opens).size).toBe(opens.length);
    expect([...opens].sort()).toEqual([...FEATURES].sort());
    expect(GUIDE_STEPS[GUIDE_STEPS.length - 1].event).toBe('move');
  });
  it('누적 문턱(gate)은 뒤로 갈수록 커진다(0은 없음)', () => {
    const gates = GUIDE_STEPS.map((s) => s.gate).filter((g) => g > 0);
    expect([...gates].sort((a, b) => a - b)).toEqual(gates);
  });
  it('새 게임은 1단계, 시작부터 열린 건 탭과 공구 강화뿐', () => {
    const s = defaultState(0, 1);
    expect(s.guide).toEqual({ step: 0, n: 0, done: false });
    for (const f of FEATURES) expect(featureOpen(s, f)).toBe(false);
    const v = guideView(s)!;
    expect(v).toMatchObject({ no: 1, total: GUIDE_STEPS.length, n: 0, goal: 10, opens: null, event: 'tap' });
  });
});

describe('guideEvent', () => {
  it('횟수 사건은 쌓이고 목표에 닿으면 보상을 주며 다음 단계로 간다', () => {
    let s = defaultState(0, 1);
    for (let i = 0; i < 9; i++) {
      const r = guideEvent(s, { type: 'tap' });
      expect(r.completed).toBe(false);
      s = r.state;
    }
    expect(guideView(s)!.n).toBe(9);
    const r = guideEvent(s, { type: 'tap' });
    expect(r.completed).toBe(true);
    expect(r.step!.id).toBe('tap');
    expect(r.reward).toBeCloseTo(GUIDE_STEPS[0].rewardTaps * tapStable(s));
    expect(r.state.points).toBeCloseTo(s.points + r.reward);
    expect(r.state.earned).toBeCloseTo(s.earned + r.reward);
    expect(r.state.guide).toEqual({ step: 1, n: 0, done: false });
    // 1단계 보상으로 첫 공구 강화(20 P)를 살 수 있다
    expect(r.state.points).toBeGreaterThanOrEqual(20);
  });
  it('지금 단계가 기다리는 사건이 아니면 아무 일도 없다', () => {
    const s = defaultState(0, 1);
    const r = guideEvent(s, { type: 'strike' });
    expect(r.completed).toBe(false);
    expect(r.state).toBe(s);
  });
  it('값 사건(콤보·연쇄·연속 퍼펙트)은 가장 큰 값을 기억하고 목표에 닿으면 끝낸다', () => {
    const s = at(idx('combo'), { earned: 1e9 });
    const a = guideEvent(s, { type: 'combo', value: 6 });
    expect(a.state.guide.n).toBe(6);
    const b = guideEvent(a.state, { type: 'combo', value: 3 });
    expect(b.state.guide.n).toBe(6);
    const c = guideEvent(b.state, { type: 'combo', value: 10 });
    expect(c.completed).toBe(true);
    expect(c.opened).toBe('charge');
    expect(featureOpen(c.state, 'charge')).toBe(true);
  });
  it('단계를 끝내면 다음 단계가 여는 요소를 알려 주고, 그 요소가 열린다', () => {
    let s = at(idx('weak') - 1, { earned: 1e9 });
    expect(featureOpen(s, 'weak')).toBe(false);
    const r = guideEvent(s, { type: 'strike' });
    expect(r.completed).toBe(true);
    expect(r.opened).toBe('weak');
    s = r.state;
    expect(featureOpen(s, 'weak')).toBe(true);
    expect(featureOpen(s, 'fever')).toBe(false);
  });
  it('누적 포인트(gate)가 모자라면 목표를 채워도 기다리다가, 다른 사건(tick)에도 끝난다', () => {
    const i = idx('weak');
    const gate = GUIDE_STEPS[i].gate;
    expect(gate).toBeGreaterThan(0);
    const s = at(i, { earned: gate / 2 });
    const a = guideEvent(s, { type: 'weak' });
    expect(a.completed).toBe(false);
    expect(guideView(a.state)).toMatchObject({ n: 1, goal: 1, gateMet: false });
    const rich = { ...a.state, earned: gate };
    const b = guideEvent(rich, { type: 'tick' });
    expect(b.completed).toBe(true);
    expect(b.state.guide.step).toBe(i + 1);
  });
  it('이사하면 가이드가 끝난다(이사 뒤에 move 사건을 알려도 되고, 모든 요소가 열린다)', () => {
    const s = at(3, { moves: 1 });
    for (const f of FEATURES) expect(featureOpen(s, f)).toBe(true);
    expect(guideView(s)).toBeNull();
    const r = guideEvent(s, { type: 'move' });
    expect(r.completed).toBe(true);
    expect(r.state.guide.done).toBe(true);
    expect(guideEvent(r.state, { type: 'tap' }).completed).toBe(false);
  });
  it('마지막 단계는 이사 사건으로 끝난다', () => {
    const s = at(GUIDE_STEPS.length - 1);
    const r = guideEvent({ ...s, moves: 1 }, { type: 'move' });
    expect(r.state.guide).toEqual(finishedGuide());
  });
  it('끝난 가이드는 모든 요소가 열려 있다', () => {
    const s = { ...defaultState(0, 1), guide: finishedGuide() };
    for (const f of FEATURES) expect(featureOpen(s, f)).toBe(true);
  });
});

describe('후반 단계: 지금 state로 판정하고 선물 상자를 준다', () => {
  const steps = ['tapLv', 'home', 'strikeLv', 'mult'];
  const dexCount = (c: ReturnType<typeof defaultState>['collection']) => Object.values(c).reduce((a, s) => a + s.base + s.shiny + s.gold + s.rainbow, 0);
  it('후반 단계는 가이드 요소를 열지 않고 사건 없이 state로 판정한다', () => {
    for (const id of steps) {
      const d = GUIDE_STEPS[idx(id)];
      expect(d.progress).toBeTypeOf('function');
      expect(d.opens).toBeUndefined();
      expect(d.rewardTaps).toBe(0);
      expect(d.rewardBoxes).toBeGreaterThan(0);
    }
    expect(idx('perkBox')).toBe(idx('gear') + 1);
    expect(idx('tapLv')).toBe(idx('perkBox') + 1);
    expect(GUIDE_STEPS).toHaveLength(18);
    expect(idx('move')).toBe(idx('mult') + 1);
  });
  it('선물 상자는 뒤로 갈수록 많아지고(줄어들지 않는다) 앞 단계는 P로 준다', () => {
    const boxes = GUIDE_STEPS.map((s) => s.rewardBoxes ?? 0);
    const from = boxes.findIndex((b) => b > 0);
    expect(from).toBeGreaterThanOrEqual(idx('chain'));
    expect(boxes.slice(from, -1)).toEqual([...boxes.slice(from, -1)].sort((a, b) => a - b));
    for (let i = 0; i < from; i++) expect(GUIDE_STEPS[i].rewardTaps).toBeGreaterThan(0);
  });
  it('공구 Lv로 판정: 사건 종류와 상관없이 목표 Lv에 닿으면 끝나고 선물 상자가 도감에 들어간다', () => {
    const i = idx('tapLv');
    const def = GUIDE_STEPS[i];
    const lo = at(i, { tapLevel: def.goal - 1, earned: 1e20 });
    expect(guideEvent(lo, { type: 'tap' }).completed).toBe(false);
    expect(guideView(lo)).toMatchObject({ n: def.goal - 1, goal: def.goal, rewardBoxes: def.rewardBoxes, rewardTaps: 0 });
    const hi = at(i, { tapLevel: def.goal, earned: 1e20 });
    const r = guideEvent(hi, { type: 'tick' });
    expect(r.completed).toBe(true);
    expect(r.state.guide.step).toBe(i + 1);
    expect(r.reward).toBe(0);
    expect(r.rewardBoxes).toBe(def.rewardBoxes);
    expect(r.boxResults).toHaveLength(def.rewardBoxes!);
    expect(dexCount(r.state.collection) - dexCount(hi.collection)).toBe(def.rewardBoxes);
    expect(r.state.points).toBe(hi.points);
    expect(r.state.boxesThisRun).toBe(hi.boxesThisRun);
  });
  it('살림 합·강타 Lv·총 배율도 state로 판정한다', () => {
    const home = GUIDE_STEPS[idx('home')];
    expect(guideEvent(at(idx('home'), { homeLv: [home.goal, 0, 0, 0, 0, 0, 0, 0], earned: 1e20 }), { type: 'tick' }).completed).toBe(true);
    expect(guideEvent(at(idx('home'), { homeLv: [home.goal - 1, 0, 0, 0, 0, 0, 0, 0], earned: 1e20 }), { type: 'tick' }).completed).toBe(false);
    const sk = GUIDE_STEPS[idx('strikeLv')];
    expect(guideEvent(at(idx('strikeLv'), { strikeLevel: sk.goal, earned: 1e20 }), { type: 'tick' }).completed).toBe(true);
    expect(guideEvent(at(idx('strikeLv'), { strikeLevel: sk.goal - 1, earned: 1e20 }), { type: 'tick' }).completed).toBe(false);
    const m = GUIDE_STEPS[idx('mult')];
    const view = guideView(at(idx('mult'), { earned: 1e20 }));
    expect(view?.goal).toBe(m.goal);
    expect(view?.n).toBeLessThan(m.goal);
  });
  it('gate가 모자라면 목표를 채워도 기다린다', () => {
    const i = idx('boxBuy');
    const s = at(i, { earned: GUIDE_STEPS[i].gate / 2 });
    expect(guideEvent(s, { type: 'boxBuy' }).completed).toBe(false);
    expect(guideView(s)).toMatchObject({ gateMet: false });
  });
  it('같은 state면 같은 상자가 나온다', () => {
    const i = idx('tapLv');
    const s = at(i, { tapLevel: GUIDE_STEPS[i].goal, earned: 1e20 });
    expect(guideEvent(s, { type: 'tick' }).state.collection).toEqual(guideEvent(s, { type: 'tick' }).state.collection);
  });
});

describe('잠금: 열리기 전에는 동작하지 않고, 열린 뒤는 지금과 같다', () => {
  it('콤보 배율은 열려야 붙는다', () => {
    expect(comboMultOf(defaultState(0, 1), 100)).toBe(1);
    expect(comboMultOf(at(idx('combo')), 100)).toBe(comboMult(100));
  });
  it('피버 게이지는 열려야 찬다', () => {
    const lock = tapWithRng(at(idx('fever') - 1), rng).state.fever.gauge;
    const open = tapWithRng(at(idx('fever')), rng).state.fever.gauge;
    expect(lock).toBe(0);
    expect(open).toBeGreaterThan(0);
  });
  it('연속 퍼펙트 배수는 열려야 붙는다', () => {
    const mid = (s: ReturnType<typeof at>) => releaseCharge(s, rng, CHARGE_ZONE_CENTER, 4).taps;
    expect(mid(at(idx('streak') - 1))).toBe(20);
    expect(mid(at(idx('streak')))).toBe(20 * (1 + 0.5 * 4));
  });
  it('오함마(강타 힘 강화)는 연쇄 단계에 닿아야 살 수 있다', () => {
    const rich = { points: 1e9, earned: 1e9 };
    expect(buyStrikeUpgrade(at(idx('chain') - 1, rich))).toBeNull();
    expect(buyStrikeUpgrade(at(idx('chain'), rich))).not.toBeNull();
  });
  it('연쇄: 잠겨 있으면 연쇄 보너스·상금이 없다', () => {
    const base = { tapLevel: 80, points: 0, unpack: { ...defaultState(0, 1).unpack, box: 30, hp: 1 } };
    const locked = releaseCharge(at(idx('chain') - 1, base), rng, CHARGE_ZONE_CENTER, 0);
    const open = releaseCharge(at(idx('chain'), base), rng, CHARGE_ZONE_CENTER, 0);
    expect(locked.prize).toBeNull();
    expect(open.chain).toBeGreaterThanOrEqual(locked.chain);
    expect(open.state.earned).toBeGreaterThan(locked.state.earned);
  });
  it('특별 상자는 열려야 나오고, 특별 상자 단계에서는 확률이 올라간다', () => {
    const base = { unpack: { ...defaultState(0, 1).unpack, salt: 5, box: 30 } };
    const seen = (s: ReturnType<typeof at>) => Array.from({ length: 400 }, (_, k) => boxSpecial({ ...s, unpack: { ...s.unpack, box: 30 + k } })).filter(Boolean).length;
    expect(seen(at(idx('special') - 1, base))).toBe(0);
    const n = seen(at(idx('special'), base));
    expect(n).toBeGreaterThan(0);
    expect(gearEffects(at(idx('special'))).specialRate).toBe(GUIDE_SPECIAL_RATE);
    expect(GUIDE_SPECIAL_RATE).toBeGreaterThan(SPECIAL_RATE);
    expect(gearEffects(at(idx('gear'))).specialRate).toBe(SPECIAL_RATE);
    expect(seen({ ...at(idx('gear'), base), guide: finishedGuide() })).toBeGreaterThan(0);
  });
  it('일반 탭은 잠금과 상관없이 상자를 깬다', () => {
    const r = tapAndHit(defaultState(0, 1), rng);
    expect(r.state.points).toBeGreaterThan(0);
  });
});

describe('기존 열림 규칙·공구 해금과의 맞춤', () => {
  it('상자 탭은 가이드 중엔 상자 단계에서 열린다(누적이 15000을 넘어도 그전엔 안 열림)', () => {
    expect(isMet(at(0, { earned: BOX_MIN_PRICE * 10 }), 'box')).toBe(false);
    expect(isMet(at(idx('boxBuy')), 'box')).toBe(true);
    expect(isMet({ ...defaultState(0, 1), guide: finishedGuide(), earned: BOX_MIN_PRICE * 10 }, 'box')).toBe(true);
  });
  it('영구 공구 카드는 공구 단계에 닿고 그 공구의 요소가 열려 있어야 열린다', () => {
    const deep = { unpack: { ...defaultState(0, 1).unpack, box: 100 } };
    expect(gearUnlocked(at(idx('gear') - 1, deep), 'level')).toBe(false);
    expect(gearUnlocked(at(idx('gear'), deep), 'level')).toBe(true);
    expect(gearUnlocked(at(idx('gear'), { unpack: { ...deep.unpack, box: 10 } }), 'level')).toBe(false);
    expect(gearUnlocked({ ...at(0, deep), guide: finishedGuide() }, 'level')).toBe(true);
    expect(gearUnlocked(at(3, { moves: 1 }), 'awl')).toBe(true);
  });
});

describe('특전 상자 단계', () => {
  it('영구 공구 바로 뒤, 특전 상자 구매 사건 1번이 목표이고 여는 요소는 perkBox', () => {
    const d = GUIDE_STEPS[idx('perkBox')];
    expect(d).toMatchObject({ event: 'perkBoxBuy', goal: 1, opens: 'perkBox', gate: 0, rewardTaps: 0 });
    expect(d.rewardBoxes).toBeGreaterThan(0);
  });
  it('사건이 오면 끝나고 다음 단계로 간다. 다른 사건은 무시', () => {
    const s = at(idx('perkBox'), { earned: 1e9 });
    expect(guideEvent(s, { type: 'tap' }).completed).toBe(false);
    const r = guideEvent(s, { type: 'perkBoxBuy' });
    expect(r.completed).toBe(true);
    expect(r.state.guide.step).toBe(idx('tapLv'));
    expect(r.rewardBoxes).toBe(GUIDE_STEPS[idx('perkBox')].rewardBoxes);
  });
  it('단계에 닿기 전엔 닫혀 있고 가이드가 끝났거나 이사했으면 열려 있다', () => {
    expect(featureOpen(at(idx('perkBox') - 1), 'perkBox')).toBe(false);
    expect(featureOpen(at(idx('perkBox')), 'perkBox')).toBe(true);
    expect(featureOpen({ ...defaultState(0, 1), guide: finishedGuide() }, 'perkBox')).toBe(true);
    expect(featureOpen({ ...at(0), moves: 1 }, 'perkBox')).toBe(true);
  });
});
