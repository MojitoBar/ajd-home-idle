import { describe, expect, it } from 'vitest';
import { RETURN_RUSH_AWAY_SEC, RUSH_MAX_SEC } from '../data/unpack';
import { applyOffline } from './offline';
import { defaultState } from './testState';

const T = 1_700_000_000_000;

describe('돌아오면 러시', () => {
  it('30분 이하로 비우면 러시가 없고 수익도 없다', () => {
    const s = defaultState(T);
    const r = applyOffline(s, T + RETURN_RUSH_AWAY_SEC * 1000);
    expect(r.rush).toBe(false);
    expect(r.awaySec).toBe(RETURN_RUSH_AWAY_SEC);
    expect(r.state.unpack.rushSec).toBe(0);
    expect(r.state.points).toBe(0);
    expect(r.state.earned).toBe(0);
  });
  it('30분을 넘기면 rushSec이 RUSH_MAX_SEC(15)로 찬다. 수익은 0', () => {
    const s = { ...defaultState(T), unpack: { ...defaultState().unpack, rushSec: 4 } };
    const r = applyOffline(s, T + (RETURN_RUSH_AWAY_SEC + 1) * 1000);
    expect(r.rush).toBe(true);
    expect(RUSH_MAX_SEC).toBe(15);
    expect(r.state.unpack.rushSec).toBe(15);
    expect(r.state.points).toBe(0);
    expect(r.state.stats.totalEarned).toBe(0);
  });
  it('시계가 거꾸로 가면 러시 없이 savedAt을 현재로 보정한다', () => {
    const r = applyOffline(defaultState(T), T - 5 * 3600 * 1000);
    expect(r.rush).toBe(false);
    expect(r.awaySec).toBe(0);
    expect(r.state.savedAt).toBe(T - 5 * 3600 * 1000);
  });
});
