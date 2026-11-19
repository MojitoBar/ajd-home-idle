// 공구함 덱 4단계 화면 ①(공구함 탭) 촬영. 전제: vite preview 4173(URL로 바꿀 수 있음), 격리 Aside CDP 9333. 출력 screenshots/deck/s4-<폭>-<번호>-<이름>.png
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = process.env.URL || 'http://localhost:4173';
const OUT = path.join(__dirname, '..', 'screenshots', 'deck');
fs.mkdirSync(OUT, { recursive: true });
const PREFS = { sound: false, music: false, haptics: false, chargeDone: true, weakDone: true };
const VIEWS = [
  { name: '390', w: 390, h: 844, mobile: true },
  { name: '360', w: 360, h: 800, mobile: true },
  { name: '1440', w: 1440, h: 900, mobile: false },
];
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;

async function open(browser, v, moves, slots, offers = []) {
  const o = v.mobile ? { viewport: { width: v.w, height: v.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 };
  const ctx = await browser.newContext(o);
  await ctx.addInitScript((p) => localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p)), PREFS);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(BASE + '/?debug');
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  await page.evaluate(([m, sl, of]) => {
    window.__ajd.guide('done');
    const s = window.__ajd.get();
    window.__ajd.set({ ...s, moves: m, unlocked: ['tap', 'home', 'box', 'dex', 'mult', 'badge', 'perk', ...(m > 0 ? ['deck', 'fever', 'special'] : [])], points: 5e5, earned: 1e5, deck: { ...s.deck, slots: sl.map((x) => ({ id: x[0], star: 1, charge: x[1] })), offers: of, mark: 3 }, collection: { ...s.collection, fan: { base: 1, shiny: 0, gold: 0, rainbow: 0 } } });
  }, [moves, slots, offers]);
  await page.waitForTimeout(700);
  for (let i = 0; i < 40 && (await page.locator('.toast:visible').count()) > 0; i++) await page.waitForTimeout(250);
  return { ctx, page };
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, 's4-' + name + '.png') });
const tabBtn = (page, ux) => page.locator(`.dock .tab[data-ux="${ux}"]`).first();

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  for (const v of VIEWS) {
    if (ONLY && !ONLY.includes(v.name)) continue;
    let { ctx, page } = await open(browser, v, 1, [['P2', 8], ['C1', 3], ['S3', 14]]);
    await shot(page, `${v.name}-1-dock`);
    await page.locator('.deck-row').click();
    await page.waitForTimeout(500);
    await shot(page, `${v.name}-2-panel`);
    await ctx.close();
    ({ ctx, page } = await open(browser, v, 1, [['P2', 8], ['C1', 3]], [['C3', 'F1', 'P1']]));
    await page.locator('.deck-row').click();
    await page.waitForTimeout(500);
    await shot(page, `${v.name}-3-pick`);
    await tabBtn(page, 'box').click();
    await page.waitForTimeout(400);
    await shot(page, `${v.name}-4-box-draw`);
    await page.locator('.view-btn[data-view="dex"]').click();
    await page.waitForTimeout(500);
    await shot(page, `${v.name}-5-box-dex`);
    await ctx.close();
    ({ ctx, page } = await open(browser, v, 0, []));
    await tabBtn(page, 'dex').click();
    await page.waitForTimeout(500);
    await shot(page, `${v.name}-6-first-house`);
    await ctx.close();
  }
  await browser.close();
})();
