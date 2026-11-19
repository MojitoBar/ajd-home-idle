// 연쇄 도중 차징 시험·촬영. 전제: 개발 서버 localhost:5173, 격리 Aside CDP 9333. 라운드마다 새 페이지. 출력 screenshots/boxloop/cc-m-charging.png
// 연쇄(1,700) 도중 꾹 눌러 게이지가 켜지는지, 퍼펙트 칸에서 뗀 강타가 한 번만 나가는지, 뗀 뒤 강타까지 걸린 시간을 잰다
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = process.env.URL || 'http://localhost:5173';
const OUT = path.join(__dirname, '..', 'screenshots', 'boxloop');
fs.mkdirSync(OUT, { recursive: true });
const O = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const PREFS = { sound: false, music: false, haptics: false, chargeDone: true, weakDone: true };
async function setup(browser) {
  const ctx = await browser.newContext(O);
  await ctx.addInitScript((p) => localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p)), PREFS);
  const page = await ctx.newPage();
  page.on('console', (m) => m.text().startsWith('DBG') && console.log(m.text()));
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(BASE + '/?debug');
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  await page.evaluate(() => { const g = window.__ajd.get(); window.__ajd.guide('done'); window.__ajd.set({ ...window.__ajd.get(), unlocked: ['tap', 'home', 'box', 'dex', 'mult', 'badge', 'perk'], points: 1e6, earned: 1e5, tapLevel: 200, unpack: { ...g.unpack, box: 30, damage: 0, hp: 1 } }); });
  await page.waitForTimeout(600);
  return { ctx, page };
}
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const rounds = Number(process.env.ROUNDS || 5);
  for (let r = 0; r < rounds; r++) {
    const { ctx, page } = await setup(browser);
    const phone = await page.locator('.phone').boundingBox();
    const px = phone.x + phone.width / 2, py = phone.y + phone.height / 2;
    const before = await page.evaluate(() => window.__ajd.get());
    await page.evaluate(() => {
      window.__sums = [];
      window.__judges = [];
      const pr = () => { const c = document.querySelector('.un-chain'); if (!c) return setTimeout(pr, 10); const t0 = performance.now(); window.__t0 = t0; new MutationObserver(() => { window.__sums.push([Math.round(performance.now() - t0), c.children[0].textContent, c.children[1].textContent, c.children[2].textContent]); }).observe(c, { childList: true, characterData: true, subtree: true }); };
      window.__ajd.chain(1700);
      pr();
      window.__p1 = window.__ajd.get().points;
    });
    await page.waitForTimeout(250);
    await page.mouse.move(px, py);
    await page.mouse.down();
    await page.waitForTimeout(500);
    const mid = await page.evaluate(() => ({ playing: window.__ajd.getChain().playing, n: window.__ajd.getChain().n, on: !!document.querySelector('.charge.on:not(.res)'), mark: document.querySelector('.charge-mark')?.style.translate }));
    await page.waitForTimeout(150);
    const mark2 = await page.evaluate(() => document.querySelector('.charge-mark')?.style.translate);
    if (r === 0) await page.screenshot({ path: path.join(OUT, 'cc-m-charging.png') });
    const res = await page.evaluate(async () => {
      const t0 = performance.now();
      while (!document.querySelector('.charge-mark.in') && performance.now() - t0 < 4000) await new Promise((q) => requestAnimationFrame(q));
      const stillPlaying = window.__ajd.getChain().playing;
      const inZone = !!document.querySelector('.charge-mark.in');
      const s0 = window.__ajd.get();
      window.__rel = performance.now();
      const tRel = performance.now();
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
      let tStrike = -1, tOldEnd = -1, ev = [];
      while (performance.now() - tRel < 5000) {
        await new Promise((q) => requestAnimationFrame(q));
        const s = window.__ajd.get();
        const t = Math.round(performance.now() - tRel);
        if (tStrike < 0 && document.querySelector('.un-chain-judge')?.textContent.includes('x1.5')) { tStrike = t; ev.push(`${t}:strike`); }
        if (tStrike >= 0 && t > tStrike + 400) break;
      }
      const s1 = window.__ajd.get();
      const rel = window.__rel - window.__t0;
      return { stillPlaying, inZone, tStrike, ev, afterRel: window.__sums.filter((x) => x[0] > rel).map((x) => `${Math.round(x[0] - rel)}:${x[1]}|${x[2]}`).filter((v, i, a) => i === 0 || v.split('|')[0].split(':')[1] !== a[i - 1].split('|')[0].split(':')[1] || true).slice(-14), txt: document.querySelector('.un-chain')?.textContent, taps: s1.stats.totalTaps - s0.stats.totalTaps };
    });
    await page.mouse.up();
    await page.waitForTimeout(3000);
    const after = await page.evaluate(() => window.__ajd.get());
    console.log(r, JSON.stringify({ mid, mark2, res }), 'p1-p0', Math.round((await page.evaluate(() => window.__p1)) - before.points), 'box', before.unpack.box, '->', after.unpack.box, 'pts+', Math.round(after.points - before.points), 'streakTxt', await page.locator('.un-chain').innerText().catch(() => ''));
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
