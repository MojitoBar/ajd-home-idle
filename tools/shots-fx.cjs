// 이펙트 프레임 촬영: node tools/shots-fx.cjs  -> screenshots/final/fx-{crit,boom,fever,ten,move}.png (390폭, DPR2). 격리 Aside 9333 + preview 4173.
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.URL || 'http://localhost:4173';
const OUT = path.join(__dirname, '..', 'screenshots', 'final');
const MOB = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const SEED = { version: 3, points: 5e15, earned: 5e15, moves: 0, tapLevel: 12, services: [20, 12, 11, 10, 0, 0, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], collection: {} };
async function open(browser, seed) {
  const ctx = await browser.newContext(MOB);
  await ctx.addInitScript(([s]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('ajd-home-idle:save', JSON.stringify({ ...s, savedAt: Date.now() }));
    localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify({ sound: false, music: false, haptics: false }));
  }, [seed]);
  const page = await ctx.newPage();
  await page.goto(BASE + '/?debug');
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  return { ctx, page };
}
const setUn = (page, u) => page.evaluate((x) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, unpack: { ...s.unpack, ...x } }); }, u);
const tapJs = (crit) => `(() => { const b = document.querySelector('.phone'); const r = b.getBoundingClientRect(); const o = Math.random; ${crit ? 'Math.random = () => 0.001;' : ''} b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1, isPrimary: true })); b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1, isPrimary: true })); Math.random = o; })()`;
const shot = (page, n) => page.screenshot({ path: path.join(OUT, `fx-${n}.png`) });
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  let { ctx, page } = await open(browser, SEED);
  await setUn(page, { box: 9, damage: 0, roomDone: false });
  await page.waitForTimeout(300);
  await page.evaluate(tapJs(true)); await page.waitForTimeout(170); await shot(page, 'crit');
  await page.waitForTimeout(1200);
  await setUn(page, { box: 9, damage: 1e15 });
  await page.evaluate(tapJs(false)); await page.waitForTimeout(260); await shot(page, 'boom');
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, fever: { ...s.fever, activeSec: 12 } }); });
  await page.waitForTimeout(700); await shot(page, 'fever');
  await ctx.close();
  ({ ctx, page } = await open(browser, { ...SEED, points: 1e9 }));
  await page.locator('.tab', { hasText: '상자' }).click();
  await page.evaluate(() => document.querySelector('.box-hero').scrollIntoView({ block: 'start' }));
  await page.locator('.box-ten').click();
  await page.waitForSelector('.bs-actions:not(.lock)', { timeout: 20000 });
  await page.waitForTimeout(300); await shot(page, 'ten');
  await ctx.close();
  ({ ctx, page } = await open(browser, { ...SEED, points: 8e7, earned: 8e7 }));
  await page.locator('.move-btn').click(); await page.locator('.modal .btn.primary').click();
  await page.waitForSelector('.move-scene'); await page.waitForTimeout(1000); await shot(page, 'move');
  await ctx.close(); await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
