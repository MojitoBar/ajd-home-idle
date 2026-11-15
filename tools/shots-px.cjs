// 도트 화면 촬영: node tools/shots-px.cjs <단위이름>  → screenshots/px-<단위>-*.png (전체 + 방 카드 원본 배율 크롭)
// 전제: 개발 서버 5173(또는 URL 환경변수), 격리 Aside CDP 9333.
const { chromium } = require('playwright');
const path = require('path');
const unit = process.argv[2] || 'u1';
const BASE = process.env.URL || 'http://localhost:5173';
const KEY = 'ajd-home-idle:save';
const SHOTS = path.join(__dirname, '..', 'screenshots');
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const SMALL = { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const PC = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };
const SEED = { version: 3, points: 5e6, earned: 5e6, moves: 0, tapLevel: 3, services: [20, 12, 11, 10, 0, 0, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], collection: {} };
const PREFS = { sound: false, music: false, haptics: false };

async function open(browser, o, seed) {
  const ctx = await browser.newContext(o);
  await ctx.addInitScript(([k, s, p]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    if (s) localStorage.setItem(k, JSON.stringify({ ...s, savedAt: Date.now() }));
    localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p));
  }, [KEY, seed, PREFS]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(BASE + '/?debug');
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  return { ctx, page };
}
const setUn = (page, unpack) => page.evaluate((u) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, unpack: { ...s.unpack, ...u } }); }, unpack);

async function shoot(page, tag) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(SHOTS, `px-${unit}-${tag}-full.png`) });
  const rb = await page.locator('.room').boundingBox();
  const sb = await page.locator('.px-strip').boundingBox();
  const x = Math.floor(rb.x) - 2, y = Math.floor(rb.y) - 2;
  const clip = { x, y, width: Math.ceil(Math.max(rb.x + rb.width, sb.x + sb.width) + 2) - x, height: Math.ceil(sb.y + sb.height + 2) - y };
  await page.screenshot({ path: path.join(SHOTS, `px-${unit}-${tag}-room.png`), clip });
}


// C2: 키트·글꼴 전역 촬영 — 서비스 탭 맨 위, 공구 강화 탭, 설정 모달, 토스트, PC 한 장
async function runC2(browser) {
  const snap = async (page, tag) => { await page.waitForTimeout(500); await page.screenshot({ path: path.join(SHOTS, `px-${unit}-${tag}.png`) }); };
  let { ctx, page } = await open(browser, MOBILE, SEED);
  await snap(page, '390-service');
  await page.locator('.tab', { hasText: '공구 강화' }).click();
  await snap(page, '390-tool');
  await page.locator('.tab', { hasText: '서비스' }).click();
  await page.locator('.btn.icon-btn[aria-label="설정"]').click();
  await snap(page, '390-settings');
  await page.locator('.modal-x').click();
  await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, tapLevel: 9, unpack: { box: 0, damage: 0, roomDone: false } }); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, tapLevel: 10 }); });
  await page.waitForTimeout(700);
  await snap(page, '390-toast');
  await ctx.close();
  ({ ctx, page } = await open(browser, PC, SEED));
  await snap(page, 'pc');
  await ctx.close();
}


// C3: 방 전체 — 상자 단계·살림 차오름·선반·방 완성·도구 5종·벽 전화·택배·360·PC
const hpOf = (k) => { const m = ['small', 'small', 'normal', 'small', 'small', 'normal', 'small', 'small', 'normal', 'big'][k % 10]; return Math.ceil(10 * 1.07 ** k * { small: 0.7, normal: 1.6, big: 3 }[m] - 1e-9); };
async function runC3(browser) {
  const dmg = (k, f) => ({ box: k, damage: Math.floor(hpOf(k) * f), roomDone: false });
  let { ctx, page } = await open(browser, MOBILE, null);
  await shoot(page, '390-1-new');
  await ctx.close();
  const FULL = { ...SEED, services: [20, 12, 11, 10, 5, 5, 5, 5] };
  ({ ctx, page } = await open(browser, MOBILE, SEED));
  await setUn(page, dmg(1, 0.5)); await shoot(page, '390-2-small-stage2');
  await setUn(page, dmg(9, 0.6)); await shoot(page, '390-3-big-stage3');
  await setUn(page, dmg(9, 0.9)); await shoot(page, '390-3-big-stage4');
  await setUn(page, dmg(3, 0.1)); await shoot(page, '390-4-fill30');
  await setUn(page, dmg(7, 0.1)); await shoot(page, '390-4-fill70');
  await setUn(page, { box: 85, damage: 0, roomDone: true }); await shoot(page, '390-6-room-done');
  await setUn(page, dmg(2, 0.2));
  await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, services: [20, 12, 11, 10, 5, 5, 5, 5] }); });
  await shoot(page, '390-5-shelf-full');
  await page.evaluate(() => { document.querySelector('.event-call').hidden = false; });
  await page.waitForTimeout(100); await shoot(page, '390-8-ring');
  await page.evaluate(() => { document.querySelector('.event-call').hidden = true; });
  await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, parcel: { nextInSec: 90, remainSec: 8 } }); });
  await page.waitForSelector('.parcel:not([hidden])', { timeout: 4000 });
  await page.waitForTimeout(1500);
  await shoot(page, '390-9-parcel');
  for (const [lv, id] of [[0, 'gloves'], [10, 'cutter'], [25, 'hammer'], [50, 'drill'], [100, 'robot-arm']]) {
    await page.evaluate((l) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, tapLevel: l }); }, lv);
    await page.waitForTimeout(1400);
    const d = await page.locator('.dock').boundingBox();
    await page.screenshot({ path: path.join(SHOTS, `px-${unit}-390-7-tool-${id}.png`), clip: { x: 0, y: Math.floor(d.y) - 24, width: 390, height: 844 - Math.floor(d.y) + 24 } });
  }
  await ctx.close();
  ({ ctx, page } = await open(browser, SMALL, FULL));
  await setUn(page, dmg(9, 0.6)); await shoot(page, '360-10-big-stage3');
  await ctx.close();
  ({ ctx, page } = await open(browser, PC, FULL));
  await setUn(page, dmg(1, 0.5)); await shoot(page, 'pc1440-11-small-stage2');
  await ctx.close();
}

// C4a: 모바일 방 바깥 — 서비스 탭 맨 위·끝, 결합 줄, 공구 강화 탭, 독 도구 5종, 방 크롭(대기 큰 상자·선반 8개·전화), 360·320
async function runC4a(browser) {
  const FULL = { ...SEED, points: 8e10, earned: 8e10, services: [20, 12, 11, 10, 5, 5, 5, 5], perks: {}, perkOffers: [] };
  const snap = async (page, tag) => { await page.waitForTimeout(600); await page.screenshot({ path: path.join(SHOTS, `px-${unit}-${tag}.png`) }); };
  const roomClip = async (page, tag) => {
    await page.waitForTimeout(700);
    const rb = await page.locator('.room').boundingBox();
    await page.screenshot({ path: path.join(SHOTS, `px-${unit}-${tag}.png`), clip: { x: Math.floor(rb.x) - 2, y: Math.floor(rb.y) - 2, width: Math.ceil(rb.width) + 4, height: Math.ceil(rb.height) + 4 } });
  };
  let { ctx, page } = await open(browser, MOBILE, SEED);
  await snap(page, '390-1-service-top');
  await page.evaluate(() => window.scrollTo(0, 99999));
  await snap(page, '390-2-service-end');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => { const r = document.querySelector('.bundle-row'); r.scrollLeft = 0; });
  const sb = await page.locator('.strat-top').boundingBox();
  await page.screenshot({ path: path.join(SHOTS, `px-${unit}-390-3-bundle-row.png`), clip: { x: 0, y: Math.floor(sb.y) - 8, width: 390, height: Math.ceil(sb.height) + 80 } });
  await page.locator('.tab', { hasText: '공구 강화' }).click();
  await snap(page, '390-4-tool-tab');
  await page.locator('.tab', { hasText: '서비스' }).click();
  for (const [lv, id] of [[0, 'gloves'], [10, 'cutter'], [25, 'hammer'], [50, 'drill'], [100, 'robot-arm']]) {
    await page.evaluate((l) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, tapLevel: l }); }, lv);
    await page.waitForTimeout(1400);
    const d = await page.locator('.dock').boundingBox();
    await page.screenshot({ path: path.join(SHOTS, `px-${unit}-390-5-dock-${id}.png`), clip: { x: 0, y: Math.floor(d.y) - 24, width: 390, height: 844 - Math.floor(d.y) + 24 } });
  }
  await ctx.close();
  ({ ctx, page } = await open(browser, MOBILE, FULL));
  await setUn(page, { box: 8, damage: 3, roomDone: false }); await roomClip(page, '390-6a-room-big-waiting');
  await setUn(page, { box: 2, damage: 1, roomDone: false }); await roomClip(page, '390-6b-room-shelf8-phone');
  await page.evaluate(() => { document.querySelector('.event-call').hidden = false; });
  await page.waitForTimeout(100); await roomClip(page, '390-6c-room-phone-ring');
  await page.waitForTimeout(170); await roomClip(page, '390-6d-room-phone-ring2');
  await page.evaluate(() => { document.querySelector('.event-call').hidden = true; });
  await snap(page, '390-1b-service-full');
  await ctx.close();
  for (const [n, o] of [['360', SMALL], ['320', { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
    ({ ctx, page } = await open(browser, o, FULL));
    await snap(page, `${n}-7-service`);
    await page.evaluate(() => window.scrollTo(0, 420));
    await snap(page, `${n}-7-service-scrolled`);
    await ctx.close();
  }
}

// C4b: PC 두 단 — 1440 서비스·공구 강화·결합 펼침, 1024·1280·900 서비스 탭
async function runC4b(browser) {
  const FULL = { ...SEED, points: 8e10, earned: 8e10, services: [20, 12, 11, 10, 5, 5, 5, 5], perks: {}, perkOffers: [] };
  const snap = async (page, tag) => { await page.waitForTimeout(600); await page.screenshot({ path: path.join(SHOTS, `px-${unit}-${tag}.png`) }); };
  const pc = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  let { ctx, page } = await open(browser, pc(1440, 900), FULL);
  await snap(page, '1440-1-service');
  await page.locator('.tab', { hasText: '공구 강화' }).click();
  await snap(page, '1440-2-tool');
  await page.locator('.tab', { hasText: '서비스' }).click();
  const tg = page.locator('.bundle-toggle');
  if ((await tg.getAttribute('aria-expanded')) !== 'true') await tg.click();
  await snap(page, '1440-3-bundle-open');
  await ctx.close();
  for (const [n, w, h] of [['1024-4', 1024, 768], ['1280-5', 1280, 800], ['900-6', 900, 700]]) {
    ({ ctx, page } = await open(browser, pc(w, h), FULL));
    await snap(page, `${n}-service`);
    await ctx.close();
  }
}

// C5a: 모달 전종 촬영 — 모달마다 1장, 저장 상태를 조작해 각 모달이 뜨는 조건을 만든다
async function runC5a(browser) {
  const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
  const snap = async (page, tag) => { await page.waitForTimeout(600); await page.screenshot({ path: path.join(SHOTS, `px-${unit}-${tag}.png`) }); };
  const set = (page, patch) => page.evaluate((pt) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, ...pt }); }, patch);
  const ct = (kind, service) => ({ service, kind, remainSec: 1800, totalSec: 3600, penaltyBase: 1e6 });
  const run = async (name, o, fn, seed = SEED) => {
    if (ONLY && !ONLY.some((x) => name.includes(x))) return;
    const { ctx, page } = await open(browser, o, seed);
    try { await fn(page); await snap(page, name); } catch (e) { console.log('FAIL', name, e.message.split('\n')[0]); await snap(page, name + '-FAIL'); }
    await ctx.close();
  };
  const modals = {
    settings: async (p) => { await p.locator('.btn.icon-btn[aria-label="설정"]').click(); },
    reset: async (p) => { await p.locator('.btn.icon-btn[aria-label="설정"]').click(); await p.locator('.reset-btn').click(); },
    house: async (p) => { await p.locator('.step-btn').click(); },
    move: async (p) => { await set(p, { points: 1e9, earned: 1e9 }); await p.waitForTimeout(400); await p.locator('button', { hasText: '이사' }).first().click(); },
    contract: async (p) => { await p.locator('.contract-btn').first().click(); },
    contractActive: async (p) => { await set(p, { contracts: [ct('short', 0)] }); await p.waitForTimeout(400); await p.locator('.contract-btn').first().click(); },
    perkpick: async (p) => { await set(p, { perkOffers: [['tap_power', 'crit', 'svc_power']] }); await p.waitForTimeout(400); await p.locator('.perk-alert').click(); },
    perklist: async (p) => { await set(p, { perks: { tap_power: 2, crit: 1, svc_power: 3, contract_slot: 1 } }); await p.waitForTimeout(400); await p.locator('.btn.icon-btn[aria-label*="특전"]').click(); },
    event: async (p) => { await set(p, { event: { nextInSec: 9999, remainSec: 0, streak: 0, bannerSec: 20, question: null, questionSec: 0, result: null } }); await p.waitForTimeout(500); await p.locator('.event-call').click(); },
    eventwin: async (p) => { await set(p, { event: { nextInSec: 9999, remainSec: 60, streak: 2, bannerSec: 0, question: null, questionSec: 0, result: { correct: true, choice: 'B', timedOut: false, answer: 'B', totalA: 540, totalB: 480, rewardSec: 60 } } }); },
    eventlose: async (p) => { await set(p, { event: { nextInSec: 9999, remainSec: 0, streak: 0, bannerSec: 0, question: null, questionSec: 0, result: { correct: false, choice: 'A', timedOut: false, answer: 'B', totalA: 540, totalB: 480, rewardSec: 0 } } }); },
    moon: async (p) => { await set(p, { moves: 3, points: 1e15, earned: 1e15 }); await p.waitForTimeout(500); await p.locator('.move-btn').click(); await p.locator('.modal .btn.primary').click(); await p.waitForSelector('.modal h2', { timeout: 20000 }); },
    mult: async (p) => { await p.locator('.info-btn').click(); },
  };
  for (const [n, fn] of Object.entries(modals)) await run(`390-${n}`, MOBILE, fn);
  if (!ONLY || ONLY.includes('offline')) {
    const ctx = await browser.newContext(MOBILE);
    await ctx.addInitScript(([k, s, p]) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem(k, JSON.stringify({ ...s, savedAt: Date.now() - 3 * 3600 * 1000 })); localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p)); }, [KEY, SEED, PREFS]);
    const page = await ctx.newPage();
    await page.goto(BASE + '/?debug'); await page.waitForSelector('.overlay'); await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1500); await snap(page, '390-offline'); await ctx.close();
  }
  const S320 = { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
  for (const [n, o] of [['320', S320], ['pc1440', PC]]) {
    await run(`${n}-perklist`, o, modals.perklist);
    await run(`${n}-house`, o, modals.house);
    if (n === '320') { await run('320-perkpick', o, modals.perkpick); await run('320-event', o, modals.event); }
  }
}

// C5b: 상자 탭·개봉 연출·도감 탭·상세 모달
const IDS = ['fan', 'kettle', 'toaster', 'heating_pad', 'hair_dryer', 'humidifier', 'rice_cooker', 'water_purifier', 'air_purifier', 'air_fryer', 'vacuum', 'coffee_machine', 'dishwasher', 'air_conditioner', 'washer', 'smart_tv', 'fridge', 'massage_chair', 'robot_vacuum', 'space_purifier'];
async function runC5b(browser) {
  const snap = async (page, tag, full) => { await page.waitForTimeout(600); await page.screenshot({ path: path.join(SHOTS, `px-${unit}-${tag}.png`), fullPage: !!full }); };
  const seed = (n) => ({ ...SEED, points: n });
  const queue = (page, q) => page.evaluate((qq) => { const o = Math.random; window.__q = qq; Math.random = () => (window.__q.length ? window.__q.shift() : o()); }, q);
  const rng = (page, sd) => page.evaluate((x) => { let a = x; Math.random = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }, sd);
  const some = {}; IDS.slice(0, 11).forEach((id, i) => { some[id] = { base: 1 + (i % 4), shiny: i % 3 === 0 ? 2 : 0, gold: i === 2 ? 1 : 0, rainbow: 0 }; });
  const all = {}; IDS.forEach((id, i) => { all[id] = { base: 1 + ((i * 3) % 16), shiny: 1 + (i % 7), gold: i % 2 ? 1 : 3, rainbow: i % 5 === 0 ? 1 : 2 }; });
  const tab = (page, name) => page.locator('.tab', { hasText: name }).click();
  let { ctx, page } = await open(browser, MOBILE, seed(1e9));
  await tab(page, '상자');
  await page.evaluate(() => document.querySelector('.box-hero').scrollIntoView({ block: 'start' }));
  await snap(page, '390-1-box');
  await queue(page, [0.9985, 0.5, 0.99]);
  await page.locator('.box-open').click();
  await page.waitForTimeout(150); await page.screenshot({ path: path.join(SHOTS, `px-${unit}-390-2a-charge.png`) });
  await page.waitForSelector('.bs-actions:not(.lock)', { timeout: 9000 });
  await snap(page, '390-2-single');
  await page.locator('.bs-actions .btn.primary').click();
  await queue(page, [0.9985, 0.5, 0.99]);
  await page.locator('.box-open').click();
  await page.waitForSelector('.bs-actions:not(.lock)', { timeout: 9000 });
  await snap(page, '390-2b-single-dup');
  await page.locator('.bs-actions .btn.primary').click();
  await rng(page, 7);
  await page.locator('.box-ten').click();
  await page.waitForSelector('.bs-actions:not(.lock)', { timeout: 20000 });
  await snap(page, '390-3-ten');
  await page.locator('.bs-actions .btn.primary').click();
  await page.locator('.odds-toggle').click();
  await page.locator('.box-sets').scrollIntoViewIfNeeded();
  await page.evaluate(() => document.querySelector('.box-sets').scrollIntoView({ block: 'start' }));
  await snap(page, '390-4-odds-sets');
  await ctx.close();
  ({ ctx, page } = await open(browser, MOBILE, { ...seed(1e6), collection: some }));
  await tab(page, '도감');
  await page.evaluate(() => document.querySelector('.dex-head').scrollIntoView({ block: 'start' }));
  await snap(page, '390-5-dex-some');
  await page.evaluate(() => document.querySelector('.dex-sec').scrollIntoView({ block: 'start' })); await snap(page, '390-5b-dex-some-mid');
  await ctx.close();
  ({ ctx, page } = await open(browser, MOBILE, { ...seed(1e6), collection: all }));
  await tab(page, '도감');
  await page.evaluate(() => document.querySelector('.dex-head').scrollIntoView({ block: 'start' }));
  await snap(page, '390-6-dex-all-top');
  await snap(page, '390-6b-dex-all-full', true);
  await page.evaluate(() => document.querySelector('.dex-head').scrollIntoView({ block: 'start' }));
  await page.locator('.dex-cell.got.cv-gold').first().click();
  await snap(page, '390-7-detail');
  await page.locator('.modal-x').click();
  await page.locator('.dex-cell:not(.got)').first().click().catch(() => {});
  await ctx.close();
  ({ ctx, page } = await open(browser, MOBILE, { ...seed(1e6), collection: some }));
  await tab(page, '도감');
  await page.locator('.dex-cell:not(.got)').first().click();
  await snap(page, '390-7b-detail-none');
  await ctx.close();
  const S320 = { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
  ({ ctx, page } = await open(browser, S320, { ...seed(1e9), collection: some }));
  await tab(page, '도감');
  await page.evaluate(() => document.querySelector('.dex-sec').scrollIntoView({ block: 'start' }));
  await snap(page, '320-8-dex');
  await tab(page, '상자');
  await rng(page, 7);
  await page.locator('.box-ten').click();
  await page.waitForSelector('.bs-actions:not(.lock)', { timeout: 20000 });
  await snap(page, '320-8b-ten');
  await ctx.close();
  ({ ctx, page } = await open(browser, PC, { ...seed(1e9), collection: some }));
  await tab(page, '상자');
  await snap(page, 'pc1440-9-box');
  await rng(page, 7);
  await page.locator('.box-ten').click();
  await page.waitForSelector('.bs-actions:not(.lock)', { timeout: 20000 });
  await snap(page, 'pc1440-9b-ten');
  await page.locator('.bs-actions .btn.primary').click();
  await tab(page, '도감');
  await snap(page, 'pc1440-10-dex');
  await ctx.close();
}

// C6: 집 9곳 방·전체 화면, 이사 장면 3프레임, PC night
async function runC6(browser) {
  const THEMES = ['blue', 'mint', 'sunset', 'night', 'moon', 'mars', 'jupiter', 'nebula', 'edge'];
  for (let m = 0; m < 9; m++) {
    const { ctx, page } = await open(browser, MOBILE, { ...SEED, moves: m });
    await setUn(page, { box: 45, damage: 0, roomDone: false });
    await shoot(page, `390-house${m}-${THEMES[m]}`);
    await ctx.close();
  }
  let { ctx, page } = await open(browser, MOBILE, { ...SEED, points: 8e7, earned: 8e7 });
  await page.locator('.move-btn').click();
  await page.locator('.modal .btn.primary').click();
  for (const [wait, tag] of [[300, '1-start'], [700, '2-mid'], [1700, '3-end']]) {
    await page.waitForTimeout(wait);
    await page.screenshot({ path: path.join(SHOTS, `px-${unit}-390-move-${tag}.png`) });
  }
  await ctx.close();
  ({ ctx, page } = await open(browser, PC, { ...SEED, moves: 3 }));
  await setUn(page, { box: 45, damage: 0, roomDone: false });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(SHOTS, `px-${unit}-1440-night.png`) });
  await ctx.close();
}

// C7: 이펙트 연속 프레임. 동작 직후 약 50ms 간격으로 n장(방·카드 영역 clip). 타임스탬프를 콘솔에 남긴다.
async function runC7(browser) {
  const FX_SEED = { ...SEED, points: 5e15, earned: 5e15, tapLevel: 12, collection: {} };
  const tapJs = (sel, crit) => `(() => { const b = document.querySelector('${sel}'); const r = b.getBoundingClientRect(); const o = Math.random; ${crit ? 'Math.random = () => 0.001;' : ''} b.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true })); Math.random = o; })()`;
  const seq = async (page, name, act, n = 4, clip = { x: 0, y: 40, width: 390, height: 520 }, gap = 30) => {
    const t0 = Date.now();
    await act();
    const ts = [];
    for (let i = 0; i < n; i++) {
      await page.screenshot({ path: path.join(SHOTS, `px-${unit}-${name}-${i + 1}.png`), clip });
      ts.push(Date.now() - t0);
      await page.waitForTimeout(gap);
    }
    console.log(name, ts.join(' '), 'ms', 'particles', await page.evaluate(() => window.__ajd.particles()));
  };
  let { ctx, page } = await open(browser, MOBILE, FX_SEED);
  await setUn(page, { box: 9, damage: 0, roomDone: false });
  await page.waitForTimeout(500);
  await seq(page, 'hit', () => page.evaluate(tapJs('.phone', false)));
  await page.waitForTimeout(900);
  await seq(page, 'crit', () => page.evaluate(tapJs('.phone', true)), 5);
  await page.waitForTimeout(1200);
  await setUn(page, { box: 9, damage: 1e15 });
  await seq(page, 'boom', () => page.evaluate(tapJs('.phone', false)), 6, undefined, 60);
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, fever: { ...s.fever, activeSec: 12 } }); });
  await seq(page, 'fever-start', async () => {}, 4);
  await page.waitForTimeout(1800);
  await seq(page, 'fever-run', async () => {}, 3, undefined, 120);
  await ctx.close();
  ({ ctx, page } = await open(browser, MOBILE, FX_SEED));
  await seq(page, 'buy', () => page.locator('.card .btn.buy:not([disabled])').first().click(), 4, { x: 0, y: 380, width: 390, height: 460 });
  await ctx.close();
  ({ ctx, page } = await open(browser, MOBILE, FX_SEED));
  await page.locator('.tab', { hasText: '상자' }).click();
  await page.waitForTimeout(300);
  await page.evaluate(() => { const o = Math.random; const q = [0.9, 0.5, 0.1]; window.__q = q; Math.random = () => (window.__q.length ? window.__q.shift() : o()); });
  await seq(page, 'gift-1', () => page.locator('.box-open').click(), 16, { x: 0, y: 220, width: 390, height: 400 }, 40);
  await page.waitForTimeout(6000);
  await ctx.close();
  ({ ctx, page } = await open(browser, MOBILE, { ...FX_SEED, points: 1e30, earned: 1e30 }));
  await page.locator('.tab', { hasText: '상자' }).click();
  await page.waitForTimeout(300);
  await seq(page, 'gift-10', () => page.locator('.box-ten').click(), 5, { x: 0, y: 0, width: 390, height: 844 }, 400);
  await page.waitForTimeout(500);
  await ctx.close();
  ({ ctx, page } = await open(browser, MOBILE, { ...SEED, points: 8e7, earned: 8e7 }));
  await page.locator('.move-btn').click();
  await page.locator('.modal .btn.primary').click();
  await page.waitForTimeout(1700);
  await seq(page, 'move-end', async () => {}, 4, { x: 0, y: 0, width: 390, height: 844 }, 250);
  await ctx.close();
}

// C8a: 감리 14건 확인 촬영
async function runC8a(browser) {
  const FX_SEED = { ...SEED, points: 5e15, earned: 5e15, tapLevel: 12, collection: {} };
  const tapJs = (sel, crit) => `(() => { const b = document.querySelector('${sel}'); const r = b.getBoundingClientRect(); const o = Math.random; ${crit ? 'Math.random = () => 0.001;' : ''} b.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true })); Math.random = o; })()`;
  const shot = (page, tag, clip) => page.screenshot({ path: path.join(SHOTS, `px-${unit}-${tag}.png`), clip });
  const tab = (page, name) => page.locator('.tab', { hasText: name }).click();
  const rng = (page, sd) => page.evaluate((x) => { let a = x; Math.random = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }, sd);
  let { ctx, page } = await open(browser, MOBILE, { ...SEED, points: 8e7, earned: 8e7 });
  await page.locator('.move-btn').click();
  await page.locator('.modal .btn.primary').click();
  const t0 = Date.now();
  for (const [at, tag] of [[800, '1-in'], [1150, '2-mid'], [1500, '3-out']]) {
    await page.waitForTimeout(Math.max(0, at - (Date.now() - t0)));
    await shot(page, `move-${tag}`);
  }
  await ctx.close();
  ({ ctx, page } = await open(browser, MOBILE, FX_SEED));
  await setUn(page, { box: 9, damage: 0, roomDone: false });
  await page.waitForTimeout(400);
  await shot(page, 'dock', { x: 0, y: 700, width: 390, height: 144 });
  await page.evaluate(tapJs('.phone', true));
  await page.waitForTimeout(150);
  await shot(page, 'crit', { x: 0, y: 40, width: 390, height: 520 });
  await page.waitForTimeout(1200);
  await page.evaluate(tapJs('.phone', false));
  await page.waitForTimeout(100);
  await shot(page, 'hit', { x: 0, y: 40, width: 390, height: 520 });
  await page.waitForTimeout(900);
  await setUn(page, { box: 9, damage: 1e15 });
  await page.evaluate(tapJs('.phone', false));
  for (const i of [1, 2]) { await page.waitForTimeout(i === 1 ? 120 : 160); await shot(page, `boom-${i}`, { x: 0, y: 40, width: 390, height: 520 }); }
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, fever: { ...s.fever, activeSec: 9.7 } }); });
  await page.waitForTimeout(500);
  await shot(page, 'fever', { x: 0, y: 40, width: 390, height: 520 });
  await ctx.close();
  ({ ctx, page } = await open(browser, MOBILE, { ...SEED, moves: 8 }));
  await setUn(page, { box: 45, damage: 0, roomDone: false });
  await shoot(page, 'edge');
  await ctx.close();
  ({ ctx, page } = await open(browser, MOBILE, SEED));
  await shot(page, 'main');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('.card.locked').first().scrollIntoViewIfNeeded();
  await shot(page, 'locked');
  await tab(page, '상자');
  await ctx.close();
  ({ ctx, page } = await open(browser, MOBILE, { ...SEED, points: 1e9 }));
  await tab(page, '상자');
  await page.evaluate(() => document.querySelector('.box-hero').scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(400);
  await shot(page, 'boxtab');
  await rng(page, 7);
  await page.locator('.box-ten').click();
  await page.waitForSelector('.bs-actions:not(.lock)', { timeout: 20000 });
  await page.waitForTimeout(500);
  await shot(page, 'ten-390');
  await ctx.close();
  const S320 = { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
  ({ ctx, page } = await open(browser, S320, { ...SEED, points: 1e9 }));
  await tab(page, '상자');
  await rng(page, 7);
  await page.locator('.box-ten').click();
  await page.waitForSelector('.bs-actions:not(.lock)', { timeout: 20000 });
  await page.waitForTimeout(500);
  await shot(page, 'ten-320');
  await ctx.close();
}

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    if (unit.startsWith('c8a')) return await runC8a(browser);
    if (unit.startsWith('c7')) return await runC7(browser);
    if (unit.startsWith('c6')) return await runC6(browser);
    if (unit.startsWith('c2')) return await runC2(browser);
    if (unit.startsWith('c3')) return await runC3(browser);
    if (unit.startsWith('c4b')) return await runC4b(browser);
    if (unit.startsWith('c5a')) return await runC5a(browser);
    if (unit.startsWith('c5b')) return await runC5b(browser);
    if (unit.startsWith('c4a')) return await runC4a(browser);
    let { ctx, page } = await open(browser, MOBILE, null);
    await shoot(page, '390-1-new');
    await ctx.close();
    ({ ctx, page } = await open(browser, MOBILE, SEED));
    await setUn(page, { box: 45, damage: 0 }); await shoot(page, '390-2-four-items');
    await setUn(page, { box: 85, damage: 0, roomDone: true }); await shoot(page, '390-3-room-done');
    await setUn(page, { box: 9, damage: 0, roomDone: false }); await shoot(page, '390-4-big-box');
    await ctx.close();
    for (const [n, o] of [['360', SMALL], ['pc1440', PC]]) {
      ({ ctx, page } = await open(browser, o, SEED));
      await setUn(page, { box: 45, damage: 0 }); await shoot(page, `${n}-2-four-items`);
      await setUn(page, { box: 9, damage: 0 }); await shoot(page, `${n}-4-big-box`);
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
})();
