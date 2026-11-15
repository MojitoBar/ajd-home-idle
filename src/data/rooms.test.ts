import { describe, expect, it } from 'vitest';
import { SHELF_ICON_EXTENT, shelfSlots } from './rooms';
import { SERVICES } from './services';

describe('선반 아이콘 자리', () => {
  const s = shelfSlots(180);
  it('서비스마다 자리가 하나씩 있다', () => {
    expect(s.length).toBe(SERVICES.length);
    expect(SHELF_ICON_EXTENT.length).toBe(SERVICES.length);
  });
  it('이웃 그림이 겹치지 않고 간격이 모두 같다', () => {
    const gaps = s.slice(1).map((c, i) => c.ink0 - s[i].ink1);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(1);
    expect(new Set(gaps).size).toBe(1);
  });
  it('묶음이 360 폭 판자(8~172) 안이고 가운데가 90±1', () => {
    const l = s[0].ink0, r = s[s.length - 1].ink1;
    expect(l).toBeGreaterThanOrEqual(8);
    expect(r).toBeLessThanOrEqual(172);
    expect(Math.abs((l + r) / 2 - 90)).toBeLessThanOrEqual(1);
  });
});
