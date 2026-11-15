// g7 b2 촬영·실측: node tools/g7b2-shots.cjs  (MODE=perk|move, 환경변수 URL, OUT_DIR)
// 격리 Aside CDP 9333. 특전 막대 실측(4개 크기) + 이사 장면 구름/글자 간격 실측.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const BASE = process.env.URL || 'http://localhost:5173';
const OUT = process.env.OUT_DIR || path.join(__dirname, '..', 'screenshots', 'g7-fix');
const KEY = 'ajd-home-idle:save';
const SEED = { unlocked: ['tap', 'bundle', 'box', 'dex', 'move', 'contract', 'mult', 'badge', 'perk'], version: 3, points: 5e6, earned: 5e6, moves: 0, tapLevel: 3, services: [20, 12, 11, 10, 0, 0, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], collection: {} };
const PREFS = { sound: false, music: false, haptics: false };
const mob = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pc = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
async function open(browser, o, seed) {
  const ctx = await browser.newContext(o);
  await ctx.addInitScript(([k, s, p]) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
    localStorage.setItem(k, JSON.stringify({ ...s, stats: { totalEarned: 0, playSec: 0, boxesOpened: 0, totalTaps: 500 }, savedAt: Date.now() })); localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p)); }, [KEY, seed, PREFS]);
  const page = await ctx.newPage();
  await page.goto(BASE + '/?debug'); await page.waitForSelector('.phone'); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(900);
  return { ctx, page };
}
const measure = () => {
  const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { t: b.top, b: b.bottom, l: b.left, r: b.right }; };
  const col = document.querySelector('.col-play'); const bar = document.querySelector('.perk-alert:not([hidden])');
  const name = document.querySelector('.house-name'); const room = document.querySelector('.room');
  const kh = document.querySelector('.key-hint');
  return { vh: innerHeight, name: r(name)?.t, room: r(room)?.t, bar: r(bar), barH: bar && bar.getBoundingClientRect().height, gap: bar ? innerHeight - bar.getBoundingClientRect().bottom : null,
    colSH: col.scrollHeight, colCH: col.clientHeight, docSH: document.documentElement.scrollHeight, kh: kh ? getComputedStyle(kh).display : null, barText: bar && bar.textContent.trim(), barTextOverflow: bar && bar.scrollWidth > bar.clientWidth + 1 };
};
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const mode = process.env.MODE || 'perk'; const tag = process.env.TAG || '';
  try {
    if (mode === 'perk') {
      for (const [w, h] of (process.env.SIZES ? process.env.SIZES.split(',').map((x) => x.split('x').map(Number)) : [[1024, 768], [1280, 800], [1440, 900], [1920, 1080]])) {
        for (const perk of [true, false]) {
          const { ctx, page } = await open(browser, pc(w, h), perk ? { ...SEED, perkOffers: [['tap_power', 'crit', 'svc_power']] } : SEED);
          await page.waitForTimeout(500);
          const m = await page.evaluate(`(${measure.toString()})()`); m.rw = await page.evaluate(() => document.querySelector('.room').getBoundingClientRect().width); m.mt = await page.evaluate(() => { const e = document.querySelector('.move-extra'); return e ? getComputedStyle(e).marginTop : null; }); m.mrb = await page.evaluate(() => { const e = document.querySelector('.move-row'); return e ? e.getBoundingClientRect().bottom : null; }); m.mh = await page.evaluate(() => { const e = document.querySelector('.move-row'); return e ? e.getBoundingClientRect().height : null; }); m.mvb = await page.evaluate(() => { const e = document.querySelector('.move-extra'); return e ? e.getBoundingClientRect().bottom : null; });
          console.log(w + 'x' + h, perk ? 'BAR ' : 'none', JSON.stringify(m));
          if (process.env.SHOT) await page.screenshot({ path: path.join(OUT, `${process.env.PREFIX || 'b2-'}${tag}perk-${w}x${h}-${perk ? 'bar' : 'none'}.png`) });
          await ctx.close();
        }
      }
    } else {
      for (const [w, h, mb] of [[360, 740, 1], [390, 844, 1], [1024, 768, 0], [1440, 900, 0]]) {
        const { ctx, page } = await open(browser, mb ? mob(w, h) : pc(w, h), { ...SEED, points: 8e7, earned: 8e7 });
        await page.locator('.move-btn').click(); await page.locator('.modal .btn.primary').click(); await page.waitForSelector('.move-scene');
        let min = 1e9, minAt = null, n = 0; const shots = [];
        const t0 = Date.now();
        while (Date.now() - t0 < 9000) {
          const s = await page.evaluate(() => {
            const sc = document.querySelector('.move-scene'); if (!sc) return null;
            const vis = (e) => { const cs = getComputedStyle(e); return cs.visibility !== 'hidden' && cs.display !== 'none'; };
            const texts = [...sc.querySelectorAll('.sc-label, .sc-arrive-name, .sc-from, .sc-skip, .sc-mult, .sc-go')].filter(vis).map((e) => { const rg = document.createRange(); rg.selectNodeContents(e); const b = rg.getBoundingClientRect(); return { c: e.className, t: b.top, b: b.bottom, l: b.left, r: b.right, txt: e.textContent.slice(0, 6) }; });
            const clouds = [...sc.querySelectorAll('.sc-cloud')].map((c) => { const b = c.getBoundingClientRect(); return { t: b.top - 32, b: b.bottom, l: b.left, r: b.left + 80 }; });
            return { texts, clouds };
          });
          if (!s) break; n++;
          for (const c of s.clouds) for (const t of s.texts) {
            if (!process.env.ANYX && t.r <= c.l || c.r <= t.l || c.r < 0) continue; // 가로로 안 겹침
            const d = Math.max(t.t - c.b, c.t - t.b); if (d < min) { min = d; minAt = { c, t, ms: Date.now() - t0 }; }
          }
          if (process.env.SHOT && [2, 4, 6, 8].includes(n)) { shots.push(1); await page.screenshot({ path: path.join(OUT, `b2-${tag}move-${w}-${shots.length}.png`) }); }
          await page.waitForTimeout(100);
        }
        console.log(w, '샘플', n, '가로 겹침 구간 최소 세로 간격', min === 1e9 ? '없음' : min, minAt ? JSON.stringify(minAt) : '');
        await ctx.close();
      }
    }
  } finally { await browser.close(); }
})();
