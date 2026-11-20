// 연쇄 1000단 재생 중 가장 긴 프레임·입자 최대 수·연출 DOM 수 측정. 전제: vite preview 4173, 격리 Aside CDP 9333.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify({ sound: false, music: false, haptics: false, chargeDone: true, weakDone: true })));
  const page = await ctx.newPage();
  page.on('console', (m) => /SWEEP/.test(m.text()) && console.log(m.text()));
  await page.goto('http://localhost:4173?debug');
  await page.waitForSelector('.phone');
  await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, unlocked: ['tap','home','box','dex','mult','badge','perk'], points: 1e6, earned: 1e5, tapLevel: 200, unpack: { ...s.unpack, box: 30, damage: 0, hp: 1 } }); });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__ajd.chain(50));
  await page.waitForTimeout(4000);
  const r = await page.evaluate(async () => {
    const SEL = '.un-bit, .un-flat, .fx-edge, .fx-edgebox, .un-ring, .fx-ring, .fx-flash, .un-flash, .fx-tail, .fx-dot';
    let maxGap = 0, maxP = 0, maxDom = 0;
    window.__ajd.chain(1000);
    let last = performance.now();
    const t0 = last;
    await new Promise((res) => {
      const tick = (now) => {
        if (now - last > 40) (window.__slow = window.__slow || []).push([Math.round(now - t0), Math.round(now - last), window.__ajd.getChain().n]); maxGap = Math.max(maxGap, now - last); last = now;
        maxP = Math.max(maxP, window.__ajd.particles());
        maxDom = Math.max(maxDom, document.querySelectorAll(SEL).length);
        if (now - t0 > 6000) return res();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await new Promise((q) => setTimeout(q, 2000));
    return { maxGap: Math.round(maxGap), maxP, maxDom, domAfter: document.querySelectorAll(SEL).length, left: [...document.querySelectorAll(SEL)].map((e) => e.className).join('|'), pAfter: window.__ajd.particles(), playing: window.__ajd.getChain().playing, slow: window.__slow };
  });
  console.log(JSON.stringify(r));
  await ctx.close(); await browser.close();
})();
