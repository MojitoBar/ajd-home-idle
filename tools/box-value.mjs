// 사은품 상자 수치 비교(바꾸기 전 vs 후). 실행: node tools/box-value.mjs
// 가중치·확률은 src/data/collectibles.ts와 같은 값을 복사해 쓴다(바뀌면 여기도 맞춘다).
const RAR = [
  { p: 0.6, w: 0.01, n: 7 },
  { p: 0.27, w: 0.02, n: 6 },
  { p: 0.1, w: 0.04, n: 4 },
  { p: 0.027, w: 0.08, n: 2 },
  { p: 0.003, w: 0.16, n: 1 },
];
const VAR = [
  { p: 0.88, w: 1 },
  { p: 0.1, w: 2 },
  { p: 0.019, w: 4 },
  { p: 0.001, w: 8 },
];
const NEED = [1, 3, 7, 15, 31];
const RULES = {
  before: { factor: 120, growth: 1.1, levels: false, guarantee: false },
  after: { factor: 60, growth: 1.06, levels: true, guarantee: true },
};
const RUNS = 2000;

let seed = 20261114;
const rng = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (list, r) => {
  let c = 0;
  for (let i = 0; i < list.length - 1; i++) {
    c += list[i].p;
    if (r < c) return i;
  }
  return list.length - 1;
};
const RARE_UP = RAR.slice(1).map((r) => ({ ...r, p: r.p / (1 - RAR[0].p) }));
const species = [];
RAR.forEach((r, ri) => { for (let i = 0; i < r.n; i++) species.push(ri); });

function roll(minRare) {
  const ri = minRare ? 1 + pick(RARE_UP, rng()) : pick(RAR, rng());
  const pool = species.map((r, i) => [r, i]).filter(([r]) => r === ri).map(([, i]) => i);
  const sp = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  return { sp, v: pick(VAR, rng()), ri };
}
const level = (c) => NEED.filter((n) => c >= n).length;
function mult(col, rule) {
  let b = 0;
  for (let s = 0; s < species.length; s++)
    for (let v = 0; v < 4; v++) {
      const c = col[s * 4 + v];
      if (c > 0) b += RAR[species[s]].w * VAR[v].w * (rule.levels ? 1 + 0.5 * (level(c) - 1) : 1);
    }
  return 1 + b;
}
function open(col, n, rule, batch10) {
  let hadRare = false;
  for (let i = 0; i < n; i++) {
    if (i % 10 === 0) hadRare = false;
    const guard = rule.guarantee && batch10 && i % 10 === 9 && !hadRare;
    const r = roll(guard);
    if (r.ri > 0) hadRare = true;
    col[r.sp * 4 + r.v]++;
  }
}

// ① 빈 도감에서 상자 1개 기대 수익 증가율(가격이 초당 수익 x factor인 구간)과 본전 시간
const emptyGain = RAR.reduce((a, r) => a + r.p * r.w * VAR.reduce((x, v) => x + v.p * v.w, 0), 0);
console.log(`① 빈 도감 첫 상자 기대 수익 증가율 +${(emptyGain * 100).toFixed(2)}% (레벨 1이라 전후 같음)`);
for (const [k, r] of Object.entries(RULES)) {
  console.log(`   ${k}: 본전까지 ${((r.factor / emptyGain) / 60).toFixed(1)}분 (가격 = ${r.factor} x 초당 수익일 때)`);
}
// ② n번째 상자 가격(초 단위 수익 환산)
for (const [k, r] of Object.entries(RULES)) {
  console.log(`② ${k}: 10번째 ${(r.factor * r.growth ** 9).toFixed(0)}초분, 20번째 ${(r.factor * r.growth ** 19).toFixed(0)}초분`);
}
// ③ 상자 100개 뒤 기대 도감 배율
function avgMult(rule, batch10) {
  let sum = 0;
  for (let i = 0; i < RUNS; i++) {
    const col = new Array(species.length * 4).fill(0);
    open(col, 100, rule, batch10);
    sum += mult(col, rule);
  }
  return sum / RUNS;
}
console.log(`③ 상자 100개 뒤 기대 도감 배율(${RUNS}회 평균)`);
console.log(`   before: x${avgMult(RULES.before, false).toFixed(3)}`);
console.log(`   after(1개씩 열기): x${avgMult(RULES.after, false).toFixed(3)}`);
console.log(`   after(10개씩 열기, 보장 포함): x${avgMult(RULES.after, true).toFixed(3)}`);
// ④ 일반 세트(7종) 완성까지 기대 상자 수
const H = [1, 2, 3, 4, 5, 6, 7].reduce((a, k) => a + 1 / k, 0);
function setBoxes(batch10) {
  let sum = 0;
  for (let i = 0; i < RUNS; i++) {
    const seen = new Set();
    let n = 0;
    let hadRare = false;
    while (seen.size < 7) {
      if (n % 10 === 0) hadRare = false;
      const r = roll(batch10 && n % 10 === 9 && !hadRare);
      if (r.ri > 0) hadRare = true;
      if (r.ri === 0) seen.add(r.sp);
      n++;
    }
    sum += n;
  }
  return sum / RUNS;
}
console.log(`④ 일반 세트 완성까지 기대 상자 수: 이론 ${((7 / 0.6) * H).toFixed(1)}개, 1개씩 ${setBoxes(false).toFixed(1)}개, 10개씩(보장) ${setBoxes(true).toFixed(1)}개 (before는 세트 없음)`);
