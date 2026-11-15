// 피버 게이지가 연타 중 멈추지 않고 오르는지 + 스크린샷(tp-01-crit, tp-02-fever-gauge). 전제: preview 4173, 격리 Aside 9333.
// 사용: node tools/fever-gauge.cjs [초당횟수...]  (기본 6 10)
const { chromium } = require('playwright');
const path = require('path');
const SHOTS = path.join(__dirname, '..', 'screenshots');
const RATES = process.argv.slice(2).map(Number);
const SEED = { version: 3, points: 1000, earned: 1000, moves: 0, tapLevel: 1, services: [0, 0, 0, 0, 0, 0, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], collection: {} };
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  for (const rate of RATES.length ? RATES : [6, 10]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ctx.addInitScript((s) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem('ajd-home-idle:save', JSON.stringify({ ...s, savedAt: Date.now() })); localStorage.setItem('ajd-home-idle:prefs', JSON.stringify({ sound: false, music: false, haptics: false })); }, SEED);
    const page = await ctx.newPage();
    await page.goto('http://localhost:4173?debug');
    await page.waitForSelector('.phone');
    const r = await page.evaluate((rate) => new Promise((res) => {
      const ph = document.querySelector('.phone');
      const t0 = performance.now();
      const samples = [];
      const tap = setInterval(() => ph.dispatchEvent(new PointerEvent('pointerdown', { clientX: 195, clientY: 300, bubbles: true, cancelable: true })), 1000 / rate);
      const rd = setInterval(() => {
        const f = window.__ajd.get().fever;
        samples.push(f.activeSec > 0 ? null : f.gauge);
        if (f.activeSec > 0 || performance.now() - t0 > 60000) { clearInterval(tap); clearInterval(rd); res({ samples, sec: (performance.now() - t0) / 1000 }); }
      }, 100);
    }), rate);
    let run = 0, maxRun = 0;
    for (let i = 1; i < r.samples.length; i++) { const a = r.samples[i - 1], b = r.samples[i]; if (a != null && b != null && b < a - 1e-9) { run++; maxRun = Math.max(maxRun, run); } else run = 0; }
    console.log(`초당 ${rate}회: ${r.sec.toFixed(1)}초, 연속 감소 최대 ${maxRun}회 (샘플 ${r.samples.length})`);
    if (rate === 10) {
      await page.waitForTimeout(3500);
      await page.evaluate(() => { const s = window.__ajd.get(); });
    }
    await ctx.close();
  }
  // 스크린샷: 게이지 연타 중, 치명타 순간
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((s) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem('ajd-home-idle:save', JSON.stringify({ ...s, savedAt: Date.now() })); localStorage.setItem('ajd-home-idle:prefs', JSON.stringify({ sound: false, music: false, haptics: false })); }, SEED);
  const page = await ctx.newPage();
  await page.goto('http://localhost:4173?debug');
  await page.waitForSelector('.phone');
  await page.evaluate(() => { const ph = document.querySelector('.phone'); window.__iv = setInterval(() => ph.dispatchEvent(new PointerEvent('pointerdown', { clientX: 195, clientY: 300, bubbles: true, cancelable: true })), 100); });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SHOTS, 'tp-02-fever-gauge.png') });
  await page.evaluate(() => clearInterval(window.__iv));
  await page.waitForTimeout(1500);
  const orig = await page.evaluate(() => { Math.random = () => 0; });
  await page.locator('.phone').dispatchEvent('pointerdown', { clientX: 195, clientY: 300 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(SHOTS, 'tp-01-crit.png') });
  console.log('crit text:', (await page.locator('.fx-float.crit').first().innerText().catch(() => '')).replace(/\n/g, ' '));
  await ctx.close();
  await browser.close();
})();
