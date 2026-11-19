// 공구함 덱 1단계 촬영·점검. 전제: 개발 서버 localhost:5173(또는 URL), 격리 Aside(헤드리스) CDP 9333. 출력 screenshots/deck/
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = process.env.URL || 'http://localhost:5173';
const OUT = path.join(__dirname, '..', 'screenshots', 'deck');
fs.mkdirSync(OUT, { recursive: true });
const PREFS = { sound: false, music: false, haptics: false, chargeDone: true, weakDone: true };
const VIEWS = [
  { name: '390', w: 390, h: 844, mobile: true },
  { name: '1440', w: 1440, h: 900, mobile: false },
  { name: '1920', w: 1920, h: 1080, mobile: false },
];
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;

async function open(browser, v, moves = 1) {
  const o = v.mobile ? { viewport: { width: v.w, height: v.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 };
  const ctx = await browser.newContext(o);
  await ctx.addInitScript((p) => localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p)), PREFS);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(BASE + '/?debug');
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  await page.evaluate((m) => {
    window.__ajd.guide('done');
    const s = window.__ajd.get();
    window.__ajd.set({ ...s, moves: m, unlocked: ['tap', 'home', 'box', 'dex', 'mult', 'badge', 'perk', ...(m > 0 ? ['deck'] : [])], points: 5e5, earned: 1e5 });
  }, moves);
  await page.waitForTimeout(700);
  return { ctx, page };
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png') });
const modalOpen = (page) => page.evaluate(() => !!document.querySelector('.overlay'));
const closeAll = async (page) => { for (let i = 0; i < 3; i++) { if (!(await modalOpen(page))) break; await page.keyboard.press('Escape'); await page.evaluate(() => document.querySelector('.overlay')?.dispatchEvent(new Event('modal-close'))); await page.waitForTimeout(200); } };

async function overflowInfo(page) {
  return page.evaluate(() => {
    const r = document.querySelector('.deck-row')?.getBoundingClientRect();
    const rects = ['.px-strip', '.charge', '.guide-row', '.move-row', '.fever-gauge', '.dock'].map((q) => { const e = document.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(); return b.width ? [q, Math.round(b.top), Math.round(b.bottom)] : null; }).filter(Boolean);
    return { row: r ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null, rects, scrollH: document.documentElement.scrollHeight, innerH: innerHeight, hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth };
  });
}

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  for (const v of VIEWS) {
    if (ONLY && !ONLY.includes(v.name)) continue;
    // 1 카드 줄(2장 + 빈 칸 1) + 대기 묶음 알림
    let { ctx, page } = await open(browser, v);
    await page.evaluate(() => { window.__ajd.deck(['P2', 'P3']); window.__ajd.offer(); });
    await page.waitForTimeout(600);
    await shot(page, `${v.name}-1-row`);
    console.log(v.name, 'row', JSON.stringify(await overflowInfo(page)));
    // 5 공구함 창
    await page.locator('.deck-row').click();
    await page.waitForTimeout(500);
    await shot(page, `${v.name}-5-toolbox`);
    await closeAll(page);
    // 2 카드 고르기
    await page.locator('.deck-alert').click();
    await page.waitForTimeout(1200);
    await shot(page, `${v.name}-2-pick`);
    await closeAll(page);
    // 3 바꿀 칸 고르기(칸이 찬 상태)
    await page.evaluate(() => { window.__ajd.deck(['P2', 'C1', 'P3']); });
    await page.waitForTimeout(400);
    await page.locator('.deck-alert').click();
    await page.waitForTimeout(1000);
    await page.evaluate(() => { const s = window.__ajd.get(); console.log('offer', JSON.stringify(s.deck.offers)); });
    await page.locator('.pcard:not(.maxed)').first().click();
    await page.waitForTimeout(800);
    await shot(page, `${v.name}-3-replace`);
    await ctx.close();
    // 4 발동 순간
    ({ ctx, page } = await open(browser, v));
    await page.evaluate(() => { window.__ajd.deck(['P3', 'C3']); window.__ajd.streak(9); window.__ajd.chain(3000); });
    let got = false;
    for (let i = 0; i < 400 && !got; i++) {
      got = (await page.locator('.deck-x').count()) > 0;
      if (got) break;
      await page.waitForTimeout(25);
    }
    await page.waitForTimeout(120);
    await shot(page, `${v.name}-4-fire`);
    console.log(v.name, 'fire texts', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.deck-x')].map((x) => x.textContent))));
    await ctx.close();
    if (v.name === '390') {
      ({ ctx, page } = await open(browser, { name: '360', w: 360, h: 740, mobile: true }));
      await page.evaluate(() => { window.__ajd.deck(['P2', 'P3']); window.__ajd.offer(); });
      await page.waitForTimeout(600);
      await shot(page, '360-1-row');
      console.log('360 row', JSON.stringify(await overflowInfo(page)));
      await ctx.close();
      ({ ctx, page } = await open(browser, v, 0));
      await shot(page, '390-0-first-house');
      console.log('first house deck-row count', await page.locator('.deck-row').count());
      await ctx.close();
    }
  }
  await browser.close();
})();
