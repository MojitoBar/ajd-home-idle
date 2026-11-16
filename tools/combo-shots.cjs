// 콤보 촬영. 전제: 개발 서버 localhost:5173, 격리 Aside CDP 9333. 출력 screenshots/combo/
// 유지 사진은 __ajd.keep()으로 창을 계속 갱신하고, 단계 오름은 __ajd.combo(n-1) 뒤 실제 탭 1번으로 만든다.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = process.env.URL || 'http://localhost:5173';
const OUT = path.join(__dirname, '..', 'screenshots', 'combo');
fs.mkdirSync(OUT, { recursive: true });
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const mob = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pc = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const cfgs = { m390: mob(390, 844), pc: pc, m360: mob(360, 740) };
const seed = (fever) => ({ unlocked: ['tap', 'bundle', 'box', 'dex', 'move', 'contract', 'mult', 'badge', 'perk'], version: 3, points: 5e6, earned: 5e6, moves: 0, tapLevel: 3, services: [20, 12, 11, 10, 9, 8, 7, 6], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], collection: {}, stats: { totalEarned: 0, playSec: 0, boxesOpened: 0, totalTaps: 500 } });
async function open(browser, o, fever) {
  const ctx = await browser.newContext(o);
  await ctx.addInitScript(([k, s, p]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(k, JSON.stringify({ ...s, savedAt: Date.now() }));
    localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p));
  }, ['ajd-home-idle:save', seed(), { sound: false, music: false, haptics: false }]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(BASE + '/?debug');
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  await page.evaluate(() => { window.scrollTo(0, 0); setInterval(() => { if (!window.__keepOff) window.__ajd.keep(); }, 150); });
  if (fever) {
    await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, fever: { ...s.fever, activeSec: 9, gauge: 45 } }); });
  }
  await page.waitForTimeout(300);
  return { ctx, page };
}
const tapOnce = async (page) => {
  const b = await page.locator('.phone').boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
};
const roomClip = async (page, o) => {
  const b = await page.locator('.room').boundingBox();
  const pad = 0;
  return { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - 10), width: Math.min(o.viewport.width, b.width + 2 * pad), height: Math.min(o.viewport.height - Math.max(0, b.y - 10), b.height + 20) };
};
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    const plan = [
      ['m390', ['hold1', 'hold3', 'hold5', 'up', 'settle', 'fever', 'tip']],
      ['pc', ['hold1', 'hold3', 'hold5', 'up', 'settle', 'fever']],
      ['m360', ['hold3', 'settle']],
    ];
    for (const [name, shots] of plan) {
      const o = cfgs[name];
      for (const sh of shots) {
        if (only && !only.includes(sh) && !only.includes(name)) continue;
        const { ctx, page } = await open(browser, o, sh === 'fever');
        const set = (n) => page.evaluate((n) => window.__ajd.combo(n), n);
        const shot = async (tag, clip) => page.screenshot({ path: path.join(OUT, `${name}-${tag}.png`), clip: clip || (await roomClip(page, o)) });
        if (sh === 'hold1') { await set(14); await tapOnce(page); await page.waitForTimeout(250); await shot('1-hold1'); }
        if (sh === 'hold3') { await set(59); await tapOnce(page); await page.waitForTimeout(1500); await shot('2-hold3'); }
        if (sh === 'hold5') { await set(209); await tapOnce(page); await page.waitForTimeout(2600); await shot('3-hold5'); }
        if (sh === 'up') {
          for (const [n, tag] of [[24, 'up2'], [199, 'up5']]) {
            await set(n); await tapOnce(page); await page.waitForTimeout(260); await shot(`4-${tag}`, { x: 0, y: 0, width: o.viewport.width, height: Math.min(o.viewport.height, 700) });
            await page.waitForTimeout(1800);
          }
        }
        if (sh === 'settle') {
          await set(65); await page.evaluate(() => { window.__keepOff = 1; });
          // 유지 갱신을 끄고 창(1초)이 지나 끊기게 둔다
          await page.waitForTimeout(1250);
          await shot('5-settle-a', { x: 0, y: 0, width: o.viewport.width, height: Math.min(o.viewport.height, 700) });
          await page.waitForTimeout(500);
          await shot('5-settle-b', { x: 0, y: 0, width: o.viewport.width, height: Math.min(o.viewport.height, 700) });
        }
        if (sh === 'tip') { await set(209); await tapOnce(page); await page.waitForTimeout(400); await page.evaluate(() => { window.__ajd.tip(); }); await page.waitForTimeout(300); await shot('7-tip200'); }
        if (sh === 'fever') { await set(59); await tapOnce(page); await page.waitForTimeout(700); await shot('6-fever', { x: 0, y: 0, width: o.viewport.width, height: Math.min(o.viewport.height, 700) }); }
        await ctx.close();
      }
    }
  } finally { await browser.close(); }
})();
