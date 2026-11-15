// PC 화면 스크린샷(pc-01~). 전제: vite preview 4173, 격리 Aside(헤드리스) CDP 9333. 1440x900 DPR 1.
const { chromium } = require('playwright');
const path = require('path');
const URL = 'http://localhost:4173';
const KEY = 'ajd-home-idle:save';
const SHOTS = path.join(__dirname, '..', 'screenshots');
const V4 = { version: 3, points: 5e8, earned: 5e8, moves: 0, tapLevel: 12, services: [20, 12, 11, 10, 6, 3, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [] };
async function open(browser, seed, vp = { width: 1440, height: 900 }, query = '?debug') {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  await ctx.addInitScript(([k, s]) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem(k, JSON.stringify({ ...s, savedAt: Date.now() })); }, [KEY, seed]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(URL + query);
  await page.waitForSelector('.phone');
  await page.waitForTimeout(700);
  return { ctx, page };
}
const shot = (page, n) => page.screenshot({ path: path.join(SHOTS, `pc-${n}.png`) });
const ph = async (page) => { const b = await page.locator('.phone').boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  let { ctx, page } = await open(browser, V4);
  await shot(page, '01-main');
  await page.evaluate(() => window.scrollTo(0, 600)); await page.waitForTimeout(400); await shot(page, '02-scrolled');
  await page.evaluate(() => window.scrollTo(0, 0));
  for (const [t, n] of [['탭 강화', '03-tap'], ['상자', '04-box'], ['도감', '05-dex']]) { await page.locator('.dock .tab', { hasText: t }).click(); await page.waitForTimeout(400); await shot(page, n); }
  await page.locator('.dock .tab', { hasText: '서비스' }).click(); await page.waitForTimeout(300);
  // 전화 연타(키보드 + 마우스)
  await page.mouse.move(...(await ph(page)));
  for (let i = 0; i < 5; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(110); }
  const [px, py] = await ph(page);
  for (let i = 0; i < 4; i++) { await page.mouse.click(px + 10, py); await page.waitForTimeout(90); }
  await shot(page, '06-tapping');
  // 결합 연결선
  await page.waitForTimeout(1000);
  await page.locator('.card .buy').first().click(); await page.waitForTimeout(350); await shot(page, '07-bundle');
  // hover / focus
  await page.waitForTimeout(1500);
  await page.locator('.card .buy').nth(1).hover(); await page.waitForTimeout(250); await shot(page, '08-hover');
  await page.mouse.move(5, 5); await page.keyboard.press('Tab'); for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
  await page.waitForTimeout(250); await shot(page, '09-focus');
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  // 모달
  await page.locator('button[aria-label="설정"]').click(); await page.waitForTimeout(500); await shot(page, '10-settings'); await page.keyboard.press('Escape');
  await page.locator('.move-btn').click(); await page.waitForTimeout(500); await shot(page, '11-move-confirm'); await page.keyboard.press('Escape');
  const ct = page.locator('.contract-btn:visible').first();
  if (await ct.count()) { await ct.click(); await page.waitForTimeout(500); await shot(page, '12-contract'); await page.keyboard.press('Escape'); } else console.log('no contract btn');
  await page.evaluate(() => { const t = document.querySelector('.toast'); t.textContent = '포인트가 부족해요'; t.classList.add('show'); });
  await page.waitForTimeout(400); await shot(page, '13-toast');
  // 택배
  await page.evaluate(() => { Math.random = () => 0.5; const s = window.__ajd.get(); window.__ajd.set({ ...s, parcel: { nextInSec: 90, remainSec: 8 } }); });
  await page.waitForTimeout(2500); await shot(page, '14-parcel');
  const pb = await page.locator('.parcel').boundingBox(); console.log('parcel', JSON.stringify(pb), JSON.stringify(await page.locator('.room').boundingBox()));
  await page.locator('.parcel').dispatchEvent('pointerdown'); await page.waitForTimeout(400); await shot(page, '15-parcel-reward');
  await ctx.close();
  // 피버
  ({ ctx, page } = await open(browser, V4));
  await page.evaluate(() => { window.__orig = Math.random; const s = window.__ajd.get(); window.__ajd.set({ ...s, fever: { ...s.fever, gauge: 59, activeSec: 0 } }); });
  const [fx, fy] = await ph(page);
  for (let i = 0; i < 16; i++) { await page.mouse.click(fx, fy); await page.waitForTimeout(150); }
  await page.waitForTimeout(500); await shot(page, '16-fever');
  await ctx.close();
  // 이벤트
  ({ ctx, page } = await open(browser, { ...V4, event: { nextInSec: 0.3, remainSec: 0, streak: 0 } }));
  await page.waitForSelector('.event-call:not([hidden])', { timeout: 6000 }); await page.waitForTimeout(400); await shot(page, '17-event-call');
  await page.locator('.event-call').click(); await page.waitForTimeout(500); await shot(page, '18-event-modal');
  await ctx.close();
  // 특전 3택
  ({ ctx, page } = await open(browser, { ...V4, moves: 2, perks: { tap_power: 1 }, perkOffers: [['tap_power', 'svc_power', 'bundle_boost']] }));
  await page.locator('.perk-alert').click(); await page.waitForTimeout(600); await shot(page, '19-perk');
  await ctx.close();
  // 상자 결과
  ({ ctx, page } = await open(browser, { ...V4, points: 1e9 }));
  await page.locator('.dock .tab', { hasText: '상자' }).click(); await page.waitForTimeout(300);
  await page.locator('.box-open').click(); await page.waitForSelector('.box-scene'); await page.waitForTimeout(900); await shot(page, '20-box-shake');
  for (let i = 0; i < 8; i++) { await page.mouse.click(720, 450); await page.waitForTimeout(250); }
  await page.waitForTimeout(1500); await shot(page, '21-box-result');
  await page.waitForSelector('.bs-actions', { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(500); await shot(page, '22-box-actions');
  await ctx.close();
  ({ ctx, page } = await open(browser, { ...V4, points: 1e10 }));
  await page.locator('.dock .tab', { hasText: '상자' }).click(); await page.waitForTimeout(300);
  await page.locator('.box-ten').click(); await page.waitForSelector('.box-scene'); await page.waitForTimeout(1200);
  for (let i = 0; i < 14; i++) { await page.mouse.click(720, 450); await page.waitForTimeout(300); }
  await page.waitForSelector('.sum-wrap', { timeout: 15000 }).catch(() => console.log('no sum')); await page.waitForTimeout(800); await shot(page, '23-ten-result');
  await ctx.close();
  // 이사 연출
  ({ ctx, page } = await open(browser, { ...V4, points: 1e18, earned: 1e18, services: [30, 18, 10, 4, 1, 0, 0, 0] }));
  await page.locator('.move-btn').click(); await page.waitForTimeout(400);
  await page.locator('.modal .btn.primary, .modal .btn.danger').last().click();
  await page.waitForSelector('.move-scene', { timeout: 3000 }); await page.waitForTimeout(1800); await shot(page, '24-move-scene');
  await page.waitForTimeout(5000); await shot(page, '25-move-after');
  await ctx.close();
  // 어두운 테마
  ({ ctx, page } = await open(browser, { ...V4, moves: 5 }));
  await shot(page, '26-dark');
  await ctx.close();
  // 폭별 메인
  for (const [w, h] of [[1024, 768], [1366, 768], [1920, 1080]]) {
    ({ ctx, page } = await open(browser, V4, { width: w, height: h }));
    await shot(page, `27-main-${w}`);
    console.log(w, 'noHScroll', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'moveRow bottom', await page.evaluate(() => Math.round(document.querySelector('.move-row').getBoundingClientRect().bottom)), 'hint bottom', await page.evaluate(() => Math.round(document.querySelector('.key-hint').getBoundingClientRect().bottom)));
    await ctx.close();
  }
  await browser.close();
})();
