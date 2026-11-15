// 우리 집 키우기 밸런스 시뮬레이터. 상수는 DESIGN.md 4·5·전략 요소 절과 동일해야 한다.
// 기본 전략: 초당 탭 3회 + 회수시간(비용/증가 수익)이 가장 짧은 항목을 즉시 구매(결합 단계·마일스톤까지 최대 40레벨 앞을 본다).
// 탭 1회 = (기본값 + 탭 비율 x 서비스 초당 수익[피버·이벤트·약정 제외]) x 탭 특전 x 치명타 x 피버(한 번만). 탭 비율은 src/data/services.ts TAP_RATIO_*.
// 탭 변주 3종은 기대값으로 반영: 치명타, 피버, 택배 상자(70% 획득).
// 전략 요소: 결합 할인(항상 자동 적용), 약정(수익 큰 서비스 2개에 보통 기간 반복, 이사 직전엔 갱신 안 함, 위약금을 못 내면 대기),
//           이사 특전(이사마다 3택 1, 정책에 따라 선택).
// 이삿짐 상자 채널(DESIGN-UNPACK.md): 탭 1회 P는 TAP_BOX_SCALE배, 상자가 터질 때 덩어리(탭 1회 P[치명타·피버 제외] x K)를 준다.
//           상자 깨는 속도 = 감쇠 없는 탭 수 / max(3, HP(k) / (힘 x 치명타 기대값 x 피버 평균)). 집별 유한 80개 + 덤 짐(작은 상자, HP 계속 상승).
// 제외: 사은품 상자·도감·이벤트·오프라인 보상(전부 속도를 높이는 방향이므로 보수적 추정).
const SERVICES = [
  { name: '인터넷',       cost: 15,   rate: 1.15, prod: 0.5 },
  { name: '정수기',       cost: 120,  rate: 1.15, prod: 4 },
  { name: '공기청정기',   cost: 1300, rate: 1.15, prod: 30 },
  { name: '휴대폰',       cost: 15000, rate: 1.15, prod: 220 },
  { name: '청소',         cost: 190000, rate: 1.15, prod: 1700 },
  { name: '인테리어',     cost: 2.6e6, rate: 1.15, prod: 14000 },
  { name: '로봇청소기',   cost: 4e7,  rate: 1.15, prod: 120000 },
  { name: '내 집 마련',   cost: 7e8,  rate: 1.15, prod: 1e6 },
];
const MILESTONES = [10, 25, 50, 100, 200, 400];
const TAP = { base: 1, perLevel: 1, cost: 20, rate: Number(process.env.TAPRATE || 1.25), milestones: [10, 25, 50, 100], ratioBase: 0.01, ratioPer: Number(process.env.RPER || 0.0005), ratioBonus: (process.env.RB || '0.01,0.02,0.03,0.05').split(',').map(Number) };
const HOUSES = ['원룸', '투룸', '아파트', '펜트하우스', '달 기지', '화성 별관', '목성 위성 단지', '은하 분양단지', '우주 끝 신도시'];
const TARGETS = (process.env.T || "5.5e7,4.6e8,3e12,8e14,8e15").split(",").map(Number);
const permMult = (moves) => 1 + 1.5 * moves;
// 결합: src/data/bundles.ts와 동일
const BUNDLES = [[0, 3], [0, 1, 2], [1, 2, 6], [4, 5, 6], [5, 7]];
const BUNDLE_LEVELS = [10, 25, 50, 100], BUNDLE_MULTS = [1.5, 2, 3, 4];
// 약정: src/data/contracts.ts와 동일
// [전체 초, 배율, 위약금 비율(체결 시점 현재 집 이사 목표 x 비율, 남은 시간에 비례해 줄어듦)]
const CONTRACTS = { short: [300, 1.5, Number(process.env.PR_S || 0.02)], normal: [900, 2, Number(process.env.PR_N || 0.05)], long: [3600, 3, Number(process.env.PR_L || 0.15)] };
const FULL = 6; // = TAPS_PER_SEC_FULL
const SLOTS = 2;
const HSCALE = (process.env.HS || '1,1,1,0.07,0.02').split(',').map(Number); // = PENALTY_HOUSE_SCALE
const hscale = (n) => HSCALE[Math.min(n, HSCALE.length - 1)];
// 특전: src/data/perks.ts와 동일(id, 최대 레벨)
const PERKS = { tap_power: 5, crit: 5, fever_long: 4, svc_power: 5, offline_rate: 3, offline_cap: 3, box_discount: 4, parcel_freq: 3, bundle_boost: 4, contract_slot: 2, penalty_cut: 3, tap_crit_power: 3 };
// 탭 변주 상수: src/logic/fever.ts와 동일
const CRIT = { chance: 0.05, mult: 6 };
const FEVER = { taps: 45, decay: 1.2, sec: 10, cooldown: 3, mult: 3 };
// 상자: src/data/unpack.ts, TAP_BOX_SCALE: src/data/services.ts와 동일
const TBS = Number(process.env.TBS || 0.6);
const UNPACK = { hpBase: Number(process.env.HPB || 10), growth: Number(process.env.HPG || 1.07), room: 80, nonCritMin: 3 };
const KINDS = { small: { hp: 0.7, k: Number(process.env.KS || 2) }, normal: { hp: 1.6, k: Number(process.env.KN || 3) }, big: { hp: 3, k: Number(process.env.KB || 12) } };
const PATTERN = ['small', 'small', 'normal', 'small', 'small', 'normal', 'small', 'small', 'normal', 'big'];
const kindOf = (k) => PATTERN[k % 10];
// 80개 뒤 살림 손질: src/data/unpack.ts ENDLESS_*와 동일(탭 수는 힘 대비라 HP 식 대신 탭 수로 이식)
const ENDLESS = { taps: { small: 10, normal: 20, big: 40 }, toolStep: 0.75, kMult: 0.25 };
const kMult = (k) => KINDS[kindOf(k)].k * (k >= UNPACK.room ? ENDLESS.kMult : 1);
const boxHp = (k) => Math.ceil(UNPACK.hpBase * UNPACK.growth ** k * KINDS[kindOf(k)].hp - 1e-9);
const PARCEL = { minInterval: 60, maxInterval: 120, freeBox: 0.1, minSec: 20, maxSec: 40, catchRate: 0.7, catchDelay: 4 };
const DT = 0.5, MAX_MOVES = 5, LOOK = Number(process.env.LOOKN || 40);

const msMult = (lv, list = MILESTONES) => 2 ** list.filter((m) => lv >= m).length;
const svcCost = (i, lv) => SERVICES[i].cost * SERVICES[i].rate ** lv;
const tapCost = (lv) => TAP.cost * TAP.rate ** lv;
const tapRatio = (lv) => TAP.ratioBase + TAP.ratioPer * lv + TAP.milestones.reduce((a, m, i) => a + (lv >= m ? TAP.ratioBonus[i] : 0), 0);
const tapBase = (lv) => (TAP.base + TAP.perLevel * lv) * msMult(lv, TAP.milestones);
const target = (n) => TARGETS[n] ?? TARGETS[TARGETS.length - 1] * 40 ** (n - TARGETS.length + 1);
const bulk = (i, lv, k) => { const r = SERVICES[i].rate; return svcCost(i, lv) * (r ** k - 1) / (r - 1); };
const tapBulk = (lv, k) => tapCost(lv) * (TAP.rate ** k - 1) / (TAP.rate - 1);

function mulberry(seed) { let a = seed; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const PREF = {
  // 균형: 쓰임이 있는 특전을 고르게(레벨 비율이 낮은 것부터)
  balanced: null,
  // 탭만 파기
  tap: ['tap_power', 'crit', 'tap_crit_power', 'fever_long'],
  // 방치·전략만 파기
  idle: ['svc_power', 'bundle_boost', 'contract_slot', 'penalty_cut'],
};
const RELEVANT = ['svc_power', 'tap_power', 'bundle_boost', 'crit', 'contract_slot', 'fever_long', 'penalty_cut', 'tap_crit_power'];

function pickPerk(policy, offer, perks) {
  const open = offer.filter((id) => (perks[id] ?? 0) < PERKS[id]);
  if (!open.length) return null;
  if (policy === 'balanced') {
    const rel = open.filter((id) => RELEVANT.includes(id));
    const pool = rel.length ? rel : open;
    return pool.sort((a, b) => (perks[a] ?? 0) / PERKS[a] - (perks[b] ?? 0) / PERKS[b] || RELEVANT.indexOf(a) - RELEVANT.indexOf(b))[0];
  }
  const rank = PREF[policy];
  const hit = open.filter((id) => rank.includes(id)).sort((a, b) => rank.indexOf(a) - rank.indexOf(b));
  return hit[0] ?? open.sort((a, b) => RELEVANT.indexOf(a) - RELEVANT.indexOf(b))[0]; // 못 찾으면 대충(효과 없는 것 포함)
}

// mode: { perks: 'none'|'balanced'|'tap'|'idle', contracts: bool, look: bool }
function run(mode, seed) {
  // 무탭도 첫 서비스를 살 때까지는 눌러야 하므로(수익 0) 그동안만 초당 3회로 친다
  const tpsNow = () => (lv[0] >= 1 ? mode.tps : 3);
  const rng = mulberry(seed);
  let t = 0, moves = 0, firstBuy = null; const out = [];
  let pts = 0, earned = 0, tapLv = 0, lv = SERVICES.map(() => 0), runStart = 0;
  let contracts = []; // {i, rem}
  const perks = {};
  const pk = (id) => perks[id] ?? 0;
  let boxK = 0, boxProg = 0; let reachedAt = null; let share = 0; let best = null; let trace = [];
  const fx = () => {
    const critMean = 1 + (CRIT.chance + Number(process.env.CRITPER || 0.03) * pk('crit')) * (CRIT.mult + pk('tap_crit_power') - 1);
    const feverSec = FEVER.sec + Number(process.env.FEVPER || 4) * pk('fever_long');
    const TPS = Math.min(tpsNow(), FULL); // 감쇠 탭은 피버를 충전하지 않는다
    const feverFill = TPS > FEVER.decay ? FEVER.taps / (TPS - FEVER.decay) : Infinity;
    const feverMean = 1 + (FEVER.mult - 1) * feverSec / (feverFill + feverSec + FEVER.cooldown);
    const cycle = (PARCEL.minInterval + PARCEL.maxInterval) / 2 * (1 - 0.15 * pk('parcel_freq')) + PARCEL.catchDelay;
    const parcelRate = (PARCEL.catchRate * (1 - PARCEL.freeBox) * (PARCEL.minSec + PARCEL.maxSec) / 2) / cycle;
    return { critMean, feverMean, parcelRate, tapPerk: 1 + Number(process.env.TAPPW || 1.1) * pk('tap_power'), power: 1 + pk('tap_power'), svcPerk: 1 + 0.2 * pk('svc_power'), boost: 1 + 0.25 * pk('bundle_boost') };
  };
  const bundleMult = (l, i, boost) => {
    let m = 1;
    for (const b of BUNDLES) if (b.includes(i)) { const min = Math.min(...b.map((j) => l[j])); const st = BUNDLE_LEVELS.filter((x) => min >= x).length; if (st) m *= 1 + (BUNDLE_MULTS[st - 1] - 1) * boost; }
    return m;
  };
  const prodOf = (l, i, F, withContract) => {
    let p = SERVICES[i].prod * l[i] * msMult(l[i]) * permMult(moves) * bundleMult(l, i, F.boost) * F.svcPerk;
    if (withContract) { const c = contracts.find((x) => x.i === i); if (c) p *= c.mult; }
    return p;
  };
  const income = (l, tl, F, withContract = true, box = true) => {
    let s = 0, st = 0; for (let i = 0; i < l.length; i++) { s += prodOf(l, i, F, withContract); st += prodOf(l, i, F, false) / F.svcPerk; } // 탭 몫의 기준 수익은 서비스 특전 제외
    const tapOne = (tapBase(tl) * permMult(moves) + tapRatio(tl) * st) * F.critMean * F.tapPerk * TBS;
    const flatOne = tapBase(tl) * permMult(moves) * F.critMean * F.tapPerk * TBS; // 초당 6회 초과 탭은 기본값 몫만
    return (s * (1 + F.parcelRate) + (Math.min(tpsNow(), FULL) * tapOne + Math.max(0, tpsNow() - FULL) * flatOne)) * F.feverMean + (box ? boxRate(l, tl, F) : 0);
  };
  // 상자 채널: 탭 1회 P 덩어리(치명타·피버 제외) = (기본값 + 비율 x 서비스 수익) x 탭 특전 x TBS
  const chunkOf = (l, tl, F) => { let st = 0; for (let i = 0; i < l.length; i++) st += prodOf(l, i, F, false) / F.svcPerk; return (tapBase(tl) * permMult(moves) + tapRatio(tl) * st) * F.tapPerk * TBS; };
  const tapsPerBox = (k, tl, F) => {
    const cm = F.critMean * F.feverMean;
    if (k < UNPACK.room) return Math.max(UNPACK.nonCritMin, boxHp(k) / (tapBase(tl) * F.power * cm));
    const tool = TAP.milestones.filter((m) => tl >= m).length; // 도구 단계 = 탭 마일스톤 통과 수
    return Math.max(UNPACK.nonCritMin, ENDLESS.taps[kindOf(k)] * ENDLESS.toolStep ** tool / cm);
  };
  const boxRate = (l, tl, F) => { // 지금 10개 묶음의 평균 속도(P/초)
    const tf = Math.min(tpsNow(), FULL); if (tf <= 0) return 0;
    const chunk = chunkOf(l, tl, F); let gain = 0, sec = 0;
    for (let k = boxK; k < boxK + 10; k++) { gain += chunk * kMult(k); sec += tapsPerBox(k, tl, F) / tf; }
    return gain / sec;
  };
  const boxStep = (dt, l, tl, F) => { // 실제 진행: 상자를 하나씩 깬다
    let taps = Math.min(tpsNow(), FULL) * dt, gain = 0; if (taps <= 0) return 0;
    const chunk = chunkOf(l, tl, F);
    while (taps > 0) {
      const need = tapsPerBox(boxK, tl, F) - boxProg;
      if (taps >= need) { taps -= need; gain += chunk * kMult(boxK); boxK++; boxProg = 0; } else { boxProg += taps; taps = 0; }
    }
    return gain;
  };
  const chooseBest = () => {
    const F = fx(); const cur = income(lv, tapLv, F); let b = null;
    const K = mode.look ? LOOK : 1;
    for (let k = 1; k <= K; k++) {
      const c = tapBulk(tapLv, k); const d = income(lv, tapLv + k, F) - cur;
      if (d > 0 && (!b || c / d < b.pb)) b = { kind: 'tap', k, cost: c, pb: c / d };
    }
    lv.forEach((l, i) => {
      if (i > 0 && lv[i - 1] < 1) return;
      for (let k = 1; k <= K; k++) {
        const c = bulk(i, l, k); const nl = lv.slice(); nl[i] += k; const d = income(nl, tapLv, F) - cur;
        if (d > 0 && (!b || c / d < b.pb)) b = { kind: i, k, cost: c, pb: c / d };
      }
    });
    return b;
  };
  const penalty = () => { let s = 0; for (const c of contracts) s += c.base * (c.rem / c.tot); return s * (1 - 0.2 * pk('penalty_cut')); };
  const trySign = () => {
    if (!mode.contracts) return;
    const F = fx(); const slots = SLOTS + pk('contract_slot');
    if (contracts.length >= slots) return;
    const inc = income(lv, tapLv, F);
    if ((target(moves) - earned) / inc < CONTRACTS.normal[0]) return; // 이사가 가까우면 갱신 안 함
    const order = lv.map((_, i) => i).filter((i) => lv[i] >= 1 && !contracts.some((c) => c.i === i)).sort((a, b) => prodOf(lv, b, F, false) - prodOf(lv, a, F, false));
    while (contracts.length < slots && order.length) { contracts.push({ i: order.shift(), rem: CONTRACTS.normal[0], tot: CONTRACTS.normal[0], mult: CONTRACTS.normal[1], base: target(moves) * CONTRACTS.normal[2] * hscale(moves) }); best = null; }
  };
  while (moves < MAX_MOVES && t < 3600 * 200) {
    const F = fx();
    const dt = t < 3600 * 3 ? DT : 5;
    let gain = income(lv, tapLv, F, true, false) * dt + boxStep(dt, lv, tapLv, F);
    pts += gain; earned += gain; t += dt;
    if (contracts.length) { const n = contracts.length; contracts = contracts.map((c) => ({ ...c, rem: c.rem - dt })).filter((c) => c.rem > 0); if (contracts.length !== n) best = null; }
    trySign();
    for (;;) {
      if (!best) best = chooseBest();
      if (!best || pts < best.cost) break;
      pts -= best.cost;
      if (best.kind === 'tap') { tapLv += best.k; trace.push([t - runStart, tapLv]); } else lv[best.kind] += best.k;
      if (firstBuy === null) firstBuy = t;
      best = null;
      trySign();
    }
    if (earned >= target(moves)) { if (reachedAt === null) reachedAt = t; }
    if (earned >= target(moves) && pts >= penalty()) {
      const incNow = income(lv, tapLv, fx()); const wait = t - reachedAt; const longSec = target(moves) * CONTRACTS.long[2] * hscale(moves) / incNow;
      { const Fx = fx(); let sv = 0, st = 0; for (let i = 0; i < lv.length; i++) { sv += prodOf(lv, i, Fx, true); st += prodOf(lv, i, Fx, false) / Fx.svcPerk; } const tp = (Math.min(tpsNow(), FULL) * (tapBase(tapLv) * permMult(moves) + tapRatio(tapLv) * st) + Math.max(0, tpsNow() - FULL) * tapBase(tapLv) * permMult(moves)) * Fx.critMean * Fx.tapPerk; share = tp / (tp + sv * (1 + Fx.parcelRate)); }
      const dur = t - runStart; const at = (f) => trace.filter(([x]) => x <= f * dur).pop()?.[1] ?? 0;
      out.push({ wait, longSec, pen: penalty() / incNow, share, tapLv, prog: [at(0.25), at(0.5), at(0.75)], n: moves + 1, to: HOUSES[moves + 1] ?? `우주 끝 신도시 ${moves - 7}차`, dur: t - runStart, total: t });
      moves++; reachedAt = null; trace = []; pts = 0; earned = 0; tapLv = 0; lv = SERVICES.map(() => 0); runStart = t; contracts = []; best = null; boxK = 0; boxProg = 0;
      if (mode.perks !== 'none') { // 이사 특전 3택
        const pool = Object.keys(PERKS).filter((id) => (perks[id] ?? 0) < PERKS[id]); const offer = [];
        while (offer.length < 3 && pool.length) offer.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
        const c = pickPerk(mode.perks, offer, perks); if (c) perks[c] = (perks[c] ?? 0) + 1;
      }
    }
  }
  return { firstBuy, out };
}
const fmt = (s) => (s < 90 ? `${s.toFixed(0)}초` : s < 5400 ? `${(s / 60).toFixed(1)}분` : `${(s / 3600).toFixed(2)}시간`);
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8].slice(0, Number(process.env.SEEDN || 8));
function avg(mode) {
  const runs = SEEDS.map((s) => run(mode, s));
  const n = Math.min(...runs.map((r) => r.out.length));
  const mean = (f) => runs.reduce((a, r) => a + f(r), 0) / runs.length;
  return { firstBuy: mean((r) => r.firstBuy), rows: Array.from({ length: n }, (_, k) => ({ n: k + 1, to: runs[0].out[k].to, dur: mean((r) => r.out[k].dur), total: mean((r) => r.out[k].total), tapLv: mean((r) => r.out[k].tapLv), share: mean((r) => r.out[k].share), wait: Math.max(...runs.map((r) => r.out[k].wait)), longSec: mean((r) => r.out[k].longSec), pen: mean((r) => r.out[k].pen), prog: [0, 1, 2].map((j) => mean((r) => r.out[k].prog[j] ?? r.out[k].tapLv)) })) };
}
const BUILDS = { '균형': { perks: 'balanced', contracts: true }, '탭 특전만': { perks: 'tap', contracts: true }, '방치·전략 특전만': { perks: 'idle', contracts: true } };
const CAP = Number(process.env.CAP || 12); // = TAPS_PER_SEC_ACCEPT (6회까지 전액, 초과분은 기본값 몫)
const TPSS = { '0회': 0, '3회': 3, '6회': 6, '상한': CAP };
const res = {};
for (const [tn, tps] of Object.entries(TPSS)) for (const [bn, b] of Object.entries(BUILDS)) res[`${tn}|${bn}`] = avg({ ...b, look: true, tps });
res['3회|특전·약정 없음'] = avg({ perks: 'none', contracts: false, look: true, tps: 3 });
const R = (t, b) => res[`${t}|${b}`];
console.log(`(특전 선택은 ${SEEDS.length}개 시드 평균, 상한=TAPS_PER_SEC_ACCEPT)`);
console.log('\n초당 탭 | 빌드 | 첫 이사 | 달 기지 누적 | 화성 별관 누적 | (같은 빌드 무탭 대비 달 기지 속도 x)');
for (const [k, r] of Object.entries(res)) {
  if (r.rows.length < 4) { console.log(k, 'rows', r.rows.length, r.rows.map((o) => fmt(o.total)).join(',')); continue; }
  const [t, b] = k.split('|'); const z = R('0회', b);
  console.log(`${t} | ${b} | ${fmt(r.rows[0].dur)} | ${fmt(r.rows[3].total)} | ${r.rows[4] ? fmt(r.rows[4].total) : '-'} | ${z ? 'x' + (z.rows[3].total / r.rows[3].total).toFixed(2) : '-'}`);
}
const bal = R('3회', '균형');
console.log('\n## 균형 @3회 이사별 (이사 시점 탭 레벨 / 집 체류 시간 25·50·75% 시점 탭 레벨)');
bal.rows.forEach((o) => console.log(`${o.n}회 ${o.to} | ${fmt(o.dur)} | 누적 ${fmt(o.total)} | 탭 Lv ${o.prog.map((x) => x.toFixed(0)).join('/')}/${o.tapLv.toFixed(0)} | 비율 ${tapRatio(Math.round(o.tapLv)).toFixed(3)} | 탭 몫 ${(o.share * 100).toFixed(0)}% | 이사 때 위약금 ${o.pen.toFixed(0)}초분 | 막힘 최대 ${o.wait.toFixed(0)}초 | 길게 직후 이사 시 ${o.longSec.toFixed(0)}초분`));
const flat = R('상한', '균형');
console.log('\n## 균형 @상한 탭 레벨: ' + flat.rows.map((o) => `${o.n}회 ${o.tapLv.toFixed(0)}`).join(', '));
const CUR = [9.9 * 60, 6.6 * 60, 16.0 * 60]; const CURMOON = 2.88 * 3600;
const within = (v, c) => Math.abs(v / c - 1) <= 0.15;
const c = [];
c.push(['첫 구매<=30초', bal.firstBuy <= 30]);
c.push(['첫 이사/2회/3회 현재 대비 ±15%', bal.rows.slice(0, 3).every((o, k) => within(o.dur, CUR[k]))]);
c.push(['달 기지 누적 현재 대비 ±15%', within(bal.rows[3].total, CURMOON)]);
c.push(['길게 약정 직후 이사 위약금 30~120초분(이사 1~5회, 균형@3회)', bal.rows.every((o) => o.longSec >= 30 && o.longSec <= 120)]);
c.push(['위약금 때문에 막힌 시간 <=120초', Object.values(res).every((r) => r.rows.every((o) => o.wait <= 120))]);
c.push(['2회차<1회차', bal.rows[1].dur < bal.rows[0].dur]);
const sp = (t, b) => R('0회', b).rows[3].total / R(t, b).rows[3].total;
c.push(['무탭 균형 달 기지<=8시간', R('0회', '균형').rows[3].total <= 8 * 3600]);
c.push(['3회/무탭 1.5~2배(균형)', sp('3회', '균형') >= 1.5 && sp('3회', '균형') <= 2]);
c.push(['상한/무탭<=4배(전 빌드)', Object.keys(BUILDS).every((b) => sp('상한', b) <= 4)]);
c.push(['초당 6회: 탭 빌드가 방치 빌드보다 2% 이상 빠름(달 기지 누적)', R('6회', '탭 특전만').rows[3].total * 1.02 <= R('6회', '방치·전략 특전만').rows[3].total]);
c.push(['초당 3회: 탭 빌드가 방치 빌드보다 10% 넘게 느리지 않음(달 기지 누적)', R('3회', '탭 특전만').rows[3].total <= R('3회', '방치·전략 특전만').rows[3].total * 1.10]);
c.push(['방치 빌드 > 탭 빌드 @무탭', R('0회', '방치·전략 특전만').rows[3].total < R('0회', '탭 특전만').rows[3].total]);
const ratio = (t, a, b) => (R(t, b).rows[3].total / R(t, a).rows[3].total).toFixed(2);
console.log(`\n달 기지 시간비: 3회 방치/탭 x${ratio('3회', '방치·전략 특전만', '탭 특전만')}, 6회 방치/탭 x${ratio('6회', '방치·전략 특전만', '탭 특전만')}, 상한 방치/탭 x${ratio('상한', '방치·전략 특전만', '탭 특전만')}, 무탭 탭/방치 x${ratio('0회', '탭 특전만', '방치·전략 특전만')}`);
console.log('\n목표 판정'); c.forEach(([n, ok]) => console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}`));
process.exitCode = c.every(([, ok]) => ok) ? 0 : 1;
