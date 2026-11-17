// 연속 퍼펙트 배수 촬영(ONLY=이름,이름 으로 일부만). 전제: 개발 서버 localhost:5173, 격리 Aside CDP 9333. 출력 screenshots/streak/
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = process.env.URL || 'http://localhost:5173';
const OUT = path.join(__dirname, '..', 'screenshots', 'streak');
fs.mkdirSync(OUT, { recursive: true });
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const mob = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const pc = { viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 };
const seed = () => ({ unlocked: ['tap', 'bundle', 'box', 'dex', 'move', 'contract', 'mult', 'badge', 'perk'], version: 3, points: 5e6, earned: 5e6, moves: 0, tapLevel: 3, services: [20, 12, 11, 10, 9, 8, 7, 6], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], collection: {}, stats: { totalEarned: 0, playSec: 0, boxesOpened: 0, totalTaps: 500 } });
async function open(browser, o) {
  const ctx = await browser.newContext(o);
  await ctx.addInitScript(([k, s, p]) => {
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
  await page.evaluate(() => { window.scrollTo(0, 0); window.__ajd.special(null); window.__ajd.zone(0.5); });
  await page.waitForTimeout(300);
  return { ctx, page };
}
const clip = async (page, o) => {
  const b = await page.locator('.room').boundingBox();
  return { x: Math.max(0, b.x), y: Math.max(0, b.y - 10), width: Math.min(o.viewport.width, b.width), height: Math.min(o.viewport.height - Math.max(0, b.y - 10), b.height + 20) };
};
const at = (page, t) => page.evaluate((t) => new Promise((r) => { const f = () => (performance.now() - window.__t0 >= t ? r() : setTimeout(f, 4)); f(); }), t);
// 장면: 연속 수 n, 판정 위치 pos(0.5 퍼펙트, 0.05 빗맞힘), 촬영 시각들
const SHOTS = [
  { name: 'm-x1.5', cfg: mob, n: 1, pos: 0.5, ms: [200] },
  { name: 'm-x3', cfg: mob, n: 4, pos: 0.5, ms: [200] },
  { name: 'm-x10', cfg: mob, n: 18, pos: 0.5, ms: [200, 900] },
  { name: 'm-break', cfg: mob, n: 8, pos: 0.05, ms: [120] },
  { name: 'm-hold', cfg: mob, n: 8, hold: true, ms: [0] },
  { name: 'pc-x10', cfg: pc, n: 18, pos: 0.5, ms: [200] },
];
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    for (const s of SHOTS) {
      if (only && !only.includes(s.name)) continue;
      const { ctx, page } = await open(browser, s.cfg);
      await page.evaluate((n) => window.__ajd.streak(n), s.n);
      await page.waitForTimeout(300);
      await page.evaluate((s) => { window.__t0 = performance.now(); if (s.hold) window.__ajd.holdAt(0.3); else window.__ajd.charge(s.pos); }, s);
      for (const t of s.ms) {
        await at(page, t);
        await page.screenshot({ path: path.join(OUT, `${s.name}-${t}.png`), clip: await clip(page, s.cfg) });
      }
      console.log(s.name, JSON.stringify(await page.evaluate(() => window.__ajd.textBoxes().map((b) => b.kind + ':' + b.text))));
      await ctx.close();
    }
  } finally { await browser.close(); }
})();
