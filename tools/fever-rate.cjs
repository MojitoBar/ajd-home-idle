// 피버 난이도 실측: 일정 간격으로 전화를 눌러 피버(body.fever)가 켜질 때까지 걸린 시간을 잰다. 전제: preview 4173, 격리 Aside 9333.
// 사용: node tools/fever-rate.cjs [초당횟수...]  (기본 3 4 5 6)
const { chromium } = require('playwright');
const RATES = process.argv.slice(2).map(Number);
const SEED = { version: 3, points: 1000, earned: 1000, moves: 0, tapLevel: 1, services: [0, 0, 0, 0, 0, 0, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], collection: {} };
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  for (const rate of RATES.length ? RATES : [3, 4, 5, 6]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctx.addInitScript((s) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem('ajd-home-idle:save', JSON.stringify({ ...s, savedAt: Date.now() })); localStorage.setItem('ajd-home-idle:prefs', JSON.stringify({ sound: false, music: false, haptics: false })); }, SEED);
    const page = await ctx.newPage();
    await page.goto('http://localhost:4173?debug');
    await page.waitForSelector('.phone');
    const sec = await page.evaluate((rate) => new Promise((res) => {
      const ph = document.querySelector('.phone');
      const t0 = performance.now();
      const iv = setInterval(() => {
        const e = new PointerEvent('pointerdown', { clientX: 195, clientY: 300, bubbles: true, cancelable: true });
        ph.dispatchEvent(e);
        if (document.body.classList.contains('fever')) { clearInterval(iv); res((performance.now() - t0) / 1000); }
        if (performance.now() - t0 > 90000) { clearInterval(iv); res(-1); }
      }, 1000 / rate);
    }), rate);
    console.log(`초당 ${rate}회: ${sec.toFixed(1)}초`);
    await ctx.close();
  }
  await browser.close();
})();
