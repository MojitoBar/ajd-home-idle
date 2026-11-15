// 모바일 독 스크린샷. 전제: vite preview 4173, 격리 Aside(헤드리스) CDP 9333.
const { chromium } = require('playwright');
const path = require('path');
const URL = 'http://localhost:4173';
const KEY = 'ajd-home-idle:save';
const SHOTS = path.join(__dirname, '..', 'screenshots');
const V4 = { version: 3, points: 5e8, earned: 5e8, moves: 0, tapLevel: 12, services: [20, 12, 11, 10, 6, 3, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [] };
async function open(browser, seed, vp = { width: 390, height: 844 }, q = '?debug') {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(([k, s]) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem(k, JSON.stringify({ ...s, savedAt: Date.now() })); }, [KEY, seed]);
  const page = await ctx.newPage();
  await page.goto(URL + q);
  await page.waitForSelector('.phone');
  await page.waitForTimeout(700);
  return { ctx, page };
}
const shot = (page, n) => page.screenshot({ path: path.join(SHOTS, `m-${n}.png`) });
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  let { ctx, page } = await open(browser, V4);
  await shot(page, '01-main');
  const n = await page.evaluate(() => [...document.querySelectorAll('.card .buy')].filter((b) => { const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= document.querySelector('.dock-band').getBoundingClientRect().top && !b.disabled || false; }).length);
  console.log('first-screen buy buttons', n);
  await page.evaluate(() => window.scrollTo(0, 760)); await page.waitForTimeout(500);
  await shot(page, '02-scrolled');
  // 독 전화 탭
  const p0 = await page.evaluate(() => window.__ajd.get().points);
  const bb = await page.locator('.dock-phone').boundingBox();
  await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.waitForTimeout(160);
  await shot(page, '03-dock-tap');
  console.log('dock tap points', p0 < await page.evaluate(() => window.__ajd.get().points));
  await page.evaluate(() => window.scrollTo(0, 1e5)); await page.waitForTimeout(400);
  await shot(page, '04-last-card');
  await page.evaluate(() => window.scrollTo(0, 0));
  for (const [t, nme] of [['탭 강화', '05-tap'], ['상자', '06-box'], ['도감', '07-dex']]) { await page.locator('.tab', { hasText: t }).click(); await page.waitForTimeout(400); await shot(page, nme); }
  await page.locator('.tab', { hasText: '서비스' }).click(); await page.waitForTimeout(300);
  await page.locator('.contract-btn:visible').first().click(); await page.waitForSelector('.ct-opt'); await page.waitForTimeout(500); await shot(page, '08-sheet-contract');
  await page.mouse.click(195, 30); await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('button[aria-label="설정"]').click(); await page.waitForTimeout(500); await shot(page, '09-sheet-settings');
  await ctx.close();
  ({ ctx, page } = await open(browser, { ...V4, points: 1e20, earned: 1e20 }));
  await page.locator('.move-btn').click({ force: true }); await page.waitForSelector('.modal'); await page.waitForTimeout(500); await shot(page, '10-sheet-move');
  await ctx.close();
  ({ ctx, page } = await open(browser, { ...V4, moves: 2, perks: { tap_power: 1 }, perkOffers: [['tap_power', 'svc_power', 'bundle_boost']] }));
  await page.locator('.perk-alert').click(); await page.waitForSelector('.pcards'); await page.waitForTimeout(1800); await shot(page, '11-sheet-perk');
  await ctx.close();
  ({ ctx, page } = await open(browser, { ...V4, event: { nextInSec: 0.3, remainSec: 0, streak: 0 } }));
  await page.waitForSelector('.event-call:not([hidden])', { timeout: 6000 }); await page.waitForTimeout(500); await shot(page, '12-event');
  await ctx.close();
  ({ ctx, page } = await open(browser, { ...V4, moves: 5 }));
  await shot(page, '13-dark');
  await page.locator('.tab', { hasText: '도감' }).click(); await page.waitForTimeout(400); await shot(page, '14-dark-dex');
  await ctx.close();
  for (const [w, h] of [[360, 740], [430, 932]]) { ({ ctx, page } = await open(browser, V4, { width: w, height: h })); await shot(page, `15-main-${w}`); console.log(w, 'noHScroll', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'dock', JSON.stringify(await page.evaluate(() => { const r = document.querySelector('.dock').getBoundingClientRect(); const s = document.querySelector('.seg').getBoundingClientRect(); return [r.left, r.right, s.right]; }))); await ctx.close(); }
  ({ ctx, page } = await open(browser, { ...V4, points: 1e12, earned: 1e12 }));
  await page.locator('.tab', { hasText: '상자' }).click(); await page.waitForTimeout(300);
  await page.locator('.box-ten').click(); await page.waitForTimeout(500);
  for (let i = 0; i < 14 && !(await page.locator('.sum-cell').count()); i++) { await page.mouse.click(195, 400); await page.waitForTimeout(700); }
  await page.waitForTimeout(800); await shot(page, '16-ten-result');
  await ctx.close();
  await browser.close();
})();
