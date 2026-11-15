// 수집품 그림 스크린샷. 전제: vite preview 4173, 격리 Aside CDP 9333. 결과는 screenshots/col-*.png
const { chromium } = require('playwright');
const path = require('path');
const URL = 'http://localhost:4173';
const KEY = 'ajd-home-idle:save';
const SHOTS = path.join(__dirname, '..', 'screenshots');
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const IDS = ['fan', 'kettle', 'toaster', 'heating_pad', 'hair_dryer', 'humidifier', 'rice_cooker', 'water_purifier', 'air_purifier', 'air_fryer', 'vacuum', 'coffee_machine', 'dishwasher', 'air_conditioner', 'washer', 'smart_tv', 'fridge', 'massage_chair', 'robot_vacuum', 'space_purifier'];
const V4 = { version: 3, points: 5e12, earned: 5e12, moves: 0, tapLevel: 12, services: [20, 12, 11, 10, 0, 0, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [] };
const full = {}; IDS.forEach((id, i) => (full[id] = { base: 1 + (i % 3), shiny: 1, gold: 1, rainbow: 1 }));
const part = {}; IDS.forEach((id, i) => (part[id] = { base: i % 2 ? 1 : 0, shiny: i % 3 === 0 ? 1 : 0, gold: i % 4 === 0 ? 1 : 0, rainbow: i % 5 === 0 ? 1 : 0 }));
async function open(browser, seed) {
  const ctx = await browser.newContext(MOBILE);
  await ctx.addInitScript(([k, s]) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem(k, JSON.stringify({ ...s, savedAt: Date.now() })); localStorage.setItem('ajd-home-idle:prefs', JSON.stringify({ sound: false, music: false, haptics: false })); }, [KEY, seed]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(URL + '?debug');
  await page.waitForSelector('.phone');
  return { ctx, page };
}
const shot = (page, n, o = {}) => page.screenshot({ path: path.join(SHOTS, n), ...o });
const dex = async (page) => { await page.locator('.tab', { hasText: '도감' }).click(); await page.waitForTimeout(1200); };
const pickCell = async (page, row, col) => { await page.locator('.dex-row').nth(row).locator('.dex-cell').nth(col).click(); await page.waitForSelector('.modal'); await page.waitForTimeout(500); };
const closeModal = async (page) => { await page.locator('.modal-x').click(); await page.waitForTimeout(300); };
async function boxOnce(page, q) {
  await page.evaluate((qq) => { const o = Math.random; window.__q = qq; Math.random = () => (window.__q.length ? window.__q.shift() : o()); }, q);
  await page.locator('.tab', { hasText: '상자' }).click();
  await page.locator('.box-open').click();
  await page.waitForSelector('.bs-card', { timeout: 9000 });
  await page.waitForTimeout(900);
}
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    let ctx, page;
    ({ ctx, page } = await open(browser, { ...V4, collection: full })); await dex(page);
    await shot(page, 'col-01-dex-full-a.png');
    await page.evaluate(() => window.scrollTo(0, 700)); await page.waitForTimeout(600); await shot(page, 'col-02-dex-full-b.png');
    await page.evaluate(() => window.scrollTo(0, 1500)); await page.waitForTimeout(600); await shot(page, 'col-03-dex-full-c.png');
    await page.evaluate(() => window.scrollTo(0, 0));
    for (const [i, v] of ['base', 'shiny', 'gold', 'rainbow'].entries()) { await pickCell(page, 3, i); await shot(page, `col-04-detail-${v}.png`); await closeModal(page); }
    await ctx.close();
    ({ ctx, page } = await open(browser, { ...V4, collection: part })); await dex(page);
    await shot(page, 'col-05-dex-part-a.png');
    await page.evaluate(() => window.scrollTo(0, 800)); await page.waitForTimeout(500); await shot(page, 'col-06-dex-part-b.png');
    await page.evaluate(() => window.scrollTo(0, 0));
    await pickCell(page, 1, 1); await shot(page, 'col-07-detail-silhouette.png'); await closeModal(page);
    await ctx.close();
    ({ ctx, page } = await open(browser, { ...V4, points: 1e15, earned: 1e15, collection: {} }));
    await boxOnce(page, [0.1, 0.1, 0.1]); await shot(page, 'col-08-box-common.png'); await page.locator('.bs-actions .btn.primary').click(); await page.waitForTimeout(400);
    await boxOnce(page, [0.93, 0.5, 0.9]); await shot(page, 'col-09-box-legend-shiny.png'); await page.locator('.bs-actions .btn.primary').click(); await page.waitForTimeout(400);
    await boxOnce(page, [0.9985, 0.5, 0.99]); await shot(page, 'col-10-box-myth-gold.png'); await page.locator('.bs-actions .btn.primary').click(); await page.waitForTimeout(400);
    await page.locator('.box-ten').click(); await page.waitForSelector('.sum-grid', { timeout: 15000 }); await page.waitForTimeout(900); await shot(page, 'col-11-ten.png');
    await ctx.close();
    ({ ctx, page } = await open(browser, { ...V4, moves: 4, earned: 9e15, points: 9e15, collection: full }));
    await page.waitForTimeout(800);
    console.log('theme', await page.evaluate(() => document.body.dataset.theme));
    await dex(page); await shot(page, 'col-12-dark-dex.png');
    await ctx.close();
  } catch (e) { console.log('ERR', e.message); } finally { await browser.close(); }
})();
