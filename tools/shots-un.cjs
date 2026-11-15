// 상자 풀기 화면 스크린샷 un-NN-*.png + 프레임 접지. 전제: vite preview 4173, 격리 Aside CDP 9333.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const URL = 'http://localhost:4173';
const KEY = 'ajd-home-idle:save';
const SHOTS = path.join(__dirname, '..', 'screenshots');
const FR = process.env.UN_FRAMES || path.join(require('os').tmpdir(), 'un-frames');
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const SMALL = { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const PC = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const SEED = { version: 3, points: 5e6, earned: 5e6, moves: 0, tapLevel: 3, services: [20, 12, 11, 10, 0, 0, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], collection: {} };
const PREFS = { sound: false, music: false, haptics: false };

async function open(browser, o, { seed = SEED, prefs = PREFS } = {}) {
  const ctx = await browser.newContext(o);
  await ctx.addInitScript(([k, s, p]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    if (s) localStorage.setItem(k, JSON.stringify({ ...s, savedAt: Date.now() }));
    localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p));
  }, [KEY, seed, prefs]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(URL + '?debug');
  await page.waitForSelector('.phone');
  await page.waitForTimeout(700);
  return { ctx, page };
}
const setUn = (page, unpack, extra = {}) => page.evaluate(([u, e]) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, ...e, unpack: { ...s.unpack, ...u } }); }, [unpack, extra]);
const shot = (page, n) => page.screenshot({ path: path.join(SHOTS, n) });

// 연속 프레임: action 직후부터 ms 동안 찍어 접지로 만든다
async function frames(page, name, action, ms, out, cols = 6, maxn = 18, env = {}) {
  fs.mkdirSync(FR, { recursive: true });
  for (const f of fs.readdirSync(FR)) if (f.startsWith(name + '-') || f === name + '.json') fs.rmSync(path.join(FR, f));
  const meta = [];
  const t0 = Date.now();
  await action();
  let i = 0;
  while (Date.now() - t0 < ms) {
    const t = Date.now() - t0;
    fs.writeFileSync(path.join(FR, `${name}-${String(i).padStart(3, '0')}.jpg`), await page.screenshot({ type: 'jpeg', quality: 82 }));
    meta.push({ i, t, p: await page.evaluate(() => window.__ajd.particles()) });
    i++;
  }
  fs.writeFileSync(path.join(FR, name + '.json'), JSON.stringify(meta));
  execFileSync('python3', [path.join(__dirname, 'fx-sheet.py'), FR, name, path.join(SHOTS, out), String(cols), String(maxn)], { stdio: 'inherit', env: { ...process.env, ...env } });
}

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    // 01 새 게임 첫 화면
    let { ctx, page } = await open(browser, MOBILE, { seed: null });
    await shot(page, 'un-01-new.png');
    await ctx.close();

    // 02~10 모바일(커터칼, 서비스 4개)
    const SEED2 = { ...SEED, tapLevel: 12 };
    ({ ctx, page } = await open(browser, MOBILE, { seed: SEED2 }));
    await setUn(page, { box: 2, damage: 8 }); await page.waitForTimeout(500); await shot(page, 'un-02-stage2.png');
    await setUn(page, { box: 2, damage: 14 }); await page.waitForTimeout(500); await shot(page, 'un-03-stage3.png');
    await setUn(page, { box: 9, damage: 49 }); await page.waitForTimeout(500); await shot(page, 'un-04-big-stage4.png');
    await setUn(page, { box: 14, damage: 0 }); await page.waitForTimeout(500); await shot(page, 'un-05-slot-filling.png');
    await setUn(page, { box: 33, damage: 0 }); await page.waitForTimeout(500); await shot(page, 'un-06-three-items.png');
    await setUn(page, { box: 9, damage: 0 }); await page.waitForTimeout(700); await shot(page, 'un-07-big-box.png');
    await setUn(page, { box: 85, damage: 0, roomDone: true }); await page.waitForTimeout(500); await shot(page, 'un-08-extra.png');
    await setUn(page, { box: 0, damage: 0, roomDone: false }, { tapLevel: 12 }); await page.waitForTimeout(500);
    await shot(page, 'un-09-cutter-dock.png');
    // 탭 1회 프레임
    await frames(page, 'tap1', async () => { await page.locator('.phone').tap(); }, 450, 'un-10-tap-frames.png', 6, 12);
    // 터짐 프레임
    await setUn(page, { box: 0, damage: 6 }, { tapLevel: 12 }); await page.waitForTimeout(500);
    await frames(page, 'burst', async () => { await page.locator('.phone').tap(); }, 1300, 'un-11-burst-frames.png', 6, 18);
    await page.waitForTimeout(400);
    await shot(page, 'un-12-after-burst.png');
    await ctx.close();

    // 13 예전 보기
    ({ ctx, page } = await open(browser, MOBILE, { seed: SEED2, prefs: { ...PREFS, phoneView: true } }));
    await shot(page, 'un-13-phone-view.png');
    await ctx.close();

    // 14~15 PC
    ({ ctx, page } = await open(browser, PC, { seed: SEED2 }));
    await shot(page, 'un-14-pc-start.png');
    await setUn(page, { box: 11, damage: 0 }); await page.waitForTimeout(300);
    for (let i = 0; i < 3; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(160); }
    await shot(page, 'un-15-pc-mid.png');
    await ctx.close();

    // 16 360x640
    ({ ctx, page } = await open(browser, SMALL, { seed: SEED2 }));
    await setUn(page, { box: 9, damage: 20 }); await page.waitForTimeout(500);
    await shot(page, 'un-16-small-360.png');
    await ctx.close();

    // 20~29 남은 연출
    const hpOf = (page, k) => page.evaluate((kk) => { const s = window.__ajd.get(); return Math.ceil(10 * Math.pow(1.07, kk) * ({ small: 0.7, normal: 1.6, big: 3 }[['small', 'normal', 'normal', 'small', 'normal', 'normal', 'small', 'normal', 'normal', 'big'][kk % 10]])) ; }, k);
    const SEED3 = { ...SEED, tapLevel: 12 };
    const forceCrit = (page) => page.evaluate(() => { window.__realRandom = Math.random; Math.random = () => 0.00001; });
    const unforce = (page) => page.evaluate(() => { if (window.__realRandom) Math.random = window.__realRandom; });
    const tapPhone = (page) => page.locator('.phone').tap();

    // 20 치명타 + 터짐 같은 탭(모바일), 21 치명타만
    ({ ctx, page } = await open(browser, MOBILE, { seed: SEED3 }));
    await setUn(page, { box: 4, damage: 0 }); await page.waitForTimeout(400);
    await forceCrit(page);
    await frames(page, 'crit', async () => { await tapPhone(page); }, 700, 'un-20-crit-frames.png', 6, 12);
    await unforce(page);
    await page.waitForTimeout(500);
    await setUn(page, { box: 4, damage: 0 }, { tapLevel: 3 }); await page.waitForTimeout(400);
    await forceCrit(page);
    await tapPhone(page); await page.waitForTimeout(110);
    await shot(page, 'un-21-crit-moment.png');
    await unforce(page);
    await ctx.close();

    // 22 피버 중 상자
    ({ ctx, page } = await open(browser, MOBILE, { seed: { ...SEED3, fever: { gauge: 0, activeSec: 25, cooldownSec: 0 } } }));
    await setUn(page, { box: 4, damage: 0 }); await page.waitForTimeout(400);
    await tapPhone(page); await page.waitForTimeout(80);
    await shot(page, 'un-22-fever-box.png');
    await ctx.close();

    // 23 큰 상자 낙하, 24 큰 상자 터짐, 25 방 완성, 26 도구 전환
    ({ ctx, page } = await open(browser, MOBILE, { seed: SEED3 }));
    let hp = await hpOf(page, 8);
    await setUn(page, { box: 8, damage: hp - 1 }); await page.waitForTimeout(400);
    await frames(page, 'drop', async () => { await tapPhone(page); }, 900, 'un-23-big-drop-frames.png', 6, 12);
    hp = await hpOf(page, 9);
    await setUn(page, { box: 9, damage: hp - 1 }); await page.waitForTimeout(500);
    await frames(page, 'bigburst', async () => { await tapPhone(page); }, 1900, 'un-24-big-burst-frames.png', 6, 18);
    await page.waitForTimeout(600);
    hp = await hpOf(page, 79);
    await setUn(page, { box: 79, damage: hp - 1, roomDone: false }); await page.waitForTimeout(500);
    await frames(page, 'roomdone', async () => { await tapPhone(page); }, 3600, 'un-25-room-done-frames.png', 6, 18);
    await ctx.close();
    ({ ctx, page } = await open(browser, MOBILE, { seed: { ...SEED3, tapLevel: 9 } }));
    await frames(page, 'toolswap', async () => { await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, tapLevel: 10 }); }); }, 1300, 'un-26-tool-swap-frames.png', 6, 18);
    await ctx.close();

    // 27 360x640 첫 화면
    ({ ctx, page } = await open(browser, SMALL, { seed: SEED3 }));
    await shot(page, 'un-27-small-first.png');
    await ctx.close();

    // 28 PC 큰 상자 터짐 + 치명타, 29 모바일 큰 상자 + 치명타 + 터짐 같은 탭
    ({ ctx, page } = await open(browser, PC, { seed: SEED3 }));
    hp = await hpOf(page, 9);
    await setUn(page, { box: 9, damage: hp - 1 }); await page.waitForTimeout(400);
    await forceCrit(page);
    await page.keyboard.press('Space'); await page.waitForTimeout(450);
    await shot(page, 'un-28-pc-big-burst.png');
    await unforce(page);
    await ctx.close();
    ({ ctx, page } = await open(browser, MOBILE, { seed: SEED3 }));
    hp = await hpOf(page, 9);
    await setUn(page, { box: 9, damage: hp - 1 }); await page.waitForTimeout(400);
    await forceCrit(page);
    await tapPhone(page); await page.waitForTimeout(300);
    await shot(page, 'un-29-mobile-crit-burst.png');
    await unforce(page);
    await ctx.close();

    // 30~36 배치 수정 확인(원본 배율로 열어 본다)
    const SEED4 = { ...SEED, tapLevel: 12 };
    ({ ctx, page } = await open(browser, MOBILE, { seed: SEED4 }));
    let hp4 = await hpOf(page, 9);
    await setUn(page, { box: 9, damage: hp4 - 1 }); await page.waitForTimeout(400);
    await forceCrit(page);
    await tapPhone(page); await page.waitForTimeout(260);
    await shot(page, 'un-30-mobile-crit-burst.png');
    await unforce(page);
    await ctx.close();

    ({ ctx, page } = await open(browser, PC, { seed: SEED4 }));
    hp4 = await hpOf(page, 9);
    await setUn(page, { box: 9, damage: hp4 - 1 }); await page.waitForTimeout(400);
    await forceCrit(page);
    await page.keyboard.press('Space'); await page.waitForTimeout(260);
    await shot(page, 'un-31-pc-big-burst.png');
    await unforce(page);
    await ctx.close();

    ({ ctx, page } = await open(browser, SMALL, { seed: SEED4 }));
    await shot(page, 'un-32-small-first.png');
    await ctx.close();

    ({ ctx, page } = await open(browser, { ...SMALL, viewport: { width: 320, height: 640 } }, { seed: SEED4 }));
    await shot(page, 'un-33-w320-move-row.png');
    await ctx.close();

    ({ ctx, page } = await open(browser, MOBILE, { seed: SEED4 }));
    await setUn(page, { box: 85, damage: 0, roomDone: true }); await page.waitForTimeout(600);
    await shot(page, 'un-34-room-done.png');
    await ctx.close();

    // 피버 중 상자: 켜진 뒤 배너가 사라지길 기다린다
    ({ ctx, page } = await open(browser, MOBILE, { seed: SEED4 }));
    await setUn(page, { box: 4, damage: 0 }, { fever: { gauge: 0, activeSec: 25, cooldownSec: 0 } }); await page.waitForTimeout(2800);
    console.log('fever body class:', await page.evaluate(() => document.body.classList.contains('fever')));
    await tapPhone(page); await page.waitForTimeout(90);
    await shot(page, 'un-35-fever-box.png');
    await ctx.close();

    // 도구 전환: 독 아래쪽만 잘라 프레임 접지
    ({ ctx, page } = await open(browser, MOBILE, { seed: { ...SEED4, tapLevel: 9 } }));
    await frames(page, 'toolswap2', async () => { await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, tapLevel: 10 }); }); }, 1100, 'un-36-tool-swap-dock.png', 3, 9, { FX_CROP: '0.80,1.0', FX_SCALE: '0.6' });
    await ctx.close();
  } finally {
    await browser.close();
  }
})();
