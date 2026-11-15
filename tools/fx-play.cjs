// 플레이 중 연출 프레임 촬영. 전제: vite preview 4173, 격리 Aside CDP 9333.
// 사용: [PC=1] node tools/fx-play.cjs <출력폴더> [케이스...]   (PC=1이면 1440x900)
// 케이스: tap tap-dock crit damped fever parcel buy buy-hold milestone
// 프레임은 <폴더>/<케이스>-NNN.jpg + <케이스>.json. 접지는 tools/fx-sheet.py.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = process.argv[2];
const WANT = process.argv.slice(3);
const PC = !!process.env.PC;
const VIEW = PC ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
const SEED = { version: 3, points: 5e6, earned: 5e6, moves: 0, tapLevel: 5, services: [9, 4, 0, 0, 0, 0, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], collection: {} };
const tapJs = (sel, crit) => `(() => { const b = document.querySelector('${sel}'); const r = b.getBoundingClientRect(); const o = Math.random; ${crit ? 'Math.random = () => 0.001;' : ''} b.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.left + r.width / 2 + (o() * 20 - 10), clientY: r.top + r.height / 2, bubbles: true, cancelable: true })); Math.random = o; })()`;
const setState = (patch) => `(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, ...(${patch}) }); })()`;
const CASES = {
  tap: { n: 16, gap: 60, step: (p, i) => i % 3 === 0 && p.evaluate(tapJs('.phone')) },
  'tap-dock': { n: 12, gap: 60, step: (p, i) => i % 3 === 0 && p.evaluate(tapJs('.dock-phone')) },
  crit: { n: 16, gap: 40, step: (p, i) => i === 2 && p.evaluate(tapJs('.phone', true)) },
  damped: { n: 14, gap: 30, setup: async (p) => { for (let k = 0; k < 6; k++) await p.evaluate(tapJs('.phone')); }, step: (p, i) => i % 2 === 0 && p.evaluate(tapJs('.phone')) },
  fever: {
    n: 40, gap: 60,
    setup: (p) => p.evaluate(setState('({ fever: { gauge: 40, activeSec: 0, cooldownSec: 0 } })')),
    step: async (p, i) => {
      if (i < 5 || (i > 12 && i % 3 === 0 && i < 22)) await p.evaluate(tapJs('.phone'));
      if (i === 24) await p.evaluate(setState('({ fever: { gauge: 0, activeSec: 3.2, cooldownSec: 0 } })'));
    },
  },
  parcel: {
    n: 40, gap: 90,
    setup: (p) => p.evaluate(setState('({ parcel: { nextInSec: 0, remainSec: 8 } })')),
    step: async (p, i) => { if (i === 22) await p.locator('.parcel').click({ force: true }).catch(() => {}); },
  },
  buy: { n: 16, gap: 60, step: async (p, i) => { if (i === 2) await p.locator('.card .buy').nth(1).click(); } },
  'buy-hold': { n: 24, gap: 60, step: async (p, i) => { if (i % 2 === 0) await p.locator('.card .buy').nth(1).click(); } },
  milestone: { n: 22, gap: 80, step: async (p, i) => { if (i === 2) await p.locator('.card .buy').first().click(); } },
};
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    for (const name of WANT.length ? WANT : Object.keys(CASES)) {
      const c = CASES[name];
      const ctx = await browser.newContext(VIEW);
      await ctx.addInitScript((s) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem('ajd-home-idle:save', JSON.stringify({ ...s, savedAt: Date.now() })); localStorage.setItem('ajd-home-idle:prefs', JSON.stringify({ sound: false, music: false, haptics: false })); }, SEED);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => console.log('pageerror', e.message));
      await page.goto('http://localhost:4173?debug');
      await page.waitForSelector('.phone');
      await page.waitForTimeout(600);
      if (c.setup) await c.setup(page);
      const meta = [];
      const t0 = Date.now();
      for (let i = 0; i < c.n; i++) {
        if (c.step) await c.step(page, i);
        await page.waitForTimeout(c.gap);
        const buf = await page.screenshot({ type: 'jpeg', quality: 85 });
        fs.writeFileSync(path.join(OUT, `${name}-${String(i).padStart(3, '0')}.jpg`), buf);
        meta.push({ i, t: Date.now() - t0, p: await page.evaluate(() => window.__ajd.particles()) });
      }
      fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(meta));
      console.log(name, 'peakParticles', Math.max(...meta.map((m) => m.p)));
      await ctx.close();
    }
  } finally { await browser.close(); }
})();
