// 공구함 덱 4단계 화면 ②(카드 고르는 순간 연출) 촬영. 전제: vite preview 4173, 격리 Aside CDP 9333. 연출은 window.__deckSlow=6으로 늦춰 찍는다.
// 출력 screenshots/deck/s4b-<폭>-<번호>-<이름>.png
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = process.env.URL || 'http://localhost:4173';
const OUT = path.join(__dirname, '..', 'screenshots', 'deck');
fs.mkdirSync(OUT, { recursive: true });
const PREFS = { sound: false, music: false, haptics: false, chargeDone: true, weakDone: true };
const VIEWS = [
  { name: '390', w: 390, h: 844, mobile: true },
  { name: '1440', w: 1440, h: 900, mobile: false },
];
const SLOW = 6;
const OFFER = ['C3', 'P2', 'F1'];

async function open(browser, v) {
  const o = v.mobile ? { viewport: { width: v.w, height: v.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 };
  const ctx = await browser.newContext(o);
  await ctx.addInitScript((p) => localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p)), PREFS);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(BASE + '/?debug');
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  await page.evaluate((of) => {
    window.__ajd.guide('done');
    const s = window.__ajd.get();
    window.__ajd.set({ ...s, moves: 1, unlocked: ['tap', 'home', 'box', 'dex', 'mult', 'badge', 'perk', 'deck', 'fever', 'special'], points: 5e5, earned: 1e5, deck: { ...s.deck, slots: [['P3', 4], ['S3', 9]].map((x) => ({ id: x[0], star: 1, charge: x[1] })), offers: [of], mark: 3 } });
  }, OFFER);
  await page.waitForTimeout(700);
  for (let i = 0; i < 40 && (await page.locator('.toast:visible').count()) > 0; i++) await page.waitForTimeout(250);
  return { ctx, page };
}
const shot = (page, name, v) => page.screenshot({ path: path.join(OUT, `s4b-${v.name}-${name}.png`) });

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  for (const v of VIEWS) {
    let { ctx, page } = await open(browser, v);
    await page.evaluate((k) => { window.__deckSlow = k; }, SLOW);
    await page.locator('.deck-alert').click();
    await page.waitForSelector('.modal.deck-pick .pcard');
    await page.waitForTimeout(1500);
    await shot(page, '1-deal', v);
    await page.waitForTimeout(2950);
    await shot(page, '2-flip', v);
    await page.waitForTimeout(950);
    await shot(page, '2b-flip-rare', v);
    await page.waitForTimeout(2850);
    await page.evaluate(() => { window.__deckSlow = 1; });
    await page.waitForTimeout(600);
    await shot(page, '3-faces', v);
    await page.evaluate((k) => { window.__deckSlow = k; }, SLOW);
    await page.locator('.pcard[data-card="P2"]').click();
    await page.waitForTimeout(1000);
    await shot(page, '4-picked', v);
    await page.waitForTimeout(2100);
    await shot(page, '5a-flying', v);
    await page.waitForTimeout(1250);
    await shot(page, '5-slot-land', v);
    await ctx.close();
  }
  await browser.close();
})();
