// 자동 연타 상한 제거 검증(a~d)과 칩 사진. 전제: 개발 서버 localhost:5173, 격리 Aside CDP 9333. 출력 screenshots/boxloop/ru-m-*.png
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = process.env.URL || 'http://localhost:5173';
const OUT = path.join(__dirname, '..', 'screenshots', 'boxloop');
fs.mkdirSync(OUT, { recursive: true });
const o = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const seed = () => ({ unlocked: ['tap', 'bundle', 'box', 'dex', 'move', 'contract', 'mult', 'badge', 'perk'], version: 3, points: 5e6, earned: 5e6, moves: 0, tapLevel: 3, services: [20, 12, 11, 10, 9, 8, 7, 6], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], collection: {}, stats: { totalEarned: 0, playSec: 0, boxesOpened: 0, totalTaps: 500 } });
async function open(browser) {
  const ctx = await browser.newContext(o);
  await ctx.addInitScript(([k, s, p]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(k, JSON.stringify({ ...s, savedAt: Date.now() }));
    localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p));
  }, ['ajd-home-idle:save', seed(), { sound: false, music: false, haptics: false, chargeDone: true, weakDone: true }]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(BASE + '/?debug');
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  return { ctx, page };
}
const rs = (page) => page.evaluate(() => window.__ajd.get().unpack.rushSec);
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    // a. 14초에서 시계 상자 하나 -> 19
    let { ctx, page } = await open(browser);
    await page.evaluate(() => { const g = window.__ajd.get(); window.__ajd.set({ ...g, tapLevel: 200, unpack: { ...g.unpack, box: 30, rushSec: 0 } }); });
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__ajd.special('clock', 0));
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__ajd.rush(14));
    const b = await page.locator('.phone').boundingBox();
    const k0 = await page.evaluate(() => window.__ajd.get().unpack.box);
    for (let i = 0; i < 40 && (await page.evaluate(() => window.__ajd.get().unpack.box)) === k0; i++) {
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await page.waitForTimeout(120);
    }
    console.log('a. box', k0, '->', await page.evaluate(() => window.__ajd.get().unpack.box));
    console.log('a. rush 14 -> 시계 상자 1개 뒤', await rs(page));
    await ctx.close();
    // b. 1700연쇄
    ({ ctx, page } = await open(browser));
    await page.evaluate(() => { const g = window.__ajd.get(); window.__ajd.set({ ...g, tapLevel: 200, unpack: { ...g.unpack, box: 30, rushSec: 0 } }); });
    await page.waitForTimeout(400);
    const b0 = await page.evaluate(() => window.__ajd.get().unpack.box);
    await page.evaluate(() => window.__ajd.chain(1700));
    await page.waitForFunction(() => !window.__ajd.getChain().playing, null, { timeout: 30000, polling: 20 });
    const g = await page.evaluate(() => window.__ajd.get());
    const clocks = await page.evaluate(async ([salt, from, to]) => {
      const m = await import('/src/logic/unpack.ts');
      let n = 0;
      for (let k = from; k < to; k++) if (m.specialAt(salt, k) === 'clock') n++;
      return n;
    }, [g.unpack.salt, b0, g.unpack.box]);
    console.log(`b. 연쇄 뒤 box ${b0}->${g.unpack.box}, rushSec=${g.unpack.rushSec.toFixed(2)}, 시계 상자 ${clocks}개 x5=${clocks * 5}`);
    await ctx.close();
    // c. 칩 사진
    ({ ctx, page } = await open(browser));
    await page.evaluate(() => { const g = window.__ajd.get(); window.__ajd.set({ ...g, unpack: { ...g.unpack, box: 5 } }); });
    for (const [sec, name] of [[125, 'ru-m-125'], [1500, 'ru-m-1500'], [40, 'ru-m-40'], [999, 'ru-m-999'], [99999, 'ru-m-99999']]) {
      await page.evaluate((s) => window.__ajd.rush(s), sec);
      await page.waitForTimeout(250);
      const m = await page.evaluate(() => { const t = document.querySelector('.rush-tag'), r = document.querySelector('.room').getBoundingClientRect(), c = t.getBoundingClientRect(), f = document.querySelector('.fever-tag').getBoundingClientRect(); const sp = t.querySelector('span').getBoundingClientRect(); return { txt: t.innerText, tagW: c.width, feverW: f.width, spanW: sp.width, inRoom: c.left >= r.left && c.right <= r.right, overflow: t.scrollWidth > t.clientWidth }; });
      console.log('c.', sec, JSON.stringify(m));
      const rb = await page.locator('.rush-tag').boundingBox();
      await page.screenshot({ path: path.join(OUT, name + '.png'), clip: { x: Math.max(0, rb.x - 30), y: rb.y - 20, width: Math.min(390, rb.width + 60), height: rb.height + 40 } });
      if (sec === 125 || sec === 1500) await page.screenshot({ path: path.join(OUT, name + '-room.png'), clip: await (async () => { const r = await page.locator('.room').boundingBox(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })() });
    }
    // 피버 칩이 떠 있을 때 폭(칩은 피버 칩과 같은 폭에서 시작해 글자가 길면 왼쪽으로 늘어난다)
    await page.evaluate(() => window.__ajd.fever());
    for (const [sec, name] of [[125, 'ru-m-125-fever'], [1500, 'ru-m-1500-fever']]) {
      await page.evaluate((s) => window.__ajd.rush(s), sec);
      await page.waitForTimeout(300);
      const m = await page.evaluate(() => { const t = document.querySelector('.rush-tag'), f = document.querySelector('.fever-tag'); return { tagW: t.getBoundingClientRect().width, feverW: f.getBoundingClientRect().width, overflow: t.scrollWidth > t.clientWidth }; });
      console.log('c.fever', sec, JSON.stringify(m));
      const rb = await page.locator('.rush-tag').boundingBox(), fb = await page.locator('.fever-tag').boundingBox();
      await page.screenshot({ path: path.join(OUT, name + '.png'), clip: { x: Math.max(0, Math.min(rb.x, fb.x) - 30), y: rb.y - 20, width: 390 - Math.max(0, Math.min(rb.x, fb.x) - 30), height: fb.y + fb.height - rb.y + 40 } });
    }
    // d. 새로고침 뒤 유지
    await page.evaluate(() => window.__ajd.rush(125));
    await page.waitForTimeout(3500);
    await page.reload();
    await page.waitForSelector('.phone');
    await page.waitForTimeout(800);
    console.log('d. 새로고침 뒤 rushSec', await rs(page));
    await ctx.close();
  } finally { await browser.close(); }
})();
