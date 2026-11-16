// 급소 노리기 촬영. 전제: 개발 서버 localhost:5173, 격리 Aside CDP 9333. 출력 screenshots/weak/
// __ajd.weak(u,v)로 급소를 띄워 고정, __ajd.weakHit()로 맞힌다.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = process.env.URL || 'http://localhost:5173';
const OUT = path.join(__dirname, '..', 'screenshots', 'weak');
fs.mkdirSync(OUT, { recursive: true });
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const mob = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const cfgs = { m390: mob(390, 844), pc: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, m360: mob(360, 740) };
const seed = (taps) => ({ unlocked: ['tap', 'bundle', 'box', 'dex', 'move', 'contract', 'mult', 'badge', 'perk'], version: 3, points: 5e6, earned: 5e6, moves: 0, tapLevel: 3, services: [20, 12, 11, 10, 9, 8, 7, 6], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], collection: {}, stats: { totalEarned: 0, playSec: 0, boxesOpened: 0, totalTaps: taps } });
async function open(browser, o, taps, weakDone = true) {
  const ctx = await browser.newContext(o);
  await ctx.addInitScript(([k, s, p]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(k, JSON.stringify({ ...s, savedAt: Date.now() }));
    localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p));
  }, ['ajd-home-idle:save', seed(taps), { sound: false, haptics: false, chargeDone: true, weakDone }]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(BASE + '/?debug');
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  await page.evaluate(() => { window.scrollTo(0, 0); });
  return { ctx, page };
}
// 깜빡임의 보이는 순간에 멈춰 찍는다
const freezeOn = (page) => page.waitForFunction(() => { const d = document.querySelector('.weak-dot'); if (!d || getComputedStyle(d).visibility !== 'visible') return false; d.getAnimations().forEach((a) => a.pause()); return true; }, null, { polling: 'raf' });
const roomClip = async (page, o) => {
  const b = await page.locator('.room').boundingBox();
  return { x: Math.max(0, b.x), y: Math.max(0, b.y - 10), width: Math.min(o.viewport.width, b.width), height: Math.min(o.viewport.height - Math.max(0, b.y - 10), b.height + 30) };
};
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    const plan = [
      ['m390', ['up', 'hit', 'combo', 'tip']],
      ['pc', ['up', 'hit']],
      ['m360', ['hit']],
    ];
    for (const [name, shots] of plan) {
      const o = cfgs[name];
      for (const sh of shots) {
        if (only && !only.includes(sh) && !only.includes(name)) continue;
        const { ctx, page } = await open(browser, o, 500, sh !== 'tip');
        const ev = (fn, a) => page.evaluate(fn, a);
        const shot = async (tag) => page.screenshot({ path: path.join(OUT, `${name}-${tag}.png`), clip: await roomClip(page, o) });
        if (sh === 'up') { await ev(() => window.__ajd.weak(0.7, 0.35)); await page.waitForTimeout(500); await freezeOn(page); await shot('1-up'); }
        if (sh === 'hit') { await ev(() => window.__ajd.weak(0.35, 0.6)); await page.waitForTimeout(300); await ev(() => window.__ajd.weakHit()); await page.waitForTimeout(170); await shot('2-hit'); }
        if (sh === 'combo') { await ev(() => window.__ajd.combo(29)); { const b = await page.locator('.phone').boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); } await ev(() => { window.__ajd.weak(0.3, 0.7); setInterval(() => window.__ajd.keep(), 150); }); await page.waitForTimeout(500); await freezeOn(page); await shot('3-combo-up'); }
        if (sh === 'tip') { await ev(() => { window.__ajd.weak(0.5, 0.5); }); await page.waitForTimeout(500); await freezeOn(page); await shot('4-tip'); }
        await ctx.close();
      }
    }
  } finally { await browser.close(); }
})();
