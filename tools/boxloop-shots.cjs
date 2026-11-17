// 상자깡 루프 개편 촬영. 전제: 개발 서버 localhost:5173, 격리 Aside CDP 9333. 출력 screenshots/boxloop/
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = process.env.URL || 'http://localhost:5173';
const OUT = path.join(__dirname, '..', 'screenshots', 'boxloop');
fs.mkdirSync(OUT, { recursive: true });
const mob = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const pc = { viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 };
const prefs = { sound: false, music: false, haptics: false, chargeDone: true, weakDone: true };
const SHOTS = {
  's1-m-new': [mob, false],
  's1-m-mid': [mob, true],
  's1-pc-mid': [pc, true],
  's2-m-mid': [mob, true],
  's2-m-move': [mob, true, 'move'],
  's2-m-perk': [mob, true, 'perk'],
  's2-m-mult': [mob, true, 'mult'],
  's2-pc-mid': [pc, true],
};
const pc9 = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const mob1 = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
const S6 = ['s6-m-tools', 's6-pc-tools', 's6-m-gauge-lv0', 's6-m-gauge-lv5', 's6-m-save', 's6-m-shelf', 's6-m-toast'];
/** 6단계(화면 C) 장면. 게이지·실드·선반은 배율 1 컨텍스트(mob1)에서 방·선반만 잘라 확대 없이 저장한다 */
async function s6(browser, name) {
  const o = name.startsWith('s6-pc') ? pc9 : /gauge|shelf|save/.test(name) ? mob1 : mob;
  const ctx = await browser.newContext(o);
  await ctx.addInitScript((p) => localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p)), prefs);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(BASE + '/?debug');
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  const setup = (gear, box, extra = {}) => page.evaluate(([g, b, x]) => {
    const s = window.__ajd.get();
    window.__ajd.set({ ...s, points: 5e7, earned: 3e7, tapLevel: 30, strikeLevel: 8, moves: 0, unlocked: ['tap', 'box', 'dex', 'move', 'mult', 'badge', 'perk'], stats: { ...s.stats, totalTaps: 300, boxesOpened: 12 }, gear: g, unpack: { ...s.unpack, box: b }, ...x });
  }, [gear, box, extra]);
  const all = { level: 5, helmet: 3, crowbar: 3, awl: 2, loupe: 4 };
  const room = () => page.locator('.room');
  const crop = async (loc, file) => loc.screenshot({ path: path.join(OUT, file) });
  const frame = async (file) => { await page.waitForTimeout(0); await crop(room(), file); };
  if (name === 's6-m-tools' || name === 's6-pc-tools') {
    await setup(all, 70);
    await page.waitForTimeout(1500);
    await page.waitForTimeout(2600);
    await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true });
    await page.locator('.panel-inner').first().screenshot({ path: path.join(OUT, name + '-panel.png') });
  } else if (name.startsWith('s6-m-gauge')) {
    const lv = name.endsWith('lv0') ? 0 : 5;
    await setup(lv ? { level: lv } : {}, 70);
    await page.waitForTimeout(3000);
    await page.evaluate(() => { window.__ajd.zone(0.6); window.__ajd.holdAt(0.45); });
    await page.waitForTimeout(400);
    await crop(room(), name + '.png');
  } else if (name === 's6-m-save') {
    await setup({ helmet: 3 }, 70);
    await page.waitForTimeout(3000);
    await page.evaluate(() => { window.__ajd.shield(3, 5); window.__ajd.streak(4); });
    await page.waitForTimeout(300);
    await crop(room(), 's6-m-save-0-before.png');
    await page.evaluate(() => { window.__ajd.zone(0.8); window.__ajd.charge(0.2); });
    for (let i = 1; i <= 6; i++) { await page.waitForTimeout(i === 1 ? 20 : 60); await crop(room(), `s6-m-save-${i}.png`); }
    await page.waitForTimeout(900);
    await crop(room(), 's6-m-save-9-after.png');
  } else if (name === 's6-m-shelf') {
    await setup(all, 70);
    await page.waitForTimeout(3200);
    await crop(room(), 's6-m-shelf-room.png');
    const box = await room().boundingBox();
    await page.screenshot({ path: path.join(OUT, 's6-m-shelf.png'), clip: { x: box.x, y: box.y, width: box.width, height: 130 } });
  } else if (name === 's6-m-toast') {
    await setup({}, 14);
    await page.waitForTimeout(1000);
    await setup({}, 15);
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, name + '.png') });
  }
  await ctx.close();
}
const S7 = ['s7a-m-home', 's7a-m-early', 's7a-pc-home', 's7a-m-tierup', 's7a-m-open', 's7a-m-tabs'];
/** 7a단계(살림 탭) 장면 */
async function s7(browser, name) {
  const o = name.startsWith('s7a-pc') ? pc9 : mob;
  const ctx = await browser.newContext(o);
  await ctx.addInitScript((p) => localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p)), prefs);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(BASE + '/?debug');
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  const all = ['tap', 'home', 'box', 'dex', 'move', 'mult', 'badge', 'perk'];
  const setup = (homeLv, unlocked, extra = {}) => page.evaluate(([h, u, x]) => {
    const s = window.__ajd.get();
    window.__ajd.set({ ...s, points: 5e7, earned: 3e7, tapLevel: 30, moves: 0, unlocked: u, homeLv: h, stats: { ...s.stats, totalTaps: 300, boxesOpened: 12 }, ...x, unpack: { ...s.unpack, ...(x.unpack || {}) } });
  }, [homeLv, unlocked, extra]);
  const out = (f) => path.join(OUT, f);
  const goHome = async () => { await page.click('[data-ux="home"]'); await page.waitForTimeout(500); };
  if (name === 's7a-m-home' || name === 's7a-pc-home') {
    await setup([1, 3, 5, 12, 20, 48, 60, 200], all);
    await page.waitForTimeout(2500);
    await goHome();
    await page.screenshot({ path: out(name + '.png'), fullPage: true });
    await page.locator('.panel-inner').first().screenshot({ path: out(name + '-panel.png') });
  } else if (name === 's7a-m-early') {
    await setup([1, 2, 1, 0, 0, 0, 0, 0], all);
    await page.waitForTimeout(2500);
    await goHome();
    await page.screenshot({ path: out(name + '.png'), fullPage: true });
  } else if (name === 's7a-m-tierup') {
    await setup([2, 5, 5, 5, 5, 5, 5, 5], all, { unpack: { box: 89, damage: 0, hp: 1 } });
    await page.waitForTimeout(3000);
    const r = await page.locator('.room').boundingBox();
    await page.mouse.click(r.x + r.width / 2, r.y + r.height * 0.55);
    for (let i = 0; i < 22; i++) { await page.waitForTimeout(100); await page.locator('.room').screenshot({ path: out(`s7a-m-tierup-${String(i).padStart(2, '0')}.png`) }); }
    await page.screenshot({ path: out('s7a-m-tierup-page.png') });
  } else if (name === 's7a-m-open') {
    await setup([0, 0, 0, 0, 0, 0, 0, 0], ['tap', 'box', 'dex', 'move', 'mult', 'badge', 'perk']);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: out('s7a-m-open-0-before.png') });
    await page.evaluate(() => window.__ajd.home(0, 1));
    await page.waitForTimeout(350);
    await page.screenshot({ path: out('s7a-m-open-1.png') });
    await page.waitForTimeout(500);
    await page.screenshot({ path: out('s7a-m-open-2.png') });
  } else if (name === 's7a-m-tabs') {
    await setup([1, 3, 5, 12, 20, 48, 60, 200], all);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: out('s7a-m-tabs-tap.png') });
    await goHome();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    await page.screenshot({ path: out('s7a-m-tabs-bottom.png') });
  }
  await ctx.close();
}
const S7B = ['s7b-m-head', 's7b-pc-head', 's7b-m-break', 's7b-m-v9', 's7b-m-toast', 's7b-m-shield', 's7b-pc-shield', 's7b-m-home'];
/** 7b단계(총 배율 머리·돌파·안내 창·러시 토스트·실드 줄·살림 카드) 장면 */
async function s7b(browser, name) {
  const o = name.startsWith('s7b-pc') ? pc9 : /shield/.test(name) ? mob1 : mob;
  const ctx = await browser.newContext(o);
  await ctx.addInitScript((p) => localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p)), prefs);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(BASE + '/?debug');
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  const all = ['tap', 'home', 'box', 'dex', 'move', 'mult', 'badge', 'perk'];
  const setup = (extra = {}, homeLv = [1, 3, 5, 12, 20, 48, 60, 200]) => page.evaluate(([h, u, x]) => {
    const s = window.__ajd.get();
    window.__ajd.set({ ...s, points: 5e7, earned: 3e7, tapLevel: 30, strikeLevel: 8, moves: 0, unlocked: u, homeLv: h, stats: { ...s.stats, totalTaps: 300, boxesOpened: 12 }, gear: { level: 5, helmet: 3, crowbar: 3, awl: 2, loupe: 4 }, ...x, unpack: { ...s.unpack, ...(x.unpack || {}) } });
  }, [homeLv, all, extra]);
  const out = (f) => path.join(OUT, f);
  const badge = () => page.locator('.top .badge').innerText();
  const room = () => page.locator('.room');
  if (name === 's7b-m-head' || name === 's7b-pc-head') {
    for (const [tag, lv, moves] of [['a', 540, 3], ['b', 1, 205e6]]) {
      await setup({ moves }, Array(8).fill(lv));
      await page.waitForTimeout(2500);
      console.log(name, tag, 'badge', await badge());
      await page.screenshot({ path: out(`${name}-${tag}.png`) });
      await page.locator('.top').screenshot({ path: out(`${name}-${tag}-top.png`) });
    }
    await page.click('.top .badge');
    await page.waitForTimeout(700);
    await page.screenshot({ path: out(`${name}-detail.png`) });
  } else if (name === 's7b-m-break') {
    await setup({}, [1, 3, 5, 12, 20, 48, 60, 100]);
    await page.waitForTimeout(3000);
    console.log('before', await badge());
    await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, homeLv: s.homeLv.map((x) => x + 120) }); });
    for (let i = 0; i < 10; i++) { await page.waitForTimeout(i ? 100 : 40); await page.screenshot({ path: out(`s7b-m-break-${String(i).padStart(2, '0')}.png`), clip: { x: 0, y: 0, width: 390, height: 300 } }); }
    console.log('after', await badge());
  } else if (name === 's7b-m-v9') {
    for (const n of [12, 0]) {
      await page.evaluate((b) => window.__ajd.v9(b), n);
      await page.waitForTimeout(500);
      await page.screenshot({ path: out(`s7b-m-v9-${n}.png`) });
      await page.click('.modal-actions .btn');
      await page.waitForTimeout(300);
    }
    // 실제 시작 경로: notice가 저장돼 있으면 한 번 뜨고, 닫으면 지워진다
    await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, notice: { kind: 'v9', boxes: 3 } }); window.dispatchEvent(new Event('beforeunload')); });
    await page.reload();
    await page.waitForSelector('.phone');
    await page.waitForTimeout(600);
    console.log('modal on start', await page.locator('.modal h2').innerText());
    await page.click('.modal-actions .btn');
    await page.waitForTimeout(300);
    await page.reload();
    await page.waitForSelector('.phone');
    await page.waitForTimeout(600);
    console.log('modal after reload', await page.locator('.modal').count());
  } else if (name === 's7b-m-toast') {
    await setup();
    await page.waitForTimeout(7000);
    await page.evaluate(() => { window.__ajd.returnToast(); window.__ajd.rush(15); });
    await page.waitForTimeout(500);
    await page.screenshot({ path: out('s7b-m-toast.png') });
  } else if (name.endsWith('shield')) {
    await setup({ gear: { level: 5, helmet: 3 } });
    await page.waitForTimeout(3200);
    await page.evaluate(() => { window.__ajd.shield(2, 5); window.__ajd.streak(4); });
    await page.waitForTimeout(400);
    await room().screenshot({ path: out(`${name}-mix.png`) });
    await page.evaluate(() => window.__ajd.streak(0));
    await page.waitForTimeout(600);
    await room().screenshot({ path: out(`${name}-nochip.png`) });
    await page.evaluate(() => { window.__ajd.shield(0, 2); window.__ajd.streak(3); });
    await page.waitForTimeout(400);
    await room().screenshot({ path: out(`${name}-empty.png`) });
    await page.evaluate(() => { window.__ajd.shield(3, 5); window.__ajd.streak(4); });
    await page.waitForTimeout(400);
    await room().screenshot({ path: out(`${name}-full.png`) });
    await page.evaluate(() => { window.__ajd.zone(0.8); window.__ajd.charge(0.2); });
    for (let i = 1; i <= 5; i++) { await page.waitForTimeout(i === 1 ? 20 : 60); await room().screenshot({ path: out(`${name}-save-${i}.png`) }); }
  } else if (name === 's7b-m-home') {
    await setup({ unlocked: all });
    await page.click('[data-ux="home"]');
    await page.waitForTimeout(800);
    await page.locator('.panel-inner').first().screenshot({ path: out('s7b-m-home-panel.png') });
    await page.screenshot({ path: out('s7b-m-home.png'), fullPage: true });
  }
  await ctx.close();
}
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  for (const n of S6) if (!only || only.includes(n)) await s6(browser, n);
  for (const n of S7) if (!only || only.includes(n)) await s7(browser, n);
  for (const n of S7B) if (only && only.includes(n)) await s7b(browser, n);
  for (const [name, [o, mid, extra]] of Object.entries(SHOTS)) {
    if (only && !only.includes(name)) continue;
    const ctx = await browser.newContext(o);
    await ctx.addInitScript((p) => localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p)), prefs);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('pageerror', e.message));
    await page.goto(BASE + '/?debug');
    await page.waitForSelector('.phone');
    await page.evaluate(() => document.fonts.ready);
    if (mid) {
      await page.evaluate(() => {
        const s = window.__ajd.get();
        window.__ajd.set({ ...s, points: 8e4, earned: 3e5, tapLevel: 12, unlocked: ['tap', 'box', 'dex', 'move', 'mult', 'badge', 'perk'], stats: { ...s.stats, totalTaps: 300, boxesOpened: 12 } });
      });
      for (let i = 0; i < 6; i++) { await page.mouse.click(o.viewport.width / 2, o.viewport.height * 0.35); await page.waitForTimeout(250); }
    }
    await page.waitForTimeout(mid ? 6500 : 1200);
    await page.evaluate(() => window.scrollTo(0, 0));
    if (extra === 'move') {
      await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, earned: 1e30 }); });
      await page.waitForTimeout(2500);
      await page.click('.move-btn');
      await page.waitForTimeout(800);
    } else if (extra === 'perk') {
      await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, perkOffers: [['tap_power', 'tap_crit_power', 'box_discount']] }); });
      await page.waitForTimeout(600);
      await page.click('.perk-alert');
      await page.waitForTimeout(1800);
    } else if (extra === 'mult') {
      await page.click('.speed-num');
      await page.waitForTimeout(700);
    }
    await page.screenshot({ path: path.join(OUT, name + '.png') });
    await ctx.close();
  }
  await browser.close();
})();
