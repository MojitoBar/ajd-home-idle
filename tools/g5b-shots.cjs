// g5b 수정 촬영: 이사 줄(비활성/활성)·상자 탭·방 선반 양 끝. 출력 screenshots/g5-fix/b-*
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.URL || 'http://localhost:5173';
const OUT = path.join(__dirname, '..', 'screenshots', 'g5-fix');
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const run = (g) => !only || only.includes(g);
const mob = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pc = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
const SEED = { unlocked: ['tap', 'bundle', 'box', 'dex', 'move', 'contract', 'mult', 'badge', 'perk'], version: 3, points: 5e6, earned: 5e6, moves: 0, tapLevel: 3, services: [20, 12, 11, 10, 0, 0, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], collection: {} };
const PREFS = { sound: false, music: false, haptics: false };
async function open(browser, o, seed) {
  const ctx = await browser.newContext(o);
  await ctx.addInitScript(([k, s, p]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(k, JSON.stringify({ ...s, stats: { totalEarned: 0, playSec: 0, boxesOpened: 0, totalTaps: 500 }, savedAt: Date.now() }));
    localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p));
  }, ['ajd-home-idle:save', seed, PREFS]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(BASE + '/?debug');
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  return { ctx, page };
}
const R = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map((v) => +v.toFixed(1)); };
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    if (run('move')) {
      const cfg = [['360', mob(360, 740)], ['390', mob(390, 844)], ['430', mob(430, 932)], ['1024', pc(1024, 768)], ['1440x900', pc(1440, 900)], ['1440x960', pc(1440, 960)], ['1920', pc(1920, 1080)]];
      for (const [w, o] of cfg) {
        const { ctx, page } = await open(browser, o, SEED);
        await page.locator('.move-row').scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        const m = await page.evaluate(() => { const row = document.querySelector('.move-row'); const k = [...row.children].map((c) => { const r = c.getBoundingClientRect(); return [c.className.split(' ')[0], r.top, r.bottom].map((v) => typeof v === 'number' ? +v.toFixed(1) : v); }); return { disabled: document.querySelector('.move-btn').disabled, kids: k }; });
        console.log('move', w, JSON.stringify(m));
        const rr = await page.evaluate(() => { const r = document.querySelector('.move-row').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
        await page.screenshot({ path: path.join(OUT, `b-move-off-${w}.png`), clip: { x: Math.max(0, rr[0] - 8), y: Math.max(0, rr[1] - 12), width: Math.min(o.viewport.width, rr[2] + 16), height: rr[3] + 30 } });
        if (w === '390') {
          await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, points: 9e8, earned: 9e8 }); });
          await page.waitForTimeout(1500);
          console.log('move-on', JSON.stringify(await page.evaluate(() => [...document.querySelector('.move-row').children].map((c) => { const r = c.getBoundingClientRect(); return [c.className.split(' ')[0], +r.top.toFixed(1), +r.bottom.toFixed(1)]; }))), await page.evaluate(() => document.querySelector('.move-btn').disabled));
          await page.screenshot({ path: path.join(OUT, `b-move-on-${w}.png`), clip: { x: Math.max(0, rr[0] - 8), y: Math.max(0, rr[1] - 12), width: Math.min(o.viewport.width, rr[2] + 16), height: rr[3] + 30 } });
        }
        await ctx.close();
      }
    }
    if (run('box')) {
      const { ctx, page } = await open(browser, mob(390, 844), SEED);
      await page.evaluate(() => { const t = [...document.querySelectorAll('.tab')].find((e) => /상자/.test(e.textContent)); t && t.click(); });
      await page.waitForTimeout(600);
      console.log('hint', await page.evaluate(() => [...document.querySelectorAll('*')].filter((e) => !e.children.length && /건너뛸/.test(e.textContent)).map((e) => e.textContent)));
      await page.screenshot({ path: path.join(OUT, 'b-box-390.png') });
      await ctx.close();
    }
    if (run('room')) {
      for (const [w, o] of [['360', mob(360, 740)], ['390', mob(390, 844)], ['430', mob(430, 932)], ['1440', pc(1440, 900)]]) {
        const { ctx, page } = await open(browser, o, SEED);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(300);
        const m = await page.evaluate((R) => { const f = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map((v) => +v.toFixed(1)); }; const room = document.querySelector('.room'); return { vw: innerWidth, room: f('.room'), ov: [...(() => { const c = []; for (let e = document.querySelector('.px-shelf'); e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); c.push(e.className + ':' + s.overflow + ':' + s.transform); } return c; })()], shelf: f('.px-shelf'), plank: f('.px-plank'), l: f('.px-sup.l'), r: f('.px-sup.r') }; });
        console.log('room', w, JSON.stringify(m));
        const sh = m.shelf;
        await page.screenshot({ path: path.join(OUT, `b-room-${w}.png`), clip: { x: 0, y: Math.max(0, sh[1] - 20), width: o.viewport.width, height: 70 } });
        await ctx.close();
      }
    }
  } finally { await browser.close(); }
})();
