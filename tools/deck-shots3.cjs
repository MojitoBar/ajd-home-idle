// 공구함 덱 3단계(필요 눈금: 이사 1회 = 14) 촬영(충전 막대·공구함 ×N·카드 완성·덱 완성·창들). 전제: vite preview 4173(URL로 바꿀 수 있음), 격리 Aside CDP 9333. 출력 screenshots/deck/s3-*
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
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;

async function open(browser, v, slots, offers = []) {
  const o = v.mobile ? { viewport: { width: v.w, height: v.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 };
  const ctx = await browser.newContext(o);
  await ctx.addInitScript((p) => localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p)), PREFS);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(BASE + '/?debug');
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  await page.evaluate(([sl, of]) => {
    window.__ajd.guide('done');
    const s = window.__ajd.get();
    window.__ajd.set({ ...s, moves: 1, unlocked: ['tap', 'home', 'box', 'dex', 'mult', 'badge', 'perk', 'deck', 'fever', 'special'], points: 5e5, earned: 1e5, deck: { ...s.deck, slots: sl.map((x) => ({ id: x[0], star: 1, charge: x[1] })), offers: of } });
  }, [slots, offers]);
  await page.waitForTimeout(700);
  for (let i = 0; i < 40 && (await page.locator('.toast:visible').count()) > 0; i++) await page.waitForTimeout(250);
  return { ctx, page };
}
const shot = (page, name, o = {}) => page.screenshot({ path: path.join(OUT, 's3-' + name + '.png'), ...o });
const closeAll = async (page) => { for (let i = 0; i < 3; i++) { if (!(await page.evaluate(() => !!document.querySelector('.overlay')))) break; await page.keyboard.press('Escape'); await page.waitForTimeout(200); } };
const perfect = (page) => page.evaluate(() => { window.__ajd.zone(0.5); window.__ajd.charge(0.5); });

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  for (const v of VIEWS) {
    if (ONLY && !ONLY.includes(v.name)) continue;
    // ① 카드 줄(충전 중간) ④ 공구함 창 ⑤ 배율 내역 창
    let { ctx, page } = await open(browser, v, [['P2', 8], ['C1', 3], ['S3', 14]]);
    await page.waitForTimeout(400);
    await shot(page, `${v.name}-1-row`);
    await page.locator('.deck-row').click();
    await page.waitForTimeout(500);
    await shot(page, `${v.name}-4-toolbox`);
    await closeAll(page);
    await page.locator('.badge').first().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(500);
    await shot(page, `${v.name}-5-mult`);
    await ctx.close();
    // ⑥ 교체 화면
    ({ ctx, page } = await open(browser, v, [['P2', 8], ['C1', 3], ['S3', 14]], [['C3', 'F1', 'P1']]));
    await page.locator('.deck-alert').click();
    await page.waitForSelector('.modal.deck-pick .pcard');
    await page.waitForTimeout(1300);
    await shot(page, `${v.name}-6a-pick`);
    await page.locator('.deck-pick .pcard').first().click();
    await page.waitForTimeout(700);
    await shot(page, `${v.name}-6-replace`);
    await ctx.close();
    // ② 카드 완성: 정밀 카드 하나가 한 눈금 모자람 → 퍼펙트 강타. 프레임 여러 장
    ({ ctx, page } = await open(browser, v, [['P2', 13], ['C1', 6], ['S3', 3]]));
    await perfect(page);
    for (let i = 0; i < 8; i++) { await shot(page, `${v.name}-2-full-f${i}`, { scale: 'css' }); await page.waitForTimeout(40); }
    console.log(v.name, 'full', JSON.stringify(await page.evaluate(() => document.querySelector('.deck-mult')?.textContent)));
    await ctx.close();
    // ③ 덱 완성 headline
    ({ ctx, page } = await open(browser, v, [['P2', 13], ['P3', 14], ['F3', 14]]));
    await perfect(page);
    for (let i = 0; i < 16; i++) { await page.waitForTimeout(300); await shot(page, `${v.name}-3-all-f${i}`, { scale: 'css' }); }
    console.log(v.name, 'all', JSON.stringify(await page.evaluate(() => [document.querySelector('.deck-mult')?.textContent, document.querySelector('.fx-banner')?.textContent])));
    await ctx.close();
  }
  await browser.close();
})();
