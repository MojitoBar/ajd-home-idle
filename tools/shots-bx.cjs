// 사은품 상자 개편 스크린샷(bx-01~). 전제: preview 4173, 격리 Aside CDP 9333. 모바일 390x844 DPR2 + PC 1440x900.
const { chromium } = require('playwright');
const path = require('path');
const URL = 'http://localhost:4173';
const SHOTS = path.join(__dirname, '..', 'screenshots');
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const PC = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const V = { version: 3, points: 1e15, earned: 1e15, moves: 0, tapLevel: 12, services: [20, 12, 11, 10, 0, 0, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [] };
const slot = (base = 0, shiny = 0, gold = 0, rainbow = 0) => ({ base, shiny, gold, rainbow });
const COMMON = ['fan', 'kettle', 'toaster', 'heating_pad', 'hair_dryer', 'humidifier', 'rice_cooker'];
const mid = {};
['fan', 'kettle', 'toaster', 'heating_pad', 'hair_dryer'].forEach((id, i) => (mid[id] = slot([2, 6, 4, 1, 15][i], i === 0 ? 1 : 0)));
mid.water_purifier = slot(3, 1); mid.air_purifier = slot(1); mid.massage_chair = slot(1, 0, 1);
async function open(browser, seed, ctxOpts = MOBILE) {
  const ctx = await browser.newContext(ctxOpts);
  await ctx.addInitScript(([s]) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem('ajd-home-idle:save', JSON.stringify({ ...s, savedAt: Date.now() })); localStorage.setItem('ajd-home-idle:prefs', JSON.stringify({ sound: false, music: false, haptics: false })); }, [seed]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(URL + '?debug');
  await page.waitForSelector('.phone');
  await page.waitForTimeout(600);
  return { ctx, page };
}
const shot = (page, n, o = {}) => page.screenshot({ path: path.join(SHOTS, n), ...o });
const tab = async (page, t) => { await page.locator('.tab', { hasText: t }).first().click(); await page.waitForTimeout(700); };
const patch = (page, q) => page.evaluate((qq) => { const o = Math.random; window.__q = qq; Math.random = () => (window.__q.length ? window.__q.shift() : o()); }, q);
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    let { ctx, page } = await open(browser, { ...V, collection: mid });
    await tab(page, '상자'); await shot(page, 'bx-01-box-tab.png');
    // 레벨업 순간(fan base 2 -> 3 = Lv 2)
    await patch(page, [0.1, 0.1, 0.1]); await page.locator('.box-open').click();
    await page.waitForSelector('.bs-card', { timeout: 9000 }); await page.waitForTimeout(1300); await shot(page, 'bx-02-levelup.png');
    await page.locator('.bs-actions .btn.primary').click(); await page.waitForTimeout(400);
    // 진행 막대(heating_pad base 1 -> 2: Lv 1, 남은 1)
    await patch(page, [0.5, 0.1, 0.1]); await page.locator('.box-open').click();
    await page.waitForSelector('.bs-card', { timeout: 9000 }); await page.waitForTimeout(1300); await shot(page, 'bx-03-progress.png');
    await page.locator('.bs-actions .btn.primary').click(); await page.waitForTimeout(400);
    // 10개: fan(3->4), kettle(6->7 Lv3), toaster(4->5), 새 칸, 일반 중복 등
    await patch(page, [0.1, 0.1, 0.1, 0.2, 0.1, 0.1, 0.3, 0.1, 0.1, 0.1, 0.1, 0.1, 0.65, 0.1, 0.1, 0.3, 0.5, 0.1, 0.3, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]);
    await page.locator('.box-ten').click(); await page.waitForSelector('.sum-grid', { timeout: 15000 });
    await page.waitForSelector('.bs-actions:not(.lock)', { timeout: 15000 }); await page.waitForTimeout(1200); await shot(page, 'bx-05-ten.png');
    await page.locator('.bs-actions .btn.primary').click(); await page.waitForTimeout(400);
    await tab(page, '도감'); await shot(page, 'bx-06-dex.png');
    await page.evaluate(() => window.scrollTo(0, 560)); await page.waitForTimeout(500); await shot(page, 'bx-06b-dex-cells.png');
    await page.evaluate(() => window.scrollTo(0, 0));
    await tab(page, '상자'); await page.locator('.odds-toggle').click(); await page.waitForTimeout(400);
    await page.locator('.odds-guarantee').scrollIntoViewIfNeeded(); await shot(page, 'bx-07-odds.png');
    await ctx.close();
    // 세트 완성: 신화 1종뿐인 세트
    ({ ctx, page } = await open(browser, { ...V, collection: {} }));
    await tab(page, '상자'); await patch(page, [0.9985, 0.5, 0.1]); await page.locator('.box-open').click();
    await page.waitForSelector('.bs-card', { timeout: 9000 }); await page.waitForTimeout(1500); await shot(page, 'bx-04-setdone.png');
    await ctx.close();
    // 연타 표시
    ({ ctx, page } = await open(browser, { ...V, points: 1000, services: [0, 0, 0, 0, 0, 0, 0, 0], tapLevel: 1, collection: {} }));
    await page.evaluate(() => { const ph = document.querySelector('.phone'); window.__iv = setInterval(() => ph.dispatchEvent(new PointerEvent('pointerdown', { clientX: 195, clientY: 300, bubbles: true, cancelable: true })), 100); });
    await page.waitForTimeout(3000); await shot(page, 'bx-08-combo.png');
    await page.evaluate(() => clearInterval(window.__iv));
    console.log('combo text', (await page.locator('.combo').innerText().catch(() => '')).replace(/\n/g, ' '));
    await ctx.close();
    // PC
    ({ ctx, page } = await open(browser, { ...V, collection: mid }, PC));
    await page.locator('.dock .tab', { hasText: '도감' }).click(); await page.waitForTimeout(500); await shot(page, 'bx-09-pc-dex.png');
    await page.locator('.dock .tab', { hasText: '상자' }).click(); await page.waitForTimeout(500); await shot(page, 'bx-10-pc-box.png');
    await ctx.close();
  } catch (e) { console.log('ERR', e.message); } finally { await browser.close(); }
})();
