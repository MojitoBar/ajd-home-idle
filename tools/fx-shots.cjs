// 상자깡 연출 사진: node tools/fx-shots.cjs fx0|fx1. 전제: vite preview 4173, 격리 Aside CDP 9333.
const { chromium } = require('playwright');
const path = require('path');
const URL = 'http://localhost:4173';
const KEY = 'ajd-home-idle:save';
const SHOTS = path.join(__dirname, '..', 'screenshots');
const PRE = process.argv[2] || 'fx1';
const PREFS = { sound: false, music: false, haptics: false, chargeDone: true, weakDone: true };
const ALL = ['tap', 'home', 'box', 'dex', 'mult', 'badge', 'perk'];
const M = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const PC = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
async function open(browser, opts, over) {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript((p) => localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p)), PREFS);
  const page = await ctx.newPage();
  await page.goto(URL + '?debug');
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate((o) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, unlocked: ['tap','home','box','dex','mult','badge','perk'], points: 1e6, earned: 1e5, tapLevel: 200, ...o, unpack: { ...s.unpack, box: 30, damage: 0, hp: 1, ...(o.unpack || {}) } }); }, over || {});
  await page.waitForTimeout(700);
  return { ctx, page };
}
async function shots(page, name, n, gap) {
  for (let i = 1; i <= n; i++) {
    await page.screenshot({ path: path.join(SHOTS, `${PRE}-${name}-${String(i).padStart(2, '0')}.png`) });
    if (gap) await page.waitForTimeout(gap);
  }
}
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const only = process.argv[3];
  try {
    if (!only || only === '390-chain') {
      const { ctx, page } = await open(browser, M);
      await page.evaluate(() => window.__ajd.fever());
      await page.waitForTimeout(400);
      await page.evaluate(() => window.__ajd.chain(40));
      await shots(page, '390-chain', 16, 0);
      await ctx.close();
    }
    if (!only || only === '390-long') {
      const { ctx, page } = await open(browser, M);
      await page.evaluate(() => window.__ajd.chain(900));
      await page.waitForTimeout(700);
      await shots(page, '390-long', 12, 0);
      await ctx.close();
    }
    if (!only || only === '390-bomb') {
      const { ctx, page } = await open(browser, M, { unpack: { damage: 1e15 } });
      await page.evaluate(() => window.__ajd.special('bomb', 0));
      await page.waitForTimeout(800);
      const b = await page.locator('.phone').boundingBox();
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await shots(page, '390-bomb', 10, 0);
      await ctx.close();
    }
    if (!only || only === '390-end') {
      const { ctx, page } = await open(browser, M);
      await page.evaluate(() => window.__ajd.chain(30));
      await page.evaluate(async () => { const t0 = performance.now(); while (window.__ajd.getChain().playing && performance.now() - t0 < 8000) await new Promise((r) => requestAnimationFrame(r)); });
      await shots(page, '390-end', 6, 0);
      await ctx.close();
    }
    if (!only || only === '1440-chain') {
      const { ctx, page } = await open(browser, PC);
      await page.evaluate(() => window.__ajd.chain(40));
      await shots(page, '1440-chain', 6, 0);
      await ctx.close();
    }
    if (!only || only === 'row') {
      for (const [w, opts] of [[390, M], [360, { ...M, viewport: { width: 360, height: 800 } }], [1440, PC]]) {
        const { ctx, page } = await open(browser, opts);
        await page.evaluate(() => { window.__ajd.guide('done'); const s = window.__ajd.get(); window.__ajd.set({ ...s, moves: 1, unlocked: ['tap', 'home', 'box', 'dex', 'mult', 'badge', 'perk', 'deck', 'fever', 'special'], deck: { ...s.deck, offers: [], boostPacks: 0, slots: [['P2', 3], ['P3', 12], ['C1', 27], ['S3', 128]].map(([id, stacks]) => ({ id, star: 1, charge: 0, stacks })) } }); window.__ajd.rush(0); });
        await page.waitForTimeout(900);
        await page.screenshot({ path: path.join(SHOTS, `${PRE}-${w}-row.png`) });
        await ctx.close();
      }
    }
  } finally { await browser.close(); }
})();
