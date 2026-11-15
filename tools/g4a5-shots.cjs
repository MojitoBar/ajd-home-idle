const { chromium } = require('playwright');
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/shots-final.cjs', 'utf8');
const SEED = eval('(' + /const SEED = (\{.*\});/.exec(src)[1] + ')');
const KEY = 'ajd-home-idle:save';
const OUT = __dirname + '/../screenshots/g4a5-fix/';
const mob = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const SZ = { 390: mob(390, 844), 360: mob(360, 740), 1440: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } };
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  for (const [w, moves, done, name] of JSON.parse(process.env.JOBS)) {
    const ctx = await browser.newContext(SZ[w]);
    await ctx.addInitScript(([k, s, p]) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
      localStorage.setItem(k, JSON.stringify({ ...s, stats: { totalEarned: 0, playSec: 0, boxesOpened: 0, totalTaps: 500 }, savedAt: Date.now() }));
      localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p)); }, [KEY, { ...SEED, moves }, { sound: false, music: false, haptics: false }]);
    const page = await ctx.newPage();
    await page.goto('http://localhost:5173/?debug'); await page.waitForSelector('.phone');
    await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(900);
    await page.evaluate((d) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, unpack: { ...s.unpack, box: d ? 85 : 45, damage: 0, roomDone: !!d } }); }, done);
    await page.waitForTimeout(900);
    await page.screenshot({ path: OUT + `${w}-${name}.png` });
    const r = await page.evaluate(() => { const q = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; }; return { room: q('.room'), wall: q('.un-wall'), cur: q('.un-slot.cur'), slots: [...document.querySelectorAll('.un-slot')].map((e) => e.className + ' ' + JSON.stringify(e.getBoundingClientRect())) .slice(0,8) }; });
    console.log(w, name, JSON.stringify(r));
    await ctx.close();
  }
  await browser.close();
})();
