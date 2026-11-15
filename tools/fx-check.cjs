// 이펙트 점검: 연타 프레임 간격 + 연출 스크린샷. 전제: vite preview 4173, 격리 Aside CDP 9333.
const { chromium } = require('playwright');
const path = require('path');
const URL = 'http://localhost:4173';
const KEY = 'ajd-home-idle:save';
const SHOTS = path.join(__dirname, '..', 'screenshots');
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const errors = [];

async function open(browser, seed) {
  const ctx = await browser.newContext(MOBILE);
  await ctx.addInitScript(([k, s]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(k, JSON.stringify({ ...s, savedAt: Date.now() }));
  }, [KEY, seed]);
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  await page.waitForSelector('.phone');
  return { ctx, page };
}

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    // 1. 연타 5초 + 프레임 간격
    let { ctx, page } = await open(browser, { version: 1, points: 2e5, earned: 3e5, moves: 0, tapLevel: 12, services: [28, 14, 8, 3, 0, 0, 0, 0] });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      window.__d = [];
      let l = performance.now();
      const f = (n) => { window.__d.push(n - l); l = n; requestAnimationFrame(f); };
      requestAnimationFrame(f);
      const ph = document.querySelector('.phone');
      const r = ph.getBoundingClientRect();
      window.__t = setInterval(() => {
        ph.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: r.left + 20 + Math.random() * (r.width - 40), clientY: r.top + 20 + Math.random() * (r.height - 40) }));
      }, 100);
    });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SHOTS, 'fx-01-tap.png') });
    await page.waitForTimeout(2000);
    const st = await page.evaluate(() => {
      clearInterval(window.__t);
      const d = window.__d.slice(5);
      const sorted = [...d].sort((a, b) => a - b);
      return { n: d.length, avg: d.reduce((a, b) => a + b, 0) / d.length, p95: sorted[Math.floor(d.length * 0.95)], max: sorted[d.length - 1] };
    });
    console.log('프레임 간격(ms)', JSON.stringify(st, (k, v) => (typeof v === 'number' ? Math.round(v * 10) / 10 : v)));
    await ctx.close();

    // 2. 마일스톤
    ({ ctx, page } = await open(browser, { version: 1, points: 5000, earned: 5000, moves: 0, tapLevel: 0, services: [9, 0, 0, 0, 0, 0, 0, 0] }));
    await page.waitForTimeout(400);
    await page.locator('.card .buy').first().click();
    await page.waitForTimeout(380);
    await page.screenshot({ path: path.join(SHOTS, 'fx-02-milestone.png') });
    await ctx.close();

    // 3~4. 이사
    ({ ctx, page } = await open(browser, { version: 1, points: 8e7, earned: 1.2e8, moves: 0, tapLevel: 9, services: [30, 18, 10, 4, 1, 0, 0, 0] }));
    await page.waitForTimeout(500);
    await page.locator('.move-btn').click();
    await page.waitForSelector('.modal');
    await page.locator('.modal .btn.primary').click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SHOTS, 'fx-03-move.png') });
    await page.waitForTimeout(950);
    await page.screenshot({ path: path.join(SHOTS, 'fx-03b-slam.png') });
    await page.waitForSelector('.move-scene', { state: 'detached', timeout: 15000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(SHOTS, 'fx-04-newhome.png') });
    await ctx.close();
  } catch (e) {
    console.log('예외', e.message);
    errors.push(e.message);
  } finally {
    await browser.close().catch(() => {});
  }
  console.log('콘솔 오류', errors.length, errors.join(' | '));
  process.exit(errors.length ? 1 : 0);
})();
