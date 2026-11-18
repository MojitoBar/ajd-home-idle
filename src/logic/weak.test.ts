import { describe, expect, it } from 'vitest';
import { defaultState } from './testState';
import { tapValue } from './economy';
import {
  WEAK_REWARD,
  WEAK_SHOW_MS,
  advanceWeak,
  hitWeak,
  initialWeak,
  weakHitTest,
  type WeakState,
} from './weak';

const never = () => 0.99;
const seq = (...vals: number[]) => {
  let i = 0;
  return () => vals[Math.min(i++, vals.length - 1)];
};
const due = (extra: Partial<WeakState> = {}): WeakState => ({ nextInMs: 100, remainMs: 0, u: 0.5, v: 0.5, ...extra });

describe('급소 타이머', () => {
  it('간격 4000~7000', () => {
    expect(initialWeak(() => 0).nextInMs).toBe(4000);
    expect(initialWeak(() => 0.5).nextInMs).toBe(5500);
    expect(initialWeak(() => 0.999999).nextInMs).toBeLessThan(7000);
  });
  it('active일 때만 대기가 줄고, 0이 되면 뜬다', () => {
    const w = due({ nextInMs: 1000 });
    expect(advanceWeak(w, 500, false, never).weak.nextInMs).toBe(1000);
    const a = advanceWeak(w, 400, true, never);
    expect(a.weak.nextInMs).toBe(600);
    expect(a.appeared).toBe(false);
    const b = advanceWeak(w, 1000, true, () => 0.5);
    expect(b.appeared).toBe(true);
    expect(b.weak.remainMs).toBe(WEAK_SHOW_MS);
  });
  it('자리는 0.15~0.85, 직전 자리와 0.3 이상', () => {
    for (const r of [0, 0.999, 0.5]) {
      const b = advanceWeak(due(), 100, true, () => r).weak;
      expect(b.u).toBeGreaterThanOrEqual(0.15);
      expect(b.u).toBeLessThanOrEqual(0.85);
      expect(b.v).toBeGreaterThanOrEqual(0.15);
      expect(b.v).toBeLessThanOrEqual(0.85);
    }
    // 첫 뽑기(0.5, 0.5)는 직전 자리와 같아 다시 뽑는다
    const b = advanceWeak(due(), 100, true, seq(0.5, 0.5, 0, 0)).weak;
    expect([b.u, b.v]).toEqual([0.15, 0.15]);
    expect(Math.hypot(b.u - 0.5, b.v - 0.5)).toBeGreaterThanOrEqual(0.3);
  });
  it('떠 있는 급소는 active와 무관하게 줄고, 끝나면 사라지며 다음 간격', () => {
    const w = due({ remainMs: 1800, nextInMs: 0 });
    const a = advanceWeak(w, 1000, false, never);
    expect(a.weak.remainMs).toBe(800);
    expect(a.vanished).toBe(false);
    const b = advanceWeak(a.weak, 800, false, () => 0);
    expect(b.vanished).toBe(true);
    expect(b.weak.remainMs).toBe(0);
    expect(b.weak.nextInMs).toBe(4000);
  });
});

describe('급소 맞힘', () => {
  it('떠 있고 반경 안일 때만', () => {
    const w = due({ remainMs: 500, u: 0.4, v: 0.6 });
    expect(weakHitTest(w, 0.4, 0.6, 0.1)).toBe(true);
    expect(weakHitTest(w, 0.5, 0.6, 0.1)).toBe(true);
    expect(weakHitTest(w, 0.52, 0.6, 0.1)).toBe(false);
    expect(weakHitTest({ ...w, remainMs: 0 }, 0.4, 0.6, 0.1)).toBe(false);
  });
  it('hitWeak: 강타 힘 강화가 탭 수에 곱해진다', () => {
    const s = { ...defaultState(), strikeLevel: 5 };
    const r = hitWeak(s, never, due({ remainMs: 900, u: 0.3, v: 0.7 }), 1);
    expect(r.gain).toBeCloseTo(tapValue(s) * 16);
  });
  it('hitWeak: 탭 8번어치, 콤보 5, 피버 3, 급소 사라짐', () => {
    expect(WEAK_REWARD).toEqual({ taps: 8, combo: 5, fever: 3 });
    const s = defaultState();
    const w = due({ remainMs: 900, u: 0.3, v: 0.7 });
    const r = hitWeak(s, never, w, 2);
    expect(r.gain).toBeCloseTo(tapValue(s) * 8 * 2);
    expect(r.comboAdd).toBe(5);
    expect(r.state.fever.gauge).toBe(3);
    expect(r.weak.remainMs).toBe(0);
    expect(r.weak.nextInMs).toBeGreaterThanOrEqual(4000);
    expect([r.weak.u, r.weak.v]).toEqual([0.3, 0.7]);
  });
});
