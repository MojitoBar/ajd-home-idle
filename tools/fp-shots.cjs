// 피버·치명타·결합·테마 낱장 촬영 + 연타 후 DOM 노드 복원 확인. 전제: preview 4173, 격리 Aside 9333.
// 사용: node tools/fp-shots.cjs  → screenshots/fp-*.png
const { chromium } = require('playwright');
const OUT = __dirname + '/../screenshots/';
const M = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const PCV = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const BASE = { version: 3, points: 5e9, earned: 5e9, moves: 0, tapLevel: 8, services: [9, 4, 3, 0, 0, 0, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], collection: {} };
const tap = `(() => { const b = document.querySelector('.phone'); const r = b.getBoundingClientRect(); b.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true })); })()`;
async function open(browser, view, seed) {
  const ctx = await browser.newContext(view);
  await ctx.addInitScript((s) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem('ajd-home-idle:save', JSON.stringify({ ...s, savedAt: Date.now() })); localStorage.setItem('ajd-home-idle:prefs', JSON.stringify({ sound: false, music: false, haptics: false })); }, seed);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto('http://localhost:4173?debug');
  await page.waitForSelector('.phone');
  await page.waitForTimeout(700);
  return { ctx, page };
}
const setS = (p, patch) => p.evaluate((x) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, ...x }); }, patch);
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  // 피버 중 메인(모바일·PC), 치명타
  for (const [tag, view] of [['m', M], ['pc', PCV]]) {
    const { ctx, page } = await open(browser, view, BASE);
    await setS(page, { fever: { gauge: 0, activeSec: 7, cooldownSec: 0 } });
    await page.waitForTimeout(2200);
    for (let i = 0; i < 4; i++) { await page.evaluate(tap); await page.waitForTimeout(70); }
    await page.screenshot({ path: OUT + (tag === 'm' ? 'fp-01-fever-mobile.png' : 'fp-02-fever-pc.png') });
    if (tag === 'm') {
      await page.waitForTimeout(500);
      await setS(page, { fever: { gauge: 0, activeSec: 0, cooldownSec: 0 } });
      await page.waitForTimeout(600);
      await page.evaluate(() => { const o = Math.random; Math.random = () => 0.001; document.querySelector('.phone').dispatchEvent(new PointerEvent('pointerdown', { clientX: 195, clientY: 300, bubbles: true })); Math.random = o; });
      await page.waitForTimeout(260);
      await page.screenshot({ path: OUT + 'fp-03-crit-mobile.png' });
    }
    await ctx.close();
  }
  // 결합 연결선: 4번째 서비스를 사서 통신 결합(0,3) 완성
  for (const [tag, view, name] of [['m', M, 'fp-04-bundle-mobile.png'], ['pc', PCV, 'fp-05-bundle-pc.png']]) {
    const { ctx, page } = await open(browser, view, { ...BASE, services: [9, 10, 10, 10, 0, 0, 0, 0] });
    await page.locator('.card .buy').nth(0).click();
    await page.waitForTimeout(tag === 'm' ? 1100 : 1100);
    await page.screenshot({ path: OUT + name });
    await ctx.close();
  }
  // 테마
  const themes = ['blue', 'mint', 'sunset', 'night', 'moon', 'mars', 'jupiter', 'nebula', 'edge'];
  for (let k = 0; k < themes.length; k++) {
    const { ctx, page } = await open(browser, M, { ...BASE, moves: k, points: 5e12, earned: 5e12 });
    await page.evaluate(tap); await page.waitForTimeout(120); await page.evaluate(tap);
    await page.waitForTimeout(120);
    await page.screenshot({ path: OUT + `fp-theme-${k}-${themes[k]}.png` });
    await ctx.close();
  }
  // 10초 연타(초당 10회) 뒤 노드 수
  {
    const { ctx, page } = await open(browser, M, BASE);
    const n0 = await page.evaluate(() => document.querySelectorAll('*').length);
    let peak = 0, peakFloat = 0;
    for (let k = 0; k < 100; k++) {
      await page.evaluate(() => { const b = document.querySelector('.phone'); const rc = b.getBoundingClientRect(); b.dispatchEvent(new PointerEvent('pointerdown', { clientX: rc.left + rc.width / 2 + Math.random() * 30 - 15, clientY: rc.top + rc.height / 2, bubbles: true, cancelable: true })); });
      const m = await page.evaluate(() => [document.querySelectorAll('*').length, document.querySelectorAll('.fx-float').length]);
      peak = Math.max(peak, m[0] - n0); peakFloat = Math.max(peakFloat, m[1]);
      await page.waitForTimeout(95);
    }
    await page.waitForTimeout(3500);
    const r = { n0, peakExtra: peak, peakFloat, particles: await page.evaluate(() => window.__ajd.particles()), n1: await page.evaluate(() => document.querySelectorAll('*').length) };
    console.log('연타 노드', JSON.stringify(r));
    await ctx.close();
  }
  await browser.close();
})();
