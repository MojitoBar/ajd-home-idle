// 독 구조 스크린샷(d-01~). 전제: vite preview 4173, 격리 Aside(헤드리스) CDP 9333.
const { chromium } = require('playwright');
const path = require('path');
const URL = 'http://localhost:4173';
const KEY = 'ajd-home-idle:save';
const SHOTS = path.join(__dirname, '..', 'screenshots');
const V4 = { version: 3, points: 5e8, earned: 5e8, moves: 0, tapLevel: 12, services: [20, 12, 11, 10, 6, 3, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [] };
async function open(browser, seed, vp = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(([k, s]) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem(k, JSON.stringify({ ...s, savedAt: Date.now() })); }, [KEY, seed]);
  const page = await ctx.newPage();
  await page.goto(URL + '?debug');
  await page.waitForSelector('.phone');
  await page.waitForTimeout(700);
  return { ctx, page };
}
const shot = (page, n) => page.screenshot({ path: path.join(SHOTS, `d-${n}.png`) });
// 독 띠 위쪽 경계에 걸친 구매 버튼이 있는 스크롤 위치를 y 오프셋별로 찾는다
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  let { ctx, page } = await open(browser, V4);
  await shot(page, '01-main');
  for (const [i, y] of [[2, 500], [3, 640], [4, 780]]) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(450); await shot(page, `0${i}-scroll-${y}`); }
  await page.evaluate(() => window.scrollTo(0, 1e5)); await page.waitForTimeout(450); await shot(page, '05-bottom');
  for (const [t, n] of [['탭 강화', '06-tap'], ['상자', '07-box'], ['도감', '08-dex']]) { await page.locator('.tab', { hasText: t }).click(); await page.waitForTimeout(450); await shot(page, n); }
  await page.locator('.tab', { hasText: '서비스' }).click(); await page.evaluate(() => window.scrollTo(0, 640)); await page.waitForTimeout(400);
  const bb = await page.locator('.dock-phone').boundingBox();
  for (let i = 0; i < 6; i++) { await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.waitForTimeout(50); }
  await shot(page, '09-dock-tap');
  await page.evaluate(() => { const t = document.querySelector('.toast'); t.textContent = '포인트가 부족해요'; t.classList.add('show'); });
  await page.waitForTimeout(400); await shot(page, '10-toast');
  await ctx.close();
  ({ ctx, page } = await open(browser, { ...V4, moves: 5 }));
  await page.evaluate(() => window.scrollTo(0, 640)); await page.waitForTimeout(450); await shot(page, '11-dark');
  await ctx.close();
  ({ ctx, page } = await open(browser, V4, { width: 360, height: 740 }));
  await page.evaluate(() => window.scrollTo(0, 640)); await page.waitForTimeout(450); await shot(page, '12-360');
  console.log('360 noHScroll', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    JSON.stringify(await page.evaluate(() => ['.dock', '.dock-band', '.dock-tabs', '.dock-phone', '.seg', '.dock-pts'].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [s, Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }))));
  await ctx.close();
  await browser.close();
})();
