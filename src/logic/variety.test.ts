import { describe, expect, it } from 'vitest';
import { TAP_BOX_SCALE } from '../data/services';
import { applyTap, pps, tapValue, tick } from './economy';
import { advanceFever, chargeFever, CRIT_CHANCE, CRIT_MULT, FEVER_COOLDOWN_SEC, FEVER_MULT, FEVER_SEC, FEVER_TAPS, feverRatio, PARCEL_MIN_TAPS, PARCEL_STAY_SEC } from './fever';
import { boxPrice } from './gacha';
import { applyOffline } from './offline';
import { perkEffects } from './perks';
import { move } from './prestige';
import { parseSave, serialize } from './save';
import { defaultState, type GameState } from './state';
import { catchParcel, tapWithRng } from './variety';

const fill = (s: GameState): GameState => {
  let cur = s;
  for (let i = 0; i < FEVER_TAPS; i++) cur = tapWithRng(cur, () => 0.99).state;
  return cur;
};
const withPps = (): GameState => ({ ...defaultState(), points: 1e4, services: [20, 5, 0, 0, 0, 0, 0, 0] });
const seq = (...v: number[]) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

describe('치명타', () => {
  it('확률 바로 아래는 치명타, 경계값부터는 일반', () => {
    const s = defaultState();
    const hit = tapWithRng(s, () => CRIT_CHANCE - 1e-9);
    expect(hit.crit).toBe(true);
    expect(hit.gain).toBe(tapValue(s) * CRIT_MULT);
    const miss = tapWithRng(s, () => CRIT_CHANCE);
    expect(miss.crit).toBe(false);
    expect(miss.gain).toBe(tapValue(s));
    expect(hit.state.points).toBe(hit.gain);
    expect(hit.state.earned).toBe(hit.gain);
    expect(hit.state.stats.totalTaps).toBe(1);
  });
  it('기존 applyTap은 치명타·피버 충전 없이 예전처럼', () => {
    const s = applyTap(defaultState());
    expect(s.points).toBeCloseTo(TAP_BOX_SCALE);
    expect(s.fever).toEqual(defaultState().fever);
  });
});

describe('피버', () => {
  it('충전·감쇠', () => {
    let s = defaultState();
    for (let i = 0; i < 10; i++) s = tapWithRng(s, () => 0.99).state;
    expect(s.fever.gauge).toBe(10);
    expect(feverRatio(s)).toBeCloseTo(10 / FEVER_TAPS);
    s = tick(s, 2);
    expect(s.fever.gauge).toBeCloseTo(7.6);
    expect(tick(s, 100).fever.gauge).toBe(0);
  });
  it('가득 차면 발동하고 수익이 x3(탭·자동)', () => {
    const base = withPps();
    const before = { tap: tapValue(base), pps: pps(base) };
    const s = fill(base);
    expect(s.fever.activeSec).toBe(FEVER_SEC);
    expect(tapValue(s)).toBeCloseTo(before.tap * FEVER_MULT);
    expect(pps(s)).toBeCloseTo(before.pps * FEVER_MULT);
    expect(feverRatio(s)).toBe(1);
  });
  it('피버 중엔 충전되지 않고, 끝나면 게이지 0 + 재충전 제한', () => {
    let s = fill(defaultState());
    expect(tapWithRng(s, () => 0.99).state.fever.gauge).toBe(0);
    s = tick(s, FEVER_SEC + 0.1);
    expect(s.fever).toEqual({ gauge: 0, activeSec: 0, cooldownSec: FEVER_COOLDOWN_SEC });
    expect(tapWithRng(s, () => 0.99).state.fever.gauge).toBe(0);
    s = tick(s, FEVER_COOLDOWN_SEC + 0.1);
    expect(tapWithRng(s, () => 0.99).state.fever.gauge).toBe(1);
  });
  it('치명타 gain은 전액 탭 값 x 배율', () => {
    const s = withPps();
    const r = tapWithRng(s, () => 0);
    expect(r.crit).toBe(true);
    expect(r.gain).toBeCloseTo(tapValue(s) * perkEffects(s).critMult, 10);
    expect(r.gain).toBeGreaterThan(tapValue(s));
  });
  it('이사하면 초기화, 오프라인엔 미적용', () => {
    const f = fill({ ...defaultState(), earned: 5.5e7 });
    expect(move(f)!.fever).toEqual(defaultState().fever);
    const s = { ...fill(withPps()), savedAt: 0 };
    const plain = applyOffline({ ...withPps(), savedAt: 0 }, 3600_000).report!.gain;
    expect(applyOffline(s, 3600_000).report!.gain).toBeCloseTo(plain);
  });
  it('저장하지 않는다(불러오면 0)', () => {
    const raw = serialize(fill(defaultState()), 5);
    expect(raw).not.toContain('fever');
    expect(raw).not.toContain('parcel');
    const r = parseSave(raw);
    expect(r.kind).toBe('ok');
    expect(r.state.fever).toEqual(defaultState().fever);
  });
  it('advanceFever 단위', () => {
    expect(chargeFever({ gauge: FEVER_TAPS - 1, activeSec: 0, cooldownSec: 0 }).activeSec).toBe(FEVER_SEC);
    expect(advanceFever({ gauge: 0, activeSec: 0, cooldownSec: 1 }, 5).cooldownSec).toBe(0);
  });
});

describe('떠다니는 택배 상자', () => {
  const appear = (s: GameState): GameState => tick({ ...s, parcel: { nextInSec: 1, remainSec: 0 } }, 1);
  it('등장 -> 시간 지나면 만료되고 다음 대기(60~120초)', () => {
    let s = defaultState();
    expect(s.parcel.remainSec).toBe(0);
    s = appear(s);
    expect(s.parcel.remainSec).toBe(PARCEL_STAY_SEC);
    s = tick(s, 3);
    expect(s.parcel.remainSec).toBe(PARCEL_STAY_SEC - 3);
    s = tick(s, PARCEL_STAY_SEC, () => 0);
    expect(s.parcel).toEqual({ nextInSec: 60, remainSec: 0 });
    expect(tick(s, 10, () => 0).parcel.nextInSec).toBe(50);
    expect(tick({ ...s, parcel: { nextInSec: 0.5, remainSec: 0 } }, 1).parcel.remainSec).toBe(PARCEL_STAY_SEC);
  });
  it('떠 있지 않으면 잡을 수 없음', () => {
    expect(catchParcel(defaultState(), () => 0.5)).toBeNull();
  });
  it('포인트 보상: 현재 pps의 N초분, earned에도 반영, 사라짐', () => {
    const s = appear(withPps());
    const r = catchParcel(s, seq(0.9, 0.5, 0.5))!; // 다음 대기, 종류(포인트), 초 수 -> 30초
    expect(r.reward).toMatchObject({ kind: 'points', seconds: 30 });
    expect(r.reward.kind === 'points' && r.reward.gain).toBeCloseTo(pps(s) * 30);
    expect(r.state.points).toBeCloseTo(s.points + pps(s) * 30);
    expect(r.state.earned).toBeCloseTo(s.earned + pps(s) * 30);
    expect(r.state.parcel.remainSec).toBe(0);
  });
  it('수익이 0이면 탭 수익 기준 최소 보장', () => {
    const s = appear(defaultState());
    const r = catchParcel(s, seq(0.5, 0.5, 0.5))!;
    expect(r.reward.kind === 'points' && r.reward.gain).toBe(tapValue(s) * PARCEL_MIN_TAPS);
  });
  it('무료 상자: 도감만 늘고 가격·개봉 수는 그대로', () => {
    const s = appear(withPps());
    const r = catchParcel(s, seq(0.5, 0.01, 0.5, 0.5, 0.5, 0.5))!;
    expect(r.reward.kind).toBe('box');
    expect(r.state.points).toBe(s.points);
    expect(r.state.boxesThisRun).toBe(s.boxesThisRun);
    expect(boxPrice(r.state)).toBe(boxPrice(s));
    const total = Object.values(r.state.collection).reduce((a, c) => a + c.base + c.shiny + c.gold + c.rainbow, 0);
    expect(total).toBe(1);
  });
});
