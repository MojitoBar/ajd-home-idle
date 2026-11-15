// 전체 화면 연출 프레임 촬영. 전제: vite preview 4173, 격리 Aside CDP 9333.
// 사용: node tools/fx-frames.cjs <출력폴더> [케이스...]  (케이스: box-low box-mid box-top box-gold box-rainbow box-shiny ten move)
// 프레임은 <폴더>/<케이스>-NNN.jpg + <케이스>.json(시각 ms, 입자 수) 로 저장한다. 접지는 tools/fx-sheet.py 가 만든다.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const URL = 'http://localhost:4173';
const KEY = 'ajd-home-idle:save';
const OUT = process.argv[2];
const WANT = process.argv.slice(3);
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
const SEED = { version: 3, points: 5e15, earned: 5e15, moves: 0, tapLevel: 12, services: [20, 12, 11, 10, 0, 0, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], collection: {} };
const CASES = {
  'box-low': { q: [0.1, 0.1, 0.1] },
  'box-mid': { q: [0.92, 0.5, 0.1] },
  'box-top': { q: [0.9985, 0.5, 0.1] },
  'box-gold': { q: [0.99, 0.5, 0.99] },
  'box-rainbow': { q: [0.99, 0.5, 0.9999] },
  'box-shiny': { q: [0.92, 0.5, 0.9] },
  ten: { q: [0.1, 0.1, 0.1, 0.4, 0.2, 0.1, 0.7, 0.3, 0.1, 0.92, 0.5, 0.1, 0.2, 0.9, 0.9, 0.5, 0.5, 0.1, 0.99, 0.4, 0.99, 0.3, 0.6, 0.1, 0.8, 0.7, 0.1, 0.9985, 0.3, 0.1], ten: true },
  move: { move: true },
};
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    for (const name of WANT.length ? WANT : Object.keys(CASES)) {
      const c = CASES[name];
      const ctx = await browser.newContext(MOBILE);
      const seed = c.move ? { ...SEED, moves: 0, points: 1e30, earned: 1e30 } : SEED;
      await ctx.addInitScript(([k, s]) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem(k, JSON.stringify({ ...s, savedAt: Date.now() })); localStorage.setItem('ajd-home-idle:prefs', JSON.stringify({ sound: false, music: false, haptics: false })); }, [KEY, seed]);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => console.log('pageerror', e.message));
      await page.goto(URL + '?debug');
      await page.waitForSelector('.phone');
      await page.waitForTimeout(500);
      if (c.q) await page.evaluate((qq) => { const o = Math.random; window.__q = qq.slice(); Math.random = () => (window.__q.length ? window.__q.shift() : o()); }, c.q);
      const meta = [];
      const t0 = Date.now();
      const snap = async (i) => {
        const t = Date.now() - t0;
        const buf = await page.screenshot({ type: 'jpeg', quality: 82 });
        fs.writeFileSync(path.join(OUT, `${name}-${String(i).padStart(3, '0')}.jpg`), buf);
        meta.push({ i, t, p: await page.evaluate(() => window.__ajd.particles()) });
      };
      if (c.move) {
        await page.locator('.tab', { hasText: '서비스' }).click().catch(() => {});
        await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, points: 1e30, earned: 1e30 }); });
        const btn = page.locator('button', { hasText: '이사' }).first();
        await btn.scrollIntoViewIfNeeded().catch(() => {});
        await btn.click();
        await page.locator('.modal .btn', { hasText: '이사하기' }).click();
      } else {
        await page.locator('.tab', { hasText: '상자' }).click();
        await page.waitForTimeout(300);
        await page.locator(c.ten ? '.box-ten' : '.box-open').click();
      }
      t0 && 0;
      let i = 0;
      let endAt = 0;
      while (Date.now() - t0 < 9000) {
        await snap(i++);
        const done = await page.evaluate(() => !!document.querySelector('.bs-actions:not(.lock)') || (!document.querySelector('.move-scene') && !!window.__movedone));
        if (c.move) { if (!(await page.evaluate(() => !!document.querySelector('.move-scene')))) break; }
        else if (done && !endAt) endAt = Date.now() + 700;
        if (endAt && Date.now() > endAt) break;
      }
      meta.push({ nodes: await page.evaluate(() => document.querySelectorAll('*').length) });
      fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(meta));
      const peak = Math.max(...meta.filter((m) => m.p !== undefined).map((m) => m.p));
      console.log(name, 'frames', i, 'ms', meta[meta.length - 2].t, 'peakParticles', peak);
      await ctx.close();
    }
  } finally { await browser.close(); }
})();
