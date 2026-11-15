import { describe, expect, it } from 'vitest';
import { applyOffline, offlineReward } from './offline';
import { defaultState } from './state';

const T = 1_700_000_000_000;

describe('오프라인 보상', () => {
  it('60초 미만 무시, 60초부터 지급', () => {
    expect(offlineReward(T, T + 59_000, 10).gain).toBe(0);
    expect(offlineReward(T, T + 60_000, 10).gain).toBe(60 * 10 * 0.5);
  });
  it('8시간 상한과 capped 표시', () => {
    const r = offlineReward(T, T + 20 * 3600 * 1000, 10);
    expect(r.seconds).toBe(28800);
    expect(r.gain).toBe(28800 * 10 * 0.5);
    expect(r.capped).toBe(true);
    expect(offlineReward(T, T + 28_800_000, 10).capped).toBe(false);
  });
  it('시계 역행이면 0이고 savedAt을 현재로 보정', () => {
    const r = offlineReward(T, T - 5 * 3600 * 1000, 10);
    expect(r.gain).toBe(0);
    expect(r.savedAt).toBe(T - 5 * 3600 * 1000);
  });
  it('applyOffline은 points·earned·통계에 가산, 미달이면 report null', () => {
    const s = { ...defaultState(T), services: [10, 0, 0, 0, 0, 0, 0, 0] };
    const { state, report } = applyOffline(s, T + 120_000);
    expect(report?.gain).toBeCloseTo(120 * 10 * 0.5);
    expect(state.points).toBeCloseTo(600);
    expect(state.earned).toBeCloseTo(600);
    expect(state.stats.totalEarned).toBeCloseTo(600);
    const none = applyOffline(s, T + 10_000);
    expect(none.report).toBeNull();
    expect(none.state.points).toBe(0);
  });
});
