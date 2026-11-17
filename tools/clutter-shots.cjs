// 방 안 글자 교통정리 검증(ONLY=A,B 로 일부만, SIZES=m390 로 크기 제한). 전제: 개발 서버 localhost:5173, 격리 Aside CDP 9333. 출력 screenshots/clutter/
// 장면마다 0.1·0.4·0.9·1.5·2.5·4초에 __ajd.textBoxes()로 ① 머리글 2개 이상 ② 대상끼리 겹침 ③ 탭 숫자가 머리글·연쇄 덩어리와 겹침을 판정하고 방 사진을 저장한다
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = process.env.URL || 'http://localhost:5173';
const OUT = path.join(__dirname, '..', 'screenshots', 'clutter');
fs.mkdirSync(OUT, { recursive: true });
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const sizes = process.env.SIZES ? process.env.SIZES.split(',') : null;
const mob = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const cfgs = { m390: mob(390, 844), m360: mob(360, 760), pc: { viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 } };
const TIMES = [100, 400, 900, 1500, 2500, 4000];
const BIG = { tapLevel: 80 };
const seed = () => ({ unlocked: ['tap', 'bundle', 'box', 'dex', 'move', 'contract', 'mult', 'badge', 'perk'], version: 3, points: 5e6, earned: 5e6, moves: 0, tapLevel: 3, services: [20, 12, 11, 10, 9, 8, 7, 6], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], collection: {}, stats: { totalEarned: 0, playSec: 0, boxesOpened: 0, totalTaps: 500 } });
async function open(browser, o, prefs) {
  const ctx = await browser.newContext(o);
  await ctx.addInitScript(([k, s, p]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(k, JSON.stringify({ ...s, savedAt: Date.now() }));
    localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p));
  }, ['ajd-home-idle:save', seed(), { sound: false, music: false, haptics: false, chargeDone: true, weakDone: true, ...prefs }]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(BASE + '/?debug');
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  await page.evaluate(() => window.scrollTo(0, 0));
  return { ctx, page };
}
const bigState = (extra) => `(() => { const g = window.__ajd.get(); window.__ajd.set({ ...g, tapLevel: 80, services: g.services.map((v) => v * 8), ...(${extra}) }); })()`;
// 각 장면: 준비(시계 밖) → 시작(시계 0). 시작 안에서 setTimeout으로 이어지는 일도 시계 기준
const small = `(() => { const g = window.__ajd.get(); window.__ajd.set({ ...g, tapLevel: 0, services: g.services.map(() => 0), ...(__EX__) }); window.__ajd.zone(0.5); })()`;
const SCENES = {
  A: { prefs: {}, prep: (p) => p.evaluate(bigState('{}')), start: (p) => p.evaluate(() => { window.__ajd.combo(24); window.__ajd.heat(90); window.__ajd.streak(4); window.__ajd.chain(12); }) },
  B: { prefs: {}, prep: (p) => p.evaluate(bigState(`{ unpack: { ...window.__ajd.get().unpack, box: 70 } }`)), start: (p) => p.evaluate(() => window.__ajd.chain(12)) },
  C: { prefs: { chargeDone: false }, prep: (p) => p.evaluate(small.replace('__EX__', '{}')), start: (p) => p.evaluate(() => { window.__ajd.say('perfect', 2, 1234, 2.2); setTimeout(() => window.__ajd.heat(100), 300); }) },
  C2: { prefs: { chargeDone: false }, prep: (p) => p.evaluate(small.replace('__EX__', '{}')), start: (p) => p.evaluate(() => { window.__ajd.charge(0.5); setTimeout(() => window.__ajd.heat(100), 300); }) },
  D: { prefs: {}, prep: (p) => p.evaluate(small.replace('__EX__', '{}')), start: (p) => p.evaluate(() => { window.__ajd.toast('살림 칸을 하나 채웠어요'); window.__ajd.toast('새 물건을 열었어요', true); window.__ajd.say('perfect', 3, 1234, 2.2); setTimeout(() => window.__ajd.fever(), 150); }) },
  D2: { prefs: {}, prep: (p) => p.evaluate(small.replace('__EX__', '{ fever: { gauge: 44, activeSec: 0, cooldownSec: 0 } }')), start: (p) => p.evaluate(() => { window.__ajd.toast('살림 칸을 하나 채웠어요'); window.__ajd.toast('새 물건을 열었어요', true); window.__ajd.charge(0.5); }) },
  F: { prefs: {}, prep: (p) => p.evaluate(bigState('{ fever: { gauge: 44, activeSec: 0, cooldownSec: 0 } }')), start: (p) => p.evaluate(() => { window.__ajd.combo(24); window.__ajd.chain(12); }) },
  F2: { prefs: {}, prep: (p) => p.evaluate(bigState('{ fever: { gauge: 44, activeSec: 0, cooldownSec: 0 } }')), start: (p) => p.evaluate(() => { window.__ajd.combo(24); window.__ajd.chain(12); window.__ajd.fever(); }) },
  G: { prefs: {}, prep: async (p) => { await p.evaluate(bigState(`{ unpack: { ...window.__ajd.get().unpack, box: 30, damage: 1e15 } }`)); await p.evaluate(() => window.__ajd.special('bomb', 0)); await p.waitForTimeout(3500); }, start: async (p) => { await p.evaluate(() => { window.__ajd.combo(24); window.__t0 = performance.now(); const r0 = Math.random; Math.random = () => 0; setTimeout(() => { Math.random = r0; }, 60); }); const b = await p.locator('.phone').boundingBox(); await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await p.evaluate(() => { window.__t0 = performance.now(); }); return true; } },
  H: { prefs: {}, prep: async (p) => { await p.evaluate(bigState(`{ fever: { gauge: 44, activeSec: 0, cooldownSec: 0 }, unpack: { ...window.__ajd.get().unpack, box: 30 } }`)); await p.evaluate(() => window.__ajd.special('gold', 2)); await p.waitForTimeout(3500); }, start: (p) => p.evaluate(() => { window.__ajd.combo(24); window.__ajd.chain(12); }) },
  I: { prefs: {}, prep: (p) => p.evaluate(bigState('{}')), start: (p) => p.evaluate(() => { window.__ajd.rush(15); window.__ajd.combo(24); window.__ajd.chain(12); }) },
  J: { prefs: {}, prep: async (p) => { await p.evaluate(bigState(`{ unpack: { ...window.__ajd.get().unpack, box: 30, damage: 1e15 } }`)); await p.evaluate(() => window.__ajd.special('bomb', 0)); await p.waitForTimeout(3500); }, start: async (p) => { await p.evaluate(() => { window.__ajd.rush(15); window.__ajd.combo(24); window.__t0 = performance.now(); }); const b = await p.locator('.phone').boundingBox(); await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2); return true; } },
  K: { prefs: {}, prep: (p) => p.evaluate(bigState('{}')), start: (p) => p.evaluate(() => { window.__ajd.combo(24); window.__ajd.streak(18); window.__ajd.chain(12); }) },
  E: { prefs: {}, prep: (p) => p.evaluate(bigState('{}')), start: async (p) => { await p.evaluate(() => { window.__ajd.combo(30); window.__ajd.weak(0.5, 0.5); }); await p.waitForTimeout(1100); await p.evaluate(() => { window.__t0 = performance.now(); window.__ajd.weakHit(); }); return true; } },
};
const inter = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1;
const desc = (b) => `${b.kind}"${b.text.slice(0, 14)}"`;
function judge(boxes) {
  const bad = [];
  const heads = boxes.filter((b) => b.kind === 'head');
  if (heads.length >= 2) bad.push(`머리글 ${heads.length}개: ${heads.map(desc).join(' + ')}`);
  const fixed = boxes.filter((b) => b.kind !== 'float');
  for (let i = 0; i < fixed.length; i++) for (let j = i + 1; j < fixed.length; j++) if (!(fixed[i].kind === 'chain' && fixed[j].kind === 'chain') && !(fixed[i].kind === 'combo' && fixed[j].kind === 'combo') && inter(fixed[i], fixed[j])) bad.push(`겹침 ${desc(fixed[i])} x ${desc(fixed[j])}`);
  for (const f of boxes.filter((b) => b.kind === 'float')) for (const h of boxes.filter((b) => b.kind === 'head' || b.kind === 'chain')) if (inter(f, h)) bad.push(`탭숫자 ${desc(f)} x ${desc(h)}`);
  return bad;
}
const roomClip = async (page, o) => {
  const b = await page.locator('.room').boundingBox();
  return { x: Math.max(0, b.x), y: Math.max(0, b.y - 10), width: Math.min(o.viewport.width, b.width), height: Math.min(o.viewport.height - Math.max(0, b.y - 10), b.height + 20) };
};
const JOBS = [['A', 'm390'], ['A', 'm360'], ['A', 'pc'], ['B', 'm390'], ['B', 'm360'], ['B', 'pc'], ['C', 'm390'], ['C2', 'm390'], ['D', 'm390'], ['D2', 'm390'], ['E', 'm390'], ['F', 'm390'], ['F2', 'm390'], ['G', 'm390'], ['H', 'm390'], ['I', 'm390'], ['I', 'pc'], ['J', 'm390'], ['K', 'm390'], ['K', 'pc']];
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  let fails = 0;
  try {
    for (const [sc, cfg] of JOBS) {
      if ((only && !only.includes(sc)) || (sizes && !sizes.includes(cfg))) continue;
      const o = cfgs[cfg];
      const { ctx, page } = await open(browser, o, SCENES[sc].prefs);
      await SCENES[sc].prep(page);
      await page.evaluate(() => { window.__t0 = performance.now(); });
      const own = await SCENES[sc].start(page);
      const rows = [];
      for (const t of TIMES) {
        await page.evaluate((t) => new Promise((r) => { const f = () => (performance.now() - window.__t0 >= t ? r() : setTimeout(f, 5)); f(); }), t);
        const boxes = await page.evaluate(() => window.__ajd.textBoxes());
        const clip = await roomClip(page, o);
        await page.screenshot({ path: path.join(OUT, `${sc}-${cfg}-${t}.png`), clip });
        const bad = judge(boxes);
        fails += bad.length;
        rows.push(`  ${String(t).padStart(4)}ms  ${bad.length ? 'FAIL ' + bad.join(' | ') : 'ok'}   [${boxes.map(desc).join(' ')}]`);
      }
      console.log(`${sc} ${cfg} chain=${JSON.stringify(await page.evaluate(() => window.__ajd.getChain()))}\n${rows.join('\n')}`);
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log(fails ? `실패 ${fails}건` : '전부 통과');
})();
