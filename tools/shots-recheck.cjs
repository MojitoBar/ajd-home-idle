// 재검수 순간 촬영: ONLY=buy,spark,ten,boxin,move,room,fever,banner,chip,main,house,newline,measure node tools/shots-recheck.cjs
// 전제: 개발 서버 localhost:5173, 격리 Aside CDP 9333. 출력 screenshots/audit4/re/<이름>.png (page.screenshot만 사용), 목록 re/_index.txt, 수치 audit4/measure.txt
// 시각은 "목표 ms"로 이름을 붙이고 실제 촬영 구간(ms)은 _index.txt 설명에 남긴다.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.URL || 'http://localhost:5173';
const AUDIT = path.join(__dirname, '..', 'screenshots', process.env.AUDIT_DIR || 'audit4');
const OUT = path.join(AUDIT, 're');
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const run = (g) => !only || only.includes(g);
const mob = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pc = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
const SEED = { unlocked: ['tap', 'bundle', 'box', 'dex', 'move', 'contract', 'mult', 'badge', 'perk'], version: 3, points: 5e6, earned: 5e6, moves: 0, tapLevel: 3, services: [20, 12, 11, 10, 0, 0, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], collection: {} };
const FULL = { ...SEED, points: 8e10, earned: 8e10, services: [20, 12, 11, 10, 5, 5, 5, 5] };
const PREFS = { sound: false, music: false, haptics: false };
const IDS = ['fan', 'kettle', 'toaster', 'heating_pad', 'hair_dryer', 'humidifier', 'rice_cooker', 'water_purifier', 'air_purifier', 'air_fryer', 'vacuum', 'coffee_machine', 'dishwasher', 'air_conditioner', 'washer', 'smart_tv', 'fridge', 'massage_chair', 'robot_vacuum'];
const some = {}; IDS.slice(0, 11).forEach((id, i) => { some[id] = { base: 1 + (i % 4), shiny: i % 3 === 0 ? 2 : 0, gold: i === 2 ? 1 : 0, rainbow: 0 }; });
const all = {}; IDS.forEach((id, i) => { all[id] = { base: 1 + ((i * 3) % 16), shiny: 1 + (i % 7), gold: i % 2 ? 1 : 3, rainbow: i % 5 === 0 ? 1 : 2 }; });
const PATTERN = ['small', 'small', 'normal', 'small', 'small', 'normal', 'small', 'small', 'normal', 'big'];
const MULT = { small: 0.7, normal: 1.6, big: 3 };
const hpOf = (k) => Math.ceil(10 * 1.07 ** k * MULT[k >= 80 ? 'small' : PATTERN[k % 10]] - 1e-9);
const THEMES = ['blue', 'mint', 'sunset', 'night', 'moon', 'mars', 'jupiter', 'nebula', 'edge'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const problems = [];

async function open(browser, o, seed, { fresh = false } = {}) {
  const ctx = await browser.newContext(o);
  await ctx.addInitScript(([k, s, p, fr]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    if (s && !fr) localStorage.setItem(k, JSON.stringify({ ...s, stats: { totalEarned: 0, playSec: 0, boxesOpened: 0, ...(s.stats || {}), totalTaps: Math.max(500, (s.stats && s.stats.totalTaps) || 0) }, savedAt: Date.now() }));
    localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p));
  }, ['ajd-home-idle:save', seed, PREFS, fresh]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { if (!/Extension context/.test(e.message)) problems.push(`pageerror ${e.message}`); });
  await page.goto(BASE + '/?debug');
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  return { ctx, page };
}
const set = (page, patch) => page.evaluate((pt) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, ...pt }); }, patch);
const setUn = (page, u) => page.evaluate((x) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, unpack: { ...s.unpack, ...x } }); }, u);
const tab = async (page, name) => { await page.locator('.dock .tab:visible, .tab:visible', { hasText: name }).first().click(); await page.waitForTimeout(400); };
const noCrit = (page) => page.evaluate(() => { if (!window.__rnd0) window.__rnd0 = Math.random; Math.random = () => 0.99; });
const queue = (page, q) => page.evaluate((qq) => { const o = Math.random; window.__q = qq; Math.random = () => (window.__q.length ? window.__q.shift() : o()); }, q);
const rng = (page, sd) => page.evaluate((x) => { let a = x; Math.random = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }, sd);
const boxTab = async (page) => { await tab(page, '상자'); await page.evaluate(() => document.querySelector('.box-hero').scrollIntoView({ block: 'start' })); await page.waitForTimeout(300); };
async function tapPos(page) {
  return page.evaluate(() => {
    const b = document.querySelector('.un-box[data-pos="0"]');
    const r = (b || document.querySelector('.phone')).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height * 0.6 };
  });
}
const tap = async (page, n = 1, gap = 0) => { const p = await tapPos(page); for (let i = 0; i < n; i++) { await page.mouse.click(p.x, p.y); if (gap) await sleep(gap); } };
async function lat(page) {
  const a = [];
  for (let i = 0; i < 3; i++) { const t = Date.now(); await page.screenshot(); a.push(Date.now() - t); }
  return a.sort((x, y) => x - y)[1];
}
/** 기준 시각 t0에서 target ms 뒤를 노려 찍는다(촬영 시간의 절반만큼 앞당김). 설명에 실제 구간을 적는다 */
async function shotAt(page, name, t0, target, L, desc, extra = '') {
  const w = target - L * 0.5 - (Date.now() - t0);
  if (w > 0) await sleep(w);
  const s = Date.now() - t0;
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  const e = Date.now() - t0;
  if (typeof extra === 'function') extra = await extra();
  results.push(`re/${name}.png — ${desc} (목표 ${target}ms, 실제 촬영 ${s}~${e}ms${extra ? ', ' + extra : ''})`);
  console.log('shot', name, `${s}~${e}`, extra);
}
async function shot(page, name, desc) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  results.push(`re/${name}.png — ${desc}`);
  console.log('shot', name);
}
async function scene(name, fn) {
  try { await fn(); } catch (e) { const m = `[${name}] 실패 ${e.message.split('\n')[0]}`; console.log(m); problems.push(m); results.push(`(못 찍음) ${m}`); }
}
const buyClick = (page, idx) => page.evaluate((i) => {
  const c = document.querySelectorAll('.card-list .card')[i];
  c.querySelector('button.buy').click();
  return performance.now();
}, idx);
const gainInfo = (page) => page.evaluate(() => { const t = document.querySelector('.fx-float.buy-gain'); if (!t) return 'buy-gain 없음'; const r = t.getBoundingClientRect(); return `buy-gain "${t.textContent}" opacity=${getComputedStyle(t).opacity} rect=${[r.left, r.top, r.right, r.bottom].map(Math.round)}`; });
const dev = (o) => `${o.viewport.width}x${o.viewport.height} DPR${o.deviceScaleFactor}`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    // 1. 구매 글자
    const buyRuns = [['390', mob(390, 844), 0], ['390', mob(390, 844), 1], ['1440', pc(1440, 900), 0]];
    if (run('buy')) for (const [w, o, idx] of buyRuns) await scene(`buy-${w}-c${idx}`, async () => {
      const { ctx, page } = await open(browser, o, SEED);
      const L = await lat(page);
      for (const ms of [80, 200, 400]) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.evaluate((i) => document.querySelectorAll('.card-list .card')[i].scrollIntoView({ block: 'center' }), idx);
        await page.waitForTimeout(250);
        await buyClick(page, idx); const t0 = Date.now();
        const w0 = ms - L * 0.5 - (Date.now() - t0); if (w0 > 0) await sleep(w0);
        const s = Date.now() - t0;
        await page.screenshot({ path: path.join(OUT, `buy-${w}-c${idx}-${ms}.png`) });
        const info = await gainInfo(page);
        results.push(`re/buy-${w}-c${idx}-${ms}.png — ${w} 카드 ${idx + 1}번째 구매 뒤 +N/초 글자 (${dev(o)}, 목표 ${ms}ms, 실제 ${s}~${Date.now() - t0}ms, ${info})`);
        console.log('buy', w, idx, ms, info);
        await page.waitForTimeout(1300);
      }
      await ctx.close();
    });
    // 2. 구매 반짝이
    if (run('spark')) await scene('spark', async () => {
      const o = mob(390, 844);
      const { ctx, page } = await open(browser, o, SEED);
      const L = await lat(page);
      for (const ms of [150, 350]) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.evaluate(() => document.querySelectorAll('.card-list .card')[0].scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(250);
        await buyClick(page, 0); const t0 = Date.now();
        await shotAt(page, `spark-390-c0-${ms}`, t0, ms, L, `390 첫 카드 구매 반짝이(별·점 입자, 날아가는 아이콘) (${dev(o)})`);
        await page.waitForTimeout(1500);
      }
      await ctx.close();
    });

    // 3. 10개 결과 입자
    if (run('ten')) for (const [w, o] of [['390', mob(390, 844)], ['1440', pc(1440, 900)]]) await scene(`ten-${w}`, async () => {
      const { ctx, page } = await open(browser, o, { ...SEED, points: 1e9 });
      await boxTab(page); await rng(page, 7);
      const L = await lat(page);
      await page.locator('.box-ten').click();
      await page.waitForSelector('.sum-best', { timeout: 25000 });
      const t0 = Date.now();
      for (const ms of [100, 300, 500, 800]) {
        const pcnt = await page.evaluate(() => window.__ajd.particles());
        await shotAt(page, `ten-${w}-${ms}`, t0, ms, L, `${w} 10개 열기 결과 화면이 뜬 뒤 입자 (${dev(o)})`, `입자 ${pcnt}개`);
      }
      await ctx.close();
    });

    // 4. 상자 장면 진입 전환·충전
    if (run('boxin')) await scene('boxin', async () => {
      const o = mob(390, 844);
      for (const ms of [0, 50, 100, 150, 300, 700, 1200]) {
        const { ctx, page } = await open(browser, o, { ...SEED, points: 1e9 });
        await boxTab(page); await queue(page, [0.9985, 0.5, 0.99]);
        const L = await lat(page);
        await page.evaluate(() => document.querySelector('.box-open').click()); const t0 = Date.now();
        await shotAt(page, `boxin-390-${ms}`, t0, ms, L, `390 상자 열기 클릭 뒤 ${ms >= 700 ? '충전(흔들림) 구간' : '장면 진입 전환'} (${dev(o)})`, `box-scene ${await page.evaluate(() => !!document.querySelector('.box-scene'))}`);
        await ctx.close();
      }
    });

    // 5. 이사
    if (run('move')) for (const [w, o] of [['360', mob(360, 740)], ['390', mob(390, 844)], ['430', mob(430, 932)], ['1440', pc(1440, 900)]]) await scene(`move-${w}`, async () => {
      const { ctx, page } = await open(browser, o, { ...SEED, points: 8e7, earned: 8e7 });
      const L = await lat(page);
      await page.locator('.move-btn').click(); await page.waitForTimeout(500);
      await page.waitForSelector('.modal .btn.primary');
      await page.evaluate(() => document.querySelector('.modal .btn.primary').click()); const t0 = Date.now();
      const tr = () => page.evaluate(() => { const t = document.querySelector('.sc-truck'); if (!t) return 'truck 없음'; const r = t.getBoundingClientRect(); return `truck x=${Math.round(r.left)}~${Math.round(r.right)}`; });
      await shotAt(page, `move-${w}-depart`, t0, 1250, L, `${w} 이사 출발(트럭이 도로 위를 달림, 화면 왼쪽 절반) (${dev(o)})`, tr);
      await shotAt(page, `move-${w}-dust`, t0, 1650, L, `${w} 이사 달리는 트럭 뒤 먼지가 보이는 순간(화면 오른쪽 절반) (${dev(o)})`, tr);
      await shotAt(page, `move-${w}-arrive`, t0, 2350, L, `${w} 이사 도착(어두운 무대·새 집 이름, 별·색종이) (${dev(o)})`);
      await shotAt(page, `move-${w}-arrive2`, t0, 2750, L, `${w} 이사 도착 직후 새 집이 내려앉은 뒤(결과 화면 직전) (${dev(o)})`);
      await page.waitForSelector('.sc-result.on', { timeout: 10000 }); await page.waitForTimeout(700);
      await shot(page, `move-${w}-result`, `${w} 이사 완료 화면(영구 배율 결과) (${dev(o)})`);
      await ctx.close();
    });

    // 6. 방 완성·사은품 도착 배너
    if (run('room')) {
      for (const [w, o] of [['390', mob(390, 844)], ['1440', pc(1440, 900)]]) await scene(`room-${w}`, async () => {
        const { ctx, page } = await open(browser, o, SEED);
        await setUn(page, { box: 79, damage: hpOf(79) - 1, hp: hpOf(79), roomDone: false });
        await noCrit(page);
        const L = await lat(page);
        await tap(page, 1); const t0 = Date.now();
        for (const [ms, tag] of [[500, '0_5s'], [1500, '1_5s'], [3500, '3_5s']]) await shotAt(page, `room-${w}-${tag}`, t0, ms, L, `${w} 방 완성(마지막 타격) 뒤 ${ms / 1000}초 (${dev(o)})`);
        await ctx.close();
      });
      await scene('room-banner', async () => {
        const o = mob(390, 844);
        const { ctx, page } = await open(browser, o, SEED);
        await setUn(page, { box: 79, damage: hpOf(79) - 1, hp: hpOf(79), roomDone: false });
        await set(page, { homeLv: Array(8).fill(2) });
        await noCrit(page);
        await tap(page, 1); const t0 = Date.now();
        await page.waitForFunction(() => { const b = document.querySelector('.fx-banner'); return b && /사은품 상자 도착/.test(b.textContent) ? b.textContent : false; }, null, { timeout: 8000, polling: 'raf' });
        await page.waitForTimeout(250);
        await page.screenshot({ path: path.join(OUT, 'room-390-gift-banner.png') });
        results.push(`re/room-390-gift-banner.png — 390 방 완성 뒤 "사은품 상자 도착!" 배너가 떠 있는 순간 (${dev(o)}, 마지막 타격 뒤 약 ${Date.now() - t0}ms)`);
        await ctx.close();
      });
    }

    // 7. 피버
    if (run('fever')) {
      for (const [w, o] of [['390', mob(390, 844)], ['1440x900', pc(1440, 900)]]) await scene(`fever-${w}`, async () => {
        const { ctx, page } = await open(browser, o, SEED);
        await setUn(page, { box: 45, damage: 0, hp: 0, roomDone: false });
        await noCrit(page);
        const L = await lat(page);
        await set(page, { fever: { gauge: 44.6, activeSec: 0, cooldownSec: 0 } });
        await page.waitForTimeout(300);
        await tap(page, 1); const t0 = Date.now();
        await shotAt(page, `fever-${w}-start-a`, t0, 150, L, `${w} 피버 시작 직후(주황 피버! 판 + 첫 탭 숫자) (${dev(o)})`);
        await tap(page, 3, 60);
        const floats = await page.evaluate(() => `fx-float ${document.querySelectorAll('.fx-float').length}개, banner=${(document.querySelector('.fx-banner') || {}).textContent || '없음'}`);
        await page.screenshot({ path: path.join(OUT, `fever-${w}-start-b.png`) });
        results.push(`re/fever-${w}-start-b.png — ${w} 피버 시작 직후 탭 3번 더(판 + 탭 숫자 여러 개) (${dev(o)}, 시작 뒤 약 ${Date.now() - t0}ms, ${floats})`);
        await page.waitForTimeout(3000);
        const quiet = await page.evaluate(() => `body.fever=${document.body.classList.contains('fever')}, fx-float ${document.querySelectorAll('.fx-float').length}개, banner=${document.querySelector('.fx-banner') ? '있음' : '없음'}`);
        await shot(page, `fever-${w}-active`, `${w} 피버 진행 중(탭 없이 3초 뒤, 조용한 순간) (${dev(o)}, ${quiet})`);
        await ctx.close();
      });
      for (const [w, o] of [['1280x880', pc(1280, 880)], ['360', mob(360, 740)]]) await scene(`fever-${w}`, async () => {
        const { ctx, page } = await open(browser, o, SEED);
        await setUn(page, { box: 45, damage: 0, hp: 0, roomDone: false });
        await noCrit(page);
        await set(page, { fever: { gauge: 44.6, activeSec: 0, cooldownSec: 0 } });
        await page.waitForTimeout(300);
        await tap(page, 1); await page.waitForTimeout(3200);
        const quiet = await page.evaluate(() => `body.fever=${document.body.classList.contains('fever')}, fx-float ${document.querySelectorAll('.fx-float').length}개`);
        await shot(page, `fever-${w}-active`, `${w} 피버 진행 중(탭 없이 3초 뒤) (${dev(o)}, ${quiet})`);
        await ctx.close();
      });
    }

    // 8. 배너
    if (run('banner')) for (const [w, o] of [['390', mob(390, 844)], ['1440', pc(1440, 900)]]) {
      await scene(`banner-move-${w}`, async () => {
        const { ctx, page } = await open(browser, o, { ...SEED, points: 4e7, earned: 4e7 });
        await page.waitForTimeout(600);
        await set(page, { points: 6e7, earned: 6e7 });
        await page.waitForFunction(() => { const b = document.querySelector('.fx-banner'); return b && /이사 목표 달성/.test(b.textContent); }, null, { timeout: 5000, polling: 'raf' });
        await page.waitForTimeout(250);
        await shot(page, `banner-move-${w}`, `${w} "이사 목표 달성!" 배너 (${dev(o)})`);
        await ctx.close();
      });
      await scene(`banner-grade-${w}`, async () => {
        const { ctx, page } = await open(browser, o, { ...SEED, services: [3, 0, 0, 0, 0, 0, 0, 0], points: 5e6, earned: 5e6 });
        await page.waitForTimeout(1200);
        await set(page, { services: [60, 40, 30, 25, 0, 0, 0, 0] });
        await page.waitForFunction(() => { const b = document.querySelector('.fx-banner'); return b && /회선 등급/.test(b.textContent); }, null, { timeout: 5000, polling: 'raf' });
        await page.waitForTimeout(250);
        const t = await page.evaluate(() => document.querySelector('.fx-banner').textContent);
        await shot(page, `banner-grade-${w}`, `${w} 회선 등급 배너("${t}") (${dev(o)})`);
        await ctx.close();
      });
    }

    // 9. 상담 요청 칩
    if (run('chip')) {
      await scene('chip-390', async () => {
        const o = mob(390, 844);
        const { ctx, page } = await open(browser, o, SEED);
        await set(page, { event: { nextInSec: 9999, remainSec: 0, streak: 0, bannerSec: 25, question: null, questionSec: 0, result: null } });
        await page.waitForSelector('.event-call:not([hidden])');
        const col = () => page.evaluate(() => getComputedStyle(document.querySelector('.event-call')).backgroundColor);
        const got = new Map();
        const t0 = Date.now();
        while (got.size < 2 && Date.now() - t0 < 8000) {
          const a = await col();
          if (!got.has(a)) {
            const f = `chip-390-${got.size ? 'b' : 'a'}`;
            await page.screenshot({ path: path.join(OUT, `${f}.png`) });
            const b = await col();
            results.push(`re/${f}.png — 390 상담 요청 칩 (${dev(o)}, 촬영 전후 배경색 ${a} -> ${b})`);
            got.set(a, f);
          }
          await sleep(30);
        }
        if (got.size < 2) results.push('(상담 칩 두 색 중 한 색만 잡힘)');
        await ctx.close();
      });
      await scene('chip-1440', async () => {
        const o = pc(1440, 900);
        const { ctx, page } = await open(browser, o, SEED);
        await set(page, { event: { nextInSec: 9999, remainSec: 0, streak: 0, bannerSec: 25, question: null, questionSec: 0, result: null } });
        await page.waitForSelector('.event-call:not([hidden])'); await page.waitForTimeout(300);
        const c = await page.evaluate(() => getComputedStyle(document.querySelector('.event-call')).backgroundColor);
        await shot(page, 'chip-1440', `1440 상담 요청 칩 (${dev(o)}, 배경색 ${c})`);
        await ctx.close();
      });
    }

    // 10. 메인 화면 여러 크기
    if (run('main')) {
      for (const [w, h] of [[1440, 960], [1280, 880], [1920, 1080], [1024, 768]]) await scene(`main-${w}`, async () => {
        const { ctx, page } = await open(browser, pc(w, h), SEED);
        await setUn(page, { box: 45, damage: 0, hp: 0, roomDone: false }); await page.waitForTimeout(600);
        await shot(page, `main-${w}x${h}`, `메인 화면 평소 상태(서비스 4종, 상자 45) (${w}x${h} DPR1)`);
        await ctx.close();
      });
      for (const [w, h] of [[1440, 900], [1024, 768]]) await scene(`main-scroll-${w}`, async () => {
        const { ctx, page } = await open(browser, pc(w, h), FULL);
        await setUn(page, { box: 45, damage: 0, hp: 0, roomDone: false }); await page.waitForTimeout(600);
        const info = await page.evaluate(() => {
          let e = document.querySelector('.card-list');
          while (e && e !== document.body) { const oy = getComputedStyle(e).overflowY; if ((oy === 'auto' || oy === 'scroll') && e.scrollHeight > e.clientHeight) { e.scrollTop = (e.scrollHeight - e.clientHeight) / 2; return `.${e.className} scrollTop=${Math.round(e.scrollTop)}/${e.scrollHeight - e.clientHeight}`; } e = e.parentElement; }
          window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) / 2); return `window scrollY=${scrollY}`;
        });
        await page.waitForTimeout(400);
        await shot(page, `main-scroll-${w}x${h}`, `메인 화면 오른쪽 단 서비스 목록 중간까지 스크롤(서비스 8종) (${w}x${h} DPR1, ${info})`);
        await ctx.close();
      });
    }

    // 11. 집별 방
    if (run('house')) {
      for (let i = 0; i < THEMES.length; i++) await scene(`house-${i}`, async () => {
        const o = mob(390, 844);
        const { ctx, page } = await open(browser, o, { ...SEED, moves: i });
        await setUn(page, { box: 45, damage: 0, hp: 0, roomDone: false }); await page.waitForTimeout(800);
        const nm = await page.locator('.house-name').innerText();
        await shot(page, `house-390-${i + 1}-${THEMES[i]}`, `집 ${i + 1}번째 ${nm} 메인 화면 (moves=${i}, ${dev(o)})`);
        await ctx.close();
      });
      for (const i of [3, 8]) await scene(`house-pc-${i}`, async () => {
        const o = pc(1440, 900);
        const { ctx, page } = await open(browser, o, { ...SEED, moves: i });
        await setUn(page, { box: 45, damage: 0, hp: 0, roomDone: false }); await page.waitForTimeout(800);
        const nm = await page.locator('.house-name').innerText();
        await shot(page, `house-1440-${i + 1}-${THEMES[i]}`, `집 ${i + 1}번째 ${nm} 메인 화면 (moves=${i}, ${dev(o)})`);
        await ctx.close();
      });
    }

    // 12. 새 게임 안내 줄
    if (run('newline')) for (const [w, o] of [['390', mob(390, 844)], ['1440', pc(1440, 900)]]) await scene(`newline-${w}`, async () => {
      const { ctx, page } = await open(browser, o, { ...SEED, unlocked: ['tap', 'bundle'], points: 600, earned: 2500, tapLevel: 1, services: [2, 1, 1, 0, 0, 0, 0, 0] });
      await page.waitForTimeout(500);
      await page.evaluate(() => { const b = [...document.querySelectorAll('.card:not(.locked) .btn.buy:not([disabled])')].filter((x) => x.getBoundingClientRect().height > 0)[0]; if (b) b.click(); });
      await page.waitForTimeout(1500);
      const t = await page.evaluate(() => { const m = [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0 && /다음: /.test(e.textContent || '')); return m.map((e) => `${e.textContent.trim()} visible=${e.getBoundingClientRect().height > 0}`).join(' | ') || '다음: 문구 없음'; });
      await shot(page, `newline-${w}`, `${w} 새 게임 안내 줄(상자 해금 전, 첫 구매 뒤) (${dev(o)}, ${t})`);
      await ctx.close();
    });

    // 묶음 3: 수치
    if (run('measure')) await scene('measure', async () => {
      const lines = [`수치 점검 ${new Date().toISOString()} (SEED 중반: 서비스 4종, 상자 45)`, ''];
      lines.push('[1] 스크롤 높이');
      for (const [w, h] of [[1440, 900], [1280, 880], [1440, 960], [1024, 768]]) {
        const { ctx, page } = await open(browser, pc(w, h), SEED);
        await setUn(page, { box: 45, damage: 0, hp: 0, roomDone: false }); await page.waitForTimeout(600);
        const r = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight, bsh: document.body.scrollHeight }));
        lines.push(`${w}x${h}: documentElement.scrollHeight=${r.sh} innerHeight=${r.ih} 차이=${r.sh - r.ih} body.scrollHeight=${r.bsh} ${r.sh > r.ih ? '넘침(세로 스크롤 생김)' : '넘침 없음'}`);
        await ctx.close();
      }
      lines.push('', '[2] 좌우 정렬(getBoundingClientRect left/right)');
      for (const [w, o] of [[390, mob(390, 844)], [1440, pc(1440, 900)], [1024, pc(1024, 768)]]) {
        const { ctx, page } = await open(browser, o, SEED);
        await setUn(page, { box: 45, damage: 0, hp: 0, roomDone: false }); await page.waitForTimeout(800);
        const r = await page.evaluate(() => {
          const q = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: +b.left.toFixed(2), r: +b.right.toFixed(2), w: +b.width.toFixed(2), vis: b.height > 0 }; };
          return { room: q('.room'), unbar: q('.un-bar'), unrow: (() => { const e = document.querySelector('.un-bar'); if (!e || !e.parentElement) return null; const b = e.parentElement.getBoundingClientRect(); return { l: +b.left.toFixed(2), r: +b.right.toFixed(2), w: +b.width.toFixed(2), vis: b.height > 0, cls: String(e.parentElement.className) }; })(), unchip: q('.un-chip'), moverow: q('.move-row'), bar: q('.move-row .bar'), phone: q('.phone') };
        });
        lines.push(`${w}폭: ` + Object.entries(r).map(([k, v]) => `${k}=${v ? `L${v.l}/R${v.r}(w${v.w}${v.vis ? '' : ',안 보임'})` : '없음'}`).join('  '));
        if (r.room && r.unbar) lines.push(`   방 대비 상자 막대줄 left차=${(r.unbar.l - r.room.l).toFixed(2)} right차=${(r.unbar.r - r.room.r).toFixed(2)}`);
        if (r.room && r.unrow) lines.push(`   방 대비 상자 막대 부모(${r.unrow.cls}) left차=${(r.unrow.l - r.room.l).toFixed(2)} right차=${(r.unrow.r - r.room.r).toFixed(2)}`);
        if (r.room && r.moverow) lines.push(`   방 대비 이사 줄 left차=${(r.moverow.l - r.room.l).toFixed(2)} right차=${(r.moverow.r - r.room.r).toFixed(2)}`);
        if (r.unbar && r.moverow) lines.push(`   상자 막대줄 대비 이사 줄 left차=${(r.moverow.l - r.unbar.l).toFixed(2)} right차=${(r.moverow.r - r.unbar.r).toFixed(2)}`);
        await ctx.close();
      }
      lines.push('', '[3] 도감에서 scrollWidth > clientWidth 인 칸(.dex-cell) 수 (일부 수집 / 가득 수집, 칸 안 자식 요소 넘침 별도)');
      for (const [w, o] of [[360, mob(360, 740)], [390, mob(390, 844)], [430, mob(430, 932)], [1024, pc(1024, 768)], [1440, pc(1440, 900)]]) {
        for (const [nm, col] of [['일부', some], ['가득', all]]) {
          const { ctx, page } = await open(browser, o, { ...SEED, points: 1e6, collection: col });
          await tab(page, '도감'); await page.waitForTimeout(500);
          const r = await page.evaluate(() => {
            const cells = [...document.querySelectorAll('.dex-cell')];
            const bad = cells.filter((c) => c.scrollWidth > c.clientWidth);
            const kids = cells.filter((c) => [...c.querySelectorAll('*')].some((k) => k.clientWidth > 0 && k.scrollWidth > k.clientWidth + 1));
            return { n: cells.length, bad: bad.length, kids: kids.length, ex: bad.slice(0, 3).map((c) => `${(c.getAttribute('aria-label') || '').slice(0, 14)} sw=${c.scrollWidth} cw=${c.clientWidth}`).join('; ') };
          });
          lines.push(`${w}폭 ${nm}: 칸 ${r.n}개 중 넘침 ${r.bad}칸 (자식 요소가 넘치는 칸 ${r.kids}) ${r.ex}`);
          await ctx.close();
        }
      }
      fs.writeFileSync(path.join(AUDIT, 'measure.txt'), lines.join('\n') + '\n');
      console.log(lines.join('\n'));
    });
  } finally {
    await browser.close();
    fs.appendFileSync(path.join(OUT, '_index.txt'), results.join('\n') + (results.length ? '\n' : ''));
    console.log('문제', problems.length ? '\n' + problems.join('\n') : '없음');
  }
})();
