// 검수용 보충 촬영: node tools/shots-audit.cjs   (ONLY=new,fever,tap,room,care,box,contract,modal,house,pc 로 묶음 선택)
// 전제: 개발 서버 localhost:5173, 격리 Aside CDP 9333. 출력 screenshots/audit/extra/<이름>.png (DPR 1, 모바일 390x844 / PC 표시한 것만)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.URL || 'http://localhost:5173';
const KEY = 'ajd-home-idle:save';
const OUT = process.env.OUT_DIR ? path.join(__dirname, '..', 'screenshots', process.env.OUT_DIR) : path.join(__dirname, '..', 'screenshots', 'audit', 'extra');
const LOG = path.join(OUT, '_log.txt');
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
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
    if (s && !fr) localStorage.setItem(k, JSON.stringify({ ...s, stats: { totalEarned: 0, playSec: 0, boxesOpened: 0, ...(s.stats || {}), totalTaps: Math.max(500, (s.stats && s.stats.totalTaps) || 0) }, savedAt: Date.now() - ago }));
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

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    // ---------- 1. 새 게임: 실제 클릭으로 진행 ----------
    if (run('new')) await scene('new', async () => {
      const { ctx, page } = await open(browser, MOB, null, { fresh: true });
      await shot(page, 'n00-new-start', '새 게임 시작(탭 전, 방+서비스 카드 2장, 잠긴 탭 자물쇠)');
      await tap(page, 1); await page.waitForTimeout(250);
      await shot(page, 'n01-first-tap', '첫 탭 직후');
      const seen = new Set(); let boughtFirst = false; let n = 0;
      const t0 = Date.now();
      while (Date.now() - t0 < 110000) {
        await tap(page, 3, 260);
        const bought = await page.evaluate(() => {
          const bs = [...document.querySelectorAll('.card:not(.locked) .btn.buy:not([disabled])')].filter((b) => b.getBoundingClientRect().height > 0);
          if (bs.length) { bs[0].click(); return true; }
          return false;
        });
        if (bought && !boughtFirst) { boughtFirst = true; await page.waitForTimeout(250); await shot(page, 'n02-first-buy', '첫 구매 직후'); }
        const t = await toastText(page);
        if (/새로 열렸어요/.test(t) && !seen.has(t)) { seen.add(t); n++; await shot(page, `n03-unlock-${n}-real`, `실제 진행으로 열림 토스트: ${t} (경과 ${Math.round((Date.now() - t0) / 1000)}초)`); }
        if (seen.size >= 3 && /상자/.test([...seen].join())) break;
      }
      // 남은 단계는 시드로 건너뛴다(열림 순서대로 조건만 채움)
      const st = await page.evaluate(() => window.__ajd.get());
      const steps = [
        ['tap', { unpack: { ...st.unpack, box: 10 } }],
        ['bundle', { services: [3, 3, 3, 0, 0, 0, 0, 0].map((v, i) => Math.max(v, st.services[i] || 0)) }],
        ['box', { earned: Math.max(st.earned, 3e3), points: Math.max(st.points, 1e5) }],
        ['dex', { collection: { fan: { base: 1, shiny: 0, gold: 0, rainbow: 0 } } }],
        ['perk', { perkOffers: [['tap_power', 'crit', 'svc_power']] }],
        ['move', { earned: Math.max(st.earned, 6e5) }],
        ['contract', { earned: Math.max(st.earned, 2e6), services: [20, 20, 20, 20, 0, 0, 0, 0] }],
      ];
      for (const [id, patch] of steps) {
        const cur = await page.evaluate(() => window.__ajd.get().unlocked || []);
        if (cur.includes(id)) continue;
        await set(page, patch);
        for (let i = 0; i < 12; i++) {
          await page.waitForTimeout(120);
          const t = await toastText(page);
          if (/새로 열렸어요/.test(t)) { n++; await shot(page, `n03-unlock-${n}-seeded-${id}`, `시드로 건너뛰어 연 단계(${id}): ${t}`); break; }
        }
        await page.waitForTimeout(2600);
      }
      const fin = await page.evaluate(() => (window.__ajd.get().unlocked || []).join(','));
      results.push(`(새 게임 마지막 unlocked: ${fin})`);
      await ctx.close();
    });

    // ---------- 2. 피버(모바일·PC) ----------
    if (run('fever')) for (const [tag, o] of [['m', MOB], ['pc', PC]]) await scene(`fever-${tag}`, async () => {
      const { ctx, page } = await open(browser, o, SEED);
      await setUn(page, { box: 45, damage: 0, hp: 0, roomDone: false });
      await noCrit(page);
      await set(page, { fever: { gauge: 23.5, activeSec: 0, cooldownSec: 0 } });
      await page.waitForTimeout(250);
      await shot(page, `f1-${tag}-gauge50`, `피버 게이지 약 50%(피버 전) ${tag === 'm' ? '390x844' : '1440x900'}`);
      await set(page, { fever: { gauge: 44.6, activeSec: 0, cooldownSec: 0 } });
      await tap(page, 1); await page.waitForTimeout(160);
      await shot(page, `f2-${tag}-start`, `피버 시작 순간(피버! 글자) ${tag === 'm' ? '390x844' : '1440x900'}`);
      const fv = await page.evaluate(() => document.body.classList.contains('fever'));
      if (!fv) problems.push(`fever-${tag}: 시작 순간 body.fever 없음`);
      await page.waitForTimeout(1500);
      await tap(page, 3, 200);
      await shot(page, `f3-${tag}-active`, `피버 진행 중(탭 직후) ${tag === 'm' ? '390x844' : '1440x900'}`);
      await ctx.close();
    });

    // ---------- 3. 치명타·감쇠 ----------
    if (run('tap')) await scene('tap', async () => {
      let { ctx, page } = await open(browser, MOB, SEED);
      await setUn(page, { box: 45, damage: 0, hp: 0, roomDone: false });
      await page.evaluate(() => { window.__rnd0 = Math.random; Math.random = () => 0; });
      await tap(page, 1); await page.waitForTimeout(140);
      const c = await page.evaluate(() => document.querySelectorAll('.fx-float.crit').length);
      if (!c) problems.push('tap: 치명타 .fx-float.crit 없음');
      await shot(page, 't1-crit', `치명타 타격 순간(.fx-float.crit ${c}개)`);
      await ctx.close();
      ({ ctx, page } = await open(browser, MOB, SEED));
      await setUn(page, { box: 45, damage: 0, hp: 0, roomDone: false });
      await noCrit(page);
      let found = 0;
      for (let i = 0; i < 40 && !found; i++) { await tap(page, 1, 88); found = await page.evaluate(() => document.querySelectorAll('.fx-float.damped').length); }
      if (!found) problems.push('tap: 감쇠 .fx-float.damped 없음');
      await shot(page, 't2-damped', `감쇠(초당 6회 초과) 타격 순간(.fx-float.damped ${found}개)`);
      await ctx.close();
    });

    // ---------- 4. 방 완성·사은품·단계 상승 ----------
    if (run('room')) await scene('room', async () => {
      let { ctx, page } = await open(browser, MOB, SEED);
      await setUn(page, { box: 79, damage: hpOf(79) - 1, hp: hpOf(79), roomDone: false });
      await noCrit(page);
      await tap(page, 1);
      await page.waitForTimeout(1300);
      await shot(page, 'r1-roomdone-1s', `방 완성 1.3초 뒤(토스트: ${await toastText(page)})`);
      await page.waitForTimeout(2200);
      await shot(page, 'r2-roomdone-3_5s', `방 완성(80번째 상자) 이후 3.5초(토스트: ${await toastText(page)})`);
      try { await page.waitForSelector('.bs-actions:not(.lock)', { timeout: 12000 }); await page.waitForTimeout(500); await shot(page, 'r3-free-box-result', '방 완성 무료 사은품 상자가 열린 결과 화면'); await page.locator('.bs-actions .btn.primary').click(); await page.waitForTimeout(900); await shot(page, 'r3b-after-close', `사은품 결과를 닫은 0.9초 뒤(토스트: ${await toastText(page)})`); }
      catch (e) { problems.push('room: 사은품 결과 화면(.bs-actions) 안 뜸'); await shot(page, 'r3-free-box-NOTFOUND', '사은품 결과 화면을 기다렸으나 .bs-actions 없음(현 화면)'); }
      await ctx.close();
      ({ ctx, page } = await open(browser, MOB, SEED));
      await setUn(page, { box: 89, damage: 9, hp: 10, roomDone: true });
      await set(page, { homeLv: [2, 3, 3, 3, 3, 3, 3, 3] });
      await page.waitForTimeout(500);
      await noCrit(page);
      await tap(page, 1);
      let got = '';
      for (let i = 0; i < 30 && !got; i++) { await page.waitForTimeout(100); const t = await toastText(page); if (t) got = t; }
      await shot(page, 'r4-tierup-toast', `단계 상승 직후 토스트 보이는 순간(토스트: ${got || '없음'})`);
      await page.waitForTimeout(3500);
      try { await page.waitForSelector('.bs-actions:not(.lock)', { timeout: 6000 }); await page.waitForTimeout(400); await shot(page, 'r5-tierup-free-box', '단계 상승 무료 사은품 결과 화면'); } catch (e) { results.push('(단계 상승 사은품 결과 화면 안 뜸)'); }
      await ctx.close();
    });

    // ---------- 5. 살림 단계별 방 ----------
    if (run('care')) for (const [tag, o] of [['m', MOB], ['pc', PC]]) {
      const sets = [['silver-lv3', Array(8).fill(3)], ['gold-lv12', Array(8).fill(12)], ['rainbow-lv48', Array(8).fill(48)], ['sparkle-lv192', Array(8).fill(192)], ['mixed', [1, 3, 12, 48, 192, 5, 20, 2]]];
      for (const [nm, lv] of sets) await scene(`care-${tag}-${nm}`, async () => {
        const { ctx, page } = await open(browser, o, SEED);
        await setUn(page, { box: 85, damage: 0, hp: 20, roomDone: true });
        await set(page, { homeLv: lv });
        await page.waitForTimeout(900);
        await shot(page, `c-${tag}-${nm}`, `살림 8칸 ${nm === 'mixed' ? '섞임 ' + lv.join('/') : '모두 Lv ' + lv[0]} ${tag === 'm' ? '390x844' : '1440x900'}`);
        await ctx.close();
      });
    }

    // ---------- 6. 상자·도감 ----------
    if (run('box')) await scene('box', async () => {
      const V = { ...SEED, points: 1e9, collection: some };
      let { ctx, page } = await open(browser, MOB, V);
      await tab(page, '상자');
      await page.evaluate(() => document.querySelector('.box-hero').scrollIntoView({ block: 'start' }));
      await page.waitForTimeout(300);
      await page.locator('.odds-toggle').click(); await page.waitForSelector('.modal .odds-row'); await page.waitForTimeout(500);
      await shot(page, 'b1-odds', '상자 탭 "확률 보기"를 눌러 뜬 상자 확률 창');
      await page.locator('.modal .btn', { hasText: '닫기' }).first().click(); await page.waitForTimeout(500);
      await page.evaluate(() => document.querySelector('.box-hero').scrollIntoView({ block: 'start' }));
      await queue(page, [0.9985, 0.5, 0.99]);
      await page.locator('.box-open').click(); await done(page); await page.waitForTimeout(400);
      await shot(page, 'b2-open-1', '상자 탭에서 1개 열기 결과');
      await page.locator('.bs-actions .btn.primary').click(); await page.waitForTimeout(500);
      await rng(page, 7);
      await page.locator('.box-ten').click(); await done(page); await page.waitForTimeout(400);
      await shot(page, 'b3-open-10', '상자 탭에서 10개 열기 결과');
      await page.locator('.bs-actions .btn.primary').click(); await page.waitForTimeout(500);
      await page.evaluate(() => document.querySelector('.box-hero').scrollIntoView({ block: 'start' })); await page.waitForTimeout(300);
      await shot(page, 'b4-box-sets', '상자 탭 위쪽(세트 완성 줄 + 세트 보기 버튼, 세트 목록은 없음)');
      const go = page.locator('.box-hero .btn', { hasText: '세트 보기' });
      if (await go.count()) { await go.first().click(); await page.waitForTimeout(700); await shot(page, 'b5-set-view', '"세트 보기"를 눌러 도감의 세트 효과로 이동한 화면'); }
      else problems.push('box: "세트 보기" 버튼 없음');
      await ctx.close();
      ({ ctx, page } = await open(browser, MOB, { ...SEED, points: 1e6, collection: all }));
      await tab(page, '도감');
      await page.evaluate(() => document.querySelector('.dex-head').scrollIntoView({ block: 'start' })); await page.waitForTimeout(300);
      await shot(page, 'b6-dex-tab', '도감 탭(가득 찬 도감) 390x844');
      await page.locator('.dex-cell.got.cv-rainbow, .dex-cell.got.cv-gold').first().click(); await page.waitForTimeout(600);
      await shot(page, 'b7-dex-detail', '도감 칸 상세');
      await ctx.close();
    });

    // ---------- 7. 약정·결합·이사 계열 ----------
    if (run('contract')) await scene('contract', async () => {
      let { ctx, page } = await open(browser, MOB, { ...SEED, points: 8e7, earned: 8e7 });
      await page.locator('.contract-btn:visible').first().click(); await page.waitForSelector('.ct-opt'); await page.waitForTimeout(500);
      await shot(page, 'k1-contract-sheet', '약정 창(종류 3택)');
      await ctx.close();
      ({ ctx, page } = await open(browser, MOB, { ...SEED, points: 8e7, earned: 8e7, contracts: [ct('normal', 0), ct('short', 1)] }));
      await page.waitForTimeout(500);
      await shot(page, 'k2-contract-card', '약정 중 카드(남은 시간 표시, 서비스 0·1)');
      await page.locator('.move-btn').click(); await page.waitForTimeout(600);
      await shot(page, 'k3-penalty-confirm', '약정 중 이사 누름 -> 위약금 확인 창');
      await ctx.close();
      ({ ctx, page } = await open(browser, MOB, SEED));
      await scrollTop(page);
      const exp = await page.locator('.bundle-toggle').getAttribute('aria-expanded');
      if (exp !== 'true') await page.locator('.bundle-toggle').click();
      await page.waitForTimeout(500);
      await page.evaluate(() => document.querySelector('.strat-top')?.scrollIntoView({ block: 'start' })); await page.waitForTimeout(300);
      await shot(page, 'k4-bundle-open', `결합 줄 펼침(처음 aria-expanded=${exp})`);
      await page.locator('.bundle-toggle').click(); await page.waitForTimeout(400);
      await shot(page, 'k5-bundle-closed', '결합 줄 접힘(비교용)');
      await ctx.close();
    });

    // ---------- 8. 창·알림 ----------
    if (run('modal')) {
      await scene('perk-list', async () => {
        const { ctx, page } = await open(browser, MOB, { ...SEED, perks: { tap_power: 2, crit: 1, svc_power: 3, contract_slot: 1 } });
        await page.locator('.btn.icon-btn[aria-label*="특전"]').click(); await page.waitForTimeout(600);
        await shot(page, 'm1-perk-list', '특전 창(보유 특전 목록)');
        await ctx.close();
      });
      await scene('house-table', async () => {
        const { ctx, page } = await open(browser, MOB, SEED);
        await page.locator('.step-btn').click(); await page.waitForTimeout(600);
        await shot(page, 'm2-house-table', '집 단계 창');
        await ctx.close();
      });
      await scene('move', async () => {
        const { ctx, page } = await open(browser, MOB, { ...SEED, points: 8e7, earned: 8e7 });
        await page.locator('.move-btn').click(); await page.waitForTimeout(600);
        await shot(page, 'm3-move-confirm', '이사 확인 창');
        await page.locator('.modal .btn.primary').click(); await page.waitForSelector('.move-scene'); await page.waitForTimeout(1100);
        await shot(page, 'm4-move-mid', '이사 장면 중간 1장(1.1초)');
        await page.waitForSelector('.move-scene', { state: 'detached', timeout: 25000 }).catch(() => problems.push('move: 이사 장면이 25초 안에 안 끝남'));
        await page.waitForTimeout(1200);
        await shot(page, 'm5-after-move', `이사 직후 방(${await page.locator('.house-name').innerText()})`);
        await ctx.close();
      });
      await scene('settings', async () => {
        const { ctx, page } = await open(browser, MOB, SEED);
        await page.locator('.btn.icon-btn[aria-label="설정"]').click(); await page.waitForTimeout(600);
        await shot(page, 'm6-settings', '설정 창');
        await ctx.close();
      });
      await scene('info', async () => {
        const { ctx, page } = await open(browser, MOB, { ...SEED, contracts: [ct('normal', 0)], perks: { tap_power: 2 } });
        await scrollTop(page);
        await page.locator('.info-btn').first().click(); await page.waitForTimeout(600);
        await shot(page, 'm7-info-mult', '위쪽 i 상세(배율 내역 팝오버)');
        await ctx.close();
      });
      await scene('trophy', async () => {
        const { ctx, page } = await open(browser, MOB, { ...SEED, moves: 2 });
        const hasT = await page.evaluate(() => /트로피|업적/.test(document.body.innerText));
        await page.locator('.badge').first().click().catch(() => {}); await page.waitForTimeout(600);
        const modal = await page.locator('.modal').count();
        if (modal) await shot(page, 'm8-badge-click', '.badge(영구 배율 칩)를 눌렀을 때 뜬 창(트로피 창이 있다면 이것)');
        else { problems.push(`trophy: 트로피 창 없음(본문 '트로피/업적' 글자 ${hasT ? '있음' : '없음'}, .badge 클릭해도 창 안 뜸)`); }
        await ctx.close();
      });
      await scene('offline', async () => {
        const { ctx, page } = await open(browser, MOB, SEED, { savedAgo: 3 * 3600 * 1000 });
        await page.waitForTimeout(800);
        await shot(page, 'm9-offline', '오프라인 보상 창(3시간)');
        await ctx.close();
      });
      await scene('event', async () => {
        const { ctx, page } = await open(browser, MOB, SEED);
        await set(page, { event: { nextInSec: 9999, remainSec: 0, streak: 0, bannerSec: 20, question: null, questionSec: 0, result: null } });
        await page.waitForTimeout(900);
        await shot(page, 'm10-event-alert', '이벤트 알림(전화 울림, 아직 안 누름)');
        await ctx.close();
      });
      await scene('tap-pop', async () => {
        const { ctx, page } = await open(browser, MOB, { ...SEED, perks: { tap_power: 1 } });
        await tab(page, '공구 강화');
        const info = page.locator('.tap-card .card-info.key');
        await info.first().scrollIntoViewIfNeeded(); await info.first().click(); await page.waitForTimeout(600);
        const vis = await page.locator('.mult-pop:not([hidden])').count();
        if (!vis) problems.push('tap-pop: 탭 1회 줄을 눌러도 .mult-pop 안 뜸');
        await shot(page, 'm11-tap-popover', `공구 강화 탭 "탭 1회" 줄 내역 팝오버(.mult-pop 보임=${vis})`);
        await ctx.close();
      });
    }

    // ---------- 9. 집 5곳 ----------
    if (run('house')) for (const [i, nm] of ['원룸', '투룸', '아파트', '펜트하우스', '달 기지'].entries()) await scene(`house-${i}`, async () => {
      const { ctx, page } = await open(browser, MOB, { ...SEED, moves: i });
      await setUn(page, { box: 45, damage: 0, hp: 0, roomDone: false });
      await page.waitForTimeout(900);
      const got = await page.locator('.house-name').innerText();
      if (got !== nm) problems.push(`house-${i}: 기대 ${nm} 실제 ${got}`);
      await shot(page, `h${i + 1}-${['oneroom', 'tworoom', 'apt', 'penthouse', 'moon'][i]}`, `집 방 화면: ${got}(moves=${i}) 390x844`);
      await ctx.close();
    });

    // ---------- 10. PC ----------
    if (run('pc')) {
      await scene('pc-new', async () => {
        const { ctx, page } = await open(browser, PC, null, { fresh: true });
        await shot(page, 'p01-new', 'PC 1440x900 새 게임');
        await ctx.close();
      });
      await scene('pc-mid', async () => {
        const { ctx, page } = await open(browser, PC, SEED);
        await setUn(page, { box: 45, damage: 0, hp: 0, roomDone: false }); await page.waitForTimeout(600);
        await shot(page, 'p02-mid', 'PC 1440x900 중반');
        await tab(page, '공구 강화'); await page.waitForTimeout(300);
        await shot(page, 'p03-tool-tab', 'PC 1440x900 공구 강화 탭');
        await ctx.close();
      });
      await scene('pc-box', async () => {
        const { ctx, page } = await open(browser, PC, { ...SEED, points: 1e9, collection: all });
        await tab(page, '상자'); await page.waitForTimeout(400);
        await shot(page, 'p04-box-tab', 'PC 1440x900 상자 탭');
        await tab(page, '도감'); await page.waitForTimeout(400);
        await shot(page, 'p05-dex-tab', 'PC 1440x900 도감 탭');
        await ctx.close();
      });
      await scene('pc-modal', async () => {
        const { ctx, page } = await open(browser, PC, { ...SEED, points: 8e7, earned: 8e7 });
        await page.locator('.contract-btn:visible').first().click(); await page.waitForSelector('.ct-opt'); await page.waitForTimeout(500);
        await shot(page, 'p06-contract-modal', 'PC 1440x900 약정 창');
        await ctx.close();
      });
      for (const [w, h] of [[1280, 720], [1024, 768]]) await scene(`pc-${w}`, async () => {
        const { ctx, page } = await open(browser, pc(w, h), SEED);
        await setUn(page, { box: 45, damage: 0, hp: 0, roomDone: false }); await page.waitForTimeout(600);
        await shot(page, `p0${w === 1280 ? 7 : 8}-mid-${w}x${h}`, `PC ${w}x${h} 중반`);
        await ctx.close();
      });
    }
  } finally {
    await browser.close();
    fs.appendFileSync(LOG, `--- ${new Date().toISOString()} ONLY=${process.env.ONLY || 'all'}\n${results.join('\n')}\n[문제]\n${problems.join('\n') || '없음'}\n`);
    console.log('문제', problems.length ? '\n' + problems.join('\n') : '없음');
  }
})();
