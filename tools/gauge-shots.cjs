// 게이지 띠 사진(c3: PC 방 2배·높이 1020 이상 한 줄 게이지 띠). 전제: 개발 서버 localhost:5173, 격리 Aside CDP 9333. 출력 screenshots/boxloop/c3-*.png
// 사진: c3-pc1080-idle · c3-pc1080-charging(피버+연속+열기) · c3-pc1080-perfect · c3-pc1200-charging · c3-pc900-charging
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = process.env.URL || 'http://localhost:5173';
const OUT = path.join(__dirname, '..', 'screenshots', 'boxloop');
fs.mkdirSync(OUT, { recursive: true });
const PREFS = { sound: false, music: false, haptics: false, chargeDone: true, weakDone: true };
const M390 = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const M640 = { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const pc = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
const ALL = ['tap', 'home', 'box', 'dex', 'move', 'mult', 'badge', 'perk'];
const setup = (p) => p.evaluate((u) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, points: 5e7, earned: 3e7, tapLevel: 30, strikeLevel: 8, unlocked: u, stats: { ...s.stats, totalTaps: 300, boxesOpened: 12 }, gear: { level: 5, helmet: 3, crowbar: 3, awl: 2, loupe: 4 } }); }, ALL);
async function open(browser, cfg, qs = '?debug') {
  const ctx = await browser.newContext(cfg);
  await ctx.addInitScript((p) => localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p)), PREFS);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(BASE + '/' + qs);
  await page.waitForTimeout(2500);
  return { ctx, page };
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    for (const [w, h, tag] of [[1440, 900, 'pc900'], [1920, 1080, 'pc1080'], [1920, 1200, 'pc1200']]) {
      let { ctx, page } = await open(browser, pc(w, h));
      await setup(page); await page.waitForTimeout(800);
      if (tag === 'pc1080') await shot(page, 'c3-pc1080-idle');
      await page.evaluate(() => { window.__ajd.streak(3); window.__ajd.heat(75); window.__ajd.fever(); window.__ajd.holdAt(0.7); });
      await page.waitForTimeout(500);
      await shot(page, `c3-${tag}-charging`);
      if (tag === 'pc1080') {
        await page.evaluate(() => window.__ajd.release());
        await ctx.close();
        ({ ctx, page } = await open(browser, pc(w, h)));
        await setup(page); await page.waitForTimeout(800);
        await page.evaluate(() => { window.__ajd.streak(2); window.__ajd.zone(0.5); window.__ajd.heat(40); window.__ajd.holdAt(0.5); });
        await page.waitForTimeout(150);
        await page.evaluate(() => window.__ajd.release());
        await page.waitForTimeout(330);
        await shot(page, 'c3-pc1080-perfect');
      }
      await ctx.close();
    }
  } finally { await browser.close(); }
})();
