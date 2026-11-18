// 특전 상자 화면 촬영(p1). 전제: 개발 서버 localhost:5173, 격리 Aside CDP 9333. 출력 screenshots/boxloop/p1-*.png
// ONLY=이름,이름 으로 일부만 찍는다
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = process.env.URL || 'http://localhost:5173';
const OUT = path.join(__dirname, '..', 'screenshots', 'boxloop');
fs.mkdirSync(OUT, { recursive: true });
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const prefs = { sound: false, music: false, haptics: false, chargeDone: true, weakDone: true };
const M = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const PC = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const ALL = ['tap', 'home', 'box', 'dex', 'move', 'mult', 'badge', 'perk'];
const set = (page, over) => page.evaluate((o) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, ...o }); }, over);
const tab = async (page, id) => { await page.locator(`[data-ux="${id}"]`).first().click(); await page.waitForTimeout(300); };

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  let fails = 0;
  const mk = async (cfg, query = '?debug') => {
    const ctx = await browser.newContext(cfg);
    await ctx.addInitScript((pp) => localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(pp)), prefs);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { fails++; console.log('pageerror', e.message); });
    await page.goto(BASE + query);
    await page.waitForSelector('.phone');
    await page.evaluate(() => document.fonts.ready);
    return { ctx, page };
  };
  const base = { points: 5e9, earned: 1e10, tapLevel: 20, unlocked: ALL, perks: { tap_power: 3, crit: 2, fever_long: 4, streak_coef: 1, strike_power: 5 } };
  const full = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png') });
  try {
    if (!only || only.includes('boxtab')) {
      const { ctx, page } = await mk(M);
      await set(page, base);
      await tab(page, 'box');
      await page.waitForTimeout(500);
      // 두 카드가 한 화면에 들어오도록 상자 탭 패널 윗단을 화면 위로 올린다
      await page.evaluate(() => document.querySelector('.panel.surface').scrollIntoView({ block: 'start' }));
      await page.waitForTimeout(400);
      await full(page, 'p1-m-boxtab');
      await ctx.close();
    }
    if (!only || only.includes('pick')) {
      const { ctx, page } = await mk(M);
      await set(page, base);
      await tab(page, 'box');
      await page.locator('.perkbox-buy').click();
      await page.waitForTimeout(450);
      await full(page, 'p1-m-open');
      await page.waitForSelector('.modal .pcard', { timeout: 6000 });
      await page.waitForTimeout(1600);
      await full(page, 'p1-m-pick');
      await page.locator('.pcard').first().click();
      await page.waitForTimeout(350);
      await full(page, 'p1-m-picked');
      await ctx.close();
    }
    if (!only || only.includes('guide13')) {
      const { ctx, page } = await mk(M);
      await set(page, base);
      await page.evaluate(() => window.__ajd.guide(13));
      await page.waitForTimeout(600);
      await full(page, 'p1-m-guide13-tab');
      await tab(page, 'box');
      await page.waitForTimeout(700);
      await page.evaluate(() => document.querySelector('.panel.surface').scrollIntoView({ block: 'start' }));
      await page.waitForTimeout(700);
      await full(page, 'p1-m-guide13');
      await ctx.close();
    }
    if (!only || only.includes('pc')) {
      const { ctx, page } = await mk(PC);
      await set(page, base);
      await tab(page, 'box');
      await page.waitForTimeout(500);
      await full(page, 'p1-pc-boxtab');
      await ctx.close();
    }
    if (!only || only.includes('perks')) {
      const { ctx, page } = await mk(M);
      await set(page, base);
      await page.locator('.perk-btn').click();
      await page.waitForTimeout(500);
      await full(page, 'p1-m-perks');
      await page.evaluate(() => { const l = document.querySelector('.perk-list'); l.scrollTop = l.scrollHeight; l.parentElement.scrollTop = l.parentElement.scrollHeight; });
      await page.waitForTimeout(300);
      await full(page, 'p1-m-perks-b');
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails}` : 'ok');
})();
