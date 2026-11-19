// 공구함 덱 5단계 화면 촬영(전설 뒤집힘·섞인 고르기·★ 올리기·확률·공구함 패널·카드 줄). 전제: vite preview 4173, 격리 Aside CDP 9333. 출력 screenshots/deck/s5-<폭>-<번호>-<이름>.png
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

async function open(browser, v, slots, offers = [], buff = {}) {
  const o = v.mobile ? { viewport: { width: v.w, height: v.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 };
  const ctx = await browser.newContext(o);
  await ctx.addInitScript((p) => localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p)), PREFS);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(BASE + '/?debug');
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  await page.evaluate(([sl, of, bf]) => {
    window.__ajd.guide('done');
    const s = window.__ajd.get();
    window.__ajd.set({ ...s, moves: 2, unlocked: ['tap', 'home', 'box', 'dex', 'mult', 'badge', 'perk', 'deck', 'fever', 'special'], points: 5e5, earned: 1e5, deck: { ...s.deck, slots: sl.map((x) => ({ id: x[0], charge: x[1], star: x[2] || 1 })), offers: of, mark: 3, buff: { ...s.deck.buff, ...bf } } });
  }, [slots, offers, buff]);
  await page.waitForTimeout(700);
  for (let i = 0; i < 40 && (await page.locator('.toast:visible').count()) > 0; i++) await page.waitForTimeout(250);
  return { ctx, page };
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, 's5-' + name + '.png') });

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  for (const v of VIEWS) {
    if (ONLY && !ONLY.includes(v.name)) continue;
    // 1 전설 뒤집힘(느리게): 첫 카드가 전설
    let { ctx, page } = await open(browser, v, [['P2', 8], ['C1', 3]], [['P5', 'P1', 'S3']]);
    await page.evaluate(() => { window.__deckSlow = 6; });
    await page.locator('.deck-alert').click();
    await page.waitForSelector('.modal.deck-pick .pcard');
    const t0 = Date.now();
    const marks = [3560, 3640, 3760, 3920];
    for (let i = 0; i < marks.length; i++) {
      const wait = marks[i] - (Date.now() - t0);
      if (wait > 0) await page.waitForTimeout(wait);
      await shot(page, `${v.name}-1-legend-${i}`);
    }
    await ctx.close();
    // 2 섞인 고르기(전설·레어·일반)
    ({ ctx, page } = await open(browser, v, [['P2', 8], ['C1', 3]], [['P5', 'C4', 'S3']]));
    await page.locator('.deck-alert').click();
    await page.waitForSelector('.modal.deck-pick .pcard');
    await page.waitForTimeout(2200);
    await shot(page, `${v.name}-2-mixed`);
    await ctx.close();
    // 3 ★ 올리기 후보
    ({ ctx, page } = await open(browser, v, [['P2', 8], ['C1', 3], ['S3', 14]], [['P2', 'F1', 'C1']]));
    await page.locator('.deck-alert').click();
    await page.waitForSelector('.modal.deck-pick .pcard');
    await page.waitForTimeout(2200);
    await shot(page, `${v.name}-3-starup`);
    // 4 확률 창
    await page.locator('.deck-odds-btn').click();
    await page.waitForTimeout(400);
    await shot(page, `${v.name}-4-odds`);
    await ctx.close();
    // 5 공구함 패널
    ({ ctx, page } = await open(browser, v, [['P2', 20, 2], ['P3', 12], ['A1', 30], ['S2', 50, 1]]));
    await page.locator('.deck-row').click();
    await page.waitForTimeout(600);
    await shot(page, `${v.name}-5-panel`);
    await page.locator('.deck-panel').evaluate((e) => e.scrollIntoView(false)).catch(() => {});
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(300);
    await shot(page, `${v.name}-5-panel-b`);
    await ctx.close();
    // 6 카드 줄(★·희귀도·장전)
    ({ ctx, page } = await open(browser, v, [['C5', 20, 2], ['P3', 30, 3], ['P4', 12], ['A1', 8]], [], { nextStrike: true }));
    await page.waitForTimeout(300);
    await page.locator('.deck-row').screenshot({ path: path.join(OUT, `s5-${v.name}-6-row.png`) });
    await shot(page, `${v.name}-6-row-full`);
    await ctx.close();
  }
  await browser.close();
})();
