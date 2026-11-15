// 연출·드문 상태 촬영: ONLY=1,2,3 node tools/shots-fx2.cjs -> screenshots/audit2/fx/NN-이름-상태.png
// 전제: 개발 서버 localhost:5173, 격리 Aside CDP 9333.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = 'http://localhost:5173';
const OUT = process.env.OUT_DIR || path.join(__dirname, '..', 'screenshots', 'audit2', 'fx');
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const run = (g) => !only || only.includes(String(g));
const mob = (w = 390, h = 844, extra = {}) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, ...extra });
const pc = (w, h = 900, extra = {}) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 1, ...extra });
const MOB = mob(), PC = pc(1440, 900);
const SEED = { unlocked: ['tap', 'bundle', 'box', 'dex', 'move', 'contract', 'mult', 'badge', 'perk'], version: 3, points: 5e6, earned: 5e6, moves: 0, tapLevel: 3, services: [20, 12, 11, 10, 0, 0, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], collection: {} };
const PREFS = { sound: false, music: false, haptics: false };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const problems = [];
const PATTERN = ['small', 'small', 'normal', 'small', 'small', 'normal', 'small', 'small', 'normal', 'big'];
const MULT = { small: 0.7, normal: 1.6, big: 3 };
const hpOf = (k) => Math.ceil(10 * 1.07 ** k * MULT[k >= 80 ? 'small' : PATTERN[k % 10]] - 1e-9);

async function open(browser, o, seed, { fresh = false, query = '?debug', prefs = PREFS } = {}) {
  const ctx = await browser.newContext(o);
  await ctx.addInitScript(([k, s, p, fr]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    if (s && !fr) localStorage.setItem(k, JSON.stringify({ ...s, stats: { totalEarned: 0, playSec: 0, boxesOpened: 0, ...(s.stats || {}), totalTaps: Math.max(500, (s.stats && s.stats.totalTaps) || 0) }, savedAt: Date.now() }));
    localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p));
  }, ['ajd-home-idle:save', seed, prefs, fresh]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { if (!/Extension context/.test(e.message)) problems.push(`pageerror ${e.message}`); });
  await page.goto(BASE + '/' + query);
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  return { ctx, page };
}
const set = (page, patch) => page.evaluate((pt) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, ...pt }); }, patch);
const setUn = (page, u) => page.evaluate((x) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, unpack: { ...s.unpack, ...x } }); }, u);
const tab = async (page, name) => { await page.locator('.dock .tab:visible, .tab:visible', { hasText: name }).first().click(); await page.waitForTimeout(400); };
const queue = (page, q) => page.evaluate((qq) => { const o = window.__o || Math.random; window.__o = o; window.__q = qq; Math.random = () => (window.__q.length ? window.__q.shift() : o()); }, q);
const rng = (page, sd) => page.evaluate((x) => { let a = x; Math.random = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }, sd);
const done = (page) => page.waitForSelector('.bs-actions:not(.lock)', { timeout: 20000 });
const boxTab = async (page) => { await tab(page, '상자'); await page.evaluate(() => document.querySelector('.box-hero').scrollIntoView({ block: 'start' })); };
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `${name}.png`) }); console.log('shot', name); };
async function scene(name, fn) { try { await fn(); } catch (e) { const m = `[${name}] 실패 ${e.message.split('\n')[0]}`; console.log(m); problems.push(m); } }

// 연속 프레임: fn()을 실행한 시각을 0으로, times(ms) 각각에 가장 가까운 이전 프레임을 name 접미사로 저장
async function rec(ctx, page, fn, times, prefix, W = 390, H = 844) {
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', (f) => { frames.push({ t: f.metadata.timestamp * 1000, data: f.data }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1, maxWidth: W, maxHeight: H });
  await sleep(300);
  let t0 = Date.now();
  const p = fn(() => { t0 = Date.now(); });
  const last = Math.max(...times.map((x) => x[0]));
  await p;
  await sleep(last + 300 - (Date.now() - t0) > 0 ? last + 300 - (Date.now() - t0) : 0);
  await cdp.send('Page.stopScreencast');
  await cdp.detach();
  for (const [ms, label] of times) {
    const want = t0 + ms; let best = frames[0];
    for (const f of frames) if (f.t <= want) best = f;
    fs.writeFileSync(path.join(OUT, `${prefix}-${label}.png`), Buffer.from(best.data, 'base64'));
    console.log('frame', `${prefix}-${label}`, 'src', Math.round(best.t - t0), 'want', ms);
  }
}
const DOTS = () => {
  const out = [];
  const isY = (c) => /rgb\(255, 200, 61\)|rgb\(255, 234, 160\)|rgb\(201, 138, 0\)|rgb\(255, 138, 31\)/.test(c);
  for (const e of document.querySelectorAll('body *')) {
    const r = e.getBoundingClientRect(); if (r.width <= 0 || r.width > 24 || r.height > 24) continue;
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue;
    if (isY(cs.backgroundColor)) out.push(`${e.tagName}.${String(e.className).slice(0, 60)} ${Math.round(r.width)}x${Math.round(r.height)} @${Math.round(r.left)},${Math.round(r.top)} op=${cs.opacity} parent=${String(e.parentElement && e.parentElement.className).slice(0, 50)}`);
  }
  out.push('canvas:' + [...document.querySelectorAll('canvas')].map((c) => `${c.className}:${c.width}x${c.height}`).join(','));
  return out;
};
module.exports = { open, set, setUn, tab, queue, rng, done, boxTab, shot, scene, rec, DOTS, SEED, MOB, PC, mob, pc, hpOf, sleep, run, problems, OUT };
