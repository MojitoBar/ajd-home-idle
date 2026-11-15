// g5 수정 촬영: 구매 +N/초 칩 / 이사 목표 달성 버튼 연출. ONLY=buy,move. 출력 screenshots/g5-fix/
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.URL || 'http://localhost:5173';
const OUT = path.join(__dirname, '..', 'screenshots', 'g5-fix');
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const run = (g) => !only || only.includes(g);
const mob = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pc = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
const SEED = { unlocked: ['tap', 'bundle', 'box', 'dex', 'move', 'contract', 'mult', 'badge', 'perk'], version: 3, points: 5e6, earned: 5e6, moves: 0, tapLevel: 3, services: [20, 12, 11, 10, 0, 0, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], collection: {} };
const BIG = { ...SEED, points: 9e15, earned: 9e15, services: [60, 40, 30, 25, 0, 0, 0, 0] };
const HUGE = { ...SEED, points: 1e60, earned: 1e60, services: [500, 400, 300, 250, 0, 0, 0, 0] };
const PREFS = { sound: false, music: false, haptics: false };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function open(browser, o, seed) {
  const ctx = await browser.newContext(o);
  await ctx.addInitScript(([k, s, p]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(k, JSON.stringify({ ...s, stats: { totalEarned: 0, playSec: 0, boxesOpened: 0, totalTaps: 500 }, savedAt: Date.now() }));
    localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p));
  }, ['ajd-home-idle:save', seed, PREFS]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(BASE + '/?debug');
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  return { ctx, page };
}
const set = (page, patch) => page.evaluate((pt) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, ...pt }); }, patch);
const buyClick = (page, i) => page.evaluate((idx) => document.querySelectorAll('.card-list .card')[idx].querySelector('button.buy').click(), i);
const probe = (page, idx) => page.evaluate((i) => {
  const t = document.querySelector('.fx-float.buy-gain'); if (!t) return 'none';
  const c = document.querySelectorAll('.card-list .card')[i];
  const R = (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map(Math.round); };
  const tr = (e) => { const g = document.createRange(); g.selectNodeContents(e); const r = g.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map(Math.round); };
  return JSON.stringify({ chip: R(t), text: t.textContent, card: R(c), name: R(c.querySelector('.card-name')), lv: R(c.querySelector('.card-lv')), info: tr(c.querySelector('.card-info')), btn: R(c.querySelector('button.buy')), ms: tr(c.querySelector('.ms-label')) });
}, idx);
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    if (run('buy')) {
      const cfg = [['360', mob(360, 740), SEED], ['390', mob(390, 844), SEED], ['430', mob(430, 932), SEED], ['1440', pc(1440, 900), SEED], ['390big', mob(390, 844), BIG], ['360huge', mob(360, 740), HUGE], ['390huge', mob(390, 844), HUGE]];
      for (const [w, o, seed] of cfg) for (const idx of [0, 1]) {
        const { ctx, page } = await open(browser, o, seed);
        for (const ms of [80, 200, 400]) {
          await page.evaluate((i) => document.querySelectorAll('.card-list .card')[i].scrollIntoView({ block: 'center' }), idx);
          await page.waitForTimeout(250);
          await buyClick(page, idx); const t0 = Date.now();
          const w0 = ms - 40 - (Date.now() - t0); if (w0 > 0) await sleep(w0);
          await page.screenshot({ path: path.join(OUT, `buy-${w}-c${idx}-${ms}.png`) });
          console.log('buy', w, idx, ms, await probe(page, idx));
          await page.waitForTimeout(1200);
        }
        await ctx.close();
      }
    }
    if (run('move')) {
      for (const [w, o] of [['390', mob(390, 844)], ['1440', pc(1440, 960)]]) {
        const { ctx, page } = await open(browser, o, { ...SEED, points: 4e7, earned: 4e7 });
        await page.waitForTimeout(600);
        await set(page, { points: 6e7, earned: 6e7 });
        await page.waitForFunction(() => { const b = document.querySelector('.fx-banner'); return b && /이사 목표 달성/.test(b.textContent); }, null, { timeout: 5000, polling: 'raf' });
        const t0 = Date.now();
        for (const ms of [80, 200, 400]) {
          const w0 = ms - 40 - (Date.now() - t0); if (w0 > 0) await sleep(w0);
          await page.screenshot({ path: path.join(OUT, `move-${w}-${ms}.png`) });
          console.log('move', w, ms, Date.now() - t0, await page.evaluate(() => { const r = document.querySelector('.move-btn').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map(Math.round).join(','); }));
        }
        await ctx.close();
      }
    }
  } finally { await browser.close(); }
})();
