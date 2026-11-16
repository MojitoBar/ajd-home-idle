// 열기 게이지·연출 촬영(ONLY=이름,이름 으로 일부만). 전제: 개발 서버 localhost:5173, 격리 Aside CDP 9333. 출력 screenshots/heat/
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = process.env.URL || 'http://localhost:5173';
const OUT = path.join(__dirname, '..', 'screenshots', 'heat');
fs.mkdirSync(OUT, { recursive: true });
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const mob = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const cfgs = { m390: mob(390, 844), pc: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, m360: mob(360, 740) };
const seed = (taps) => ({ unlocked: ['tap', 'bundle', 'box', 'dex', 'move', 'contract', 'mult', 'badge', 'perk'], version: 3, points: 5e6, earned: 5e6, moves: 0, tapLevel: 3, services: [20, 12, 11, 10, 9, 8, 7, 6], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], collection: {}, stats: { totalEarned: 0, playSec: 0, boxesOpened: 0, totalTaps: taps } });
async function open(browser, o, taps) {
  const ctx = await browser.newContext(o);
  await ctx.addInitScript(([k, s, p]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(k, JSON.stringify({ ...s, savedAt: Date.now() }));
    localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p));
  }, ['ajd-home-idle:save', seed(taps), { sound: false, music: false, haptics: false, chargeDone: true, weakDone: true }]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(BASE + '/?debug');
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  await page.evaluate(() => { window.scrollTo(0, 0); });
  return { ctx, page };
}
const roomClip = async (page, o, extra = 0) => {
  const b = await page.locator('.room').boundingBox();
  return { x: Math.max(0, b.x), y: Math.max(0, b.y - 10), width: Math.min(o.viewport.width, b.width), height: Math.min(o.viewport.height - Math.max(0, b.y - 10), b.height + 20 + extra) };
};
const SHOTS = {
  '1-idle50': async (page) => { await page.evaluate(() => window.__ajd.heat(50)); await page.waitForTimeout(400); },
  '2-hold85': async (page) => { await page.evaluate(() => { window.__ajd.heat(85); window.__ajd.holdAt(0.4); }); await page.waitForTimeout(400); },
  '3-hot-enter': async (page) => { await page.evaluate(() => window.__ajd.heat(66)); await page.waitForTimeout(300); await page.evaluate(() => window.__ajd.heat(72)); await page.waitForTimeout(40); },
  '4-warn95': async (page) => { await page.evaluate(() => window.__ajd.heat(95)); await page.waitForTimeout(420); },
  '5-over-a': async (page) => { await page.evaluate(() => window.__ajd.heat(100)); await page.waitForTimeout(60); },
  '5-over-b': async (page) => { await page.evaluate(() => window.__ajd.heat(100)); await page.waitForTimeout(1500); },
  '6-strike90': async (page) => { await page.evaluate(() => { window.__ajd.heat(90); const z = window.__ajd.getZone().perfect; window.__ajd.charge((z[0] + z[1]) / 2); }); await page.waitForTimeout(260); },
  '7-tip': async (page) => { await page.evaluate(() => window.__ajd.heat(66)); await page.waitForTimeout(300); await page.evaluate(() => window.__ajd.heat(72)); await page.waitForTimeout(700); },
  '8-tip-charge': async (page) => { await page.evaluate(() => { window.__ajd.heat(40); window.__ajd.tip(); }); await page.waitForTimeout(400); },
};
const JOBS = [['m390', '1-idle50'], ['m390', '2-hold85'], ['m390', '3-hot-enter'], ['m390', '4-warn95'], ['m390', '5-over-a'], ['m390', '5-over-b'], ['m390', '6-strike90'], ['m390', '7-tip'], ['m390', '8-tip-charge'], ['pc', '2-hold85'], ['pc', '5-over-a'], ['m360', '6-strike90']];
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    for (const [cfg, sh] of JOBS) {
      const name = cfg === 'm390' ? sh : `${cfg}-${sh}`;
      if (only && !only.includes(name)) continue;
      const o = cfgs[cfg];
      const { ctx, page } = await open(browser, o, 500);
      await SHOTS[sh](page);
      await page.screenshot({ path: path.join(OUT, `${name}.png`), clip: await roomClip(page, o) });
      await ctx.close();
    }
  } finally { await browser.close(); }
})();
