// 가이드 화살표·안내 말풍선 점검(g5). 전제: 개발 서버 localhost:5173, 격리 Aside CDP 9333. 출력 screenshots/boxloop/g5-*.png
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = process.env.URL || 'http://localhost:5173';
const OUT = path.join(__dirname, '..', 'screenshots', 'boxloop');
fs.mkdirSync(OUT, { recursive: true });
const prefs = { sound: false, music: false, haptics: false };
const mob = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const PC = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const ALL = ['tap', 'home', 'box', 'dex', 'move', 'mult', 'badge', 'perk'];
const step = (page, i, over = {}) => page.evaluate(([i, o, ALL]) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, guide: { step: i, n: 0, done: false }, unlocked: ALL, ...o }); }, [i, over, ALL]);
const arrow = (page) => page.evaluate(() => { const e = document.querySelector('.gd-point'); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, dir: e.dataset.dir }; });
const rect = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, sel);
const near = (a, b) => a && b && Math.abs(a.x + a.w / 2 - (b.x + b.w / 2)) < 40 && (Math.abs(a.y + a.h - b.y) < 12 || Math.abs(a.y - (b.y + b.h)) < 12);
const inside = (a, vw, vh) => a.x >= 0 && a.y >= 0 && a.x + a.w <= vw && a.y + a.h <= vh;
const hit = (a, b) => a && b && Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y);
let fails = 0;
const check = (name, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${extra}`); };
async function open(browser, cfg, qs = '?debug&guide') {
  const ctx = await browser.newContext(cfg);
  await ctx.addInitScript((pp) => localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(pp)), prefs);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(BASE + qs);
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page };
}
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    for (const [tag, cfg, shot] of [['m', mob(390, 844), 'g5-m-arrow-upgrade'], ['m640', mob(390, 664), 'g5-m640-arrow'], ['m320', mob(320, 640), 'g5-m320-arrow'], ['pc', PC, 'g5-pc-arrow']]) {
      const { ctx, page } = await open(browser, cfg);
      const vw = cfg.viewport.width, vh = cfg.viewport.height;
      await step(page, 1, { points: 1e6 });
      await page.waitForTimeout(700);
      const a = await arrow(page); const b = await rect(page, '.panel .btn.buy');
      await page.screenshot({ path: path.join(OUT, shot + '.png') });
      check(`${tag} 2단계 화살표가 강화 버튼 위`, !!a && near(a, b) && inside(a, vw, vh) && !hit(a, b), JSON.stringify({ a, b }));
      await step(page, 1, { points: 0 });
      await page.waitForTimeout(500);
      check(`${tag} 포인트 모자라면 없음`, (await arrow(page)) === null);
      // 10단계: 상자 탭 → 뽑기 버튼
      await step(page, 9, { points: 1e13, earned: 1e13 });
      await page.waitForTimeout(600);
      const a2 = await arrow(page); const t = await rect(page, '.tab:nth-of-type(1)');
      const tabBox = await page.evaluate(() => { const b = [...document.querySelectorAll('.tab')].find((x) => x.textContent.includes('상자')); const r = b.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
      if (tag === 'm' || tag === 'pc') await page.screenshot({ path: path.join(OUT, tag === 'm' ? 'g5-m-arrow-tab.png' : 'g5-pc-arrow-tab.png') });
      check(`${tag} 10단계 화살표가 상자 탭`, !!a2 && near(a2, tabBox) && inside(a2, vw, vh) && !hit(a2, tabBox), JSON.stringify({ a2, tabBox }));
      await page.evaluate(() => [...document.querySelectorAll('.tab')].find((x) => x.textContent.includes('상자')).click());
      await page.waitForTimeout(600);
      const a3 = await arrow(page); const o = await rect(page, '.box-open');
      if (tag === 'm') await page.screenshot({ path: path.join(OUT, 'g5-m-arrow-box.png') });
      check(`${tag} 상자 탭에서 뽑기 버튼(화면 밖이면 탭 바 위 가장자리)`, !!a3 && (near(a3, o) || o.y >= vh - 70) && inside(a3, vw, vh) && !hit(a3, o), JSON.stringify({ a3, o }));
      // 모달이 뜨면 숨김
      await page.evaluate(() => document.querySelector('.box-open').click());
      await page.waitForTimeout(300);
      check(`${tag} 뽑기 장면 중 숨김`, (await arrow(page)) === null);
      await page.reload(); await page.waitForSelector('.phone');
      // 13단계: 상자 탭 → 특전 상자 뽑기 버튼, 포인트가 모자라면 없음
      await step(page, 12, { points: 1e30, earned: 1e30 });
      await page.waitForTimeout(600);
      const p1 = await arrow(page);
      const tb = await page.evaluate(() => { const b = [...document.querySelectorAll('.tab')].find((x) => x.textContent.includes('상자')); const r = b.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
      check(`${tag} 13단계 화살표가 상자 탭`, !!p1 && near(p1, tb) && inside(p1, vw, vh) && !hit(p1, tb), JSON.stringify({ p1, tb }));
      await page.evaluate(() => [...document.querySelectorAll('.tab')].find((x) => x.textContent.includes('상자')).click());
      await page.evaluate(() => document.querySelector('.perkbox-buy').scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(700);
      const p2 = await arrow(page); const pb = await rect(page, '.perkbox-buy');
      if (tag === 'm') await page.screenshot({ path: path.join(OUT, 'g5-m-arrow-perkbox.png') });
      check(`${tag} 13단계 상자 탭에서 특전 상자 뽑기 버튼`, !!p2 && near(p2, pb) && inside(p2, vw, vh) && !hit(p2, pb), JSON.stringify({ p2, pb }));
      await page.evaluate(() => document.querySelector('.perkbox-buy').click());
      await page.waitForTimeout(300);
      check(`${tag} 특전 상자 장면 중 화살표 숨김`, (await arrow(page)) === null);
      await page.reload(); await page.waitForSelector('.phone');
      await step(page, 12, { points: 0, earned: 1e30 });
      await page.evaluate(() => [...document.querySelectorAll('.tab')].find((x) => x.textContent.includes('상자')).click());
      await page.waitForTimeout(600);
      check(`${tag} 13단계 포인트 모자라면 화살표 없음`, (await arrow(page)) === null);
      await page.reload(); await page.waitForSelector('.phone');
      await step(page, 17, { points: 1e30, earned: 1e30, moves: 0, tapLevel: 12 });
      await page.waitForTimeout(600);
      const am = await arrow(page);
      check(`${tag} 18단계 이사 버튼`, !!am, JSON.stringify(am));
      await page.evaluate(() => window.__ajd.guide('done'));
      await page.waitForTimeout(500);
      check(`${tag} 가이드 완료 후 없음`, (await arrow(page)) === null);
      await ctx.close();
    }
    // 방 안 행동 단계: 4초 입력 없음 → 상자 화살표
    {
      const { ctx, page } = await open(browser, mob(390, 844));
      await step(page, 3, { points: 1e6, earned: 1e6 });
      await page.waitForTimeout(1500);
      check('combo 단계 1.5초: 화살표 없음', (await arrow(page)) === null);
      await page.waitForTimeout(3200);
      const a = await arrow(page);
      await page.screenshot({ path: path.join(OUT, 'g5-m-arrow-idle.png') });
      check('combo 단계 4초 뒤 상자 화살표', !!a, JSON.stringify(a));
      await page.mouse.click(5, 5);
      await page.waitForTimeout(300);
      check('입력하면 사라짐', (await arrow(page)) === null);
      await ctx.close();
    }
    // 강타 말풍선
    for (const [tag, cfg] of [['m', mob(390, 844)], ['m640', mob(390, 664)]]) {
      const { ctx, page } = await open(browser, cfg);
      await step(page, 4, { points: 1e7, earned: 3e6 });
      await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, stats: { ...s.stats, totalTaps: 30 } }); });
      await page.waitForTimeout(900);
      const tip = await rect(page, '.first-tip:not([hidden])');
      if (tag === 'm') await page.screenshot({ path: path.join(OUT, 'g5-m-strike-bubble.png') });
      check(`${tag} 5단계 강타 말풍선`, !!tip);
      await page.evaluate(() => window.__ajd.guideEv({ type: 'strike' }));
      await page.waitForTimeout(250);
      check(`${tag} 6단계로 가면 말풍선 사라짐`, (await rect(page, '.first-tip:not([hidden])')) === null);
      await page.waitForTimeout(4000);
      check(`${tag} 완료 머리글과 말풍선 겹침 없음`, await page.evaluate(() => { const b = window.__ajd.textBoxes(); const tips = b.filter((x) => x.kind === 'tip'); const heads = b.filter((x) => x.kind === 'head'); return !tips.some((t) => heads.some((h) => Math.min(t.x + t.w, h.x + h.w) > Math.max(t.x, h.x) && Math.min(t.y + t.h, h.y + h.h) > Math.max(t.y, h.y))); }));
      await ctx.close();
    }
    // 퍼펙트 말풍선 (9단계)
    {
      const { ctx, page } = await open(browser, mob(390, 844));
      await step(page, 8, { points: 1e7, earned: 3e7, stats: { ...(await page.evaluate(() => window.__ajd.get().stats)), totalTaps: 30 } });
      await page.waitForTimeout(900);
      const tip = await page.evaluate(() => document.querySelector('.first-tip:not([hidden])')?.textContent ?? null);
      check('9단계 퍼펙트 말풍선', !!tip, tip);
      await ctx.close();
    }
    // 실제 새 게임: 1단계
    {
      const { ctx, page } = await open(browser, mob(390, 844), '');
      await page.waitForTimeout(800);
      check('새 게임 1단계 화살표 없음', (await arrow(page)) === null);
      await page.waitForTimeout(4200);
      check('새 게임 4초 뒤 상자 화살표', !!(await arrow(page)));
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log(fails ? `실패 ${fails}` : '전부 통과');
})();
