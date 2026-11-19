// 연쇄 연출 촬영(ONLY=이름,이름 으로 일부만). 전제: 개발 서버 localhost:5173, 격리 Aside CDP 9333. 출력 screenshots/chain/
// 재생 중 장면은 setTimeout을 SLOW배로 늘려(연쇄 간격만) 원하는 숫자에서 찍는다. 화면 효과(WAAPI)는 실시간이다
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = process.env.URL || 'http://localhost:5173';
const OUT = path.join(__dirname, '..', 'screenshots', 'boxloop');
fs.mkdirSync(OUT, { recursive: true });
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const mob = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const cfgs = { m390: mob(390, 844), m360: mob(360, 760), pc: { viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 } };
const seed = () => ({ unlocked: ['tap', 'bundle', 'box', 'dex', 'move', 'contract', 'mult', 'badge', 'perk'], version: 3, points: 5e6, earned: 5e6, moves: 0, tapLevel: 3, services: [20, 12, 11, 10, 9, 8, 7, 6], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], collection: {}, stats: { totalEarned: 0, playSec: 0, boxesOpened: 0, totalTaps: 500 } });
async function open(browser, o) {
  const ctx = await browser.newContext(o);
  await ctx.addInitScript(([k, s, p]) => {
    window.__slow = 1;
    const st = window.setTimeout.bind(window);
    window.setTimeout = (f, ms, ...a) => st(f, (ms || 0) * (ms >= 30 && ms <= 140 ? window.__slow : 1), ...a);
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(k, JSON.stringify({ ...s, savedAt: Date.now() }));
    localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p));
  }, ['ajd-home-idle:save', seed(), { sound: false, music: false, haptics: false, chargeDone: true, weakDone: true }]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(BASE + '/?debug');
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  await page.evaluate(() => { window.scrollTo(0, 0); });
  return { ctx, page };
}
const roomClip = async (page, o) => {
  const b = await page.locator('.room').boundingBox();
  return { x: Math.max(0, b.x), y: Math.max(0, b.y - 10), width: Math.min(o.viewport.width, b.width), height: Math.min(o.viewport.height - Math.max(0, b.y - 10), b.height + 20) };
};
const until = (page, n) => page.waitForFunction((n) => window.__ajd.getChain().n >= n, n, { timeout: 15000, polling: 10 });
const done = (page) => page.waitForFunction(() => !window.__ajd.getChain().playing, null, { timeout: 15000, polling: 10 });

const ns = (process.env.NS || '10,40,100,1700,20000').split(',').map(Number);
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    for (const n of ns) {
      const o = cfgs.m390;
      const { ctx, page } = await open(browser, o);
      await page.evaluate(() => { const g = window.__ajd.get(); window.__ajd.set({ ...g, tapLevel: 200, unpack: { ...g.unpack, box: 30 } }); });
      await page.waitForTimeout(500);
      const b0 = await page.evaluate(() => window.__ajd.get().unpack.box);
      const p0 = await page.evaluate(() => window.__ajd.get().points);
      const r = await page.evaluate(async (n) => {
        window.__ajd.chain(n);
        const t0 = performance.now();
        let maxLong = 0, last = t0, frames = 0;
        while (window.__ajd.getChain().playing && performance.now() - t0 < 30000) { await new Promise((r) => requestAnimationFrame(r)); const t = performance.now(); maxLong = Math.max(maxLong, t - last); last = t; frames++; }
        return { ms: Math.round(performance.now() - t0), maxFrame: Math.round(maxLong), frames, info: window.__ajd.getChain(), txt: document.querySelector('.un-chain')?.textContent, part: window.__ajd.particles() };
      }, n);
      const g = await page.evaluate(() => window.__ajd.get());
      console.log(n, JSON.stringify(r), 'box+', g.unpack.box - b0, 'pts+', g.points - p0);
      await ctx.close();
    }
  } finally { await browser.close(); }
})();
