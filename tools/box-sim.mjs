// 상자깡 루프 진행 속도 시뮬: 실제 로직(src/logic)을 vite ssr로 불러 초 단위로 한 판을 돈다. 실행: node tools/box-sim.mjs
// 정책 3개(기본: 초당 4행동·강타 30%·퍼펙트 60% / 고수: 퍼펙트 90% / 가볍게: 초당 3행동·강타 20%·퍼펙트 40%) x 시드 5개.
// 급소가 떠 있으면 70% 맞힘, 나머지는 일반 탭. 콤보 배율은 반영하되 콤보 정산 보너스·택배·시계 러시는 뺀다.
// 업그레이드는 싼 것부터, 상자는 가격이 P의 10% 이하일 때, 공구 5종은 해금됐고 비용이 P의 25% 이하일 때, 이사는 조건이 되면 바로, 특전은 첫 번째.
// 연속 퍼펙트는 resolveStreak(안전모 실드)로 갱신하고, 퍼펙트 확률은 수평계 반폭에 비례해 올린다(0.97 상한).
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const ld = (p) => vite.ssrLoadModule(p);
const { tapAndHit } = await ld('/src/logic/unpack.ts');
const eco = await ld('/src/logic/economy.ts');
const { defaultState } = await ld('/src/logic/state.ts');
const { seededRng, choosePerk } = await ld('/src/logic/perks.ts');
const { releaseCharge, CHARGE_PERFECT, CHARGE_GOOD } = await ld('/src/logic/charge.ts');
const { initialWeak, advanceWeak, weakVisible, hitWeak } = await ld('/src/logic/weak.ts');
const combo = await ld('/src/logic/combo.ts');
const gear = await ld('/src/logic/gear.ts');
const { GEAR_IDS } = await ld('/src/data/gear.ts');
const { openBox, boxPrice } = await ld('/src/logic/gacha.ts');
const { move, canMove } = await ld('/src/logic/prestige.ts');
const { HOUSES, MOON_STAGE } = await ld('/src/data/houses.ts');

// 목표 값 시험용: TARGETS=1e10,1e11,... node tools/box-sim.mjs (houses.ts 값을 메모리에서만 덮어쓴다)
if (process.env.TARGETS) process.env.TARGETS.split(',').forEach((v, i) => { HOUSES[i].target = Number(v); });

const WEAK_HIT = 0.7, BOX_SHARE = 0.1, GEAR_SHARE = 0.25;
const MAX_MOVES = Number(process.env.MAX_MOVES ?? 6), MAX_SEC = Number(process.env.MAX_SEC ?? 5 * 3600);
const SEEDS = [12345, 777, 4242, 90210, 31337];
const POLICIES = [
  { name: '기본', tps: 4, strike: 0.3, perfect: 0.6, good: 0.3 },
  { name: '고수', tps: 4, strike: 0.3, perfect: 0.9, good: 0.07 },
  { name: '가볍게', tps: 3, strike: 0.2, perfect: 0.4, good: 0.35, maxMoves: 4 } // 느려서 6회까지 돌리면 시간이 너무 걸림,
];

function run(pol, seed) {
  const DT = 1 / pol.tps;
  const rng = seededRng(seed);
  let s = defaultState(0, 1);
  let w = initialWeak(rng), c = combo.initialCombo(), streak = 0, shield = gear.initialShield(0);
  let t = 0, last = 0;
  const rows = [];
  while (rows.length < Math.min(MAX_MOVES, pol.maxMoves ?? MAX_MOVES) && t < MAX_SEC) {
    t += DT;
    const ms = t * 1000;
    const g = gear.gearEffects(s);
    s = eco.tick(s, DT, rng);
    const wa = advanceWeak(w, DT * 1000, true, rng, g.weakDelayMult);
    w = wa.weak;
    const win = combo.comboWindowMs(s.fever.activeSec > 0);
    if (combo.comboExpired(c, ms, win)) c = combo.initialCombo();
    let r;
    if (weakVisible(w) && rng() < WEAK_HIT) {
      r = hitWeak(s, rng, w, combo.comboMult(c.n));
      w = r.weak;
      c = combo.comboAdd(c, ms, r.comboAdd).combo;
    } else if (rng() < pol.strike) {
      const pp = Math.min(0.97, pol.perfect * (g.perfectHalf / 0.05));
      const gp = Math.min(pol.good, 1 - pp);
      const q = rng();
      const pos = q < pp ? (CHARGE_PERFECT[0] + CHARGE_PERFECT[1]) / 2 : q < pp + gp ? CHARGE_GOOD[0] + 0.01 : 0.1;
      r = releaseCharge(s, rng, pos, streak, combo.comboMult(c.n));
      const st = gear.resolveStreak(streak, r.grade, shield, g.shieldMax);
      streak = st.streak;
      shield = st.shield;
      c = combo.comboAdd(c, ms, r.comboAdd).combo;
    } else {
      const h = combo.comboHit(c, ms, win, false);
      c = h.combo;
      r = tapAndHit(s, rng, false, combo.comboMult(c.n));
    }
    s = r.state;
    // 상자(뽑기): 가격이 보유 P의 10% 이하일 때
    for (let i = 0; i < 50 && boxPrice(s) <= s.points * BOX_SHARE; i++) { const o = openBox(s, rng); if (!o) break; s = o.state; }
    // 업그레이드: 싼 것부터
    for (;;) {
      const tc = eco.tapCost(s.tapLevel), sc = eco.strikeCost(s.strikeLevel);
      const b = tc <= sc ? eco.buyTapUpgrade(s) : eco.buyStrikeUpgrade(s);
      if (!b) break;
      s = b;
    }
    // 공구 5종: 해금됐고 비용이 보유 P의 25% 이하면 산다(안전모는 사는 순간 한 칸 채움)
    for (const id of GEAR_IDS) {
      if (!gear.gearUnlocked(s, id) || gear.gearCost(s, id) > s.points * GEAR_SHARE) continue;
      const b = gear.buyGear(s, id);
      if (!b) continue;
      s = b;
      if (id === 'helmet') shield = { ...shield, n: shield.n + 1 };
    }
    if (canMove(s)) {
      const bd = eco.multBreakdown(s, 'tap');
      const row = { to: HOUSES[s.moves]?.name ?? `${s.moves + 1}번째`, sec: t - last, total: t, H: eco.homeMult(s), C: eco.collectionMult(s), M: bd.total / bd.fever, tapLv: s.tapLevel, gear: GEAR_IDS.map((id) => s.gear[id] ?? 0).join('') };
      last = t;
      s = move(s, rng);
      shield = gear.initialShield(gear.gearEffects(s).shieldMax);
      while (s.perkOffers.length > 0) { const n = choosePerk(s, 0, s.perkOffers[0][0]); if (!n) break; s = { ...n }; }
      rows.push(row);
    }
  }
  return rows;
}

const fx = (x) => (x >= 1e4 ? x.toExponential(1) : x.toFixed(1));
const min = (sec) => (sec / 60).toFixed(1);
const med = (a) => { const b = [...a].sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const results = POLICIES.map((pol) => ({ pol, runs: SEEDS.map((sd) => run(pol, sd)) }));
for (const { pol, runs } of results) {
  console.log(`\n[${pol.name}] 이사 | 걸린 분 중앙(최소~최대) | 누적 분 중앙 | 도달 시드 | 탭Lv | H | C | 총 배율(피버 제외) | 공구Lv(수평계·안전모·빠루·송곳·돋보기)`);
  for (let i = 0; i < MAX_MOVES; i++) {
    const rs = runs.map((r) => r[i]).filter(Boolean);
    if (rs.length === 0) { console.log(`${i + 1}회 도달 시드 없음`); continue; }
    const secs = rs.map((r) => r.sec), tot = rs.map((r) => r.total), m = rs[rs.length >> 1];
    console.log(`${i + 1}회 ${rs[0].to} | ${min(med(secs))} (${min(Math.min(...secs))}~${min(Math.max(...secs))}) | ${min(med(tot))} | ${rs.length}/${SEEDS.length} | ${med(rs.map((r) => r.tapLv)).toFixed(0)} | x${fx(med(rs.map((r) => r.H)))} | x${fx(med(rs.map((r) => r.C)))} | x${fx(med(rs.map((r) => r.M)))} | ${m.gear}`);
  }
}
console.log('\n[기본] 시드별 걸린 분');
results[0].runs.forEach((r, k) => console.log(`시드 ${SEEDS[k]}: ${r.map((x) => min(x.sec)).join(' / ')}`));
const stat = (pol, i) => { const rs = results.find((x) => x.pol.name === pol).runs.map((r) => r[i]).filter(Boolean); return rs.length ? { sec: med(rs.map((r) => r.sec)), total: med(rs.map((r) => r.total)) } : null; };
const ok = (b) => (b ? 'OK' : 'NG');
const j = [];
const b1 = stat('기본', 0), b2 = stat('기본', 1), b3 = stat('기본', 2), bm = stat('기본', MOON_STAGE);
if (b1 && b2 && b3 && bm) {
  const [a, b, c3] = [b1.sec / 60, b2.sec / 60, b3.sec / 60];
  const moon = bm.total / 3600;
  j.push(`첫 이사 ${a.toFixed(1)}분 (8~12): ${ok(a >= 8 && a <= 12)}`);
  j.push(`2회 ${b.toFixed(1)}분 < 1회 ${a.toFixed(1)}분: ${ok(b < a)}`);
  j.push(`3회 ${c3.toFixed(1)}분 (12~22): ${ok(c3 >= 12 && c3 <= 22)}`);
  j.push(`달 기지(${MOON_STAGE + 1}번째 이사) 도착 누적 ${moon.toFixed(2)}시간 (1.5~2.9): ${ok(moon >= 1.5 && moon <= 2.9)}`);
  const pm = stat('고수', MOON_STAGE);
  if (pm) j.push(`참고: 고수 달 기지 누적 ${(pm.total / 3600).toFixed(2)}시간 (기본 대비 x${(bm.total / pm.total).toFixed(2)} 빠름)`);
  const lm = stat('가볍게', MOON_STAGE);
  if (lm) j.push(`참고: 가볍게 달 기지 누적 ${(lm.total / 3600).toFixed(2)}시간 (기본 대비 x${(lm.total / bm.total).toFixed(2)} 느림)`);
} else j.push('NG: 기본 정책이 시간 안에 이사를 충분히 끝내지 못함');
console.log('\n판정(기본 정책 중앙값)\n' + j.join('\n'));
await vite.close();
