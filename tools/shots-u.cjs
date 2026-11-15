// UI 통일 1단계 스크린샷. 전제: vite preview 4173, 격리 Aside CDP 9333.
const { chromium } = require('playwright');
const path = require('path');
const URL = 'http://localhost:4173';
const KEY = 'ajd-home-idle:save';
const SHOTS = path.join(__dirname, '..', 'screenshots');
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const V3 = { version: 3, points: 0, earned: 0, moves: 0, tapLevel: 0, services: [0, 0, 0, 0, 0, 0, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [] };
async function open(browser, seed, ctxOpt = MOBILE) {
  const ctx = await browser.newContext(ctxOpt);
  await ctx.addInitScript(([k, s]) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem(k, JSON.stringify({ ...s, savedAt: Date.now() })); localStorage.setItem('ajd-home-idle:prefs', JSON.stringify({ sound: false, music: false, haptics: false })); }, [KEY, seed]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(URL + '?debug');
  await page.waitForSelector('.phone');
  await page.waitForTimeout(700);
  return { ctx, page };
}
const shot = (page, n, o = {}) => page.screenshot({ path: path.join(SHOTS, n), ...o });
const clip = async (page, sel, n, i = 0, pad = 0) => { const b = await page.locator(sel).nth(i).boundingBox(); await shot(page, n, { clip: { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: b.width + pad * 2, height: b.height + pad * 2 } }); };
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    const ALL = { ...V3, points: 3e8, earned: 3e8, tapLevel: 8, services: [30, 20, 15, 12, 8, 5, 2, 1] };
    let { ctx, page } = await open(browser, ALL);
    await shot(page, 'u1-01-main.png');
    await clip(page, '.top', 'u1-01a-top.png', 0, 6);
    await clip(page, '.room', 'u1-01b-room.png');
    await clip(page, '.card', 'u1-01c-card.png', 1);
    await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, fever: { gauge: 1, activeSec: 12, cooldownSec: 0 } }); });
    await page.waitForTimeout(600);
    await shot(page, 'u1-06-fever.png');
    await ctx.close();

    ({ ctx, page } = await open(browser, ALL, { ...MOBILE, viewport: { width: 390, height: 1700 } }));
    await shot(page, 'u1-02-services-full.png');
    await ctx.close();

    ({ ctx, page } = await open(browser, { ...V3, points: 1e9, earned: 1e9, services: [20, 20, 20, 12, 0, 0, 0, 0] }));
    await page.locator('.contract-btn:visible').nth(0).click();
    await page.locator('.ct-opt.k-normal').click();
    await page.waitForTimeout(2200);
    await page.locator('.contract-btn:visible').nth(1).click();
    await page.locator('.ct-opt.k-short').click();
    await page.waitForTimeout(2500);
    await shot(page, 'u1-03-contract-bundle.png');
    await page.evaluate(() => window.scrollTo(0, 420));
    await page.waitForTimeout(300);
    await shot(page, 'u1-03b-scrolled.png');
    console.log('card heights', (await page.locator('.card').evaluateAll((cs) => cs.map((x) => Math.round(x.getBoundingClientRect().height)))).join(','));
    console.log('buy x', (await page.locator('.card .buy').evaluateAll((cs) => cs.map((x) => Math.round(x.getBoundingClientRect().left)))).join(','));
    await ctx.close();

    ({ ctx, page } = await open(browser, ALL));
    await page.locator('.tab', { hasText: '탭 강화' }).click();
    await page.waitForTimeout(300);
    await shot(page, 'u1-04-tap-upgrade.png');
    await page.locator('.tab', { hasText: '상자' }).click();
    await page.waitForTimeout(300);
    await shot(page, 'u1-07-box-tab.png');
    await page.locator('.tab', { hasText: '도감' }).click();
    await page.waitForTimeout(300);
    await shot(page, 'u1-08-dex-tab.png');
    await ctx.close();

    for (const m of [4, 6]) {
      ({ ctx, page } = await open(browser, { ...ALL, moves: m }));
      console.log('moves', m, 'theme', await page.evaluate(() => document.body.dataset.theme));
      await shot(page, `u1-05-dark-house-m${m}.png`);
      await ctx.close();
    }
    for (const w of [360, 430]) {
      ({ ctx, page } = await open(browser, ALL, { ...MOBILE, viewport: { width: w, height: 844 } }));
      await shot(page, `u1-09-w${w}.png`);
      console.log(w, 'noHScroll', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
      await ctx.close();
    }
  } finally { await browser.close(); }
})();
