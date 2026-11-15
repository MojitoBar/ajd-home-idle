// g7b 촬영·실측: 선반 간격(2도트)·약정 칸/결합 줄 윗변·아랫변·상자 탭 그림 가운데. 출력 screenshots/g7-fix/b1-*
// 전제: 개발 서버(URL), 격리 Aside CDP 9333. ONLY=shelf,line,box 로 골라 실행
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.URL || 'http://localhost:5173';
const OUT = process.env.OUT_DIR || path.join(__dirname, '..', 'screenshots', 'g7-fix');
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const run = (g) => !only || only.includes(g);
const mob = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pc = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
const S8 = [20, 12, 11, 10, 9, 8, 7, 6];
const S4 = [20, 12, 11, 10, 0, 0, 0, 0];
const seed = (services, points = 5e6) => ({ unlocked: ['tap', 'bundle', 'box', 'dex', 'move', 'contract', 'mult', 'badge', 'perk'], version: 3, points, earned: points, moves: 0, tapLevel: 3, services, event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], collection: {} });
const PREFS = { sound: false, music: false, haptics: false };
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
const shelfM = (page) => page.evaluate(async () => {
  const f = (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; };
  const rr = f(document.querySelector('.room'));
  const pl = f(document.querySelector('.px-plank'));
  const sl = f(document.querySelector('.px-sup.l')), sr = f(document.querySelector('.px-sup.r'));
  const vis = [Math.max(0, rr[0]), Math.min(innerWidth, rr[2])];
  const ic = [];
  for (const b of document.querySelectorAll('.px-svc')) {
    const img = b.querySelector('img'); const r = f(b);
    const im = new Image(); im.src = img.currentSrc || img.src; await im.decode();
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; let mn = 1e9, mx = -1;
    for (let j = 0; j < c.height; j++) for (let i = 0; i < c.width; i++) if (d[(j * c.width + i) * 4 + 3] > 0) { mn = Math.min(mn, i); mx = Math.max(mx, i + 1); }
    const k = (r[2] - r[0]) / c.width; ic.push([r[0] + mn * k, r[0] + mx * k]);
  }
  const R = (v) => +v.toFixed(1);
  return { vw: innerWidth, room: rr.map(R), plankL: R(pl[0] - vis[0]), plankR: R(vis[1] - pl[2]), supL: R(sl[0] - vis[0]), supR: R(vis[1] - sr[2]), gaps: ic.slice(1).map((a, i) => R(a[0] - ic[i][1])), icoL: R(ic[0][0] - pl[0]), icoR: R(pl[2] - ic[ic.length - 1][1]), n: ic.length };
});
const lineM = (page) => page.evaluate(() => {
  const chip = document.querySelector('.slots-pill'), btn = document.querySelector('.chip.bundle-toggle');
  const f = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return { l: +r.left.toFixed(1), t: +r.top.toFixed(1), r: +r.right.toFixed(1), h: +r.height.toFixed(1), shadow: s.boxShadow, mb: s.marginBottom }; };
  return { chip: f(chip), btn: f(btn) };
});
const boxM = (page) => page.evaluate(async () => {
  const img = document.querySelector('.box-art .gift-img'), t = document.querySelector('.box-title');
  const r = img.getBoundingClientRect();
  const im = new Image(); im.src = img.src; await im.decode();
  const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data; let mn = 1e9, mx = -1;
  for (let j = 0; j < c.height; j++) for (let i = 0; i < c.width; i++) if (d[(j * c.width + i) * 4 + 3] > 0) { mn = Math.min(mn, i); mx = Math.max(mx, i + 1); }
  const k = r.width / c.width; const art = (r.left + (mn + mx) / 2 * k);
  const rg = document.createRange(); rg.selectNodeContents(t); const tr = rg.getBoundingClientRect();
  return { artMid: +art.toFixed(1), titleMid: +((tr.left + tr.right) / 2).toFixed(1), diff: +(art - (tr.left + tr.right) / 2).toFixed(1), imgLeft: +r.left.toFixed(1) };
});
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    const cfg = [['360', mob(360, 740)], ['390', mob(390, 844)], ['430', mob(430, 932)], ['1024', pc(1024, 768)], ['1440', pc(1440, 900)]];
    if (run('shelf')) for (const [w, o] of cfg) for (const [n, S] of [['s8', S8], ['s4', S4]]) {
      if (w === '1024' || (n === 's4' && w !== '360' && w !== '390')) continue;
      const { ctx, page } = await open(browser, o, seed(S));
      console.log('shelf', w, n, JSON.stringify(await shelfM(page)));
      const y = await page.evaluate(() => document.querySelector('.px-shelf').getBoundingClientRect().top);
      await page.screenshot({ path: path.join(OUT, `b1-shelf-${w}-${n}.png`), clip: { x: 0, y: Math.max(0, y - 60), width: o.viewport.width, height: 130 } });
      await ctx.close();
    }
    if (run('line')) for (const [w, o] of cfg) for (const open_ of [true, false]) {
      const { ctx, page } = await open(browser, o, seed(S8));
      const isOpen = await page.evaluate(() => document.querySelector('.chip.bundle-toggle').getAttribute('aria-expanded') === 'true');
      if (isOpen !== open_) { await page.locator('.chip.bundle-toggle').click(); await page.waitForTimeout(300); }
      console.log('line', w, open_ ? 'open' : 'closed', JSON.stringify(await lineM(page)));
      if (open_ === false) {
        const b = await page.locator('.strat-line').boundingBox();
        await page.screenshot({ path: path.join(OUT, `b1-line-${w}.png`), clip: { x: 0, y: Math.max(0, b.y - 10), width: o.viewport.width, height: b.height + 30 } });
      }
      await ctx.close();
    }
    if (run('box')) for (const [w, o] of cfg) {
      if (w === '430' || w === '1024') continue;
      const { ctx, page } = await open(browser, o, seed(S8, 1e9));
      await page.locator('.tab', { hasText: '상자' }).click();
      await page.evaluate(() => document.querySelector('.box-hero').scrollIntoView({ block: 'start' }));
      await page.waitForTimeout(500);
      console.log('box', w, JSON.stringify(await boxM(page)));
      const b = await page.locator('.box-hero').boundingBox();
      await page.screenshot({ path: path.join(OUT, `b1-box-${w}.png`), clip: { x: 0, y: b.y, width: o.viewport.width, height: Math.min(b.height, 260) } });
      await ctx.close();
    }
  } finally { await browser.close(); }
})();
