// C8b 최종 촬영: node tools/shots-final.cjs   (W=390,360 로 폭 골라 실행, APPEND=1 이면 보고서에 이어 씀)
// 전제: 개발 서버 5173(또는 URL 환경변수) 또는 preview 4173, 격리 Aside CDP 9333.
// 5폭 x 25장 -> screenshots/final/<폭>-<번호>-<이름>.png, 화면마다 촬영 직전 넘침 검사 -> screenshots/final/overflow-report.txt
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.URL || 'http://localhost:5173';
const KEY = 'ajd-home-idle:save';
const OUT = path.join(__dirname, '..', 'screenshots', 'x1b-fix');
const REPORT = '/private/tmp/claude-501/-Users-judongseok/b87026c5-a45c-41c8-a4a9-ec179e698a7c/scratchpad/x1b-report.txt';
const mob = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pc = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
const SIZES = { 390: mob(390, 844), 360: mob(360, 740), 430: mob(430, 932), 1024: pc(1024, 768), 1440: pc(1440, 900), '390dpr1': { ...mob(390, 844), deviceScaleFactor: 1 } };
const DEFAULT_WIDTHS = ['390', '360', '430', '1024', '1440'];
const SEED = { unlocked: ['tap', 'bundle', 'box', 'dex', 'move', 'contract', 'mult', 'badge', 'perk'], version: 3, points: 5e6, earned: 5e6, moves: 0, tapLevel: 3, services: [20, 12, 11, 10, 0, 0, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], collection: {} };
const FULL = { ...SEED, points: 8e10, earned: 8e10, services: [20, 12, 11, 10, 5, 5, 5, 5] };
const PREFS = { sound: false, music: false, haptics: false };
const IDS = ['fan', 'kettle', 'toaster', 'heating_pad', 'hair_dryer', 'humidifier', 'rice_cooker', 'water_purifier', 'air_purifier', 'air_fryer', 'vacuum', 'coffee_machine', 'dishwasher', 'air_conditioner', 'washer', 'smart_tv', 'fridge', 'massage_chair', 'robot_vacuum'];

async function open(browser, o, seed, savedAgo = 0) {
  const ctx = await browser.newContext(o);
  await ctx.addInitScript(([k, s, p, ago]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    if (s) localStorage.setItem(k, JSON.stringify({ ...s, savedAt: Date.now() - ago }));
    localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p));
  }, [KEY, seed, PREFS, savedAgo]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { if (!/Extension context/.test(e.message)) console.log('pageerror', e.message); });
  await page.goto(BASE + '/?debug');
  await page.waitForSelector(savedAgo ? '.overlay' : '.phone');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  return { ctx, page };
}
const set = (page, patch) => page.evaluate((pt) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, ...pt }); }, patch);
const setUn = (page, u) => page.evaluate((x) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, unpack: { ...s.unpack, ...x } }); }, u);
const tab = (page, name) => page.locator('.tab', { hasText: name }).click();
const queue = (page, q) => page.evaluate((qq) => { const o = Math.random; window.__q = qq; Math.random = () => (window.__q.length ? window.__q.shift() : o()); }, q);
const rng = (page, sd) => page.evaluate((x) => { let a = x; Math.random = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }, sd);
const done = (page) => page.waitForSelector('.bs-actions:not(.lock)', { timeout: 20000 });
const some = {}; IDS.slice(0, 11).forEach((id, i) => { some[id] = { base: 1 + (i % 4), shiny: i % 3 === 0 ? 2 : 0, gold: i === 2 ? 1 : 0, rainbow: 0 }; });
const all = {}; IDS.forEach((id, i) => { all[id] = { base: 1 + ((i * 3) % 16), shiny: 1 + (i % 7), gold: i % 2 ? 1 : 3, rainbow: i % 5 === 0 ? 1 : 2 }; });
const ct = (kind, service) => ({ service, kind, remainSec: 1800, totalSec: 3600, penaltyBase: 1e6 });
const boxTab = async (page) => { await tab(page, '상자'); await page.evaluate(() => document.querySelector('.box-hero').scrollIntoView({ block: 'start' })); };
const dexTop = async (page) => { await tab(page, '도감'); await page.evaluate(() => document.querySelector('.dex-head').scrollIntoView({ block: 'start' })); };
const evState = (result) => ({ event: { nextInSec: 9999, remainSec: 0, streak: 0, bannerSec: 0, question: null, questionSec: 0, result } });

// 화면 목록: [번호, 이름, 시드, 준비 함수, (옵션) 저장 시각 차이 ms]
const SCREENS = [
  ['01', 'main-early', null, async () => {}],
  ['02', 'main-mid', SEED, async (p) => { await setUn(p, { box: 45, damage: 0, roomDone: false }); }],
  ['03', 'service-end', FULL, async (p) => { await p.evaluate(() => window.scrollTo(0, 99999)); }],
  ['04', 'tool-tab', FULL, async (p) => { await tab(p, '공구 강화'); }],
  ['05', 'box-tab', { ...SEED, points: 1e9 }, async (p) => { await boxTab(p); }],
  ['06', 'open-single', { ...SEED, points: 1e9 }, async (p) => { await boxTab(p); await queue(p, [0.9985, 0.5, 0.99]); await p.locator('.box-open').click(); await done(p); }],
  ['07', 'open-ten', { ...SEED, points: 1e9 }, async (p) => { await boxTab(p); await rng(p, 7); await p.locator('.box-ten').click(); await done(p); }],
  ['08', 'dex-some', { ...SEED, points: 1e6, collection: some }, async (p) => { await dexTop(p); }],
  ['09', 'dex-all', { ...SEED, points: 1e6, collection: all }, async (p) => { await dexTop(p); }],
  ['10', 'dex-detail', { ...SEED, points: 1e6, collection: all }, async (p) => { await dexTop(p); await p.locator('.dex-cell.got.cv-gold').first().click(); }],
  ['11', 'settings', SEED, async (p) => { await p.locator('.btn.icon-btn[aria-label="설정"]').click(); await p.locator('.setting-row input').nth(0).check(); }],
  ['27', 'tap-info', { ...SEED, perks: { tap_power: 1 } }, async (p) => { await tab(p, '공구 강화'); const i = p.locator('.tap-card .card-info.key').first(); await i.scrollIntoViewIfNeeded(); await i.click(); await p.waitForTimeout(500); }],
  ['28', 'dex-detail-sil', { ...SEED, points: 1e6, collection: some }, async (p) => { await dexTop(p); await p.locator('.dex-cell.got').first().click(); }],
  ['12', 'house-step', SEED, async (p) => { await p.locator('.step-btn').click(); }],
  ['13', 'move-confirm', { ...SEED, points: 8e7, earned: 8e7 }, async (p) => { await p.locator('.move-btn').click(); }],
  ['14', 'move-mid', { ...SEED, points: 8e7, earned: 8e7 }, async (p) => { await p.locator('.move-btn').click(); await p.locator('.modal .btn.primary').click(); await p.waitForSelector('.move-scene'); await p.waitForTimeout(1000); return 'now'; }],
  ['15', 'move-end', { ...SEED, points: 8e7, earned: 8e7 }, async (p) => { await p.locator('.move-btn').click(); await p.locator('.modal .btn.primary').click(); await p.waitForSelector('.sc-result.on', { timeout: 8000 }); await p.waitForTimeout(500); }],
  ['16', 'contract-sheet', SEED, async (p) => { await p.locator('.contract-btn').first().click(); }],
  ['17', 'perk-pick', { ...SEED, perkOffers: [['tap_power', 'crit', 'svc_power']] }, async (p) => { await p.locator('.perk-alert').click(); }],
  ['18', 'perk-list', { ...SEED, perks: { tap_power: 2, crit: 1, svc_power: 3, contract_slot: 1 } }, async (p) => { await p.locator('.btn.icon-btn[aria-label*="특전"]').click(); }],
  ['19', 'offline', SEED, async () => {}, 3 * 3600 * 1000],
  ['20', 'event-question', SEED, async (p) => { await set(p, { event: { nextInSec: 9999, remainSec: 0, streak: 0, bannerSec: 20, question: null, questionSec: 0, result: null } }); await p.waitForTimeout(500); await p.locator('.event-call').click(); }],
  ['21', 'event-result', SEED, async (p) => { await set(p, evState({ correct: true, choice: 'B', timedOut: false, answer: 'B', totalA: 540, totalB: 480, rewardSec: 60 })); }],
  ['26', 'event-wrong', SEED, async (p) => { await set(p, evState({ correct: false, choice: 'A', timedOut: false, answer: 'B', totalA: 540, totalB: 480, rewardSec: 0 })); }],
  ['22', 'fever', SEED, async (p) => { await p.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, fever: { ...s.fever, activeSec: 12 } }); }); await p.waitForTimeout(600); }],
  ['23', 'room-done', SEED, async (p) => { await setUn(p, { box: 85, damage: 0, roomDone: true }); }],
  ['24', 'house-night', { ...SEED, moves: 3 }, async (p) => { await setUn(p, { box: 45, damage: 0, roomDone: false }); }],
  ['25', 'house-edge', { ...SEED, moves: 8 }, async (p) => { await setUn(p, { box: 45, damage: 0, roomDone: false }); }],
];

// 넘침 검사: 가로 스크롤, 글자 잘림(보이는 버튼·칩·카드 제목), 화면 밖 고정 요소, 독이 마지막 구매 버튼을 가리는지
function overflowCheck() {
  const out = [];
  const vw = innerWidth, vh = innerHeight;
  if (document.documentElement.scrollWidth > innerWidth) out.push(`가로 스크롤 scrollWidth=${document.documentElement.scrollWidth} > ${innerWidth}`);
  const label = (e) => `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : ''} "${(e.textContent || '').trim().slice(0, 18)}"`;
  const visible = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw; };
  const sel = 'button, .btn, .chip, .badge, .mini-chip, .slots-pill, .pc-cat, .card-name, .card-lv, .house-name, .tab, .bc-name, .modal h2, .modal-title';
  const seen = new Set();
  for (const e of document.querySelectorAll(sel)) {
    if (!visible(e) || getComputedStyle(e).display === 'inline' || !(e.textContent || '').trim()) continue;
    if (e.scrollWidth > e.clientWidth + 1 || (e.classList.contains('house-name') && e.scrollHeight > e.clientHeight + 1)) { const k = label(e); if (!seen.has(k)) { seen.add(k); out.push(`글자 잘림 ${k} scrollWidth=${e.scrollWidth} clientWidth=${e.clientWidth}`); } }
  }
  for (const e of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(e);
    if (cs.position !== 'fixed' || cs.visibility === 'hidden' || cs.display === 'none' || e.hidden) continue;
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (/overlay|scrim|move-scene|sc-|un-fx|fx-|particle/.test(String(e.className))) continue;
    if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) out.push(`화면 밖 고정 요소 ${label(e)} rect=${[r.left, r.top, r.right, r.bottom].map(Math.round)}`);
  }
  const dock = document.querySelector('.dock');
  if (dock) {
    const d = dock.getBoundingClientRect();
    if (d.top > vh / 2) {
      const btns = [...document.querySelectorAll('.card:not(.locked) .btn.buy')].filter((b) => b.getBoundingClientRect().height > 0);
      const last = btns[btns.length - 1];
      if (last) {
        const b = last.getBoundingClientRect();
        const atEnd = Math.ceil(scrollY + vh) >= document.documentElement.scrollHeight - 1;
        if (atEnd && b.bottom > d.top + 0.5) out.push(`독이 마지막 구매 버튼을 가림 버튼 아래=${Math.round(b.bottom)} 독 위=${Math.round(d.top)}`);
      }
    }
  }
  return out;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const widths = (process.env.W || DEFAULT_WIDTHS.join(',')).split(',');
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  if (!process.env.APPEND) fs.writeFileSync(REPORT, `넘침 보고서 ${new Date().toISOString()}\n`);
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  let issues = 0;
  try {
    for (const w of widths) {
      for (const [no, name, seed, fn, ago] of SCREENS) {
        if (only && !only.includes(no)) continue;
        const { ctx, page } = await open(browser, SIZES[w], seed, ago || 0);
        try {
          const mode = await fn(page);
          if (mode === 'now') await page.screenshot({ path: path.join(OUT, `${w}-${no}-${name}.png`) });
          else await page.waitForTimeout(700);
          const found = await page.evaluate(`(${overflowCheck.toString()})()`);
          const head = `[${w}-${no}-${name}]`;
          fs.appendFileSync(REPORT, found.length ? found.map((f) => `${head} ${f}`).join('\n') + '\n' : `${head} 이상 없음\n`);
          issues += found.length;
          if (mode !== 'now') await page.screenshot({ path: path.join(OUT, `${w}-${no}-${name}.png`) });
        } catch (e) {
          const msg = `[${w}-${no}-${name}] 촬영 실패 ${e.message.split('\n')[0]}`;
          console.log(msg); fs.appendFileSync(REPORT, msg + '\n'); issues++;
          await page.screenshot({ path: path.join(OUT, `${w}-${no}-${name}-FAIL.png`) }).catch(() => {});
        }
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
  console.log('넘침·실패 건수', issues);
})();
