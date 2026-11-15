const UNITS: readonly [number, string][] = [
  [1e4, '만'],
  [1e8, '억'],
  [1e12, '조'],
  [1e16, '경'],
  [1e20, '해'],
  [1e24, '자'],
  [1e28, '양'],
  [1e32, '구'],
  [1e36, '간'],
  [1e40, '정'],
  [1e44, '재'],
  [1e48, '극'],
];
const EXP_THRESHOLD = 1e52;

function withComma(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function stripZeros(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

function mantissa(m: number): string {
  if (m < 10) return stripZeros(m.toFixed(2));
  if (m < 100) return stripZeros(m.toFixed(1));
  return withComma(Math.round(m));
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '0';
  if (n <= 0) return '0';
  if (n < 100) {
    const r = Math.round(n * 10) / 10;
    if (r === 0) return '0';
    if (r < 100) return stripZeros(r.toFixed(1));
  }
  if (n < 1e4) {
    const r = Math.round(n);
    if (r < 1e4) return withComma(r);
  }
  if (n >= EXP_THRESHOLD) {
    const [m, e] = n.toExponential(2).split('e');
    return `${stripZeros(m)}e${Number(e)}`;
  }
  let idx = 0;
  for (let i = 0; i < UNITS.length; i++) if (n >= UNITS[i][0]) idx = i;
  let m = n / UNITS[idx][0];
  if (Math.round(m) >= 1e4 && idx < UNITS.length - 1) {
    idx += 1;
    m = n / UNITS[idx][0];
  }
  return mantissa(m) + UNITS[idx][1];
}

export function formatMbps(pps: number): string {
  return `${formatNumber(pps)} Mbps`;
}

export function speedTitle(pps: number): string {
  if (pps >= 1e8) return '우주 회선';
  if (pps >= 1000) return '기가 회선';
  if (pps >= 100) return '광랜 회선';
  return '기본 회선';
}

export function formatDuration(sec: number): string {
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
  if (m > 0) return `${m}분`;
  return `${s}초`;
}
