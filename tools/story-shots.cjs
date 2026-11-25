// 이야기 사진: 인트로·도착 쪽지·엔딩·끝 화면·다시 보기. 전제: vite preview 4173, 격리 Aside(헤드리스) CDP 9333.
const { chromium } = require('playwright');
const path = require('path');

const URL = 'http://localhost:4173';
const KEY = 'ajd-home-idle:save';
const SHOTS = path.join(__dirname, '..', 'screenshots');
require('fs').mkdirSync(SHOTS, { recursive: true });
const PREFS = { sound: false, music: false, haptics: false, chargeDone: true, weakDone: true };
const ALL = ['tap', 'home', 'box', 'dex', 'mult', 'badge', 'perk'];
const mobile = (w) => ({ viewport: { width: w, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const PC = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };

async function open(browser, opts, seed, query = '?debug') {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript((p) => localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p)), PREFS);
  if (seed) {
    await ctx.addInitScript(([key, s]) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem(key, JSON.stringify({ ...s, savedAt: Date.now() }));
    }, [KEY, seed]);
  }
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(URL + query);
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page };
}
const seedAt = (moves) => ({ version: 9, unlocked: ALL, points: 5e9, earned: 1e60, moves, bestChain: 37, stats: { totalTaps: 5231, totalEarned: 3.4e31, playSec: 9000, boxesOpened: 812 }, tapLevel: 12, strikeLevel: 4, gear: { level: 3 }, homeLv: [3, 2, 1, 0, 0, 0, 0, 0], unpack: { box: 40, damage: 0, roomDone: false, hp: 1e15, salt: 5, rushSec: 0 } });
const snap = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function doMove(page) {
  await page.locator('.move-btn').click();
  await page.waitForSelector('.modal');
  await page.locator('.modal .btn.primary').click();
}
/** 이사 장면을 눌러 건너뛰며 쪽지를 기다린다 */
async function toNote(page) {
  for (let i = 0; i < 40; i++) {
    if (await page.locator('.story-ov .sn-note').count()) return;
    if (await page.locator('.move-scene').count()) await page.mouse.click(100, 400).catch(() => {});
    await sleep(400);
  }
}

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  const want = (k) => !only || only.includes(k);
  try {
    if (want('intro')) {
      for (const w of [390, 360]) {
        const { ctx, page } = await open(browser, mobile(w), null, '?debug&guide');
        await page.waitForSelector('.story-ov .sn-note');
        await sleep(800);
        await snap(page, w === 390 ? 'st-390-intro-1' : 'st-360-intro');
        if (w === 390) {
          await page.locator('.story-ov').click({ position: { x: 100, y: 100 } });
          await page.locator('.story-ov').click({ position: { x: 100, y: 100 } });
          await sleep(800);
          await snap(page, 'st-390-intro-2');
          await page.locator('.story-ov').click({ position: { x: 100, y: 100 } });
          await page.locator('.story-ov').click({ position: { x: 100, y: 100 } });
          await sleep(800);
          await snap(page, 'st-390-intro-3');
          await page.locator('.sn-next').click();
          await sleep(900);
          await snap(page, 'st-390-after-intro');
        }
        await ctx.close();
      }
    }
    if (want('notes')) {
      for (const [moves, name] of [[0, 'twoRoom'], [3, 'moon'], [7, 'edge']]) {
        const { ctx, page } = await open(browser, mobile(390), seedAt(moves));
        await sleep(600);
        await doMove(page);
        await toNote(page);
        await sleep(900);
        await snap(page, `st-390-note-${name}`);
        if (name === 'moon') {
          await page.locator('.sn-next').click();
          await sleep(900);
          await snap(page, 'st-390-note-moon-after');
        }
        await ctx.close();
      }
      {
        const { ctx, page } = await open(browser, PC, seedAt(0));
        await sleep(600);
        await doMove(page);
        await toNote(page);
        await sleep(900);
        await snap(page, 'st-1440-note');
        await ctx.close();
      }
    }
    if (want('ending')) {
      for (const [opts, tag] of [[mobile(390), '390'], [mobile(360), '360'], [PC, '1440']]) {
        const { ctx, page } = await open(browser, opts, seedAt(8));
        await sleep(600);
        await doMove(page);
        const main = tag === '390';
        // 시선 연출 + 문단
        if (main) { await sleep(300); await snap(page, 'st-390-ending-01'); }
        await page.waitForSelector('.story-ov .sn-note', { timeout: 8000 });
        await sleep(700);
        if (main) await snap(page, 'st-390-ending-02');
        await page.locator('.sn-next').click(); await page.locator('.sn-next').click();
        await sleep(700);
        if (main) await snap(page, 'st-390-ending-03');
        await page.locator('.sn-next').click(); await page.locator('.sn-next').click();
        await sleep(700);
        if (main) await snap(page, 'st-390-ending-04');
        // 송장 -> 상자가 날아감
        await page.locator('.sn-next').click();
        await sleep(450);
        if (main) for (let i = 5; i <= 7; i++) await snap(page, `st-390-ending-0${i}`);
        await sleep(900);
        await page.evaluate(() => { document.querySelector('.sn-next')?.click(); document.querySelector('.sn-next')?.click(); });
        // 끝 화면
        await page.waitForSelector('.story-ov.end', { timeout: 5000 });
        if (main) for (let i = 8; i <= 10; i++) { await page.waitForFunction(() => getComputedStyle(document.querySelector('.sn-white')).visibility === 'hidden'); await snap(page, i === 10 ? 'st-390-ending-10' : `st-390-ending-0${i}`); }
        else await sleep(150);
        await sleep(3200);
        await snap(page, main ? 'st-390-end' : `st-${tag}-end`);
        await ctx.close();
      }
    }
    if (want('replay')) {
      const { ctx, page } = await open(browser, mobile(390), seedAt(8));
      await sleep(2500);
      await page.locator('.icon-btn[aria-label="설정"]').click();
      await page.waitForSelector('.modal');
      await page.locator('.modal .btn', { hasText: '이야기 다시 보기' }).click();
      await page.waitForSelector('.sn-list');
      await sleep(700);
      await snap(page, 'st-390-replay');
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
})();
