// 브라우저 스모크. 전제: vite preview 4173, 격리 Aside(헤드리스) CDP 9333. 스크린샷은 screenshots/.
const { chromium } = require('playwright');
const path = require('path');

const URL = 'http://localhost:4173';
const KEY = 'ajd-home-idle:save';
const SHOTS = path.join(__dirname, '..', 'screenshots');
require('fs').mkdirSync(path.join(SHOTS, 'unlock'), { recursive: true });
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const ALL_UNLOCKED = ['tap', 'bundle', 'box', 'dex', 'move', 'contract', 'mult', 'badge', 'perk'];
const results = [];
const errors = [];

function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' - ' + detail : ''}`);
}

async function newPage(browser, seed, query = '') {
  const ctx = await browser.newContext(MOBILE);
  if (seed) {
    seed = { unlocked: ALL_UNLOCKED, ...seed };
    await ctx.addInitScript(
      ([key, s]) => {
        if (sessionStorage.getItem('seeded')) return;
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem(key, JSON.stringify({ ...s, savedAt: Date.now() }));
      },
      [KEY, seed],
    );
  }
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && !/Extension context invalidated|Receiving end does not exist/.test(m.text()) && errors.push(`console: ${m.text()}`));
  page.on('pageerror', (e) => !/Extension context invalidated|Receiving end does not exist/.test(e.message) && errors.push(`pageerror: ${e.message}`));
  await page.goto(URL + query);
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page };
}

const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
const text = (page, sel) => page.locator(sel).first().innerText();
const loadedIn = (page, sel) => page.evaluate((q) => { const n = [...document.querySelectorAll(q)]; return n.length > 0 && n.every((i) => i.complete && i.naturalWidth > 0); }, sel);
const save = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), KEY);

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    // 1. 첫 화면, 탭, 구매, 저장 유지
    let { ctx, page } = await newPage(browser);
    check('첫 화면 렌더', (await text(page, '.house-name')) === '원룸' && (await text(page, '.speed-num')) === '0 Mbps');
    check('가로 스크롤 없음(시작)', await noHScroll(page));
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SHOTS, '01-start.png') });

    const before = await text(page, '.dock-pts-main');
    for (let i = 0; i < 20; i++) {
      await page.locator('.phone').tap();
      await page.waitForTimeout(90);
    }
    const after = await text(page, '.dock-pts-main');
    check('탭하면 재화 증가', before !== after, `${before} -> ${after}`);

    // 콤보: 사람 속도로 13번 치면 표시·배율 칩·최고 기록, 끊기면 정산으로 포인트가 오른다(0 pps라 정산만 포인트를 올린다)
    {
      const cb = await newPage(browser, null, '?debug');
      for (let i = 0; i < 13; i++) {
        await cb.page.locator('.phone').tap();
        await cb.page.waitForTimeout(170);
      }
      const chip = (await cb.page.locator('.combo.on .combo-chip').count()) ? await cb.page.locator('.combo.on .combo-chip').innerText() : '';
      const num = (await cb.page.locator('.combo.on .combo-n').count()) ? await cb.page.locator('.combo.on .combo-n').innerText() : '';
      check('콤보: 10번 넘게 치면 콤보 표시와 배율 칩', Number(num) >= 10 && /^탭 x1\.2$/.test(chip), `n=${num} chip=${chip}`);
      const p0 = await cb.page.evaluate(() => window.__ajd.get().points);
      await cb.page.waitForTimeout(1600);
      const st = await cb.page.evaluate(() => ({ p: window.__ajd.get().points, best: window.__ajd.get().bestCombo, n: window.__ajd.getCombo().n }));
      check('콤보: 끊기면 정산으로 포인트가 오른다', st.p > p0 && st.n === 0, `${p0} -> ${st.p}`);
      check('콤보: 최고 콤보가 저장 상태에 남는다', st.best >= 10, `best=${st.best}`);
      await cb.ctx.close();
    }

    // 꾹 눌러 강타: 짧은 탭은 게이지 없는 일반 탭, 길게 누르면 게이지 -> 떼면 판정 글자와 함께 탭 1번보다 많이 깎인다
    {
      const cg = await newPage(browser, { version: 3, points: 1e6, earned: 1e6, moves: 0, tapLevel: 3, services: [0, 0, 0, 0, 0, 0, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], stats: { totalEarned: 0, playSec: 0, boxesOpened: 0, totalTaps: 500 }, unpack: { box: 2, damage: 0, roomDone: false } }, '?debug');
      const box = await cg.page.locator('.phone').boundingBox();
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      const gs = () => cg.page.evaluate(() => window.__ajd.get());
      const dmg = (s) => s.unpack.box * 1e12 + s.unpack.damage;
      await cg.page.waitForTimeout(500);
      const s0 = await gs();
      await cg.page.mouse.click(cx, cy);
      await cg.page.waitForTimeout(450);
      const s1 = await gs();
      check('강타: 짧은 탭은 게이지도 판정 글자도 없는 일반 탭', (await cg.page.locator('.charge:not([hidden])').count()) === 0 && (await cg.page.locator('.charge-say').count()) === 0 && s1.stats.totalTaps - s0.stats.totalTaps === 1, `taps +${s1.stats.totalTaps - s0.stats.totalTaps}`);
      const one = dmg(s1) - dmg(s0);
      await cg.page.waitForTimeout(600);
      await cg.page.mouse.move(cx, cy);
      await cg.page.mouse.down();
      await cg.page.waitForTimeout(500);
      check('강타: 길게 누르면 게이지가 뜬다', (await cg.page.locator('.charge:not([hidden])').count()) === 1 && (await cg.page.locator('.charge-mark').count()) === 1);
      await cg.page.waitForTimeout(200);
      const s2 = await gs();
      await cg.page.mouse.up();
      await cg.page.waitForTimeout(300);
      const s3 = await gs();
      const say = (await cg.page.locator('.charge-say b').count()) ? await cg.page.locator('.charge-say b').first().innerText() : '';
      check('강타: 떼면 판정 글자와 함께 상자가 탭 1번보다 많이 깎이고 게이지가 사라진다', /퍼펙트|굿|아쉽/.test(say) && dmg(s3) - dmg(s2) > one * 1.5 && (await cg.page.locator('.charge:not([hidden])').count()) === 0, `say=${say} 탭1번=${one} 강타=${dmg(s3) - dmg(s2)}`);
      await cg.ctx.close();
    }

    // 열기·정타 구간: 탭하면 열기가 오르고 게이지가 보인다 / 과열이면 탭이 약하다 / 열기 90 퍼펙트는 열기 0보다 세고 뒤에 20 이하로 식는다 / 구간이 옮겨진다(스모크는 ?debug라 둘 다 꺼져 있다)
    {
      const ch = await newPage(browser, { version: 3, points: 1e6, earned: 1e6, moves: 0, tapLevel: 3, services: [0, 0, 0, 0, 0, 0, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], stats: { totalEarned: 0, playSec: 0, boxesOpened: 0, totalTaps: 500 }, unpack: { box: 2, damage: 0, roomDone: false } }, '?debug');
      const hbox = await ch.page.locator('.phone').boundingBox();
      const hx = hbox.x + hbox.width / 2;
      const hy = hbox.y + hbox.height / 2;
      const gs = () => ch.page.evaluate(() => window.__ajd.get());
      const dmg = (s) => s.points;
      const ev = (fn, a) => ch.page.evaluate(fn, a);
      await ch.page.waitForTimeout(500);
      await ev(() => window.__ajd.heatAuto(true));
      for (let i = 0; i < 4; i++) { await ch.page.mouse.click(hx, hy); await ch.page.waitForTimeout(90); }
      const h1 = await ev(() => window.__ajd.getHeat());
      check('열기: 탭하면 열기가 오르고 게이지가 보인다', h1.v > 10 && (await ch.page.locator('.charge:not([hidden]) .charge-heat').count()) === 1, `v=${h1.v.toFixed(1)}`);
      await ev(() => window.__ajd.heatAuto(false));
      const tapSum = async (n) => {
        const a = dmg(await gs());
        for (let i = 0; i < n; i++) { await ch.page.mouse.click(hx, hy); await ch.page.waitForTimeout(260); }
        return dmg(await gs()) - a;
      };
      await ev(() => window.__ajd.heat(0));
      const normal = await tapSum(5);
      await ev(() => window.__ajd.heat(100));
      const over = await tapSum(5);
      const hs = await ev(() => window.__ajd.getHeat());
      check('열기: 100이면 과열이 되고 그동안 탭 수익이 평소보다 작다', hs.overMs > 0 && (await ch.page.locator('.charge-heat.z-over').count()) === 1 && over < normal, `평소 5탭=${normal} 과열 5탭=${over} overMs=${hs.overMs.toFixed(0)}`);
      await ch.page.waitForTimeout(3200);
      const strike = async (v) => {
        await ev((x) => { window.__ajd.heat(x); window.__ajd.zone(0.4); }, v);
        const a = dmg(await gs());
        await ev(() => window.__ajd.charge(0.4));
        await ch.page.waitForTimeout(300);
        return dmg(await gs()) - a;
      };
      const g0 = await strike(0);
      await ch.page.waitForTimeout(1500);
      const g90 = await strike(90);
      const after = await ev(() => window.__ajd.getHeat());
      check('열기: 90에서 퍼펙트 강타는 열기 0보다 세고(약 2.8배) 강타 뒤 열기가 20 이하', g90 > g0 * 2.2 && g90 < g0 * 3.5 && after.v <= 20, `열기0=${g0} 열기90=${g90} 비=${(g90 / g0).toFixed(2)} 뒤=${after.v}`);
      await ch.page.waitForTimeout(1500);
      await ev(() => { window.__ajd.heat(0); window.__ajd.zone(0.4); window.__ajd.charge(0.4); });
      await ch.page.waitForTimeout(200);
      const sayA = (await ch.page.locator('.charge-say b').count()) ? await ch.page.locator('.charge-say b').first().innerText() : '';
      await ch.page.waitForTimeout(1500);
      await ev(() => { window.__ajd.zone(0.4); window.__ajd.charge(0.83); });
      await ch.page.waitForTimeout(200);
      const sayB = (await ch.page.locator('.charge-say b').count()) ? await ch.page.locator('.charge-say b').first().innerText() : '';
      check('열기: zone(0.4)이면 charge(0.4)는 퍼펙트, charge(0.83)은 퍼펙트가 아니다', /퍼펙트/.test(sayA) && !/퍼펙트/.test(sayB) && sayB !== '', `0.4=${sayA} 0.83=${sayB}`);
      await ch.ctx.close();
    }

    // 급소 노리기: 띄우면 과녁이 보이고, 과녁 밖은 일반 탭, 과녁을 누르면 `급소!`와 함께 탭 1번보다 많이 깎인다(스모크는 ?debug라 급소가 저절로 뜨지 않는다)
    {
      const cw = await newPage(browser, { version: 3, points: 1e6, earned: 1e6, moves: 0, tapLevel: 3, services: [0, 0, 0, 0, 0, 0, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], stats: { totalEarned: 0, playSec: 0, boxesOpened: 0, totalTaps: 500 }, unpack: { box: 2, damage: 0, roomDone: false } }, '?debug');
      const gs = () => cw.page.evaluate(() => window.__ajd.get());
      const dmg = (s) => s.unpack.box * 1e12 + s.unpack.damage;
      await cw.page.waitForTimeout(500);
      await cw.page.evaluate(() => window.__ajd.weak(0.8, 0.2));
      await cw.page.waitForTimeout(300);
      const wb = await cw.page.locator('.weak').boundingBox();
      check('급소: 띄우면 과녁이 보이고 누르는 영역이 44px 이상', (await cw.page.locator('.weak:not([hidden])').count()) === 1 && wb.width >= 44 && wb.height >= 44, `${wb.width}x${wb.height}`);
      const s0 = await gs();
      await cw.page.mouse.click(wb.x + wb.width / 2 - 70, wb.y + wb.height / 2);
      await cw.page.waitForTimeout(450);
      const s1 = await gs();
      const one = dmg(s1) - dmg(s0);
      check('급소: 과녁 밖 상자를 누르면 일반 탭(급소는 그대로)', s1.stats.totalTaps - s0.stats.totalTaps === 1 && (await cw.page.locator('.weak-say').count()) === 0 && (await cw.page.locator('.weak:not([hidden])').count()) === 1, `taps +${s1.stats.totalTaps - s0.stats.totalTaps}`);
      await cw.page.waitForTimeout(500);
      const s2 = await gs();
      await cw.page.mouse.click(wb.x + wb.width / 2, wb.y + wb.height / 2);
      await cw.page.waitForTimeout(300);
      const s3 = await gs();
      const say = (await cw.page.locator('.weak-say b').count()) ? await cw.page.locator('.weak-say b').first().innerText() : '';
      check('급소: 과녁을 누르면 `급소!`와 함께 상자가 탭 1번보다 많이 깎이고 과녁이 사라진다', say === '급소!' && dmg(s3) - dmg(s2) > one * 1.5 && (await cw.page.locator('.weak:not([hidden])').count()) === 0, `say=${say} 탭1번=${one} 급소=${dmg(s3) - dmg(s2)}`);
      await cw.ctx.close();
    }

    // 상자 풀기 화면
    check('방에 상자가 보인다', (await page.locator('.un-box[data-pos="0"]').count()) === 1 && await page.locator('.un-box[data-pos="0"]').isVisible());
    const barW = () => page.locator('.un-bar-fill').evaluate((e) => parseFloat(e.style.getPropertyValue('--r')));
    const chipN = () => text(page, '.px-count');
    await page.goto(URL + '?debug');
    await page.waitForSelector('.phone');
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, unpack: { box: 2, damage: 0, roomDone: false } }); });
    await page.waitForTimeout(300);
    const w0 = await barW();
    await page.locator('.phone').tap();
    await page.waitForTimeout(300);
    check('탭하면 내구도 막대가 줄어든다', (await barW()) < w0, `${w0} -> ${await barW()}`);
    const chip0 = await chipN();
    for (let i = 0; i < 40 && (await chipN()) === chip0; i++) { await page.locator('.phone').tap(); await page.waitForTimeout(160); }
    check('상자가 터지면 진행 칩 숫자가 오른다', (await chipN()) !== chip0, `${chip0} -> ${await chipN()}`);
    // 도구 전환·방 완성·벽 전화
    {
      await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, tapLevel: 9, unpack: { box: 0, damage: 0, roomDone: false } }); });
      await page.waitForTimeout(400);
      const toolId = () => page.locator('.dock-phone').getAttribute('data-tool');
      const hand = await toolId();
      await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, tapLevel: 10 }); });
      await page.waitForTimeout(900);
      const toastTxt = (await page.locator('.toast').allInnerTexts()).join(' | ');
      check('공구 강화 Lv 10이면 독 도구가 바뀐다', (await toolId()) === 'cutter' && hand === 'gloves' && (await loadedIn(page, '.dock-phone[data-tool] .un-dock-tool img')), `${hand} -> ${await toolId()}`);
      check('도구 획득 토스트', toastTxt.includes('손에 넣었어요'), toastTxt);
      check('옛 도구 노드가 정리된다', (await page.locator('.un-tool-out').count()) === 0);
      // 다음 프레임에 syncEvent가 다시 숨기므로 같은 스크립트 안에서 바로 읽는다
      const ringName = await page.evaluate(() => { document.querySelector('.event-call').hidden = false; return getComputedStyle(document.querySelector('.un-wall')).animationName; });
      check('이벤트 전화가 오면 벽 전화가 흔들린다', ringName === 'un-ring', ringName);
      await page.evaluate(() => { document.querySelector('.event-call').hidden = true; });
      await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, unpack: { box: 79, damage: 6286, roomDone: false } }); });
      await page.waitForTimeout(400);
      await page.locator('.phone').tap();
      await page.waitForSelector('.box-scene', { timeout: 8000 }).catch(() => {});
      check('방 완성 직전 마지막 상자를 터뜨리면 상자 결과 화면이 뜬다', (await page.locator('.box-scene').count()) === 1);
      await page.goto(URL + '?debug');
      await page.waitForSelector('.phone');
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, unpack: { box: 2, damage: 0, roomDone: false } }); });
      await page.waitForTimeout(300);
    }
    check('독 가운데 버튼에 도구 그림이 보인다', (await page.locator('.dock-phone[data-tool]').count()) === 1 && (await loadedIn(page, '.dock-phone[data-tool] .un-dock-tool img')) && await page.locator('.un-dock-tool img').first().isVisible());

    const buy = page.locator('.card .buy').first();
    check('구매 가능 강조', await page.locator('.card.affordable').count() > 0);
    await buy.click();
    await page.waitForTimeout(700);
    check('서비스 구매 후 초당 수익 증가', (await text(page, '.speed-num')) === '0.5 Mbps', await text(page, '.speed-num'));
    await page.waitForFunction((k) => (JSON.parse(localStorage.getItem(k) || 'null') || {}).services?.[0] === 1, KEY, { timeout: 15000 });
    check('자동 저장 기록', (await save(page)).services[0] === 1);
    await page.reload();
    await page.waitForSelector('.phone');
    check('새로고침 후 저장 유지', (await text(page, '.card .card-lv')) === 'Lv 1' && (await text(page, '.speed-num')).startsWith('0.5'));
    await page.locator('.tab', { hasText: '공구 강화' }).click();
    check('공구 강화 패널', (await text(page, '.panel')).includes('탭 비율'));
    await ctx.close();

    // 2. 서비스 여러 개 구매 상태
    ({ ctx, page } = await newPage(browser, { version: 1, points: 3.2e5, earned: 6e5, moves: 0, tapLevel: 12, services: [28, 14, 8, 3, 0, 0, 0, 0] }));
    check('가로 스크롤 없음(플레이)', await noHScroll(page));
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SHOTS, '02-playing.png') });
    await page.locator('.chip', { hasText: 'MAX' }).click();
    const maxTxt = await text(page, '.card .buy');
    check('MAX 구매 수량 표기', /x\d+ 구매/.test(maxTxt), maxTxt);
    await ctx.close();

    // 3. 이사
    const seed = {
      version: 1, points: 8e5, earned: 1e18, moves: 0, tapLevel: 9, services: [30, 18, 10, 4, 1, 0, 0, 0],
      collection: { fan: { base: 2, shiny: 0, gold: 0, rainbow: 0 } }, event: { nextInSec: 100, remainSec: 0, streak: 2 },
      stats: { totalTaps: 321, totalEarned: 2e6, playSec: 900, boxesOpened: 0 },
    };
    ({ ctx, page } = await newPage(browser, seed));
    const mv = page.locator('.move-btn');
    check('이사 버튼 활성', await mv.isEnabled());
    await mv.click();
    await page.waitForSelector('.modal');
    check('이사 확인창 문구', (await text(page, '.modal')).includes('영구 배율은 x1 → x2.5'), (await text(page, '.modal-body')).replace(/\n/g, ' '));
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SHOTS, '03-move.png') });
    await page.locator('.modal .btn.primary').click();
    await page.waitForSelector('.move-scene', { state: 'detached', timeout: 15000 });
    await page.waitForTimeout(500);
    const s = await save(page);
    check('이사 후 초기화/유지', s.moves === 1 && s.points === 0 && s.earned === 0 && s.tapLevel === 0 && s.services.every((v) => v === 0) && s.collection.fan.base === 2 && s.event.streak === 2 && s.stats.totalTaps === 321, JSON.stringify({ moves: s.moves, points: s.points }));
    check('이사 후 집·배율 표시', (await text(page, '.house-name')) === '투룸' && (await text(page, '.badge')).includes('영구 x2.5'));
    await page.waitForSelector('.pcards', { timeout: 6000 });
    await page.locator('.modal-actions .btn', { hasText: '나중에 고르기' }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOTS, '04-moved.png') });
    await page.locator('.phone').tap();
    await page.waitForTimeout(800);
    check('이사 후 탭하면 재화 증가', !(await text(page, '.dock-pts-main')).includes('0 P'), await text(page, '.dock-pts-main'));
    check('가로 스크롤 없음(이사 후)', await noHScroll(page));
    await ctx.close();

    // 4. 달 기지 연출
    ({ ctx, page } = await newPage(browser, { version: 1, points: 1e14, earned: 1e19, moves: 3, services: [5, 5, 5, 5, 5, 5, 5, 5] }));
    await page.locator('.move-btn').click();
    await page.locator('.modal .btn.primary').click();
    await page.waitForSelector('.modal h2');
    check('달 기지 도착 팝업', (await text(page, '.modal h2')).includes('달 기지') && (await page.evaluate(() => document.body.dataset.theme)) === 'moon');
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SHOTS, '05-moon.png') });
    await ctx.close();


    // 5. M2: 상자 탭·열기 연출·도감·확률표
    const M2 = { version: 2, points: 1e6, earned: 1e6, moves: 0, tapLevel: 0, services: [0, 0, 0, 0, 0, 0, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 } };
    ({ ctx, page } = await newPage(browser, M2));
    check('탭 바 준비 중 표시 없음', (await page.locator('.tab small').count()) === 0 && (await page.locator('.tab:disabled').count()) === 0);
    check('상자 탭 알림 점(살 수 있음)', await page.locator('.tab', { hasText: '상자' }).locator('.dot').isVisible());
    await page.locator('.tab', { hasText: '상자' }).click();
    await page.waitForTimeout(500);
    check('상자 가격·열기 버튼', (await text(page, '.box-price')).includes('5,000') || /가격/.test(await text(page, '.box-price')), await text(page, '.box-price'));
    check('상자 열기 강조', await page.locator('.box-open.ready').count() === 1);
    check('확률 창은 처음엔 없음', (await page.locator('.modal').count()) === 0);
    await page.locator('.odds-toggle').click();
    await page.waitForSelector('.modal');
    const oddsTxt = await text(page, '.modal');
    check('확률 창·합 100%', (oddsTxt.match(/100%/g) || []).length === 2 && oddsTxt.includes('0.3%') && oddsTxt.includes('0.1%'), oddsTxt.replace(/\n/g, ' ').slice(0, 120));
    check('확률 창에 10개 열기 보장 문구', oddsTxt.includes('10개 열기에서는 레어 이상이 1개 꼭 나와요'));
    await page.locator('.modal .btn', { hasText: '닫기' }).click();
    await page.evaluate(() => document.querySelector('.panel').scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOTS, 'm2-01-box-tab.png') });
    check('가로 스크롤 없음(상자 탭)', await noHScroll(page));

    // 신화+황금 고정 난수
    await page.evaluate(() => { const o = Math.random; window.__q = [0.9985, 0.5, 0.99]; Math.random = () => (window.__q.length ? window.__q.shift() : o()); });
    await page.locator('.box-open').click();
    await page.waitForSelector('.box-scene');
    await page.waitForTimeout(1250);
    await page.screenshot({ path: path.join(SHOTS, 'm2-02-opening.png') });
    check('열기 연출 중 상자 흔들림', await page.locator('.bs-box.shaking').count() === 1);
    await page.waitForSelector('.bs-card', { timeout: 8000 });
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(SHOTS, 'm2-03-reveal-rare.png') });
    check('신화 공개: 이름·새로 얻음 칩', (await text(page, '.bs-card')).includes('우주 정수기') && (await text(page, '.bs-card')).includes('새로 얻음') && (await text(page, '.bs-card')).includes('황금'), (await text(page, '.bs-card')).replace(/\n/g, ' '));
    check('상자 결과에 수집품 그림', await page.evaluate(() => { const m = document.querySelector('.bs-card img'); return !!m && m.complete && m.naturalWidth > 0; }));
    check('가로 스크롤 없음(공개)', await noHScroll(page));
    await page.waitForTimeout(1500);
    await page.locator('.bs-actions .btn.primary').click();
    await page.waitForSelector('.box-scene', { state: 'detached' });
    let sv = await save(page);
    check('상자 개봉 저장', sv.collection.space_purifier?.gold === 1 && sv.boxesThisRun === 1 && sv.stats.boxesOpened === 1);
    check('도감 알림 점', await page.locator('.tab', { hasText: '도감' }).locator('.dot').isVisible());
    await page.locator('.tab', { hasText: '도감' }).click();
    await page.waitForTimeout(900);
    check('도감 진행도 1/80·배율', (await text(page, '.dex-prog')) === '1/80' && (await text(page, '.dex-mult')).includes('x1.6'), `${await text(page, '.dex-prog')} ${await text(page, '.dex-mult')}`);
    check('도감 칸 수 80', (await page.locator('.dex-cell').count()) === 80);
    check('도감 획득 칸에 수집품 그림(img naturalWidth>0)', await page.evaluate(() => { const i = document.querySelectorAll('.dex-cell.got img'); return i.length >= 1 && [...i].every((m) => m.naturalWidth > 0); }));
    check('상단 영구 알약은 도감 배율과 무관(permMult만)', (await text(page, '.badge')) === '영구 x1', await text(page, '.badge'));
    check('도감 알림 점 해제', !(await page.locator('.tab', { hasText: '도감' }).locator('.dot').isVisible()));

    // 새 상자 10개
    await page.locator('.tab', { hasText: '상자' }).click();
    await page.locator('.box-ten').click();
    await page.waitForSelector('.sum-grid', { timeout: 12000 });
    await page.waitForSelector('.bs-actions:not(.lock)', { timeout: 15000 });
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(SHOTS, 'm2-04-ten.png') });
    check('10개 결과에 수집품 그림', await page.evaluate(() => { const i = document.querySelectorAll('.sum-cell img'); return i.length === 10 && [...i].every((m) => m.complete && m.naturalWidth > 0); }));
    check('10개 요약 10칸·최고 등급', (await page.locator('.sum-cell').count()) === 10 && (await text(page, '.sum-best')).includes('최고 등급') && (await page.locator('.sum-cell.best').count()) === 1);
    check('가로 스크롤 없음(10개 요약)', await noHScroll(page));
    await page.locator('.bs-actions .btn.primary').click();
    await page.waitForSelector('.box-scene', { state: 'detached' });
    sv = await save(page);
    check('10개 개봉 저장(총 11)', sv.stats.boxesOpened === 11 && sv.boxesThisRun === 11, `${sv.stats.boxesOpened}`);
    // 일반 1개: 가벼운 연출도 끝까지 간다
    await page.evaluate(() => { window.__q = [0.1, 0.1, 0.1]; });
    await page.locator('.box-open').click();
    await page.waitForSelector('.bs-card', { timeout: 6000 });
    await page.waitForSelector('.bs-actions:not(.lock)', { timeout: 6000 });
    await page.locator('.bs-card').click();
    await page.waitForSelector('.box-scene', { state: 'detached' });
    // 같은 칸 중복: 레벨 진행이 보인다
    await page.evaluate(() => { window.__q = [0.1, 0.1, 0.1]; });
    await page.locator('.box-open').click();
    await page.waitForSelector('.bs-card', { timeout: 6000 });
    await page.waitForSelector('.bs-actions:not(.lock)', { timeout: 6000 });
    check('중복 결과에 레벨 진행(Lv·눈금)', (await text(page, '.bs-lvtext')).includes('Lv') && (await page.locator('.bs-lvbar .lv-dots').count()) === 1, (await text(page, '.bs-lvtext')).replace(/\n/g, ' '));
    await page.locator('.bs-card').click();
    await page.waitForSelector('.box-scene', { state: 'detached' });
    await page.locator('.tab', { hasText: '도감' }).click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(SHOTS, 'm2-05-dex.png') });
    check('도감에 세트 목록 5줄·칸 레벨 표기', (await page.locator('.dex-set').count()) === 5 && (await page.locator('.dex-cell.got .lv-dots i.on').count()) >= 1, String(await page.locator('.dex-cell.got .lv-dots i.on').count()));
    const regNow = await text(page, '.dex-prog');
    check('가로 스크롤 없음(도감)', await noHScroll(page));
    await page.locator('.dex-cell.got').first().click();
    await page.waitForSelector('.modal');
    check('도감 상세 모달', (await text(page, '.modal')).includes('보유'), (await text(page, '.modal')).replace(/\n/g, ' ').slice(0, 80));
    await page.locator('.modal .modal-actions .btn').click();
    await page.waitForTimeout(1200);
    await page.reload();
    await page.waitForSelector('.phone');
    await page.locator('.tab', { hasText: '도감' }).click();
    check('새로고침 후 도감 유지', (await text(page, '.dex-prog')) === regNow, regNow);
    await ctx.close();

    // 6. M2: 이벤트 정답/오답
    const EV = { ...M2, event: { nextInSec: 0.3, remainSec: 0, streak: 0 } };
    async function solve(pg) {
      return pg.evaluate(() => {
        const months = parseInt(document.querySelector('.q-ask b').textContent, 10);
        const nums = (el) => [...el.querySelectorAll('.plan-line')].map((e) => parseInt((e.textContent.match(/\d+/) || [0])[0], 10));
        const a = document.querySelector('.plan-A');
        const b = document.querySelector('.plan-B');
        const [fixed] = nums(a).filter((_, i) => i === 0);
        const bn = [...b.querySelectorAll('.plan-line')].map((e) => parseInt((e.textContent.match(/\d+/) || [0])[0], 10));
        const totalA = fixed * months;
        const totalB = bn[1] * bn[0] + bn[3] * (months - bn[0]);
        return { answer: totalA < totalB ? 'A' : 'B', totalA, totalB, months };
      });
    }
    ({ ctx, page } = await newPage(browser, EV));
    await page.waitForSelector('.event-call:not([hidden])', { timeout: 6000 });
    check('이벤트 배너 등장', (await text(page, '.event-call')).includes('상담 요청'), await text(page, '.event-call'));
    await page.locator('.event-call').click();
    await page.waitForSelector('.plan-card');
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(SHOTS, 'm2-06-event.png') });
    check('요금제 카드 2장·허구 표기', (await page.locator('.plan-card').count()) === 2 && (await text(page, '.modal')).includes('가상 단위'));
    check('가로 스크롤 없음(이벤트 모달)', await noHScroll(page));
    const sol = await solve(page);
    await page.locator(`.plan-${sol.answer}`).click();
    await page.waitForFunction(() => document.querySelector('.modal h2')?.textContent === '정답');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOTS, 'm2-07-event-win.png') });
    check('정답: 수익 x3 표시·해설 총액', (await text(page, '.modal')).includes(`${sol.totalA}콩`) && (await text(page, '.modal')).includes(`${sol.totalB}콩`), JSON.stringify(sol));
    await page.locator('.modal .btn.primary').click();
    await page.waitForTimeout(600);
    check('이벤트 배지 x3 표시', (await page.locator('.event-badge').isVisible()) && (await text(page, '.event-badge')).includes('x3'), await text(page, '.event-badge'));
    check('이벤트 중 배율 반영(상단 배지)', (await text(page, '.badge')).includes('x') );
    check('가로 스크롤 없음(이벤트 배지)', await noHScroll(page));
    await ctx.close();

    ({ ctx, page } = await newPage(browser, EV));
    await page.waitForSelector('.event-call:not([hidden])', { timeout: 6000 });
    await page.locator('.event-call').click();
    await page.waitForSelector('.plan-card');
    const sol2 = await solve(page);
    await page.locator(`.plan-${sol2.answer === 'A' ? 'B' : 'A'}`).click();
    await page.waitForSelector('.modal .plan-card.static');
    check('오답: 해설·정답 안내', (await text(page, '.modal')).includes('정답은'), (await text(page, '.modal')).replace(/\n/g, ' ').slice(0, 80));
    await page.locator('.modal .btn.primary').click();
    await page.waitForTimeout(400);
    check('오답: 배율 없음', !(await page.locator('.event-badge').isVisible()));
    await ctx.close();


    // 6. 탭 변주: 치명타·피버·택배 상자·연타 숫자 정리
    const V = { version: 2, points: 5e5, earned: 5e5, moves: 0, tapLevel: 5, services: [20, 10, 5, 0, 0, 0, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 } };
    const tapLoop = (pg, n, gap) => pg.evaluate(([n, gap]) => new Promise((res) => {
      const ph = document.querySelector('.phone'); const r = ph.getBoundingClientRect(); let i = 0;
      const t = setInterval(() => {
        ph.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: r.left + 30 + Math.random() * (r.width - 60), clientY: r.top + 30 + Math.random() * (r.height - 60) }));
        if (++i >= n) { clearInterval(t); res(); }
      }, gap);
    }), [n, gap]);
    const frameProbe = (pg, ms) => pg.evaluate((ms) => new Promise((res) => {
      const d = []; let last = performance.now(); const t0 = last;
      const f = (now) => { d.push(now - last); last = now; if (now - t0 < ms) requestAnimationFrame(f); else res(d); };
      requestAnimationFrame(f);
    }), ms);
    const stat = (d) => ({ avg: +(d.reduce((a, b) => a + b, 0) / d.length).toFixed(1), max: +Math.max(...d).toFixed(1), n: d.length });
    const gs = (pg) => pg.evaluate(() => window.__ajd.get());
    ({ ctx, page } = await newPage(browser, V, '?debug'));
    // 초당 6회 초과 탭은 피버를 충전하지 않으므로, 이 구간은 탭 감쇠 판정(performance.now)만 절반 속도로 보이게 해 피버 연출을 따로 검증한다
    await page.evaluate(() => { const o = performance.now.bind(performance); window.__pnow = o; const t0 = o(); performance.now = () => t0 + (o() - t0) * 2; });
    await page.evaluate(() => { window.__orig = Math.random; Math.random = () => 0.01; });
    await page.locator('.phone').tap();
    await page.waitForTimeout(260);
    check('치명타 표시', (await page.locator('.fx-float.crit').count()) > 0 && (await text(page, '.fx-float.crit')).includes('쾅'), await page.locator('.fx-float.crit').first().innerText().catch(() => ''));
    await page.screenshot({ path: path.join(SHOTS, 'v-01-crit.png') });
    await page.evaluate(() => { Math.random = () => 0.9; });
    await page.waitForTimeout(1600);
    await tapLoop(page, 42, 90);
    const g1 = await gs(page);
    check('게이지 80%대 신호', g1.fever.gauge / 45 >= 0.8 && (await page.locator('.fever-gauge.near').count()) === 1 && (await page.locator('.phone.near').count()) === 1, `gauge=${g1.fever.gauge.toFixed(1)}`);
    await page.screenshot({ path: path.join(SHOTS, 'v-02-gauge.png') });
    await page.evaluate(() => { window.__bannerSeen = false; new MutationObserver(() => { if ([...document.querySelectorAll('.fx-banner-big')].some((e) => e.textContent === '피버!')) window.__bannerSeen = true; }).observe(document.body, { childList: true, subtree: true }); });
    await tapLoop(page, 14, 90);
    await page.waitForTimeout(400);
    check('피버 발동: 배너·모드·x3 배지', (await page.evaluate(() => window.__bannerSeen)) && (await page.evaluate(() => document.body.classList.contains('fever'))) && (await page.locator('.x3-badge').isVisible()) && (await page.locator('.fever-tag.active').count()) === 1);
    await page.waitForTimeout(1800);
    await tapLoop(page, 6, 90);
    await page.screenshot({ path: path.join(SHOTS, 'v-03-fever.png') });
    check('피버 중 금색 숫자', (await page.locator('.fx-float.fever').count()) > 0);
    check('가로 스크롤 없음(피버)', await noHScroll(page));
    await page.evaluate(() => { performance.now = window.__pnow; });
    const fp = frameProbe(page, 5000);
    await tapLoop(page, 50, 100);
    const fd = stat(await fp);
    console.log('프레임 간격(피버 중 10탭/초 5초)', JSON.stringify(fd));
    await page.waitForFunction(() => !document.body.classList.contains('fever'), null, { timeout: 12000 });
    await page.waitForTimeout(200);
    check('피버 해제 후 재충전 잠김 표시', (await page.evaluate(() => !document.body.classList.contains('fever'))) && (await page.locator('.fever-tag.lock').count()) === 1, JSON.stringify((await gs(page)).fever));
    await page.waitForTimeout(3600);
    check('잠김 해제', (await page.locator('.fever-tag.lock').count()) === 0 && !(await page.locator('.x3-badge').isVisible()));
    await ctx.close();

    ({ ctx, page } = await newPage(browser, V, '?debug'));
    const fp0 = frameProbe(page, 5000);
    await page.evaluate(() => { window.__orig = Math.random; Math.random = () => 0.9; });
    await tapLoop(page, 50, 100);
    const fd0 = stat(await fp0);
    console.log('프레임 간격(평소 10탭/초 5초)', JSON.stringify(fd0));
    const live = await page.locator('.fx-float').count();
    check('탭 숫자 동시 개수 상한', live <= 8, `live=${live}`);
    await ctx.close();

    ({ ctx, page } = await newPage(browser, V, '?debug'));
    await page.evaluate(() => { Math.random = () => 0.9; });
    const fp1 = tapLoop(page, 40, 100);
    await page.waitForTimeout(2200);
    await page.screenshot({ path: path.join(SHOTS, 'v-06-combo-clean.png') });
    const liveNow = await page.locator('.fx-float').count();
    check('연타 중 숫자 개수 상한(스크린샷 시점)', liveNow <= 8, `live=${liveNow}`);
    await fp1;
    await ctx.close();

    ({ ctx, page } = await newPage(browser, V, '?debug'));
    await page.evaluate(() => { Math.random = () => 0.5; const s = window.__ajd.get(); window.__ajd.set({ ...s, parcel: { nextInSec: 90, remainSec: 8 } }); });
    await page.waitForTimeout(2300);
    const pb = await page.locator('.parcel').boundingBox();
    check('택배 상자 등장·터치 영역 56px 이상', !!pb && pb.width >= 56 && pb.height >= 56, JSON.stringify(pb));
    await page.screenshot({ path: path.join(SHOTS, 'v-04-parcel.png') });
    check('가로 스크롤 없음(택배)', await noHScroll(page));
    const p0 = (await gs(page)).points;
    await page.locator('.parcel').dispatchEvent('pointerdown');
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(SHOTS, 'v-05-parcel-reward.png') });
    const p1 = (await gs(page)).points;
    check('택배 잡기: 보유 P 증가·상자 사라짐', p1 > p0 + 50 && (await page.locator('.parcel').isHidden()), `${p0} -> ${p1}`);
    check('택배 보상 문구', (await page.locator('.fx-float.parcel-gain').count()) === 1 && (await text(page, '.fx-float.parcel-gain')).includes('치'), await page.locator('.fx-float.parcel-gain').first().innerText().catch(() => ''));
    // 무료 상자 경로
    await page.evaluate(() => { Math.random = () => 0.01; const s = window.__ajd.get(); window.__ajd.set({ ...s, parcel: { nextInSec: 90, remainSec: 8 } }); });
    await page.waitForTimeout(600);
    await page.locator('.parcel').dispatchEvent('pointerdown');
    await page.waitForTimeout(300);
    check('무료 상자 배너', (await page.locator('.fx-banner-big', { hasText: '사은품 상자 도착!' }).count()) === 1);
    await page.waitForSelector('.box-scene', { timeout: 5000 });
    check('무료 상자 열기 연출 진입', true);
    await page.waitForSelector('.bs-card', { timeout: 9000 });
    await page.waitForTimeout(1600);
    await page.locator('.bs-actions .btn.primary').click();
    await page.waitForSelector('.box-scene', { state: 'detached' });
    check('무료 상자 도감 반영', (await save(page)).stats.boxesOpened === 1 || (await gs(page)).stats.boxesOpened === 1);
    // 놓치면 사라짐
    await page.evaluate(() => { Math.random = () => 0.5; const s = window.__ajd.get(); window.__ajd.set({ ...s, parcel: { nextInSec: 90, remainSec: 8 } }); });
    await page.waitForTimeout(1000);
    check('놓칠 상자 떠 있음', await page.locator('.parcel').isVisible());
    await page.waitForTimeout(7600);
    check('놓치면 8초 뒤 사라짐', (await page.locator('.parcel').isHidden()) && (await gs(page)).parcel.remainSec === 0);
    await ctx.close();


    // 10. 전략 요소 v3: 결합 · 특전 3택 · 약정 · 위약금 · 배율 내역
    const V3 = { version: 3, points: 0, earned: 0, moves: 0, tapLevel: 0, services: [0, 0, 0, 0, 0, 0, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [] };
    const gs3 = (pg) => pg.evaluate(() => window.__ajd.get());
    // 10-1. 결합
    ({ ctx, page } = await newPage(browser, { ...V3, points: 1e9, earned: 1e9, services: [9, 20, 20, 10, 0, 0, 0, 0] }, '?debug'));
    await page.waitForTimeout(500);
    check('결합 칩 5개', (await page.locator('.bchip').count()) === 5);
    const commTxt = await page.locator('.bchip[data-bundle="comm"]').innerText();
    check('결합 현재 단계·부족분 표시', commTxt.includes('통신 결합') && commTxt.includes('x1') && commTxt.includes('1레벨 더') && commTxt.includes('다음 x1.5'), commTxt.replace(/\n/g, ' '));
    check('카드 결합 칩·구매 근처 힌트', (await page.locator('.card').first().locator('.mini-chip').count()) === 2 && (await text(page, '.bundle-hint')).includes('x1.5까지 1레벨 더'), await text(page, '.bundle-hint'));
    await page.screenshot({ path: path.join(SHOTS, 's-01-bundles.png') });
    check('가로 스크롤 없음(결합)', await noHScroll(page));
    await page.locator('.card .buy').first().click();
    await page.waitForTimeout(450);
    check('결합 카드 강조(연결선 없음)', (await page.locator('.bundle-link').count()) === 0 && (await page.locator('.card.bundle-glow').count()) >= 2);
    await page.waitForSelector('.fx-banner-big:has-text("결합 x1.5!")', { timeout: 5000 });
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(SHOTS, 's-02-bundle-up.png') });
    check('결합 단계 상승 배너', (await page.locator('.fx-banner-big', { hasText: '결합 x1.5!' }).count()) === 1);
    check('결합 단계 반영', (await page.locator('.bchip[data-bundle="comm"]').getAttribute('data-stage')) === '1' && (await text(page, '.bchip[data-bundle="comm"] .bc-mult')) === 'x1.5');
    await ctx.close();

    // 10-2. 특전 3택(대기 2묶음)
    ({ ctx, page } = await newPage(browser, { ...V3, moves: 2, perks: { tap_power: 1 }, perkOffers: [['tap_power', 'svc_power', 'bundle_boost'], ['crit', 'contract_slot', 'box_discount']] }, '?debug'));
    await page.waitForTimeout(400);
    check('특전 대기 알림 버튼', (await text(page, '.perk-alert')).includes('특전 고르기 2'), await text(page, '.perk-alert'));
    await page.locator('.perk-alert').click();
    await page.waitForSelector('.pcard');
    await page.waitForTimeout(1500);
    const pk = await page.locator('.pcard').allInnerTexts();
    check('특전 3장·이름·레벨 표시', pk.length === 3 && pk[0].includes('손목 단련') && pk[0].includes('Lv 1 → 2') && pk[2].includes('결합 달인') && pk[2].includes('전략'), pk.join('|').replace(/\n/g, ' '));
    await page.screenshot({ path: path.join(SHOTS, 's-03-perk-pick.png') });
    check('가로 스크롤 없음(특전 선택)', await noHScroll(page));
    await page.locator('.modal-actions .btn', { hasText: '나중에 고르기' }).click();
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForSelector('.phone');
    await page.locator('.perk-alert').click();
    await page.waitForSelector('.pcard');
    const pk2 = await page.locator('.pcard').allInnerTexts();
    check('새로고침 후 같은 3장 유지', pk2.join('|') === pk.join('|'));
    await page.waitForTimeout(1300);
    await page.locator('.pcard', { hasText: '결합 달인' }).click();
    await page.waitForTimeout(500);
    check('선택 강조 연출', (await page.locator('.pcard.chosen').count()) === 1 && (await page.locator('.pcard.faded').count()) === 2);
    await page.waitForSelector('.pcards h2, .modal h2', { timeout: 4000 });
    await page.waitForTimeout(1900);
    let g3 = await gs3(page);
    check('특전 선택 저장·다음 묶음 이어서 열림', g3.perks.bundle_boost === 1 && g3.perkOffers.length === 1 && (await page.locator('.pcard').count()) === 3 && (await text(page, '.perk-alert')).includes('특전 고르기 1'));
    await page.waitForTimeout(1400);
    await page.locator('.pcard', { hasText: '촉이 좋은 손가락' }).click();
    await page.waitForTimeout(1900);
    g3 = await gs3(page);
    check('모두 고르면 알림 사라짐', g3.perkOffers.length === 0 && g3.perks.crit === 1 && (await page.locator('.perk-alert').isHidden()) && (await page.locator('.pcard').count()) === 0);
    await page.locator('.perk-btn').click();
    await page.waitForSelector('.perk-list');
    const pl = await text(page, '.perk-list');
    check('보유 특전 목록', pl.includes('결합 달인') && pl.includes('손목 단련') && (await page.locator('.perk-row').count()) === 12, pl.slice(0, 40).replace(/\n/g, ' '));
    await page.screenshot({ path: path.join(SHOTS, 's-04-perk-list.png') });
    await page.locator('.modal-actions .btn').click();
    await ctx.close();

    // 10-3. 약정 · 배율 내역
    ({ ctx, page } = await newPage(browser, { ...V3, points: 5e8, earned: 5e8, services: [20, 12, 11, 10, 0, 0, 0, 0] }, '?debug'));
    await page.waitForTimeout(500);
    check('약정 칸 표시 0/2', (await text(page, '.slots-pill')).includes('0/2'));
    check('약정 버튼은 보유 서비스만', (await page.locator('.contract-btn:visible').count()) === 4);
    await page.locator('.contract-btn').nth(0).click();
    await page.waitForSelector('.ct-opt');
    const ct = await page.locator('.modal').innerText();
    check('약정 시트 3종(시간·배율)', (await page.locator('.ct-opt').count()) === 3 && ct.includes('5분 · x1.5') && ct.includes('15분 · x2') && ct.includes('1시간 · x3'), ct.replace(/\n/g, ' ').slice(0, 120));
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SHOTS, 's-05-contract-sheet.png') });
    await page.locator('.ct-opt.k-normal').click();
    await page.waitForTimeout(500);
    check('도장 연출', (await page.locator('.stamp-fx').count()) === 1);
    await page.waitForTimeout(1500);
    await page.locator('.contract-btn:visible').nth(1).click();
    await page.locator('.ct-opt.k-short').click();
    await page.waitForTimeout(1800);
    const c0 = await text(page, '.card-chips .ct-badge');
    await page.waitForTimeout(1200);
    const c1 = await text(page, '.card-chips .ct-badge');
    check('약정 남은 시간 카운트다운·배율', /x2 1[45]:\d\d/.test(c0) && c0 !== c1, `${c0} -> ${c1}`);
    check('약정 칸 2/2·카드 구분', (await text(page, '.slots-pill')).includes('2/2') && (await page.locator('.card.contracted').count()) === 2);
    const full = page.locator('.contract-btn:visible').nth(2);
    check('칸 가득: 약정 버튼 비활성·사유', (await full.isDisabled()) && (await full.innerText()).includes('약정 가득'));
    check('가로 스크롤 없음(약정)', await noHScroll(page));
    check('약정 저장', (await gs3(page)).contracts.length === 2);
    await page.screenshot({ path: path.join(SHOTS, 's-06-contract-active.png') });
    await page.locator('.speed-num').click();
    await page.waitForSelector('.mult-pop:not([hidden])');
    await page.locator('.mp-t[aria-label="인터넷"]').click();
    await page.waitForTimeout(500);
    const mp = await text(page, '.mult-pop');
    check('배율 내역 팝오버', ['영구', '도감', '이벤트', '피버', '결합', '약정', '특전', '합계'].every((k) => mp.includes(k)) && mp.includes('x2.3') && mp.includes('x2'), mp.replace(/\n/g, ' '));
    await page.screenshot({ path: path.join(SHOTS, 's-08-mult-breakdown.png') });
    check('배율 내역이 창(기존 모달 틀)으로 뜸·탭 아이콘 한 줄', (await page.locator('.modal .mult-pop').count()) === 1 && (await page.locator('.modal .mp-t').evaluateAll((els) => new Set(els.slice(0, 5).map((e) => Math.round(e.getBoundingClientRect().top))).size)) === 1);
    await page.locator('.modal-actions .btn', { hasText: '닫기' }).click();
    check('배율 내역 창 닫기 버튼으로 닫힘', (await page.locator('.modal').count()) === 0 && (await page.locator('.mult-pop').isHidden()));
    await page.locator('.tab', { hasText: '공구 강화' }).click();
    check('탭 1회 줄에 i 칩', (await page.locator('.tap-info-row .i-chip').isVisible()));
    await page.locator('.tap-info-row').click();
    await page.waitForSelector('.modal .mult-pop');
    const tapMp = await text(page, '.modal .mult-pop');
    check('탭 1회 줄을 누르면 탭 내역 창', tapMp.includes('탭 1회 =') && tapMp.includes('초당 6회까지는 전액'), tapMp.replace(/\n/g, ' '));
    await page.locator('.modal-actions .btn', { hasText: '닫기' }).click();
    await ctx.close();

    // 10-4. 위약금
    ({ ctx, page } = await newPage(browser, { ...V3, points: 0, earned: 1e18, services: [40, 30, 20, 25, 10, 0, 0, 0], contracts: [{ service: 0, kind: 'long', remainSec: 3000 }, { service: 3, kind: 'normal', remainSec: 800 }] }, '?debug'));
    await page.waitForTimeout(500);
    const mn = await text(page, '.move-note');
    check('위약금 부족: 이사 비활성·사유', (await page.locator('.move-btn').isDisabled()) && mn.includes('위약금') && mn.includes('모자라요') && mn.includes('약정 만료까지') && (await text(page, '.bar-text')).includes('위약금'), mn + ' / ' + (await text(page, '.bar-text')));
    await page.screenshot({ path: path.join(SHOTS, 's-07b-penalty-blocked.png') });
    await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, points: 1e15 }); });
    await page.waitForTimeout(400);
    check('위약금 낼 수 있으면 이사 가능·금액 표시(안내 중복 없음)', (await page.locator('.move-btn').isEnabled()) && (await page.locator('.move-note').isHidden()) && (await text(page, '.bar-text')).includes('위약금'), await text(page, '.bar-text'));
    await page.locator('.move-btn').click();
    await page.waitForSelector('.modal');
    const mc = await text(page, '.modal');
    check('이사 확인창 위약금·약정 소멸 안내', mc.includes('위약금') && mc.includes('P가 빠져요') && mc.includes('함께 끝나요'), mc.replace(/\n/g, ' '));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SHOTS, 's-07-move-penalty.png') });
    check('가로 스크롤 없음(위약금)', await noHScroll(page));
    await page.locator('.modal .btn.primary').click();
    await page.waitForSelector('.move-scene', { state: 'detached', timeout: 15000 });
    await page.waitForSelector('.pcards', { timeout: 6000 });
    g3 = await gs3(page);
    check('이사 후 약정 소멸·특전 3택 대기', g3.contracts.length === 0 && g3.moves === 1 && g3.perkOffers.length === 1 && g3.perkOffers[0].length === 3);
    await ctx.close();

    // 아이콘 이미지 로드
    ({ ctx, page } = await newPage(browser, { version: 1, points: 5e3, earned: 5e3, moves: 0, tapLevel: 3, services: [5, 3, 1, 0, 0, 0, 0, 0] }, '?debug'));
    const loaded = (sel) => loadedIn(page, sel);
    await page.waitForTimeout(600);
        check('서비스 카드 아이콘 이미지 로드(8장)', (await page.locator('.card-icon img').count()) === 8 && (await loaded('.card-icon img')));
    check('독 도구 이미지 로드', await loaded('.dock-phone .un-dock-tool img'));
    check('방 선반 서비스 아이콘 로드', (await page.locator('.px-svc img').count()) === 3 && (await loaded('.px-svc img')));
    await page.evaluate(() => { Math.random = () => 0.5; const s = window.__ajd.get(); window.__ajd.set({ ...s, parcel: { nextInSec: 90, remainSec: 8 } }); });
    await page.waitForSelector('.parcel:not([hidden])', { timeout: 4000 });
    check('택배 상자 이미지 로드', await loaded('.parcel img'));
    await page.locator('.tab', { hasText: '상자' }).click();
    check('상자 탭 이미지 로드', await loaded('.box-art img'));
    await ctx.close();

    ({ ctx, page } = await newPage(browser, { ...V3, points: 5e5, earned: 5e5, services: [20, 10, 5, 3, 2, 1, 0, 0] }, '?debug'));
    const phoneShown = () => page.evaluate(() => { const r = document.querySelector('.dock-phone').getBoundingClientRect(); return r.width === 64 && r.top >= 0 && r.bottom <= innerHeight && getComputedStyle(document.querySelector('.dock-phone')).opacity === '1'; });
    check('독의 전화 버튼: 맨 위에서도 보임', await phoneShown());
    await page.evaluate(() => window.scrollTo(0, 700));
    await page.waitForTimeout(500);
    check('독의 전화 버튼: 스크롤 뒤에도 보임', await phoneShown());
    const mp0 = await page.evaluate(() => window.__ajd.get().points);
    await page.locator('.dock-phone').tap();
    await page.waitForTimeout(200);
    check('독의 전화 버튼 탭 -> 포인트 증가', (await page.evaluate(() => window.__ajd.get().points)) > mp0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    check('독의 전화 버튼: 맨 위로 와도 보임', await phoneShown());
    check('독 띠의 포인트가 상단 포인트와 같음', await page.evaluate(() => document.querySelector('.dock-pts-main').textContent === document.querySelector('.pts-main').textContent && document.querySelector('.dock-pts-rate').textContent === document.querySelector('.pts-rate').textContent && document.querySelector('.dock-pts-main').textContent.length > 0));
    check('독 전화는 양옆 탭과 12px 이상 떨어짐', await page.evaluate(() => { const p = document.querySelector('.dock-phone').getBoundingClientRect(); const t = [...document.querySelectorAll('.dock .tab')].map((b) => b.getBoundingClientRect()); return t.every((r) => r.right <= p.left - 12 || r.left >= p.right + 12); }));
    check('독: position fixed + 화면 아래', await page.evaluate(() => { const d = document.querySelector('.dock'); const r = d.getBoundingClientRect(); return getComputedStyle(d).position === 'fixed' && Math.abs(r.bottom - innerHeight) < 1; }));
    check('구매 수량 버튼: 서비스 탭에서 보임', await page.locator('.seg').isVisible());
    await page.locator('.tab', { hasText: '공구 강화' }).click();
    check('구매 수량 버튼: 공구 강화 탭에서 숨음', !(await page.locator('.seg').isVisible()));
    check('독 띠: 공구 강화 탭에서도 포인트는 보임', await page.locator('.dock-pts-main').isVisible());
    await page.locator('.tab', { hasText: '서비스' }).click();
    check('구매 수량 버튼: 서비스 탭으로 돌아오면 보임', await page.locator('.seg').isVisible());
    await ctx.close();

    // 길게 눌러 연속 구매
    ({ ctx, page } = await newPage(browser, { ...V3, points: 1e9, earned: 1e9, services: [1, 0, 0, 0, 0, 0, 0, 0] }, '?debug'));
    const lvOf = () => page.evaluate(() => window.__ajd.get().services[0]);
    const lv0 = await lvOf();
    await page.evaluate(() => window.scrollBy(0, 200));
    const bb = await page.locator('.card .buy').first().boundingBox();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1000);
    await page.mouse.up();
    const lv1 = await lvOf();
    check('길게 눌러 연속 구매: 1초에 레벨 3 이상', lv1 - lv0 >= 3, `${lv0} -> ${lv1}`);
    await page.waitForTimeout(500);
    check('길게 눌러 연속 구매: 손 떼면 멈춤', (await lvOf()) === lv1);
    const bb2 = await page.locator('.card .buy').first().boundingBox();
    await page.mouse.click(bb2.x + bb2.width / 2, bb2.y + bb2.height / 2);
    check('짧게 누르면 1회 구매', (await lvOf()) === lv1 + 1);
    await ctx.close();

    // 가림막을 눌러 모달 닫기
    ({ ctx, page } = await newPage(browser, { ...V3, points: 5e5, earned: 5e5 }, '?debug'));
    await page.locator('button[aria-label="설정"]').click();
    await page.waitForSelector('.overlay');
    await page.mouse.click(195, 40);
    await page.waitForTimeout(200);
    check('가림막을 누르면 모달 닫힘', (await page.locator('.overlay').count()) === 0);
    await ctx.close();

    ({ ctx, page } = await newPage(browser, { ...V3, points: 1e20, earned: 1e20, moves: 2, services: [30, 20, 15, 12, 8, 5, 2, 1], collection: { fan: { base: 3, shiny: 1, gold: 0, rainbow: 0 }, mug: { base: 1, shiny: 0, gold: 0, rainbow: 0 } } }, '?debug'));
    await page.locator('.move-btn').click({ force: true });
    await page.waitForSelector('.modal');
    const mtxt = (await text(page, '.modal-body')).match(/영구 배율은 x([\d.]+) → x([\d.]+)/);
    check('이사 확인창: 영구 배율 현재 → 다음 (도감 배율 무관, 증가)', !!mtxt && +mtxt[1] === 4 && +mtxt[2] === 5.5 && +mtxt[2] > +mtxt[1], mtxt ? mtxt.slice(1).join('→') : 'no match');
    await ctx.close();


    // 12. 문구 점검 반영: 탭 감쇠·공구 강화 비율·위약금 표시·영구 알약 + 스크린샷 c-*
    const parseKo = (t) => {
      const m = t.replace(/,/g, '').match(/([\d.]+)(조|억|만)?\s*P/);
      if (!m) return NaN;
      return parseFloat(m[1]) * ({ 조: 1e12, 억: 1e8, 만: 1e4 }[m[2]] || 1);
    };
    const V4 = { version: 3, points: 5e8, earned: 5e8, moves: 0, tapLevel: 12, services: [20, 12, 11, 10, 0, 0, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [] };
    ({ ctx, page } = await newPage(browser, V4, '?debug'));
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(SHOTS, 'c-01-services.png') });
    const gains = await page.evaluate(() => {
      Math.random = () => 0.9;
      // 상자가 터지지 않게 큰 상자(HP 6287)를 앞에 둔다: 터짐 덩어리가 탭 P에 섞이지 않도록
      window.__ajd.set({ ...window.__ajd.get(), unpack: { box: 79, damage: 0, roomDone: false } });
      const ph = document.querySelector('.phone');
      const out = [];
      for (let i = 0; i < 10; i++) {
        const b = window.__ajd.get().points;
        ph.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 195, clientY: 300 }));
        out.push(window.__ajd.get().points - b);
      }
      return out;
    });
    const fullG = gains[0];
    check('(a) 초당 6회 초과 탭은 감쇠돼 들어감', gains.slice(0, 6).every((g) => Math.abs(g - fullG) < 1e-6 * fullG) && gains.slice(6, 10).every((g) => g < fullG * 0.9 && g > 0) && gains[6] === gains[9], gains.map((g) => g.toFixed(1)).join(' '));
    check('(a) 감쇠 탭은 작고 흐린 숫자', (await page.locator('.fx-float.damped').count()) > 0);
    await page.locator('.tab', { hasText: '공구 강화' }).click();
    await page.waitForTimeout(400);
    const tapTxt = await text(page, '.panel');
    check('(b) 공구 강화 카드: 탭 비율·% 두 개 이상', /탭 비율 [\d.]+%/.test(tapTxt) && /탭 비율 [\d.]+% → [\d.]+%/.test(tapTxt) && /Lv \d+에서 비율 [\d.]+%/.test(tapTxt) && tapTxt.includes('탭 1회 줄을 누르면'), tapTxt.replace(/\n/g, ' ').slice(0, 220));
    check('가로 스크롤 없음(공구 강화)', await noHScroll(page));
    await page.screenshot({ path: path.join(SHOTS, 'c-02-tap-upgrade.png') });
    await page.locator('.tab', { hasText: '서비스' }).click();
    await page.locator('.contract-btn').nth(0).click();
    await page.waitForSelector('.ct-opt');
    const pen0 = await page.locator('.ct-pen').allInnerTexts();
    check('(c) 약정 카드에 위약금 미리 보기', pen0.length === 3 && pen0.every((t) => t.includes('지금 걸면 위약금 최대') && parseKo(t) > 0), pen0.join(' / '));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOTS, 'c-03-contract-before.png') });
    await page.locator('.ct-opt.k-long').click();
    await page.waitForTimeout(1900);
    await page.locator('.contract-btn:visible').nth(0).click();
    await page.waitForSelector('.penalty-line');
    const penA = await text(page, '.modal .penalty-line');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOTS, 'c-04-contract-active.png') });
    await page.locator('.modal-actions .btn').click();
    await page.evaluate(() => {
      const st = window.__ajd.get();
      window.__ajd.set({ ...st, services: st.services.map((v, i) => (i === 3 ? v + 15 : v)) });
    });
    await page.waitForTimeout(2200);
    await page.locator('.contract-btn:visible').nth(0).click();
    await page.waitForSelector('.penalty-line');
    const penB = await text(page, '.modal .penalty-line');
    check('(c) 약정 뒤 시간이 지나고 서비스를 사도 위약금 표시가 늘지 않음', penA.includes('지금 이사하면 위약금') && parseKo(penB) <= parseKo(penA) && parseKo(penA) > 0, `${penA} -> ${penB}`);
    await page.locator('.modal-actions .btn').click();
    await page.evaluate(() => {
      const st = window.__ajd.get();
      window.__ajd.set({ ...st, earned: 1e18 });
    });
    await page.waitForTimeout(400);
    await page.locator('.move-btn').click();
    await page.waitForSelector('.penalty-line');
    const mvTxt = await text(page, '.modal-body');
    check('이사 확인창: 위약금·약정 안내 문구', mvTxt.includes('위약금') && mvTxt.includes('약정 1개도 함께 끝나요') && mvTxt.includes('영구 배율은'), mvTxt.replace(/\n/g, ' '));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOTS, 'c-05-move-confirm.png') });
    await page.locator('.modal-actions .btn', { hasText: '취소' }).click();
    await page.locator('.speed-num').click();
    await page.waitForSelector('.mult-pop:not([hidden])');
    const mpTxt = await text(page, '.mult-pop');
    check('배율 내역에 도감 배율 노출', mpTxt.includes('도감') && mpTxt.includes('영구 배율'));
    await page.locator('.modal-actions .btn', { hasText: '닫기' }).click();
    await page.locator('button[aria-label="설정"]').click();
    await page.waitForSelector('.modal');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOTS, 'c-06-settings.png') });
    await ctx.close();

    ({ ctx, page } = await newPage(browser, { ...V4, moves: 2, collection: { fan: { base: 3, shiny: 1, gold: 0, rainbow: 0 } } }, '?debug'));
    check('(d) 상단 알약 = 영구 배율(permMult)만', (await text(page, '.badge')) === '영구 x4', await text(page, '.badge'));
    await ctx.close();

    ({ ctx, page } = await newPage(browser, { ...V4, moves: 2, perks: { tap_power: 1 }, perkOffers: [['tap_power', 'svc_power', 'bundle_boost']] }, '?debug'));
    await page.locator('.perk-alert').click();
    await page.waitForSelector('.pcards');
    await page.waitForTimeout(1800);
    await page.screenshot({ path: path.join(SHOTS, 'c-07-perk-pick.png') });
    await ctx.close();

    // 이사 줄 글자 넘침(320·360·390·430) + 방 완성 칩
    for (const w of [320, 360, 390, 430]) {
      const c2 = await browser.newContext({ ...MOBILE, viewport: { width: w, height: 760 } });
      const p2 = await c2.newPage();
      await p2.goto(URL + '?debug');
      await p2.waitForSelector('.phone');
      await p2.evaluate(() => document.fonts.ready);
      await p2.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, points: 5e6, unpack: { ...s.unpack, box: 80, roomDone: true } }); });
      await p2.waitForTimeout(500);
      const m = await p2.evaluate(() => { const t = document.querySelector('.bar-text'); return { fit: t.scrollWidth <= t.clientWidth, txt: t.textContent, sw: t.scrollWidth, cw: t.clientWidth }; });
      check(`${w} 폭 이사 줄 글자가 넘치지 않는다`, m.fit && m.txt.includes('이사'), `${m.txt} ${m.sw}/${m.cw}`);
      check(`${w} 폭 살림 Lv 칩`, await p2.locator('.px-done', { hasText: '살림 Lv' }).isVisible());
      await c2.close();
    }

    // ---- 단계적 공개 ----
    {
      const vis = (page, sel) => page.locator(sel).first().isVisible();
      const tabVis = (page, label) => page.locator('.tab', { hasText: label }).isVisible();
      const dotOn = (page, label) => page.locator('.tab', { hasText: label }).locator('.dot').isVisible();
      const gsU = (page) => page.evaluate(() => window.__ajd.get());
      const setS = (page, patch) => page.evaluate((p) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, ...p }); }, patch);
      const V3U = { version: 3, points: 0, earned: 0, moves: 0, tapLevel: 0, services: [0, 0, 0, 0, 0, 0, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [] };

      // 새 게임 직후
      let { ctx: uc, page: up } = await newPage(browser, null, '?debug');
      await up.waitForTimeout(500);
      check('공개: 새 게임은 탭이 서비스뿐이고 도구 버튼이 있다', (await up.locator('.dock .tab:visible').count()) === 1 && (await tabVis(up, '서비스')) && (await up.locator('.dock-phone').isVisible()));
      const hiddenSels = ['.move-block', '.slots-pill', '.bundle-toggle', '.speed-wrap .info-btn', '.top .badge', '.perk-btn', '.strat-top'];
      const shownNew = [];
      for (const sel of hiddenSels) if (await up.locator(sel).first().isVisible()) shownNew.push(sel);
      check('공개: 새 게임에서 이사 줄·약정 칸·결합·i·영구 칩·특전 버튼이 숨겨져 있다', shownNew.length === 0, shownNew.join(','));
      check('공개: 새 게임에서 서비스 카드는 가진 것 1장 + 잠김 1장만', (await up.locator('.card-list .card:visible').count()) === 2);
      check('공개: 숨긴 요소 자리가 접힌다(이사 줄 높이 0, 가로 스크롤 없음)', (await up.locator('.move-block').evaluate((e) => e.getBoundingClientRect().height)) === 0 && (await noHScroll(up)));
      await up.screenshot({ path: path.join(SHOTS, 'unlock', 'm-new-game.png') });

      // 조건 충족 -> 공구 강화 탭이 토스트·알림 점과 함께 열림
      await setS(up, { unpack: { box: 10, damage: 0, roomDone: false } });
      await up.waitForTimeout(250);
      check('공개: 상자 10개 뒤 공구 강화 탭이 나타난다', await tabVis(up, '공구 강화'));
      check('공개: 열릴 때 토스트 "새로 열렸어요 · 공구 강화"', (await text(up, '.toast')).includes('새로 열렸어요 · 공구 강화'), await text(up, '.toast'));
      check('공개: 새 탭에 알림 점, 열면 사라진다', (await dotOn(up, '공구 강화')) && (await up.locator('.tab', { hasText: '공구 강화' }).click(), await up.waitForTimeout(100), !(await dotOn(up, '공구 강화'))));
      await up.locator('.tab', { hasText: '서비스' }).click();
      check('공개: 다른 것은 아직 숨어 있다(상자·도감·이사 줄)', !(await tabVis(up, '상자')) && !(await tabVis(up, '도감')) && !(await vis(up, '.move-block')));
      check('공개: 열림이 저장에 기록된다', (await gsU(up)).unlocked.includes('tap'));
      await up.reload();
      await up.waitForSelector('.phone');
      await up.waitForTimeout(400);
      check('공개: 새로 고침해도 열린 채로 유지(연출 없음)', (await tabVis(up, '공구 강화')) && !(await up.locator('.toast.show').count()));

      // 여러 개가 한꺼번에 풀리면 600ms 간격으로 하나씩
      await up.evaluate(() => { window.__t = []; new MutationObserver(() => { for (const id of ['bundle', 'box', 'dex']) if (document.body.classList.contains('ux-' + id) && !window.__t.some((x) => x[0] === id)) window.__t.push([id, performance.now()]); }).observe(document.body, { attributes: true, attributeFilter: ['class'] }); });
      await setS(up, { services: [5, 3, 2, 0, 0, 0, 0, 0], points: 9000, collection: { x: { base: 1, shiny: 0, gold: 0, rainbow: 0 } } });
      await up.waitForTimeout(2200);
      const tt = await up.evaluate(() => window.__t);
      check('공개: 동시에 풀리는 3개가 순서대로 600ms 이상 간격으로 열린다', tt.length === 3 && tt[1][1] - tt[0][1] >= 550 && tt[2][1] - tt[1][1] >= 550, JSON.stringify(tt.map((x) => [x[0], Math.round(x[1])])));
      check('공개: 결합·상자·도감이 열렸다', (await vis(up, '.bundle-toggle')) && (await tabVis(up, '상자')) && (await tabVis(up, '도감')));
      check('공개: 탭 4개일 때도 도구 버튼이 가운데', await up.evaluate(() => { const r = document.querySelector('.dock-phone').getBoundingClientRect(); return Math.abs(r.left + r.width / 2 - innerWidth / 2) <= 1; }));
      await up.screenshot({ path: path.join(SHOTS, 'unlock', 'm-mid.png') });
      await uc.close();

      // 기존 저장: 조건을 넘은 항목은 연출 없이 열린 채로 시작
      ({ ctx: uc, page: up } = await newPage(browser, { ...V3U, unlocked: undefined, earned: 1e6, points: 3000, tapLevel: 4, services: [12, 6, 3, 0, 0, 0, 0, 0] }, '?debug'));
      await up.waitForTimeout(150);
      check('공개: 기존 저장은 열린 채로 시작하고 토스트·튀어나오기가 없다', (await tabVis(up, '공구 강화')) && (await vis(up, '.bundle-toggle')) && (await vis(up, '.move-block')) && !(await up.locator('.toast.show').count()) && (await up.locator('.ux-pop').count()) === 0);
      check('공개: 기존 저장에서 아직 못 푼 것은 숨김(도감·약정·특전)', !(await tabVis(up, '도감')) && !(await vis(up, '.slots-pill')) && !(await vis(up, '.perk-btn')));
      check('공개: 기존 저장의 열림이 기록된다', (await gsU(up)).unlocked.includes('move'));
      await uc.close();

      // 움직임 줄이기: 튀어나오는 움직임 없이 나타남
      ({ ctx: uc, page: up } = await newPage(browser, { ...V3U, unlocked: [], settings: { reduceMotion: true } }, '?debug'));
      await setS(up, { unpack: { box: 10, damage: 0, roomDone: false } });
      await up.waitForTimeout(120);
      check('공개: 움직임 줄이기면 튀어나오는 클래스 없이 나타난다', (await tabVis(up, '공구 강화')) && (await up.locator('.ux-pop').count()) === 0);
      await uc.close();

      // 열리는 순간 연출(튀어나오기) 한 장
      ({ ctx: uc, page: up } = await newPage(browser, null, '?debug'));
      await setS(up, { unpack: { box: 10, damage: 0, roomDone: false } });
      await up.waitForTimeout(70);
      check('공개: 열리는 순간 튀어나오는 클래스가 붙는다', (await up.locator('.tab.ux-pop').count()) === 1);
      await up.screenshot({ path: path.join(SHOTS, 'unlock', 'm-moment.png') });
      await uc.close();
    }

    check('콘솔 오류 0건', errors.length === 0, errors.join(' | '));
  } catch (e) {
    check('스모크 실행 예외 없음', false, e.message);
  } finally {
    await browser.close().catch(() => {});
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} 통과`);
  process.exit(failed ? 1 : 0);
})();
