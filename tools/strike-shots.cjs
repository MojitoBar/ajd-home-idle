// 강타 힘 카드 촬영(ONLY=이름,이름 으로 일부만). 전제: 개발 서버 localhost:5173, 격리 Aside CDP 9333. 출력 screenshots/strike/
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = process.env.URL || 'http://localhost:5173';
const OUT = path.join(__dirname, '..', 'screenshots', 'strike');
fs.mkdirSync(OUT, { recursive: true });
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const mob = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const cfgs = { m390: mob(390, 844), m360: mob(360, 760), pc: { viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 } };
const seed = () => ({ unlocked: ['tap', 'bundle', 'box', 'dex', 'move', 'contract', 'mult', 'badge', 'perk'], version: 3, points: 5e6, earned: 5e6, moves: 0, tapLevel: 3, strikeLevel: 0, bestChain: 0, services: [20, 12, 11, 10, 9, 8, 7, 6], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], collection: {}, stats: { totalEarned: 0, playSec: 0, boxesOpened: 0, totalTaps: 500 } });
async function open(browser, o, extra) {
  const ctx = await browser.newContext(o);
  await ctx.addInitScript(([k, s, p]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(k, JSON.stringify({ ...s, savedAt: Date.now() }));
    localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p));
  }, ['ajd-home-idle:save', { ...seed(), ...extra }, { sound: false, music: false, haptics: false, chargeDone: true, weakDone: true }]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(BASE + '/?debug');
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  await page.click('[data-ux=tap]');
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('.strike-card').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  return { ctx, page };
}
const SCENES = {
  lv0: { extra: {}, act: async () => {} },
  lv7: { extra: {}, act: async (page) => { await page.evaluate(() => { const g = window.__ajd.get(); window.__ajd.set({ ...g, strikeLevel: 7, bestChain: 14, points: 0, services: g.services.map(() => 0), tapLevel: 0 }); }); await page.waitForTimeout(500); } },
  buy: { extra: {}, act: async (page) => { await page.click('.strike-card .btn.buy'); await page.waitForTimeout(110); } },
};
const JOBS = [['m390', 'lv0'], ['m390', 'lv7'], ['m390', 'buy'], ['m360', 'lv0'], ['m360', 'lv7'], ['pc', 'lv0'], ['pc', 'lv7']];
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    for (const [cfg, sc] of JOBS) {
      const name = `${cfg}-${sc}`;
      if (only && !only.includes(name)) continue;
      const { ctx, page } = await open(browser, cfgs[cfg], SCENES[sc].extra);
      await SCENES[sc].act(page);
      await page.screenshot({ path: path.join(OUT, `${name}.png`) });
      console.log(name, JSON.stringify(await page.evaluate(() => { const g = window.__ajd.get(); return [g.strikeLevel, g.points]; })), await page.evaluate(() => document.querySelector('.strike-card').innerText.replace(/\n/g, ' | ')));
      await ctx.close();
    }
  } finally { await browser.close(); }
})();
