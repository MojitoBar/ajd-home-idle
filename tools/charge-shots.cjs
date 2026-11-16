// 꾹 눌러 강타 촬영. 전제: 개발 서버 localhost:5173, 격리 Aside CDP 9333. 출력 screenshots/charge/
// 모으기는 __ajd.holdAt(pos)(표시 고정), 판정은 __ajd.charge(pos)(그 자리에서 떼기)로 만든다.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = process.env.URL || 'http://localhost:5173';
const OUT = path.join(__dirname, '..', 'screenshots', 'charge');
fs.mkdirSync(OUT, { recursive: true });
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const mob = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const cfgs = { m390: mob(390, 844), pc: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, m360: mob(360, 740) };
const seed = (taps) => ({ unlocked: ['tap', 'bundle', 'box', 'dex', 'move', 'contract', 'mult', 'badge', 'perk'], version: 3, points: 5e6, earned: 5e6, moves: 0, tapLevel: 3, services: [20, 12, 11, 10, 9, 8, 7, 6], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], collection: {}, stats: { totalEarned: 0, playSec: 0, boxesOpened: 0, totalTaps: taps } });
async function open(browser, o, taps) {
  const ctx = await browser.newContext(o);
  await ctx.addInitScript(([k, s, p]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(k, JSON.stringify({ ...s, savedAt: Date.now() }));
    localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p));
  }, ['ajd-home-idle:save', seed(taps), { sound: false, music: false, haptics: false }]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(BASE + '/?debug');
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  await page.evaluate(() => { window.scrollTo(0, 0); });
  return { ctx, page };
}
const roomClip = async (page, o, extra = 0) => {
  const b = await page.locator('.room').boundingBox();
  return { x: Math.max(0, b.x), y: Math.max(0, b.y - 10), width: Math.min(o.viewport.width, b.width), height: Math.min(o.viewport.height - Math.max(0, b.y - 10), b.height + 20 + extra) };
};
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    const plan = [
      ['m390', ['hold', 'perfect', 'good', 'miss', 'combo', 'streak', 'tip']],
      ['pc', ['hold', 'perfect', 'good', 'miss', 'combo']],
      ['m360', ['hold', 'perfect']],
    ];
    for (const [name, shots] of plan) {
      const o = cfgs[name];
      for (const sh of shots) {
        if (only && !only.includes(sh) && !only.includes(name)) continue;
        const { ctx, page } = await open(browser, o, sh === 'tip' ? 22 : 500);
        const ev = (fn, a) => page.evaluate(fn, a);
        const shot = async (tag, clip) => page.screenshot({ path: path.join(OUT, `${name}-${tag}.png`), clip: clip || (await roomClip(page, o)) });
        if (sh === 'hold') { await ev(() => window.__ajd.holdAt(0.4)); await page.waitForTimeout(500); await shot('1-hold'); }
        if (sh === 'perfect') { await ev(() => window.__ajd.charge(0.83)); await page.waitForTimeout(260); await shot('2-perfect-a'); await page.waitForTimeout(350); await shot('2-perfect-b'); }
        if (sh === 'good') { await ev(() => window.__ajd.charge(0.65)); await page.waitForTimeout(230); await shot('3-good'); }
        if (sh === 'miss') { await ev(() => window.__ajd.charge(0.2)); await page.waitForTimeout(60); await shot('4-miss'); }
        if (sh === 'combo') { await ev(() => window.__ajd.combo(29)); { const b = await page.locator('.phone').boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); } await ev(() => { window.__ajd.holdAt(0.83); setInterval(() => window.__ajd.keep(), 150); }); await page.waitForTimeout(500); await shot('5-combo-hold'); }
        if (sh === 'streak') { await ev(() => { window.__ajd.streak(4); window.__ajd.holdAt(0.83); }); await page.waitForTimeout(400); await shot('6-streak-hold'); await ev(() => window.__ajd.release()); await page.waitForTimeout(260); await shot('6-streak-perfect'); }
        if (sh === 'tip') { await page.waitForTimeout(600); await ev(() => window.__ajd.tip()); await page.waitForTimeout(300); await shot('7-tip'); }
        await ctx.close();
      }
    }
  } finally { await browser.close(); }
})();
