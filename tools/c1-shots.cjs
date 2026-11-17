// 머리글 겹침 점검(c1). 전제: 개발 서버 localhost:5173, 격리 Aside CDP 9333. 출력 screenshots/boxloop/c1-*.png
// ONLY=이름,이름  SIZES=m390,pc  장면마다 40ms 간격으로 4.5초 동안 __ajd.textBoxes()를 재서 머리글 2개 이상·글자 상자 겹침(탭 숫자 제외)을 찾는다
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = process.env.URL || 'http://localhost:5173';
const OUT = path.join(__dirname, '..', 'screenshots', 'boxloop');
fs.mkdirSync(OUT, { recursive: true });
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const sizes = process.env.SIZES ? process.env.SIZES.split(',') : ['m390'];
const prefs = { sound: false, music: false, haptics: false, chargeDone: true, weakDone: true };
const cfgs = {
  m390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  pc: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};
const ALL = ['tap', 'home', 'box', 'dex', 'move', 'mult', 'badge', 'perk'];
// 살림 0번 칸이 Lv2(다음 칸 손질이 단계 상승), 나머지는 높아 다음 손질 칸이 0번이 된다
const LOW = [2, 20, 20, 20, 20, 20, 20, 20];
const setup = (page, extra = {}, homeLv = LOW, box = 70) => page.evaluate(([h, u, x, b]) => {
  const s = window.__ajd.get();
  window.__ajd.set({ ...s, points: 5e7, earned: 3e7, tapLevel: 30, strikeLevel: 8, moves: 0, unlocked: u, homeLv: h, stats: { ...s.stats, totalTaps: 300, boxesOpened: 12 }, gear: { level: 5, helmet: 3, crowbar: 3, awl: 2, loupe: 4 }, ...x, unpack: { ...s.unpack, box: b, ...(x.unpack || {}) } });
}, [homeLv, ALL, extra, box]);
const SCENES = {
  // 흠 1: 연쇄 중 실드가 막는다
  'shieldchain': { prep: async (p) => { await setup(p, {}, [1, 3, 5, 12, 20, 48, 60, 200], 30); await p.waitForTimeout(3000); await p.evaluate(() => { window.__ajd.shield(3, 5); window.__ajd.streak(4); window.__ajd.zone(0.8); }); }, start: (p) => p.evaluate(() => window.__ajd.charge(0.2)) },
  // 살림 단계 상승(1연쇄)
  'home1': { prep: async (p) => { await setup(p, {}, LOW, 89); await p.waitForTimeout(3000); }, start: (p) => p.evaluate(() => window.__ajd.chain(1)) },
  // 살림 단계 상승이 연쇄 안에서
  'homechain': { prep: async (p) => { await setup(p, {}, LOW, 85); await p.waitForTimeout(3000); }, start: (p) => p.evaluate(() => window.__ajd.chain(5)) },
  // 연쇄 없이 살림 단계 상승 + 피버 시작
  'home-fever': { prep: async (p) => { await setup(p, {}, LOW, 89); await p.waitForTimeout(3000); }, start: (p) => p.evaluate(() => { window.__ajd.chain(1); setTimeout(() => window.__ajd.fever(), 300); }) },
  // 연쇄 안 살림 단계 상승 + 피버 시작 + 콤보
  'homechain-fever': { prep: async (p) => { await setup(p, {}, LOW, 85); await p.waitForTimeout(3000); }, start: (p) => p.evaluate(() => { window.__ajd.combo(24); window.__ajd.chain(5); setTimeout(() => window.__ajd.fever(), 300); }) },
  // 토스트 2개 + 살림 단계 상승
  'home-toasts': { prep: async (p) => { await setup(p, {}, LOW, 89); await p.waitForTimeout(3000); }, start: (p) => p.evaluate(() => { window.__ajd.toast('살림 칸을 하나 채웠어요'); window.__ajd.toast('새 물건을 열었어요', true); window.__ajd.chain(1); }) },
  // 황금 상자 머리글 + 배율 돌파
  'gold-break': { prep: async (p) => { await setup(p, {}, [1, 3, 5, 12, 20, 48, 60, 100], 30); await p.evaluate(() => window.__ajd.special('gold', 0)); await p.waitForTimeout(3500); }, start: (p) => p.evaluate(() => { window.__ajd.chain(1); setTimeout(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, homeLv: s.homeLv.map((x) => x + 120) }); }, 250); }) },
  'clock-home': { prep: async (p) => { await setup(p, {}, LOW, 88); await p.evaluate(() => window.__ajd.special('clock', 0)); await p.waitForTimeout(3500); }, start: (p) => p.evaluate(() => { window.__ajd.chain(2); }) },
  'bomb-break': { prep: async (p) => { await setup(p, {}, [1, 3, 5, 12, 20, 48, 60, 100], 30); await p.evaluate(() => window.__ajd.special('bomb', 0)); await p.waitForTimeout(3500); }, start: (p) => p.evaluate(() => { window.__ajd.chain(1); setTimeout(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, homeLv: s.homeLv.map((x) => x + 120) }); }, 250); }) },
  // 흠 2: 살림·총 배율 등이 한꺼번에 열림
  'unlocks': { prep: async (p) => { await setup(p, {}, [3, 5, 7, 12, 20, 48, 60, 100], 30); await p.waitForTimeout(3000); }, start: (p) => p.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, unlocked: ['tap'] }); }) },
  // 콤보 + 배율 돌파 (연쇄 없음)
  'combo-break': { prep: async (p) => { await setup(p, {}, [1, 3, 5, 12, 20, 48, 60, 100], 30); await p.waitForTimeout(3000); }, start: (p) => p.evaluate(() => { window.__ajd.combo(24); window.__ajd.say('perfect', 2, 1234, 2.2); setTimeout(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, homeLv: s.homeLv.map((x) => x + 120) }); }, 200); }) },
};
const inter = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1;
// 글자 외곽선(2px)이 서로 닿는 것도 붙은 것으로 본다: 세로 간격이 외곽선 두 겹(4px)보다 작으면 겹침
const near = (a, b, g) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > -g;
const desc = (b) => `${b.kind}"${b.text.slice(0, 16)}"`;
function judge(boxes, g) {
  const bad = [];
  const heads = boxes.filter((b) => b.kind === 'head');
  if (heads.length >= 2) bad.push(`머리글 ${heads.length}개: ${heads.map(desc).join(' + ')}`);
  const fixed = boxes.filter((b) => b.kind !== 'float' && b.kind !== 'gain');
  for (let i = 0; i < fixed.length; i++) for (let j = i + 1; j < fixed.length; j++) {
    const a = fixed[i], b = fixed[j];
    if (a.kind === 'chain' && b.kind === 'chain') continue;
    if (a.kind === 'streak' && b.kind === 'streak') continue;
    if ([a.kind, b.kind].includes('toast') && [a.kind, b.kind].includes('streak')) continue;
    if (inter(a, b)) bad.push(`겹침 ${desc(a)} x ${desc(b)}`);
    else if (['head', 'chain', 'toast'].includes(a.kind) && ['head', 'chain', 'toast'].includes(b.kind) && near(a, b, g)) bad.push(`붙음 ${desc(a)} x ${desc(b)}`);
  }
  const ch = boxes.filter((b) => b.kind === 'chain');
  if (ch.length >= 3 && near({ ...ch[0], y: ch[0].y + 3, h: ch[0].h - 6 }, { ...ch[2], y: ch[2].y + 3, h: ch[2].h - 6 }, g)) bad.push(`붙음 ${desc(ch[2])} x ${desc(ch[0])}`);
  return bad;
}
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  let fails = 0;
  try {
    for (const cfg of sizes) for (const [name, sc] of Object.entries(SCENES)) {
      if (only && !only.includes(name)) continue;
      const o = cfgs[cfg];
      const ctx = await browser.newContext(o);
      await ctx.addInitScript((pp) => localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(pp)), { ...prefs, ...(sc.prefs || {}) });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => console.log('pageerror', e.message));
      await page.goto(BASE + '/?debug');
      await page.waitForSelector('.phone');
      await page.evaluate(() => document.fonts.ready);
      await sc.prep(page);
      const room = await page.locator('.room').boundingBox();
      const clip = { x: Math.max(0, room.x), y: Math.max(0, room.y - 10), width: Math.min(o.viewport.width, room.width), height: room.height + 20 };
      const g = 3;
      await page.evaluate(() => { window.__t0 = performance.now(); });
      await sc.start(page);
      const seen = [];
      let firstBad = null, lastBoxes = null; const badAt = [];
      for (let t = 0; t < 4500; t += 40) {
        const boxes = await page.evaluate(() => window.__ajd.textBoxes());
        const key = boxes.filter((b) => b.kind === 'head' || b.kind === 'chain' || b.kind === 'toast').map(desc).join(' ');
        if (key && seen[seen.length - 1]?.k !== key) seen.push({ k: key, t });
        if (process.env.SHOT && process.env.SHOT.split(',').map(Number).includes(t)) await page.screenshot({ path: path.join(OUT, `c1-${name}-${cfg}-${t}.png`), clip });
        const bad = judge(boxes, g);
        if (bad.length) { fails += 1; badAt.push(t); lastBoxes = boxes; if (!firstBad) { firstBad = { t, bad }; await page.screenshot({ path: path.join(OUT, `c1-${name}-${cfg}-bad.png`), clip }); } }
        await page.waitForTimeout(40);
      }
      console.log(`${name} ${cfg}: ${firstBad ? 'FAIL@' + badAt.join(',') + 'ms ' + firstBad.bad.join(' | ') : 'ok'}\n  ${seen.map((s) => `${s.t}:${s.k}`).join('\n  ')}`);
      if (process.env.DUMP && lastBoxes) console.log('  last bad boxes', JSON.stringify(lastBoxes));
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log(fails ? `실패 프레임 ${fails}` : '전부 통과');
})();
