// 특별 상자(황금·폭탄·시계) 연출 촬영(ONLY=이름,이름 으로 일부만). 전제: 개발 서버 localhost:5173, 격리 Aside CDP 9333. 출력 screenshots/special/
// 상자 순번 30에서 시작해 __ajd.special(종류, 자리)로 salt를 맞춘다. 일반 탭은 .phone 클릭, 시간은 pointerdown 순간(__t0) 기준
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = process.env.URL || 'http://localhost:5173';
const OUT = path.join(__dirname, '..', 'screenshots', 'special');
fs.mkdirSync(OUT, { recursive: true });
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const mob = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const cfgs = { m390: mob(390, 844), pc: { viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 } };
const seed = () => ({ unlocked: ['tap', 'bundle', 'box', 'dex', 'move', 'contract', 'mult', 'badge', 'perk'], version: 3, points: 5e6, earned: 5e6, moves: 0, tapLevel: 3, services: [20, 12, 11, 10, 9, 8, 7, 6], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], collection: {}, stats: { totalEarned: 0, playSec: 0, boxesOpened: 0, totalTaps: 500 } });
async function open(browser, o) {
  const ctx = await browser.newContext(o);
  await ctx.addInitScript(([k, s, p]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(k, JSON.stringify({ ...s, savedAt: Date.now() }));
    localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p));
  }, ['ajd-home-idle:save', seed(), { sound: false, music: false, haptics: false, chargeDone: true, weakDone: true }]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(BASE + '/?debug');
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => !document.querySelector('.fx-banner'), null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);
  return { ctx, page };
}
// 큰 도구 + 상자 순번 30 + (burst=true면 한 탭에 터질 만큼 이미 맞은 상태) + 특별 상자 자리
const prep = async (page, kind, offset, burst, more) => {
  const ok = await prep0(page, kind, offset, burst, more);
  await page.waitForTimeout(150);
  await page.waitForFunction(() => !document.querySelector('.fx-banner'), null, { timeout: 8000 }).catch(() => {});
  // 도구 업그레이드 토스트가 방 위쪽을 가리니 사라진 뒤에 찍는다
  await page.waitForFunction(() => !document.querySelector('.toast'), null, { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(300);
  return ok;
};
const prep0 = (page, kind, offset, burst, more) =>
  page.evaluate(([kind, offset, burst, more]) => {
    const g = window.__ajd.get();
    window.__ajd.set({ ...g, tapLevel: 80, services: g.services.map((v) => v * 8), unpack: { ...g.unpack, box: 30, damage: burst ? 1e15 : 0 } });
    const ok = window.__ajd.special(kind, offset, more || {});
    return ok;
  }, [kind, offset, burst, more]);
const tap = async (page) => {
  await page.evaluate(() => document.querySelector('.phone').addEventListener('pointerdown', () => { window.__t0 = performance.now(); }, { once: true, capture: true }));
  const b = await page.locator('.phone').boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
};
const at = (page, t) => page.evaluate((t) => new Promise((r) => { const f = () => (performance.now() - window.__t0 >= t ? r() : setTimeout(f, 4)); f(); }), t);
const roomClip = async (page, o) => {
  const b = await page.locator('.room').boundingBox();
  return { x: Math.max(0, b.x), y: Math.max(0, b.y - 10), width: Math.min(o.viewport.width, b.width), height: Math.min(o.viewport.height - Math.max(0, b.y - 10), b.height + 20) };
};
const SCENES = {
  '1-gold-front': { cfg: 'm390', run: async (page, shot) => { await prep(page, 'gold', 0); await page.waitForTimeout(700); await shot('1-gold-front'); } },
  '1-bomb-front': { cfg: 'm390', run: async (page, shot) => { await prep(page, 'bomb', 0); await page.waitForTimeout(700); await shot('1-bomb-front'); } },
  '1-clock-front': { cfg: 'm390', run: async (page, shot) => { await prep(page, 'clock', 0); await page.waitForTimeout(700); await shot('1-clock-front'); } },
  '1-bomb-wait': { cfg: 'm390', run: async (page, shot) => { await prep(page, 'bomb', 2); await page.waitForTimeout(400); await shot('1-bomb-wait'); } },
  '2-gold-tap': { cfg: 'm390', run: async (page, shot) => { await prep(page, 'gold', 0, true); await tap(page); for (const t of [80, 250]) { await at(page, t); await shot(`2-gold-tap-${t}`); } } },
  '3-bomb-tap': { cfg: 'm390', run: async (page, shot) => { await prep(page, 'bomb', 0, true); await tap(page); for (const t of [150, 400, 800]) { await at(page, t); await shot(`3-bomb-tap-${t}`); } } },
  '4-mix-heavy': { cfg: 'm390', run: async (page, shot) => { await prep(page, 'gold', 2, false, { 8: 'bomb' }); await page.evaluate(() => { window.__t0 = performance.now(); window.__ajd.chain(12); }); for (const t of [400, 900]) { await at(page, t); await shot(`4-mix-heavy-${t}`); } } },
  '5-bomb-tap-pc': { cfg: 'pc', run: async (page, shot) => { await prep(page, 'bomb', 0, true); await tap(page); await at(page, 400); await shot('5-bomb-tap-pc-400'); } },
  // 시계 상자: 일반 탭으로 터뜨리면 자동 연타(러시) 시작. 터짐 150ms / 러시 중 1500ms / 콤보 24 + 피버 게이지 44 1000ms / PC 1000ms
  '6-clock-burst': { cfg: 'm390', run: async (page, shot) => { await prep(page, 'clock', 0, true); await tap(page); await at(page, 150); await shot('6-clock-burst-150'); } },
  '6-rush': { cfg: 'm390', run: async (page, shot) => { await prep(page, 'clock', 0, true); await tap(page); await at(page, 1500); await shot('6-rush-1500'); } },
  '6-rush-big': { cfg: 'm390', run: async (page, shot) => { await prep(page, 'clock', 0, true); await page.evaluate(() => { const g = window.__ajd.get(); window.__ajd.set({ ...g, fever: { gauge: 44, activeSec: 0, cooldownSec: 0 } }); window.__ajd.combo(24); }); await tap(page); await at(page, 1000); await shot('6-rush-big-1000'); } },
  '6-rush-pc': { cfg: 'pc', run: async (page, shot) => { await prep(page, 'clock', 0, true); await tap(page); await at(page, 1000); await shot('6-rush-pc-1000'); } },
};
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    for (const [name, sc] of Object.entries(SCENES)) {
      if (only && !only.includes(name)) continue;
      const o = cfgs[sc.cfg];
      const { ctx, page } = await open(browser, o);
      const shot = async (n) => {
        await page.screenshot({ path: path.join(OUT, `${n}.png`), clip: await roomClip(page, o) });
        console.log(n, JSON.stringify(await page.evaluate(() => ({ chain: window.__ajd.getChain(), particles: window.__ajd.particles(), boxes: window.__ajd.textBoxes().map((b) => b.kind + ':' + b.text.slice(0, 12)) }))));
      };
      await sc.run(page, shot);
      await ctx.close();
    }
  } finally { await browser.close(); }
})();
