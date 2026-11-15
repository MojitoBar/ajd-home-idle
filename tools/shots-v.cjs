// UI 통일 2단계 스크린샷. 전제: vite preview 4173, 격리 Aside CDP 9333.
const { chromium } = require('playwright');
const path = require('path');
const URL = 'http://localhost:4173';
const KEY = 'ajd-home-idle:save';
const SHOTS = path.join(__dirname, '..', 'screenshots');
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const V3 = { version: 3, points: 0, earned: 0, moves: 0, tapLevel: 0, services: [0, 0, 0, 0, 0, 0, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [] };
const ALL = { ...V3, points: 3e8, earned: 3e8, tapLevel: 8, services: [30, 20, 15, 12, 8, 5, 2, 1] };
async function open(browser, seed, ctxOpt = MOBILE) {
  const ctx = await browser.newContext(ctxOpt);
  await ctx.addInitScript(([k, s]) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem(k, JSON.stringify({ ...s, savedAt: s.savedAt ?? Date.now() })); localStorage.setItem('ajd-home-idle:prefs', JSON.stringify({ sound: false, music: false, haptics: false })); }, [KEY, seed]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(URL + '?debug');
  await page.waitForSelector('.phone');
  await page.waitForTimeout(700);
  return { ctx, page };
}
const shot = (page, n, o = {}) => page.screenshot({ path: path.join(SHOTS, n), ...o });
const clip = async (page, sel, n, i = 0, pad = 0) => { const b = await page.locator(sel).nth(i).boundingBox(); await shot(page, n, { clip: { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: b.width + pad * 2, height: b.height + pad * 2 } }); };
const only = process.argv[2];
const run = (name) => !only || only.split(',').includes(name);
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    let ctx, page;
    if (run('move')) {
      ({ ctx, page } = await open(browser, { ...ALL, points: 1e12, earned: 1e12 }));
      await page.locator('.move-btn').click({ force: true });
      await page.waitForSelector('.modal');
      await page.waitForTimeout(500);
      await shot(page, 'v-01-move-confirm.png');
      await page.locator('.modal-x').click();
      await page.locator('.step-btn').click();
      await page.waitForTimeout(500);
      await shot(page, 'v-02-stages.png');
      await ctx.close();
    }
    if (run('perk')) {
      ({ ctx, page } = await open(browser, { ...V3, moves: 2, points: 1e6, perks: { tap_power: 1, crit: 2 }, perkOffers: [['tap_power', 'svc_power', 'bundle_boost'], ['crit', 'contract_slot', 'box_discount']] }));
      await page.locator('.perk-alert').click();
      await page.waitForTimeout(1800);
      await shot(page, 'v-03-perk-pick.png');
      await page.locator('.modal-x').click();
      await page.locator('.perk-btn').click();
      await page.waitForTimeout(500);
      await shot(page, 'v-04-perk-list.png');
      await ctx.close();
    }
    if (run('contract')) {
      ({ ctx, page } = await open(browser, { ...V3, points: 1e9, earned: 1e9, services: [20, 20, 20, 12, 0, 0, 0, 0] }));
      await page.locator('.contract-btn:visible').nth(0).click();
      await page.waitForTimeout(500);
      await shot(page, 'v-05-contract-sheet.png');
      await page.locator('.ct-opt.k-normal').click();
      await page.waitForTimeout(2200);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.locator('.speed-num').click();
      await page.waitForTimeout(500);
      await shot(page, 'v-06-mult.png');
      await ctx.close();
    }
    if (run('offline')) {
      ({ ctx, page } = await open(browser, { ...ALL, savedAt: Date.now() - 3 * 3600 * 1000 }));
      await page.waitForSelector('.modal');
      await page.waitForTimeout(1200);
      await shot(page, 'v-07-offline.png');
      await ctx.close();
      ({ ctx, page } = await open(browser, ALL));
      await page.locator('.top .btn.icon-btn').last().click();
      await page.waitForTimeout(500);
      await shot(page, 'v-08-settings.png');
      await ctx.close();
    }
    if (run('event')) {
      ({ ctx, page } = await open(browser, { ...ALL, event: { nextInSec: 0.3, remainSec: 0, streak: 2 } }));
      await page.waitForSelector('.event-call:visible', { timeout: 6000 });
      await page.waitForTimeout(300);
      await shot(page, 'v-09-event-call.png');
      await page.locator('.event-call').click();
      await page.waitForSelector('.plan-card');
      await page.waitForTimeout(500);
      await shot(page, 'v-09-event.png');
      await page.locator('.plan-card').first().click();
      await page.waitForSelector('.res-totals');
      await page.waitForTimeout(900);
      await shot(page, 'v-09b-event-result.png');
      await ctx.close();
    }
    if (run('box')) {
      ({ ctx, page } = await open(browser, { ...ALL, points: 1e12, earned: 1e12 }));
      await page.locator('.tab', { hasText: '상자' }).click();
      await page.waitForTimeout(400);
      await shot(page, 'v-10-box-tab.png');
      await page.locator('.box-open').click();
      await page.waitForSelector('.bs-card', { timeout: 8000 });
      await page.waitForTimeout(900);
      await shot(page, 'v-11-box-result.png');
      await page.locator('.bs-actions .btn.primary').click();
      await page.waitForTimeout(300);
      await page.locator('.box-ten').click();
      await page.waitForSelector('.sum-grid', { timeout: 20000 });
      await page.waitForTimeout(900);
      await shot(page, 'v-12-ten-result.png');
      await ctx.close();
    }
    if (run('dex')) {
      ({ ctx, page } = await open(browser, { ...ALL, points: 1e12, earned: 1e12, collection: { fan: { base: 2, shiny: 1, gold: 0, rainbow: 0 }, mug: { base: 1, shiny: 0, gold: 0, rainbow: 0 } } }));
      await page.locator('.tab', { hasText: '도감' }).click();
      await page.waitForTimeout(800);
      await shot(page, 'v-13-dex.png');
      await page.locator('.dex-cell.got').first().click();
      await page.waitForTimeout(500);
      await shot(page, 'v-13b-dex-detail.png');
      await ctx.close();
    }
    if (run('tap')) {
      ({ ctx, page } = await open(browser, ALL));
      await page.locator('.tab', { hasText: '탭 강화' }).click();
      await page.waitForTimeout(400);
      await shot(page, 'v-14-tap-upgrade.png');
      await ctx.close();
    }
    if (run('room')) {
      ({ ctx, page } = await open(browser, ALL));
      await shot(page, 'v-15-room.png');
      await clip(page, '.room', 'v-15b-room-crop.png');
      await clip(page, '.top', 'v-15c-top.png', 0, 6);
      await ctx.close();
    }
    if (run('mini')) {
      ({ ctx, page } = await open(browser, ALL));
      const vis = async () => page.evaluate(() => document.querySelector('.mini-phone').classList.contains('on'));
      console.log('mini before scroll', await vis());
      await page.evaluate(() => window.scrollTo(0, 600));
      await page.waitForTimeout(500);
      console.log('mini after scroll', await vis());
      await shot(page, 'v-16-mini-phone.png');
      const before = await page.evaluate(() => window.__ajd.get().points);
      await page.locator('.mini-phone').tap();
      await page.waitForTimeout(200);
      console.log('mini tap gain', (await page.evaluate(() => window.__ajd.get().points)) - before);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);
      console.log('mini back top', await vis());
      await ctx.close();
    }
    if (run('dark')) {
      for (const m of [4, 5, 6]) {
        ({ ctx, page } = await open(browser, { ...ALL, moves: m, perkOffers: [['tap_power', 'svc_power', 'bundle_boost']] }));
        await shot(page, `v-17-dark-m${m}.png`);
        await page.locator('.perk-alert').click();
        await page.waitForTimeout(1800);
        await shot(page, `v-17-dark-modal-m${m}.png`);
        console.log('moves', m, await page.evaluate(() => document.body.dataset.theme));
        await ctx.close();
      }
    }
  } finally { await browser.close(); }
})();
