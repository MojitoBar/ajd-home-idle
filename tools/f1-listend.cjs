// F1-1 확인: 집 단계·내 특전 목록을 끝까지 내린 장면 -> screenshots/f1-fix/390-<이름>-end.png
const { chromium } = require('playwright');
const H = require('./shots-fx2.cjs');
const { open, SEED, mob } = H;
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    for (const [name, seed, sel] of [['house-step', SEED, '.step-btn'], ['perk-list', { ...SEED, perks: { tap_power: 2, crit: 1, svc_power: 3, contract_slot: 1 } }, '.perk-btn']]) {
      const { ctx, page } = await open(browser, mob(390, 844, { deviceScaleFactor: 2 }), seed);
      await page.locator(sel).click(); await page.waitForTimeout(700);
      await page.evaluate(() => { const b = document.querySelector('.modal-body'); b.scrollTop = b.scrollHeight; });
      await page.waitForTimeout(300);
      await page.screenshot({ path: `screenshots/f1-fix/390-${name}-end.png` });
      console.log(name, JSON.stringify(await page.evaluate(() => { const b = document.querySelector('.modal-body'); const l = b.lastElementChild.getBoundingClientRect(); const r = b.getBoundingClientRect(); return { lastBottom: l.bottom, bodyBottom: r.bottom, scrolls: b.scrollHeight > b.clientHeight }; })));
      await ctx.close();
    }
  } finally { await browser.close(); }
})();
