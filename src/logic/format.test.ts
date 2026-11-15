import { describe, expect, it } from 'vitest';
import { formatDuration, formatMbps, formatNumber, speedTitle } from './format';

describe('formatNumber', () => {
  it('1만 미만', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(0.5)).toBe('0.5');
    expect(formatNumber(12.34)).toBe('12.3');
    expect(formatNumber(99.96)).toBe('100');
    expect(formatNumber(1234)).toBe('1,234');
    expect(formatNumber(9999)).toBe('9,999');
    expect(formatNumber(9999.4)).toBe('9,999');
  });
  it('1만 경계', () => {
    expect(formatNumber(9999.6)).toBe('1만');
    expect(formatNumber(1e4)).toBe('1만');
    expect(formatNumber(12345)).toBe('1.23만');
    expect(formatNumber(123456)).toBe('12.3만');
    expect(formatNumber(1234567)).toBe('123만');
    expect(formatNumber(12345678)).toBe('1,235만');
    expect(formatNumber(99990000)).toBe('9,999만');
  });
  it('1억 이상', () => {
    expect(formatNumber(1e8)).toBe('1억');
    expect(formatNumber(1.234e8)).toBe('1.23억');
    expect(formatNumber(9999.9e8)).toBe('1조');
    expect(formatNumber(1e12)).toBe('1조');
    expect(formatNumber(2.5e16)).toBe('2.5경');
  });
  it('극과 지수 표기', () => {
    expect(formatNumber(1e48)).toBe('1극');
    expect(formatNumber(9.99e51)).toBe('9,990극');
    expect(formatNumber(1e52)).toBe('1e52');
    expect(formatNumber(1.234e52)).toBe('1.23e52');
  });
  it('보조 포맷', () => {
    expect(formatMbps(1234)).toBe('1,234 Mbps');
    expect(speedTitle(99)).toBe('기본 회선');
    expect(speedTitle(100)).toBe('광랜 회선');
    expect(speedTitle(1000)).toBe('기가 회선');
    expect(speedTitle(1e8)).toBe('우주 회선');
    expect(formatDuration(3700)).toBe('1시간 1분');
    expect(formatDuration(75)).toBe('1분');
  });
});
