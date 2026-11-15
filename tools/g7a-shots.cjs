// g7a 촬영·실측: 방 선반 가운데 정렬(폭별·집별)과 머리 높이. 출력 screenshots/g7-fix/
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.URL || 'http://localhost:5173';
const OUT = path.join(__dirname, '..', 'screenshots', 'g7-fix');
const mob = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pc = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
const S8 = [20, 12, 11, 10, 9, 8, 7, 6];
const S4 = [20, 12, 11, 10, 0, 0, 0, 0];
const seed = (services, moves, points = 5e6) => ({ unlocked: ['tap', 'bundle', 'box', 'dex', 'move', 'contract', 'mult', 'badge', 'perk'], version: 3, points, earned: points, moves, tapLevel: 3, services, event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], collection: {} });
const PREFS = { sound: false, music: false, haptics: false };
const THEMES = ['blue', 'mint', 'sunset', 'night', 'moon', 'mars', 'jupiter', 'nebula', 'edge'];
async function open(browser, o, sd) {
  const ctx = await browser.newContext(o);
  await ctx.addInitScript(([k, s, p]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(k, JSON.stringify({ ...s, stats: { totalEarned: 0, playSec: 0, boxesOpened: 0, totalTaps: 500 }, savedAt: Date.now() }));
    localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p));
  }, ['ajd-home-idle:save', sd, PREFS]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(BASE + '/?debug');
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  return { ctx, page };
}
const measure = (page) => page.evaluate(async () => {
  const f = (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; };
  const room = document.querySelector('.room');
  const rr = f(room);
  const pl = f(document.querySelector('.px-plank'));
  const sl = f(document.querySelector('.px-sup.l')), sr = f(document.querySelector('.px-sup.r'));
  const vis = [Math.max(0, rr[0]), Math.min(innerWidth, rr[2])];
  const ic = [];
  for (const b of document.querySelectorAll('.px-svc')) {
    const img = b.querySelector('img'); const r = f(b);
    const c = document.createElement('canvas'); const im = new Image(); im.src = img.currentSrc || img.src; await im.decode();
    c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; let mn = 1e9, mx = -1;
    for (let j = 0; j < c.height; j++) for (let i = 0; i < c.width; i++) if (d[(j * c.width + i) * 4 + 3] > 0) { mn = Math.min(mn, i); mx = Math.max(mx, i + 1); }
    const k = (r[2] - r[0]) / c.width; ic.push([r[0] + mn * k, r[0] + mx * k]);
  }
  const head = document.querySelector('header.top').getBoundingClientRect();
  const R = (a) => a.map((v) => +v.toFixed(1));
  const supL = R(sl), supR = R(sr);
  return { vw: innerWidth, roomTop: +rr[1].toFixed(1), headH: +head.height.toFixed(1), noIco: document.querySelector('header.top').classList.contains('no-ico'), room: R(rr), plankL: +(pl[0] - vis[0]).toFixed(1), plankR: +(vis[1] - pl[2]).toFixed(1), supL: +(sl[0] - vis[0]).toFixed(1), supR: +(vis[1] - sr[2]).toFixed(1), plank: R(pl), supLrect: supL, supRrect: supR, icoL: ic.length ? +(Math.min(...ic.map((a) => a[0])) - pl[0]).toFixed(1) : null, icoR: ic.length ? +(pl[2] - Math.max(...ic.map((a) => a[1]))).toFixed(1) : null, icoMid: ic.length ? +(((Math.min(...ic.map((a) => a[0])) + Math.max(...ic.map((a) => a[1]))) / 2) - (pl[0] + pl[2]) / 2).toFixed(1) : null };
});
async function shot(page, name, o) {
  const y = await page.evaluate(() => document.querySelector('.px-shelf').getBoundingClientRect().top);
  await page.screenshot({ path: path.join(OUT, name + '.png'), clip: { x: 0, y: Math.max(0, y - 60), width: o.viewport.width, height: 130 } });
}
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    const cfg = [['360', mob(360, 740)], ['390', mob(390, 844)], ['430', mob(430, 932)], ['1024', pc(1024, 768)], ['1440', pc(1440, 900)], ['1920', pc(1920, 1080)]];
    for (const [w, o] of cfg) for (const [n, S] of [['s8', S8], ['s4', S4]]) {
      if (n === 's4' && w !== '360' && w !== '390') continue;
      const { ctx, page } = await open(browser, o, seed(S, 0));
      console.log('shelf', w, n, JSON.stringify(await measure(page)));
      await shot(page, `shelf-${w}-${n}`, o);
      await ctx.close();
    }
    for (const i of [5]) {
      const { ctx, page } = await open(browser, mob(390, 844), seed(S8, i));
      const m = await measure(page);
      console.log('house390', i, THEMES[i], JSON.stringify({ roomTop: m.roomTop, headH: m.headH, noIco: m.noIco, plankL: m.plankL, plankR: m.plankR }));
      await shot(page, `house-390-${i + 1}-${THEMES[i]}`, mob(390, 844));
      await ctx.close();
    }
    {
      const o = mob(390, 1500);
      const { ctx, page } = await open(browser, o, seed(S4, 0, 1e12));
      await page.locator('.card').nth(4).locator('button').first().click();
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(OUT, 'buy-390-200ms.png'), clip: { x: 0, y: 0, width: 390, height: 560 } });
      await ctx.close();
    }
  } finally { await browser.close(); }
})();
