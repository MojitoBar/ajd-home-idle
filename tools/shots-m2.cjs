// 검수용 보충 촬영: node tools/shots-audit.cjs   (ONLY=new,fever,tap,room,care,box,contract,modal,house,pc 로 묶음 선택)
// 전제: 개발 서버 localhost:5173, 격리 Aside CDP 9333. 출력 screenshots/audit/extra/<이름>.png (DPR 1, 모바일 390x844 / PC 표시한 것만)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.URL || 'http://localhost:5173';
const KEY = 'ajd-home-idle:save';
const OUT = process.env.OUT_DIR ? path.join(__dirname, '..', 'screenshots', process.env.OUT_DIR) : path.join(__dirname, '..', 'screenshots', 'audit', 'extra');
const LOG = path.join(OUT, '_log.txt');
const only = null;
const run = (g) => !only || only.includes(g);
const MOB = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
const pc = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
const PC = pc(1440, 900);
const SEED = { unlocked: ['tap', 'bundle', 'box', 'dex', 'move', 'contract', 'mult', 'badge', 'perk'], version: 3, points: 5e6, earned: 5e6, moves: 0, tapLevel: 3, services: [20, 12, 11, 10, 0, 0, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], collection: {} };
const PREFS = { sound: false, music: false, haptics: false };
const IDS = ['fan', 'kettle', 'toaster', 'heating_pad', 'hair_dryer', 'humidifier', 'rice_cooker', 'water_purifier', 'air_purifier', 'air_fryer', 'vacuum', 'coffee_machine', 'dishwasher', 'air_conditioner', 'washer', 'smart_tv', 'fridge', 'massage_chair', 'robot_vacuum'];
const some = {}; IDS.slice(0, 11).forEach((id, i) => { some[id] = { base: 1 + (i % 4), shiny: i % 3 === 0 ? 2 : 0, gold: i === 2 ? 1 : 0, rainbow: 0 }; });
const all = {}; IDS.forEach((id, i) => { all[id] = { base: 1 + ((i * 3) % 16), shiny: 1 + (i % 7), gold: i % 2 ? 1 : 3, rainbow: i % 5 === 0 ? 1 : 2 }; });
const ct = (kind, service) => ({ service, kind, remainSec: 1800, totalSec: 3600, penaltyBase: 1e6 });
const PATTERN = ['small', 'small', 'normal', 'small', 'small', 'normal', 'small', 'small', 'normal', 'big'];
const MULT = { small: 0.7, normal: 1.6, big: 3 };
const hpOf = (k) => Math.ceil(10 * 1.07 ** k * MULT[k >= 80 ? 'small' : PATTERN[k % 10]] - 1e-9);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const problems = [];

async function open(browser, o, seed, { savedAgo = 0, fresh = false, waitSel } = {}) {
  const ctx = await browser.newContext(o);
  await ctx.addInitScript(([k, s, p, ago, fr]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    if (s && !fr) localStorage.setItem(k, JSON.stringify({ ...s, savedAt: Date.now() - ago }));
    localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p));
  }, [KEY, seed, PREFS, savedAgo, fresh]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { if (!/Extension context/.test(e.message)) problems.push(`pageerror ${e.message}`); });
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console.error ${m.text().slice(0, 160)}`); });
  await page.goto(BASE + '/?debug');
  await page.waitForSelector(waitSel || (savedAgo ? '.overlay' : '.phone'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  return { ctx, page };
}
const set = (page, patch) => page.evaluate((pt) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, ...pt }); }, patch);
const setUn = (page, u) => page.evaluate((x) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, unpack: { ...s.unpack, ...x } }); }, u);
const tab = async (page, name) => { await page.locator('.dock .tab:visible, .tab:visible', { hasText: name }).first().click(); await page.waitForTimeout(400); };
const noCrit = (page) => page.evaluate(() => { if (!window.__rnd0) window.__rnd0 = Math.random; Math.random = () => 0.99; });
const queue = (page, q) => page.evaluate((qq) => { const o = Math.random; window.__q = qq; Math.random = () => (window.__q.length ? window.__q.shift() : o()); }, q);
const rng = (page, sd) => page.evaluate((x) => { let a = x; Math.random = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }, sd);
const done = (page) => page.waitForSelector('.bs-actions:not(.lock)', { timeout: 20000 });
async function tapPos(page) {
  return page.evaluate(() => {
    const b = document.querySelector('.un-box[data-pos="0"]');
    const r = (b || document.querySelector('.phone')).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height * 0.6 };
  });
}
async function tap(page, n = 1, gap = 0) {
  const p = await tapPos(page);
  for (let i = 0; i < n; i++) { await page.mouse.click(p.x, p.y); if (gap) await sleep(gap); }
}
async function shot(page, name, note = '') {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  results.push(`${name}${note ? ' | ' + note : ''}`);
  console.log('shot', name, note);
}
async function scene(name, fn) {
  try { await fn(); } catch (e) {
    const msg = `[${name}] 실패 ${e.message.split('\n')[0]}`;
    console.log(msg); problems.push(msg);
  }
}
const toastText = (page) => page.evaluate(() => { const t = document.querySelector('.toast'); return t && t.classList.contains('show') ? t.textContent : ''; });
const scrollTop = (page) => page.evaluate(() => window.scrollTo(0, 0));

const M360 = { viewport: { width: 360, height: 740 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
const measure = (page) => page.evaluate(() => {
  const dock = document.querySelector('.dock').getBoundingClientRect().top;
  const cards = [...document.querySelectorAll('.card')].filter((c) => c.getBoundingClientRect().height > 0);
  let sum = 0;
  for (const c of cards) { const r = c.getBoundingClientRect(); sum += Math.max(0, Math.min(r.bottom, dock) - Math.max(r.top, 0)) / r.height; }
  const g = document.querySelector('.fever-gauge').getBoundingClientRect();
  const bar = document.querySelector('.bar-text');
  return { cards: +sum.toFixed(2), gaugeH: g.height, gaugeW: g.width, bar: bar && bar.textContent };
});
const clip = (page, name, y0, h) => page.screenshot({ path: path.join(OUT, name + '.png'), clip: { x: 0, y: y0, width: page.viewportSize().width, height: h } });

async function fever(browser, o, tag, steps) {
  const { ctx, page } = await open(browser, o, SEED);
  await setUn(page, { box: 45, damage: 0, hp: 0, roomDone: false });
  await noCrit(page);
  await set(page, { fever: { gauge: 0, activeSec: 0, cooldownSec: 0 } });
  await page.waitForTimeout(300);
  if (steps.includes('g0')) { await shot(page, `${tag}-g0`); console.log(tag, JSON.stringify(await measure(page))); }
  if (steps.includes('g50')) {
    await set(page, { fever: { gauge: 23.5, activeSec: 0, cooldownSec: 0 } }); await page.waitForTimeout(300);
    await shot(page, `${tag}-g50`);
  }
  if (steps.includes('act')) {
    await set(page, { fever: { gauge: 44.6, activeSec: 0, cooldownSec: 0 } });
    await tap(page, 1); await page.waitForTimeout(1500); await tap(page, 3, 200); await page.waitForTimeout(150);
    await shot(page, `${tag}-act`);
    if (o.isMobile) await clip(page, `${tag}-dock`, o.viewport.height - 80, 80);
  }
  await ctx.close();
}
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    await fever(browser, MOB, 'm390', ['g0', 'g50', 'act']);
    await fever(browser, M360, 'm360', ['g0', 'act']);
    await fever(browser, PC, 'pc1440', ['g0', 'act']);
    await fever(browser, pc(1280, 720), 'pc1280', ['g50']);
    // 이사 목표 줄(360)
    { const { ctx, page } = await open(browser, M360, SEED); await page.waitForTimeout(500);
      await clip(page, 'm360-bar', 400, 100); console.log('bar360', JSON.stringify(await measure(page))); await ctx.close(); }
    // 결합 알림 점
    { const { ctx, page } = await open(browser, MOB, { ...SEED, services: [1, 1, 1, 1, 0, 0, 0, 0] }); await page.waitForTimeout(500);
      const dot = () => page.evaluate(() => { const d = document.querySelector('.bundle-toggle .dot'); return d ? !d.hidden : null; });
      console.log('dot before', await dot());
      await clip(page, 'm390-bdot-0', 430, 120);
      await set(page, { services: [30, 30, 30, 30, 30, 30, 30, 30] }); await page.waitForTimeout(4500);
      console.log('dot after raise', await dot());
      await clip(page, 'm390-bdot-1', 430, 120);
      await page.locator('.bundle-toggle').click(); await page.waitForTimeout(300);
      console.log('dot after open', await dot());
      await clip(page, 'm390-bdot-2', 430, 220);
      await ctx.close(); }
  } finally { await browser.close(); }
  console.log(problems.join('\n') || 'no problems');
})();
