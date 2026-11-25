// 첫 방문 점검: 빈 저장으로 새 게임(?debug 없음)을 열고, 가이드 줄이 시키는 대로만 사람처럼 행동한다. 단계마다 사진·걸린 시간·화살표 상태를 남긴다.
// 전제: vite preview 4173, 격리 Aside 9333. 사용법: node tools/g2-first-visit.cjs [최대단계=12] [제한초=540]
const { chromium } = require('playwright');
const path = require('path');
const SHOTS = path.join(__dirname, '..', 'screenshots');
const MAX = Number(process.argv[2] || 12);
const LIMIT = Number(process.argv[3] || 560) * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: false });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('p')) { sessionStorage.setItem('p', '1'); localStorage.clear(); localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify({ sound: false, music: false, haptics: false })); } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:4173/');
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  const ov = await page.locator('.story-ov').count();
  console.log('인트로 창', ov);
  if (ov) { await page.screenshot({ path: path.join(SHOTS, 'g2-390-intro.png') }); const sk = page.locator('.story-ov .sn-skip'); if (await sk.count()) await sk.click(); else await page.locator('.story-ov button').last().click(); await page.waitForSelector('.story-ov', { state: 'detached' }).catch(() => {}); }
  const box = await page.locator('.phone').boundingBox();
  let cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const t0 = Date.now();
  let lastT = 0, cur = 0, tStep = Date.now(), lastLog = '';
  const info = () => page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const pt = q('.gd-point');
    const r = pt ? pt.getBoundingClientRect() : null;
    return { chip: q('.gd-chip')?.textContent || '', text: q('.gd-text')?.textContent || '', n: q('.gd-n')?.textContent || '', point: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), inView: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth } : null, tab: document.querySelector('.dock .tab.active')?.textContent || '', overlay: !!q('.overlay'), tip: q('.first-tip:not([hidden])')?.textContent || '' };
  });
  const times = [];
  while (Date.now() - t0 < LIMIT) {
    // 강화 버튼을 누르면 화면이 스크롤될 수 있어 매번 방 한가운데를 다시 잰다
    const rr = await page.evaluate(() => { const r = document.querySelector('.room')?.getBoundingClientRect(); return r ? [r.left + r.width / 2, r.top + r.height / 2] : null; });
    if (rr) { cx = rr[0]; cy = rr[1]; }
    const i = await info();
    const s = Math.round((Date.now() - t0) / 1000);
    const log = `${i.chip}|${i.n}`;
    if (s - lastT >= 20) { lastT = s; lastLog = log; const top = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return (e && (e.className || e.tagName)) + ''; }, [cx, cy]); await page.screenshot({ path: path.join(SHOTS, "g2-stall.png") }); const sv = await page.evaluate(() => { try { const j = JSON.parse(localStorage.getItem('ajd-home-idle:save')); return `taps=${j.stats.totalTaps} earned=${Math.round(j.earned)} box=${j.unpack.box} L=${j.tapLevel} S=${j.strikeLevel} pts=${Math.round(j.points)}`; } catch (e) { return 'nosave'; } }); console.log(`  ${s}s ${log} ${i.text} 중앙=${top} ${sv}`); }
    const m = /가이드 (\d+)\/18/.exec(i.chip);
    const no = m ? Number(m[1]) : 0;
    if (no !== cur && no > 0) {
      if (cur > 0) times.push([cur, Math.round((Date.now() - tStep) / 1000)]);
      cur = no; tStep = Date.now();
      await sleep(900);
      await page.screenshot({ path: path.join(SHOTS, `g2-390-step-${String(no).padStart(2, '0')}.png`) });
      console.log(`단계 ${no} @${Math.round((Date.now() - t0) / 1000)}s  "${i.text}" 화살표=${JSON.stringify(i.point)} 탭=${i.tab} 팁="${i.tip}"`);
      if (no > MAX) break;
    }
    if (i.overlay) { await page.screenshot({ path: path.join(SHOTS, `g2-390-overlay-${cur}.png`) }); await page.locator('.overlay .btn').last().click().catch(() => {}); await sleep(300); continue; }
    const text = i.text;
    const buy = page.locator('.btn.buy:not([disabled])');
    if (/강타가 약하면/.test(text)) { const sb = page.locator('.card:has(.card-name:text-is("오함마")) .btn.buy:not([disabled])'); if ((await sb.count()) && (await sb.first().isVisible())) { await sb.first().click().catch(() => {}); await sleep(200); continue; } }
    if (/공구를 강화|영구 공구|누적|강타가 약하면/.test(text) && (await buy.count())) { const b = buy.first(); if (await b.isVisible()) { await b.click().catch(() => {}); await sleep(200); continue; } }
    if (/꾹 눌렀다|강타|퍼펙트|터뜨려|피버/.test(text) && !/큰 상자|특별/.test(text)) {
      if (await page.locator('.weak:not([hidden])').count()) await page.locator('.weak:not([hidden])').first().click({ force: true }).catch(() => {});
      await page.mouse.move(cx, cy); await page.mouse.down();
      // 게이지의 표시가 노란 칸(퍼펙트) 안에 들어오면 놓는다(최대 두 번 왕복)
      const t1 = Date.now();
      while (Date.now() - t1 < 2400) {
        const inZone = await page.evaluate(() => { const m = document.querySelector('.charge-mark')?.getBoundingClientRect(); const p = document.querySelector('.charge-perfect')?.getBoundingClientRect(); if (!m || !p) return false; const c = m.left + m.width / 2; return c >= p.left && c <= p.right; });
        if (inZone) break;
        await sleep(15);
      }
      await page.mouse.up(); await sleep(500); continue;
    }
    if (/급소/.test(text) && (await page.locator('.weak:not([hidden])').count())) { { const wr = await page.locator('.weak:not([hidden])').first().boundingBox().catch(() => null); if (wr) await page.mouse.click(wr.x + wr.width / 2, wr.y + wr.height / 2); else await page.mouse.click(cx, cy); } await sleep(250); continue; }
    await page.mouse.click(cx, cy); await sleep(190);
  }
  if (cur > 0) times.push([cur, Math.round((Date.now() - tStep) / 1000), '진행중']);
  console.log('단계별 걸린 초', JSON.stringify(times));
  console.log('pageerror', errs);
  await ctx.close();
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
