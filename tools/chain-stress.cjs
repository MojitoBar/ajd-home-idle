// 연쇄 부하 측정(탭이 죽는지·가장 긴 작업·힙·DOM 노드). 전제: 격리 Aside CDP 9333, `BASE_PATH=/ npm run build` 뒤 `npx vite preview --port 4173`.
// 실제 강타 경로(__ajd.charge)로 낸다: 연쇄 수는 strikeLevel(SLS)로 맞추고 실제 수는 상자 번호 증가로 센다(대략 SL 2만=1.5천, 10만=7천, 100만=7만3천 연쇄).
// 사용: SLS=20000,100000,300000,1000000 REPEAT=10 MODE=m390|pc RUSH=1 FEVER=1 SOUND=1 REDUCED=1 URL=http://127.0.0.1:4173 node tools/chain-stress.cjs
// 각 N마다 새 페이지에서: 연쇄 재생 동안 rAF 최대 간격·longtask 최대·힙·노드를 재고, 이어서 REPEAT번 연쇄를 연달아 낸 뒤 힙·노드가 돌아오는지 본다
const { chromium } = require('playwright');
const BASE = process.env.URL || 'http://127.0.0.1:4173';
const ns = (process.env.SLS || '20000,100000,300000,1000000').split(',').map(Number);
const REPEAT = Number(process.env.REPEAT || 10);
const mob = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const pc = { viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 };
const O = { ...(process.env.MODE === 'pc' ? pc : mob), ...(process.env.REDUCED === '1' ? { reducedMotion: 'reduce' } : {}) };
const PREFS = { sound: process.env.SOUND === '1', music: false, haptics: false, chargeDone: true, weakDone: true };
const metric = async (cdp) => {
  const { metrics } = await cdp.send('Performance.getMetrics');
  const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
  return { heap: m.JSHeapUsedSize / 1048576, nodes: m.Nodes };
};
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  for (const n of ns) {
    const ctx = await browser.newContext(O);
    await ctx.addInitScript((p) => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p)); } }, PREFS);
    const page = await ctx.newPage();
    let crashed = false;
    const errs = [];
    let navs = 0;
    page.on('crash', () => { crashed = true; });
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('framenavigated', () => navs++);
    await page.goto(BASE + '/?debug');
    await page.waitForSelector('.phone');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(800);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Performance.enable');
    const opt = { sl: n, rush: process.env.RUSH === '1', fever: process.env.FEVER === '1' };
    await page.evaluate((o) => {
      window.__ajd.guide('done');
      const g = window.__ajd.get();
      window.__ajd.set({ ...g, unlocked: ['tap', 'home', 'box', 'dex', 'mult', 'badge', 'perk', 'move', 'contract', 'charge', 'chain', 'fever'], points: 5e9, earned: 5e9, tapLevel: 400, strikeLevel: o.sl, unpack: { ...g.unpack, box: 30, rushSec: o.rush ? 600 : 0 } });
      if (o.fever) window.__ajd.fever();
    }, opt);
    await page.waitForTimeout(500);
    const run = async () => {
      const m0 = await metric(cdp);
      const r = await page.evaluate(async () => {
        let long = 0;
        const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) long = Math.max(long, e.duration); });
        try { po.observe({ entryTypes: ['longtask'] }); } catch (e) { /* 미지원 */ }
        const t0 = performance.now();
        let max = 0;
        let last = t0;
        const b0 = window.__ajd.get().unpack.box;
        window.__ajd.charge(0.5);
        const real = window.__ajd.get().unpack.box - b0;
        const sync = performance.now() - t0;
        let peakNodes = 0;
        while (window.__ajd.getChain().playing && performance.now() - t0 < 60000) {
          await new Promise((res) => requestAnimationFrame(res));
          const t = performance.now();
          max = Math.max(max, t - last);
          last = t;
          peakNodes = Math.max(peakNodes, document.getElementsByTagName('*').length);
        }
        po.disconnect();
        return { sync: Math.round(sync), maxFrame: Math.round(max), longtask: Math.round(long), total: Math.round(performance.now() - t0), chain: real, peakNodes, part: window.__ajd.particles() };
      });
      const m1 = await metric(cdp);
      return { ...r, heapDelta: +(m1.heap - m0.heap).toFixed(1), heap: +m1.heap.toFixed(1), nodes: m1.nodes };
    };
    const base = await metric(cdp);
    let first = null;
    let rep = null;
    try {
      first = await run();
      console.log('first', n, JSON.stringify(first));
      for (let k = 0; k < REPEAT; k++) { rep = await run(); await page.waitForTimeout(300); }
      await page.waitForTimeout(3000);
      await cdp.send('HeapProfiler.enable').catch(() => {});
      await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
    } catch (e) { console.log('ERR', n, String(e.message).slice(0, 160)); }
    const end = await metric(cdp).catch(() => null);
    console.log(JSON.stringify({ sl: n, crashed, navs, errs: errs.slice(0, 2), base: { heap: +base.heap.toFixed(1), nodes: base.nodes }, last: rep, end: end && { heap: +end.heap.toFixed(1), nodes: end.nodes } }));
    await ctx.close().catch(() => {});
  }
  await browser.close();
})();
