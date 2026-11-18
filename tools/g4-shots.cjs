// 가이드 단계 완료 연출 점검(g4). 전제: 개발 서버 localhost:5173, 격리 Aside CDP 9333. 출력 screenshots/boxloop/g4-*.png
// ONLY=이름,이름  각 장면마다 40ms 간격으로 5초 동안 __ajd.textBoxes()를 재서 머리글 2개 이상·글자 상자 겹침을 찾는다
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = process.env.URL || 'http://localhost:5173';
const OUT = path.join(__dirname, '..', 'screenshots', 'boxloop');
fs.mkdirSync(OUT, { recursive: true });
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const prefs = { sound: false, music: false, haptics: false, chargeDone: true, weakDone: true };
const M390 = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const M640 = { viewport: { width: 390, height: 664 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const M320 = { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const PC = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const ALL = ['tap', 'home', 'box', 'dex', 'move', 'mult', 'badge', 'perk'];
const step = (page, i, over = {}) => page.evaluate(([i, o]) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, guide: { step: i, n: 0, done: false }, unlocked: ['tap'], ...o }); }, [i, over]);
const say = (page, ev, n = 1) => page.evaluate(([ev, n]) => { for (let i = 0; i < n; i++) window.__ajd.guideEv(ev); }, [ev, n]);
// shots: [ms, 파일 이름] 이 시각에 뷰포트 사진
const SCENES = {
  'step1': { cfg: M390, prep: (p) => step(p, 0), start: (p) => say(p, { type: 'tap' }, 10), shots: [[350, 'g4-m-step1-done']] },
  'combo': { cfg: M390, prep: (p) => step(p, 2, { earned: 1e6, points: 1e6 }), start: (p) => say(p, { type: 'unbox' }), shots: [[750, 'g4-m-open-combo'], [1650, 'g4-m-open-combo-b']] },
  'gift': { cfg: M390, prep: (p) => step(p, 13, { tapLevel: 100, earned: 1e14, points: 1e14, unlocked: ALL }), start: (p) => say(p, { type: 'tick' }), shots: [[3000, 'g4-m-gift'], [4200, 'g4-m-gift-b']] },
  'perkBox': { cfg: M390, prep: (p) => step(p, 12, { points: 1e14, earned: 1e14, unlocked: ALL }), start: (p) => say(p, { type: 'perkBoxBuy' }), shots: [[400, 'g4-m-perkbox'], [3000, 'g4-m-perkbox-gift']] },
  'gift1': { cfg: M390, prep: (p) => step(p, 8, { earned: 1e12, points: 1e12, unlocked: ALL }), start: (p) => say(p, { type: 'perfect', value: 3 }), shots: [[2400, 'g4-m-gift1']] },
  'm640': { cfg: M640, prep: (p) => step(p, 1, { points: 1e6 }), start: (p) => say(p, { type: 'upgrade' }), shots: [[400, 'g4-m640-done']] },
  'm320': { cfg: M320, prep: (p) => step(p, 6, { earned: 1e9, points: 1e9 }), start: (p) => say(p, { type: 'fever' }), shots: [[400, 'g4-m320-fever'], [1700, 'g4-m320-fever-b']] },
  'chain': { cfg: M390, prep: (p) => step(p, 7, { earned: 1e10, points: 1e10 }), start: (p) => say(p, { type: 'chain', value: 3 }), shots: [[400, 'g4-m-chain'], [1800, 'g4-m-chain-b']] },
  'pc': { cfg: PC, prep: (p) => step(p, 2, { earned: 1e6, points: 1e6 }), start: (p) => say(p, { type: 'unbox' }), shots: [[400, 'g4-pc-done'], [1700, 'g4-pc-open']] },
  'end': { cfg: M390, prep: async (p) => { await step(p, 17, { points: 5e9, earned: 1e30, tapLevel: 12, unlocked: ALL }); await p.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, stats: { ...s.stats, totalTaps: 500 } }); }); }, start: async (p) => { await p.locator('.move-btn').click(); await p.waitForSelector('.modal'); await p.locator('.modal .btn.primary').click(); }, wait: 12000, shots: [[0, 'g4-m-guide-end']], shotWhen: (p) => p.waitForSelector('.un-home-say', { timeout: 15000 }) },
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
    for (const [name, sc] of Object.entries(SCENES)) {
      if (only && !only.includes(name)) continue;
      const o = sc.cfg;
      const ctx = await browser.newContext(o);
      await ctx.addInitScript((pp) => localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(pp)), prefs);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => console.log('pageerror', e.message));
      await page.goto(BASE + '/?debug&guide');
      await page.waitForSelector('.phone');
      await page.evaluate(() => document.fonts.ready);
      await sc.prep(page);
      await page.waitForTimeout(500);
      const g = 3;
      const t0 = Date.now();
      const startP = sc.start(page);
      if (sc.shotWhen) { await sc.shotWhen(page); await page.waitForTimeout(500); await page.screenshot({ path: path.join(OUT, sc.shots[0][1] + '.png') }); }
      await startP;
      const seen = []; const done = new Set();
      let firstBad = null; const badAt = [];
      const total = sc.wait || 5200;
      for (;;) {
        const t = Date.now() - t0;
        if (t > total) break;
        const boxes = await page.evaluate(() => window.__ajd.textBoxes());
        const key = boxes.filter((b) => b.kind === 'head' || b.kind === 'chain' || b.kind === 'toast').map(desc).join(' ');
        if (key && seen[seen.length - 1]?.k !== key) seen.push({ k: key, t });
        for (const [ms, file] of sc.shots) if (!sc.shotWhen && t >= ms && !done.has(file)) { done.add(file); await page.screenshot({ path: path.join(OUT, file + '.png') }); }
        const bad = judge(boxes, g);
        if (bad.length) { fails += 1; badAt.push(t); if (!firstBad) firstBad = { t, bad }; }
        await page.waitForTimeout(40);
      }
      console.log(`${name}: ${firstBad ? 'FAIL@' + badAt.slice(0, 6).join(',') + 'ms ' + firstBad.bad.join(' | ') : 'ok'}\n  ${seen.map((s) => `${s.t}:${s.k}`).join('\n  ')}`);
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log(fails ? `실패 프레임 ${fails}` : '전부 통과');
})();
