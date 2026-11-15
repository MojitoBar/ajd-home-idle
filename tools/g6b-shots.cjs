// g6b 촬영: 화성 집 판자·받침 색(w2) 확인. 출력 screenshots/g6-fix/b-*.png
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.URL || 'http://localhost:5173';
const OUT = path.join(__dirname, '..', 'screenshots', 'g6-fix');
const mob = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pc = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
const S8 = [20, 12, 11, 10, 9, 8, 7, 6];
const seed = (services, moves, points = 5e6) => ({ unlocked: ['tap', 'bundle', 'box', 'dex', 'move', 'contract', 'mult', 'badge', 'perk'], version: 3, points, earned: points, moves, tapLevel: 3, services, event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], collection: {} });
async function run(browser, o, moves, name) {
  const ctx = await browser.newContext(o);
  await ctx.addInitScript(([k, s, p]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(k, JSON.stringify({ ...s, stats: { totalEarned: 0, playSec: 0, boxesOpened: 0, totalTaps: 500 }, savedAt: Date.now() }));
    localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p));
  }, ['ajd-home-idle:save', seed(S8, moves), { sound: false, music: false, haptics: false }]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(BASE + '/?debug');
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const y = await page.evaluate(() => document.querySelector('.px-shelf').getBoundingClientRect().top);
  await page.screenshot({ path: path.join(OUT, name + '.png'), clip: { x: 0, y: Math.max(0, y - 60), width: o.viewport.width, height: 130 } });
  console.log(name, await page.evaluate(() => getComputedStyle(document.querySelector('.px-plank')).borderBottomColor));
  await ctx.close();
}
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    await run(browser, mob(390, 844), 5, 'b-house-390-6-mars');
    await run(browser, mob(360, 800), 5, 'b-house-360-6-mars');
    await run(browser, pc(1440, 900), 5, 'b-house-1440-6-mars');
    await run(browser, mob(390, 844), 0, 'b-house-390-1-blue');
    await run(browser, mob(390, 844), 6, 'b-house-390-7-jupiter');
  } finally { await browser.close(); }
})();
