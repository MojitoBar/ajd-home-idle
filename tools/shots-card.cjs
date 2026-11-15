// 카드 글자 정리 촬영: node tools/shots-card.cjs [접두사]  -> screenshots/card-text/
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.URL || 'http://localhost:5173';
const P = process.argv[2] || '';
const OUT = path.join(__dirname, '..', 'screenshots', process.env.OUTDIR || 'card-text');
const SEED = { unlocked: ['tap', 'bundle', 'box', 'dex', 'move', 'contract', 'mult', 'badge', 'perk'], version: 3, points: 5e6, earned: 5e6, moves: 0, tapLevel: 3, services: [20, 12, 11, 10, 0, 0, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], collection: {} };
const mob = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const pc = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
const NEW = [['m390-new', mob(390, 844)], ['pc1440-new', pc(1440, 900)]];
const SHOTS = [
  ['m390-services', mob(390, 844), '서비스'], ['m390-tool', mob(390, 844), '공구 강화'], ['m390-box', mob(390, 844), '상자'],
  ['m360-services', mob(360, 800), '서비스'], ['m360-hint', mob(360, 800), '서비스', [25, 12, 11, 23, 0, 0, 0, 0]], ['pc1440-services', pc(1440, 900), '서비스'], ['pc1024-services', pc(1024, 768), '서비스'], ['pc1280-services', pc(1280, 820), '서비스'],
];
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  for (const [name, o] of NEW) {
    const ctx = await browser.newContext(o);
    await ctx.addInitScript(() => { localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify({ sound: false, music: false, haptics: false })); });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('pageerror', e.message));
    await page.goto(BASE + '/?debug'); await page.waitForSelector('.phone');
    await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(900);
    console.log(name, JSON.stringify(await page.evaluate(() => ({ hs: document.documentElement.scrollWidth > innerWidth }))));
    await page.screenshot({ path: path.join(OUT, P + name + '.png'), fullPage: false });
    await ctx.close();
  }
  for (const [name, o, tab, svc] of SHOTS) {
    const ctx = await browser.newContext(o);
    await ctx.addInitScript(([s]) => {
      if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
      localStorage.setItem('ajd-home-idle:save', JSON.stringify({ ...s, stats: { totalEarned: 0, playSec: 0, boxesOpened: 0, ...(s.stats || {}), totalTaps: Math.max(500, (s.stats && s.stats.totalTaps) || 0) }, savedAt: Date.now() }));
      localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify({ sound: false, music: false, haptics: false }));
    }, [{ ...SEED, services: svc || SEED.services, points: tab === '상자' ? 1e9 : 5e6 }]);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('pageerror', e.message));
    await page.goto(BASE + '/?debug'); await page.waitForSelector('.phone');
    await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(900);
    await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, unpack: { ...s.unpack, box: 45, damage: 0, roomDone: false } }); });
    await page.locator('.tab', { hasText: tab }).click(); await page.waitForTimeout(400);
    if (tab === '상자') await page.evaluate(() => document.querySelector('.box-hero').scrollIntoView({ block: 'start' }));
    if (tab !== '상자') await page.evaluate(() => { const el = document.querySelector('.card-list') || document.querySelector('.tap-card'); el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -8); });
    const ov = await page.evaluate(() => ({ hs: document.documentElement.scrollWidth > innerWidth, cards: [...document.querySelectorAll('.card')].filter((c) => c.offsetParent).map((c) => [c.querySelector('.card-name')?.textContent, c.getBoundingClientRect().height | 0, c.scrollWidth > c.clientWidth]) }));
    console.log(name, JSON.stringify(ov));
    await page.screenshot({ path: path.join(OUT, P + name + '.png'), fullPage: false });
    await ctx.close();
  }
  await browser.close();
})();
