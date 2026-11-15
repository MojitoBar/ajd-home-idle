// 아이콘 교체 스크린샷. 전제: vite preview 4173, 격리 Aside CDP 9333.
const { chromium } = require('playwright');
const path = require('path');
const URL = 'http://localhost:4173';
const KEY = 'ajd-home-idle:save';
const SHOTS = path.join(__dirname, '..', 'screenshots');
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const V3 = { version: 3, points: 0, earned: 0, moves: 0, tapLevel: 0, services: [0, 0, 0, 0, 0, 0, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [] };
async function open(browser, seed, ctxOpt = MOBILE) {
  const ctx = await browser.newContext(ctxOpt);
  await ctx.addInitScript(([k, s]) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem(k, JSON.stringify({ ...s, savedAt: Date.now() })); }, [KEY, seed]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(URL + '?debug');
  await page.waitForSelector('.phone');
  await page.waitForTimeout(700);
  return { ctx, page };
}
const shot = (page, n, o = {}) => page.screenshot({ path: path.join(SHOTS, n), ...o });
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    const ALL = { ...V3, points: 3e8, earned: 3e8, tapLevel: 8, services: [30, 20, 15, 12, 8, 5, 2, 1] };
    let { ctx, page } = await open(browser, ALL);
    await shot(page, 'a-01-main.png');
    await shot(page, 'a-01-phone.png', { clip: { x: 100, y: 150, width: 190, height: 190 } });
    const r = await page.locator('.room').boundingBox();
    await shot(page, 'a-01-room.png', { clip: { x: r.x, y: r.y, width: r.width, height: r.height } });
    await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, fever: { gauge: 1, activeSec: 12, cooldownSec: 0 } }); });
    await page.waitForTimeout(500);
    await shot(page, 'a-03-fever.png');
    await page.waitForTimeout(1500);
    await shot(page, 'a-03b-fever-late.png');
    await ctx.close();

    ({ ctx, page } = await open(browser, ALL, { ...MOBILE, viewport: { width: 390, height: 1400 } }));
    await shot(page, 'a-02-services.png');
    const c = await page.locator('.card').nth(1).boundingBox();
    await shot(page, 'a-02-card.png', { clip: { x: c.x, y: c.y, width: c.width, height: c.height } });
    await ctx.close();

    ({ ctx, page } = await open(browser, { ...V3, points: 1e9, earned: 1e9, services: [20, 20, 20, 12, 0, 0, 0, 0] }));
    await page.locator('.contract-btn:visible').nth(0).click();
    await page.locator('.ct-opt.k-normal').click();
    await page.waitForTimeout(250);
    await shot(page, 'a-06b-stamp.png');
    await page.waitForTimeout(1800);
    await page.locator('.contract-btn:visible').nth(1).click();
    await page.locator('.ct-opt.k-short').click();
    await page.waitForTimeout(2500);
    await shot(page, 'a-06-strategy.png');
    const c0 = await page.locator('.card').nth(0).boundingBox();
    await shot(page, 'a-06-card.png', { clip: { x: c0.x, y: c0.y, width: c0.width, height: c0.height } });
    const hs = await page.locator('.card').evaluateAll((cs) => cs.map((x) => Math.round(x.getBoundingClientRect().height)));
    console.log('card heights', hs.join(','), 'overflow', await page.evaluate(() => [...document.querySelectorAll('.card-main')].some((m) => m.scrollWidth > m.clientWidth + 1)));
    await ctx.close();

    ({ ctx, page } = await open(browser, { ...ALL, parcel: { nextInSec: 90, remainSec: 8 } }));
    await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, parcel: { nextInSec: 90, remainSec: 8 } }); });
    await page.waitForSelector('.parcel:not([hidden])');
    await page.waitForTimeout(900);
    await shot(page, 'a-04-parcel.png');
    const pb = await page.locator('.parcel').boundingBox();
    await shot(page, 'a-04-parcel-zoom.png', { clip: { x: Math.max(0, pb.x - 10), y: pb.y - 10, width: 90, height: 90 } });
    await page.locator('.parcel').dispatchEvent('pointerdown');
    await page.waitForTimeout(350);
    await shot(page, 'a-04b-parcel-coins.png');
    await ctx.close();

    ({ ctx, page } = await open(browser, { ...ALL, points: 1e12 }));
    await page.evaluate(() => { const p = window.__ajd.get(); window.__ajd.set({ ...p, points: 1e12 }); });
    // crit: 난수 고정은 어려우니 여러 번 탭해 .fx-pop 출현을 본다
    const ph = await page.locator('.phone').boundingBox();
    for (let i = 0; i < 40; i++) {
      await page.touchscreen.tap(ph.x + 50, ph.y + 50);
      await page.waitForTimeout(90);
      if (await page.locator('.fx-pop').count()) { await page.waitForTimeout(150); await shot(page, 'a-03c-crit.png'); break; }
    }
    await page.locator('.tab', { hasText: '상자' }).click();
    await page.waitForTimeout(500);
    await shot(page, 'a-05b-box-tab.png');
    await page.locator('.box-open').click();
    await page.waitForSelector('.box-scene');
    await page.waitForTimeout(500);
    await shot(page, 'a-05c-box-shake.png');
    await page.waitForSelector('.bs-box.opened', { timeout: 8000 });
    await page.waitForTimeout(60);
    await shot(page, 'a-05-box-open.png');
    await ctx.close();

    ({ ctx, page } = await open(browser, { version: 1, points: 1e14, earned: 1e19, moves: 3, services: [5, 5, 5, 5, 5, 5, 5, 5] }));
    await page.locator('.move-btn').click();
    await page.locator('.modal .btn.primary').click();
    await page.waitForSelector('.modal h2', { timeout: 20000 });
    await page.waitForTimeout(500);
    await page.locator('.modal .btn.primary').click().catch(() => {});
    await page.waitForTimeout(800);
    await shot(page, 'a-07-dark-house.png');
    await ctx.close();
  } catch (e) { console.log('ERR', e.message); } finally { await browser.close().catch(() => {}); }
})();
