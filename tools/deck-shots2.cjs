// 공구함 덱 2단계 촬영(새 카드 12장 화면·발동 연출). 전제: 개발 서버 localhost:5173(또는 URL), 격리 Aside CDP 9333. 출력 screenshots/deck/s2-*
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = process.env.URL || 'http://localhost:5173';
const OUT = path.join(__dirname, '..', 'screenshots', 'deck');
fs.mkdirSync(OUT, { recursive: true });
const PREFS = { sound: false, music: false, haptics: false, chargeDone: true, weakDone: true };
const VIEWS = [
  { name: '390', w: 390, h: 844, mobile: true },
  { name: '1440', w: 1440, h: 900, mobile: false },
];
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;

async function open(browser, v, extra = {}, big = false) {
  const o = v.mobile ? { viewport: { width: v.w, height: v.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 };
  const ctx = await browser.newContext(o);
  await ctx.addInitScript((p) => localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p)), { ...PREFS, ...extra });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(BASE + '/?debug');
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  await page.evaluate((big) => {
    window.__ajd.guide('done');
    const s = window.__ajd.get();
    window.__ajd.set({ ...s, moves: 1, unlocked: ['tap', 'home', 'box', 'dex', 'mult', 'badge', 'perk', 'deck', 'fever', 'special'], points: 5e5, earned: 1e5, ...(big ? { tapLevel: 200, unpack: { ...s.unpack, box: 30, damage: 0, hp: 1 } } : {}) });
  }, big);
  await page.waitForTimeout(700);
  // 첫 토스트가 사라질 때까지
  for (let i = 0; i < 40 && (await page.locator('.toast:visible').count()) > 0; i++) await page.waitForTimeout(250);
  return { ctx, page };
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, 's2-' + name + '.png') });
const modalOpen = (page) => page.evaluate(() => !!document.querySelector('.overlay'));
const closeAll = async (page) => { for (let i = 0; i < 3; i++) { if (!(await modalOpen(page))) break; await page.keyboard.press('Escape'); await page.evaluate(() => document.querySelector('.overlay')?.dispatchEvent(new Event('modal-close'))); await page.waitForTimeout(200); } };
const setOffer = (page, ids) => page.evaluate((ids) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, deck: { ...s.deck, offers: [ids] } }); window.__ajd.deck(s.deck.slots.map((x) => x.id)); }, ids);

async function waitFor(page, sel, ms = 12000) {
  for (let t = 0; t < ms; t += 25) { if ((await page.locator(sel).count()) > 0) return true; await page.waitForTimeout(25); }
  return false;
}

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  for (const v of VIEWS) {
    if (ONLY && !ONLY.includes(v.name)) continue;
    // ① 고르기 창(새 카드 3장) ② 공구함 창
    let { ctx, page } = await open(browser, v);
    await page.evaluate(() => window.__ajd.deck(['S1', 'F2', 'P1']));
    await setOffer(page, ['S4', 'F3', 'C4']);
    await page.waitForTimeout(500);
    await page.locator('.deck-row').click();
    await page.waitForTimeout(500);
    await shot(page, `${v.name}-2-toolbox`);
    await closeAll(page);
    await page.locator('.deck-alert').click();
    await page.waitForTimeout(1300);
    await shot(page, `${v.name}-1-pick`);
    await closeAll(page);
    // 12장 전부(4묶음) 고르기 창 크기 점검 사진
    for (const [n, ids] of [['a', ['P1', 'S1', 'S3']], ['b', ['F1', 'F2', 'P3']], ['c', ['C3', 'P2', 'C1']]]) {
      await setOffer(page, ids);
      await page.waitForTimeout(300);
      await page.locator('.deck-alert').click();
      await page.waitForTimeout(1200);
      await shot(page, `${v.name}-1${n}-pick`);
      await closeAll(page);
    }
    await ctx.close();
    // ③ C3 ×30
    ({ ctx, page } = await open(browser, v, {}, true));
    await page.evaluate(() => window.__ajd.deck(['P3', 'C3']));
    await page.evaluate(() => window.__ajd.chain(3000));
    await waitFor(page, '.deck-x');
    await page.waitForTimeout(150);
    await shot(page, `${v.name}-3-c3`);
    console.log(v.name, 'c3', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.deck-x')].map((x) => x.textContent))));
    await ctx.close();
    // ④ S4: 황금 3개 이상 강타 → 동전이 날아가는 프레임
    ({ ctx, page } = await open(browser, v, {}, true));
    await page.evaluate(() => window.__ajd.deck(['S4', 'S1']));
    await page.evaluate(() => window.__ajd.special('gold', 0, { 5: 'gold', 10: 'gold' }));
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__ajd.chain(11));
    await waitFor(page, '.deck-x');
    // 동전은 0.6~0.95초만 난다: 빠르게 찍고(스케일 css) 프레임마다 입자 수를 적는다
    const cnt = [];
    for (let i = 0; i < 7; i++) { const t0 = Date.now(); cnt.push(await page.evaluate(() => window.__ajd.particles())); await page.screenshot({ path: path.join(OUT, `s2-${v.name}-4-s4-f${i}.png`), scale: 'css' }); cnt.push(Date.now() - t0); }
    console.log(v.name, 's4 particles/ms', JSON.stringify(cnt));
    console.log(v.name, 's4', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.deck-x')].map((x) => x.textContent))));
    await ctx.close();
    // ⑤ F3 +2초(피버 중 퍼펙트)
    ({ ctx, page } = await open(browser, v));
    await page.evaluate(() => window.__ajd.deck(['F3', 'F2']));
    await page.evaluate(() => { window.__ajd.fever(); });
    await page.waitForTimeout(300);
    const before = await page.evaluate(() => window.__ajd.get().fever.activeSec);
    await page.evaluate(() => { window.__ajd.zone(0.5); window.__ajd.charge(0.5); });
    await waitFor(page, '.deck-x');
    await page.waitForTimeout(150);
    await shot(page, `${v.name}-5-f3`);
    console.log(v.name, 'f3', before, '->', await page.evaluate(() => window.__ajd.get().fever.activeSec), JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.deck-x')].map((x) => x.textContent))));
    await ctx.close();
    // 알림 2개(PC 1440) : 특전 알림 + 카드 고르기
    if (!v.mobile) {
      ({ ctx, page } = await open(browser, v));
      await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, perkOffers: [['crit', 'fever_long', 'strike_power']] }); window.__ajd.deck(['P2', 'P3']); window.__ajd.offer(); });
      await page.waitForTimeout(500);
      await shot(page, `${v.name}-6-alerts`);
      console.log(v.name, 'alerts', JSON.stringify(await page.evaluate(() => ({ al: [...document.querySelectorAll('.perk-alert')].map((e) => [e.className, !e.hidden, Math.round(e.getBoundingClientRect().top), Math.round(e.getBoundingClientRect().bottom)]), sh: document.documentElement.scrollHeight, ih: innerHeight, rows: ['.deck-row', '.move-row', '.charge', '.fever-gauge'].map((q) => { const b = document.querySelector(q)?.getBoundingClientRect(); return b ? [q, Math.round(b.top), Math.round(b.bottom)] : null; }) }))));
      await ctx.close();
    }
  }
  await browser.close();
})();
