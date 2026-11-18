// 새 수치 화면 사진(g7). 전제: 개발 서버 localhost:5173, 격리 Aside CDP 9333. 출력 screenshots/boxloop/g7-*.png
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = process.env.URL || 'http://localhost:5173';
const OUT = path.join(__dirname, '..', 'screenshots', 'boxloop');
fs.mkdirSync(OUT, { recursive: true });
const prefs = { sound: false, music: false, haptics: false };
const mob = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
async function open(browser, qs) {
  const ctx = await browser.newContext(mob);
  await ctx.addInitScript((pp) => localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(pp)), prefs);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(BASE + qs);
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page };
}
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    let { ctx, page } = await open(browser, '/');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT, 'g7-m-new.png') });
    await ctx.close();
    ({ ctx, page } = await open(browser, '/?debug&guide'));
    await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, guide: { step: 11, n: 0, done: false }, earned: 2e10, points: 1e11, tapLevel: 40, unpack: { ...s.unpack, box: 70 } }); });
    await page.waitForTimeout(6000);
    await page.evaluate(() => { document.querySelector('.gear-card:not([hidden])')?.scrollIntoView({ block: "center" }); });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, 'g7-m-gear.png') });
    await ctx.close();
  } finally {
    await browser.close();
  }
})();
