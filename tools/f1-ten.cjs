// F1-2 확인: 10개 결과를 낮은 PC 화면에서 촬영 -> screenshots/f1-fix/<폭>x<높이>-open-ten.png
const { chromium } = require('playwright');
const H = require('./shots-fx2.cjs');
const { open, rng, queue, done, boxTab, SEED, pc, sleep } = H;
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    for (const [w, h] of [[1024, 768], [1100, 800], [900, 800]]) {
      const { ctx, page } = await open(browser, pc(w, h), { ...SEED, points: 1e9 });
      await boxTab(page); await rng(page, 7);
      await page.locator('.box-ten').click(); await done(page); await sleep(4500);
      await page.screenshot({ path: `screenshots/f1-fix/${w}x${h}-open-ten.png` });
      console.log(w, h, JSON.stringify(await page.evaluate(() => { const a = document.querySelector('.bs-actions').getBoundingClientRect(); const b = document.querySelector('.sum-body'); return { actTop: a.top, actBottom: a.bottom, vh: innerHeight, scrollH: b.scrollHeight, clientH: b.clientHeight, docW: document.documentElement.clientWidth }; })));
      await ctx.close();
    }
  } finally { await browser.close(); }
})();
