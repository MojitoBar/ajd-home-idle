// PC 스모크(1440x900). 전제: vite preview 4173, 격리 Aside(헤드리스) CDP 9333.
const { chromium } = require('playwright');
const path = require('path');

const URL = 'http://localhost:4173';
const KEY = 'ajd-home-idle:save';
const PREFS = { sound: false, music: false, haptics: false, chargeDone: true, weakDone: true };
const ALL = ['tap', 'home', 'box', 'dex', 'mult', 'badge', 'perk'];
const results = [];
const errors = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' - ' + detail : ''}`); };
const gs = (page) => page.evaluate(() => window.__ajd.get());
const setS = (page, over) => page.evaluate((o) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, ...o, unpack: { ...s.unpack, ...(o.unpack || {}) } }); }, over);
const activeTab = (page) => page.locator('.dock .tab.active').innerText();
const text = (page, sel) => page.locator(sel).first().innerText();
const IGNORE = /Extension context invalidated|Receiving end does not exist/;

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const open = async (size = { width: 1440, height: 900 }, keepIntro = false) => {
    const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
    await ctx.addInitScript((p) => localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p)), PREFS);
    const page = await ctx.newPage();
    page.on('console', (m) => m.type() === 'error' && !IGNORE.test(m.text()) && errors.push(`console: ${m.text()}`));
    page.on('pageerror', (e) => !IGNORE.test(e.message) && errors.push(`pageerror: ${e.message}`));
    await page.goto(URL + '?debug');
    await page.waitForSelector('.phone');
    await page.evaluate(() => document.fonts.ready);
    if (!keepIntro) {
      const sk = page.locator('.story-ov .sn-skip');
      if ((await sk.count()) > 0) {
        await sk.click();
        await page.waitForSelector('.story-ov', { state: 'detached' });
      }
    }
    return { ctx, page };
  };

  // ---- 새 게임(PC): 단계적 공개 ----
  {
    const { ctx, page } = await open();
    await page.waitForTimeout(500);
    const tabsShown = await page.locator('.dock .tab:visible').count();
    check('새 게임(PC): 탭은 공구 강화뿐, 나머지는 자물쇠', tabsShown === 1 && (await page.locator('.tab-lock:visible').count()) === 3, String(tabsShown));
    const gone = await page.evaluate(() => ['.speed-wrap .info-btn', '.top .badge', '.perk-btn'].filter((q) => document.querySelector(q)?.getBoundingClientRect().width > 0));
    check('새 게임(PC): 배율 i·총 배율 칩·특전 버튼이 숨겨져 있다', gone.length === 0, gone.join(','));
    const mvTxt = await page.locator('.bar-text').innerText();
    check('새 게임(PC): 이사 줄과 다음 집 이름이 보인다', (await page.locator('.move-block').boundingBox())?.width > 0 && mvTxt.includes('투룸으로'), mvTxt);
    check('새 게임(PC): 공구 카드 2장 + 다음 공구 안내', (await page.locator('.panel .tap-card:visible').count()) === 2 && (await page.locator('.gear-next').innerText()).includes('상자 15개 더 열면'));
    await page.keyboard.press('2');
    await page.waitForTimeout(150);
    check('닫힌 탭의 단축키(2)는 동작하지 않는다', (await activeTab(page)).includes('공구 강화'));
    check('Space로 포인트가 오른다', await (async () => { const p0 = (await gs(page)).points; await page.keyboard.press('Space'); await page.waitForTimeout(150); return (await gs(page)).points > p0; })());
    await ctx.close();
  }

  const { ctx, page } = await open();
  await setS(page, { unlocked: ALL, points: 1e9, earned: 1e6, tapLevel: 5, homeLv: [2, 1, 0, 0, 0, 0, 0, 0], gear: { level: 2, helmet: 1 }, unpack: { box: 56, damage: 0, hp: 1e15 } });
  await page.waitForTimeout(700);
  const layout = () => page.evaluate(() => {
    const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, b: b.bottom }; };
    return { play: r('.col-play'), list: r('.col-list'), phone: r('.phone'), dock: r('.dock'), vh: innerHeight };
  });
  const dockInList = () => page.evaluate(() => !!document.querySelector('.col-list > .dock'));
  let L = await layout();
  check('두 단 배치: 왼쪽 x < 오른쪽 x, 같은 화면', L.play.x < L.list.x && L.play.x + L.play.w <= L.list.x && L.play.b <= L.vh + 1, JSON.stringify({ px: L.play.x, lx: L.list.x }));
  check('독이 오른쪽 단 맨 위 탭 줄', (await dockInList()) && Math.round(L.dock.y) === 10 && L.dock.h < 80 && (await page.locator('.dock-phone').isHidden()));
  check('PC: 페이지 세로 스크롤 없음(오른쪽 단만 안에서 스크롤)', await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && innerWidth === document.documentElement.clientWidth));
  check('공구 탭: 카드 7장이 오른쪽 단에 보인다', (await page.locator('.panel .tap-card:visible').count()) === 7);
  const issues = () => page.evaluate(() => {
    const out = [];
    for (const e of document.querySelectorAll('.panel .card-name, .panel .card-info, .panel .buy, .panel .card-lv, .panel .tag')) {
      if (e.getBoundingClientRect().width === 0) continue;
      if (e.scrollWidth > e.clientWidth + 1) out.push(`넘침 ${e.className}:${e.textContent.slice(0, 14)}`);
    }
    return out;
  });
  check('글자 넘침 없음(공구 탭)', (await issues()).length === 0, (await issues()).join(','));
  await page.keyboard.press('2');
  await page.waitForTimeout(300);
  check('글자 넘침 없음(살림 탭)', (await issues()).length === 0 && (await page.locator('.home-card:visible').count()) === 8, (await issues()).join(','));
  await page.keyboard.press('1');
  check('가로 스크롤 없음', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await page.setViewportSize({ width: 1440, height: 300 });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 1e5));
  await page.waitForTimeout(300);
  L = await layout();
  const scrolled = await page.evaluate(() => scrollY);
  check('낮은 창에서 스크롤해도 탭 줄은 위에 고정(오른쪽 단 sticky)', Math.round(L.dock.y) === 10 && scrolled > 100, `scrollY=${scrolled}`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);

  // ---- 키보드 ----
  await setS(page, { unpack: { box: 3, damage: 0, hp: 1e15 } });
  await page.waitForTimeout(300);
  const dmgOf = (s) => s.unpack.box * 1e12 + s.unpack.damage;
  const p0 = (await gs(page)).points;
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  check('Space로 포인트가 오른다(PC)', (await gs(page)).points > p0);
  await page.waitForTimeout(400);
  const d0 = await gs(page);
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  const d1 = await gs(page);
  check('Space로 상자가 깎인다', dmgOf(d1) > dmgOf(d0), `${dmgOf(d0)} -> ${dmgOf(d1)}`);
  await page.waitForTimeout(400);
  const t0 = (await gs(page)).stats.totalTaps;
  for (let i = 0; i < 3; i++) { await page.keyboard.down('Space'); await page.waitForTimeout(60); }
  await page.keyboard.up('Space');
  await page.waitForTimeout(100);
  check('Space를 짧게 누르고 있어도(키 반복) 한 번만', (await gs(page)).stats.totalTaps - t0 === 1, `${(await gs(page)).stats.totalTaps - t0}`);
  await page.waitForTimeout(600);
  const u0 = await gs(page);
  const ys = () => page.evaluate(() => ['.move-block', '.px-strip'].map((q) => Math.round(document.querySelector(q).getBoundingClientRect().y)).join(','));
  const y0 = await ys();
  await page.keyboard.down('Space');
  await page.waitForTimeout(150);
  const u1 = await gs(page);
  const one = dmgOf(u1) - dmgOf(u0);
  for (let i = 0; i < 8; i++) { await page.keyboard.down('Space'); await page.waitForTimeout(60); }
  check('Space 길게: 게이지가 뜨고 키 반복은 탭을 더하지 않는다', (await page.locator('.charge.on:not(.res)').count()) === 1 && (await gs(page)).stats.totalTaps === u1.stats.totalTaps);
  // 높이 900(방 2배·1020 미만): 게이지는 내구도 줄 사각형 안에 한 줄로 앉아, 피버 막대·이사 줄·방 사각형과 1px도 안 겹친다(막대·열기 줄의 바깥 테두리 4px*2 포함)
  const geo = await page.evaluate(() => {
    const R = (q) => document.querySelector(q).getBoundingClientRect();
    const grow = (r, g) => ({ l: r.left - g, t: r.top - g, r: r.right + g, b: r.bottom + g });
    const parts = [['막대', grow(R('.charge-bar'), 8)], ['열기 줄', grow(R('.heat-track'), 8)], ['이름표', grow(R('.heat-chip'), 4)], ['연속 칩', grow(R('.charge-streak'), 4)]];
    const others = [['피버 막대', R('.fever-gauge')], ['이사 줄', R('.move-block')], ['방', R('.room')]];
    const hit = [];
    for (const [pn, a] of parts) for (const [on, o] of others) if (a.l < o.right && a.r > o.left && a.t < o.bottom && a.b > o.top) hit.push(`${pn}x${on}`);
    const c = R('.charge'), s = R('.px-strip');
    return { hit, sameRect: Math.abs(c.top - s.top) < 1 && Math.abs(c.height - s.height) < 1 && Math.abs(c.left - s.left) < 1 && Math.abs(c.width - s.width) < 1, stripHidden: getComputedStyle(document.querySelector('.px-strip')).visibility, streakShown: !document.querySelector('.charge-streak').hidden, barW: R('.charge-bar').width };
  });
  check('Space 길게: 게이지(막대·칩·이름표·열기 줄)가 피버 막대·이사 줄·방과 겹치지 않는다', geo.hit.length === 0, JSON.stringify(geo.hit));
  check('Space 길게: 게이지가 내구도 줄과 같은 사각형을 쓰고 내구도 줄은 숨는다', geo.sameRect && geo.stripHidden === 'hidden' && geo.barW >= 250, JSON.stringify(geo));
  check('Space 길게: 누르기 전후로 아래 줄의 y가 같다(밀림 없음)', (await ys()) === y0, `${y0} -> ${await ys()}`);
  const u2 = await gs(page);
  await page.keyboard.up('Space');
  await page.waitForTimeout(300);
  const u3 = await gs(page);
  const say = (await page.locator('.charge-say b, .un-chain-judge').count()) ? await page.locator('.charge-say b, .un-chain-judge').first().innerText() : '';
  check('Space 떼면: 판정 글자와 함께 탭 1번보다 많이 깎인다', /퍼펙트|굿|아쉽/.test(say) && dmgOf(u3) - dmgOf(u2) > one * 1.5 && (await page.locator('.charge.on:not(.res)').count()) === 0, `say=${say}`);
  // 연쇄 도중 Space 꾹 누르기: 차징이 켜지고, 퍼펙트 칸에서 떼면 강타가 한 번만 나간다
  {
    const cc = await open();
    const pg = cc.page;
    await setS(pg, { unlocked: ALL, points: 1e6, earned: 1e5, tapLevel: 200, unpack: { box: 30, damage: 0, hp: 1 } });
    await pg.waitForTimeout(600);
    await pg.evaluate(() => { window.__ajd.chain(1700); window.__p1 = window.__ajd.get().points; });
    await pg.waitForTimeout(250);
    await pg.keyboard.down('Space');
    await pg.waitForTimeout(500);
    const k1 = await pg.evaluate(() => ({ playing: window.__ajd.getChain().playing, on: document.querySelectorAll('.charge.on:not(.res)').length, x: document.querySelector('.charge-mark')?.style.translate }));
    const kr = await pg.evaluate(async () => {
      const t0 = performance.now();
      while (!document.querySelector('.charge-mark.in') && performance.now() - t0 < 4000) await new Promise((q) => requestAnimationFrame(q));
      const inZone = !!document.querySelector('.charge-mark.in');
      const tRel = performance.now();
      window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space' }));
      let tStrike = -1;
      while (performance.now() - tRel < 4000) {
        await new Promise((q) => requestAnimationFrame(q));
        if (document.querySelector('.un-chain-judge')?.textContent.includes('x1.5')) { tStrike = Math.round(performance.now() - tRel); break; }
      }
      return { inZone, tStrike };
    });
    await pg.keyboard.up('Space');
    await pg.waitForTimeout(3000);
    const jt = await pg.evaluate(() => document.querySelector('.un-chain-judge')?.textContent ?? '');
    const pts = (await gs(pg)).points;
    const p1 = await pg.evaluate(() => window.__p1);
    check('Space 꾹(연쇄 도중): 게이지가 켜지고, 퍼펙트 칸에서 떼면 강타가 한 번만 나간다(x1.5, x2 아님)', k1.playing && k1.on === 1 && !!k1.x && kr.inZone && kr.tStrike > 0 && kr.tStrike < 1500 && /x1\.5/.test(jt) && !/x2/.test(jt) && pts > p1, JSON.stringify({ k1, kr, jt, p1, pts }));
    await cc.ctx.close();
  }
  await page.waitForTimeout(300);
  await page.keyboard.press('Tab');
  const focusedTab = await page.evaluate(() => document.activeElement?.tagName);
  const focusedCls = await page.evaluate(() => document.activeElement?.className);
  const q0 = (await gs(page)).stats.totalTaps;
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  const q1 = (await gs(page)).stats.totalTaps;
  const pressed = true;
  check('Tab으로 포커스한 버튼에서 Space는 그 버튼만 누른다(전화 안 누름)', focusedTab === 'BUTTON' && q1 === q0 && pressed, `${focusedTab}.${focusedCls} ${q0}->${q1}`);
  await page.keyboard.press('Escape');
  if (await page.locator('.mult-pop').isVisible()) await page.mouse.click(5, 5);
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  for (const [k, label] of [['2', '살림'], ['3', '상자'], ['4', '도감'], ['1', '공구 강화']]) {
    await page.keyboard.press(k);
    await page.waitForTimeout(150);
    check(`${k}키 → ${label} 탭`, (await activeTab(page)).includes(label));
  }
  await page.locator('button[aria-label="설정"]').click();
  await page.waitForSelector('.overlay');
  const m0 = (await gs(page)).stats.totalTaps;
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  check('Esc로 모달이 닫힌다', (await page.locator('.overlay').count()) === 0);
  await page.locator('button[aria-label="설정"]').click();
  await page.waitForSelector('.overlay');
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('Space');
  await page.keyboard.press('2');
  await page.waitForTimeout(150);
  check('모달 중 Space·숫자는 전화·탭 전환을 하지 않는다', (await gs(page)).stats.totalTaps === m0 && (await activeTab(page)).includes('공구 강화'));
  await page.keyboard.press('Escape');
  await setS(page, { earned: 1e30 });
  await page.waitForTimeout(300);
  const mv = page.locator('.move-btn');
  if (await mv.isEnabled()) {
    await mv.click();
    await page.waitForSelector('.overlay');
    check('모달 열면 첫 버튼에 포커스', await page.evaluate(() => document.activeElement === document.querySelector('.modal-actions button')));
    await page.keyboard.press('Escape');
  }
  check('이사 가능 상태에서 이사 버튼 활성', await mv.isEnabled());

  // ---- 1920x1080(방 2배·높이 1020 이상): 게이지 띠는 제 자리에 한 줄로 앉아, 누르는 중에도 내구도 줄·피버 막대·이사 줄·방과 1px도 안 겹치고 아래 줄이 안 밀린다 ----
  {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(400);
    const ys2 = () => page.evaluate(() => ['.move-block', '.px-strip', '.charge'].map((q) => Math.round(document.querySelector(q).getBoundingClientRect().y)).join(','));
    const yi = await ys2();
    await page.keyboard.down('Space');
    await page.waitForTimeout(150);
    for (let i = 0; i < 6; i++) { await page.keyboard.down('Space'); await page.waitForTimeout(60); }
    const g2 = await page.evaluate(() => {
      const R = (q) => document.querySelector(q).getBoundingClientRect();
      const grow = (r, g) => ({ left: r.left - g, top: r.top - g, right: r.right + g, bottom: r.bottom + g });
      const shown = (q) => R(q).width > 0;
      const parts = [['막대', grow(R('.charge-bar'), 8)], ['열기 줄', grow(R('.heat-track'), 8)], ['이름표', grow(R('.heat-chip'), 4)]].concat(shown('.charge-streak') ? [['연속 칩', grow(R('.charge-streak'), 4)]] : []);
      const others = [['내구도 줄', R('.px-strip')], ['피버 막대', R('.fever-gauge')], ['이사 줄', R('.move-block')], ['방', R('.room')]];
      const hit = [];
      for (const [pn, a] of parts) for (const [on, o] of others) if (a.left < o.right && a.right > o.left && a.top < o.bottom && a.bottom > o.top) hit.push(`${pn}x${on}`);
      const c = R('.charge');
      const inside = parts.every(([, a]) => a.left >= c.left - 8 && a.right <= c.right + 8);
      return { hit, inside, stripShown: getComputedStyle(document.querySelector('.px-strip')).visibility, barW: R('.charge-bar').width };
    });
    check('1920x1080 Space 길게: 게이지(막대·칩·이름표·열기 줄)가 내구도 줄·피버 막대·이사 줄·방과 겹치지 않는다', g2.hit.length === 0 && g2.inside && g2.stripShown === 'visible', JSON.stringify(g2));
    check('1920x1080 Space 길게: 누르기 전후로 내구도 줄·이사 줄·띠의 y가 같다(밀림 없음)', (await ys2()) === yi, `${yi} -> ${await ys2()}`);
    await page.keyboard.up('Space');
    await page.waitForTimeout(500);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);
  }
  // ---- 공구 구매(PC) ----
  await page.keyboard.press('1');
  await setS(page, { points: 1e30, unpack: { box: 56 } });
  await page.waitForTimeout(300);
  const lv0 = (await gs(page)).gear.level;
  await page.locator('.gear-level .btn.buy').click();
  await page.waitForTimeout(300);
  check('PC: 수평계 구매', (await gs(page)).gear.level === lv0 + 1);
  await page.keyboard.press('1');

  // ---- 특전 상자(PC): 카드 표시·구매·3택·가격 2배 ----
  {
    await page.keyboard.press('3');
    await page.waitForTimeout(300);
    await setS(page, { points: 1e10, unlocked: ALL });
    await page.waitForTimeout(300);
    const costOf = () => page.evaluate(() => { const t = document.querySelector('.perkbox-buy .bx-cost').textContent; const u = { 만: 1e4, 억: 1e8, 조: 1e12, 경: 1e16 }; const m = t.replace(/,/g, '').match(/([0-9.]+)\s*([만억조경]?)/); return Number(m[1]) * (u[m[2]] || 1); });
    check('PC: 특전 상자 카드가 보이고 글자가 넘치지 않는다', (await page.locator('.perkbox-card').isVisible()) && (await page.evaluate(() => [...document.querySelectorAll('.perkbox-card, .perkbox-card *')].every((e) => e.scrollWidth <= e.clientWidth + 1 || getComputedStyle(e).display === 'inline'))));
    const c0 = await costOf();
    const pb = (await gs(page)).points;
    await page.locator('.perkbox-buy').click();
    await page.waitForSelector('.modal .pcard', { timeout: 8000 });
    const s1 = await gs(page);
    check('PC: 특전 상자 구매 -> 포인트 차감·3택 창', s1.points < pb && s1.perkOffers.length === 1 && (await page.locator('.modal .pcard').count()) === 3);
    const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
    await page.locator('.modal .pcard:not(:disabled)').first().click();
    await page.waitForSelector('.modal', { state: 'detached', timeout: 8000 });
    const s2 = await gs(page);
    await page.waitForTimeout(400);
    const c1 = await costOf();
    check('PC: 고르면 특전 레벨 +1·가격 2배', sum(s2.perks) === sum(s1.perks) + 1 && Math.abs(c1 / c0 - 2) < 0.05, `${c0}->${c1}`);
    await page.keyboard.press('1');
  }

  // ---- 창 크기 바꾸기 ----
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  L = await layout();
  check('390으로 줄이면 모바일(독 아래 고정·한 단)', !(await dockInList()) && L.dock.y > 600 && L.list.x <= L.play.x + 1 && (await page.locator('.dock-phone').isVisible()), JSON.stringify({ dockY: L.dock.y }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(400);
  L = await layout();
  check('1440으로 되돌리면 두 단·독 위로', (await dockInList()) && L.play.x < L.list.x && Math.round(L.dock.y) === 10 && (await page.locator('.dock-phone').isHidden()));
  const p2 = (await gs(page)).stats.totalTaps;
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  check('되돌린 뒤에도 Space 동작', (await gs(page)).stats.totalTaps > p2);

  // ---- 공구함 덱 1단계(PC) ----
  {
    const deckSet = (pg, slots, offers, moves = 1) => pg.evaluate(([sl, of, mv]) => { window.__ajd.guide('done'); const s = window.__ajd.get(); window.__ajd.set({ ...s, moves: mv, unlocked: ['tap', 'home', 'box', 'dex', 'mult', 'badge', 'perk', 'deck'], deck: { ...s.deck, slots: sl.map((id) => ({ id, star: 1, charge: 0, stacks: 0 })), offers: of } }); }, [slots, offers, moves]);
    const fit = (pg) => pg.evaluate(() => { const r = document.querySelector('.deck-row')?.getBoundingClientRect(); const m = document.querySelector('.move-row')?.getBoundingClientRect(); return { rowH: r && Math.round(r.height), gap: r && m ? Math.round(m.top - r.bottom) : null, scrollH: document.documentElement.scrollHeight, innerH: innerHeight, hs: document.documentElement.scrollWidth > document.documentElement.clientWidth }; });
    for (const size of [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
      const { ctx, page } = await open(size);
      await page.waitForTimeout(500);
      await deckSet(page, ['P2', 'P3'], [['C1', 'C3', 'P2']], 0);
      await page.waitForTimeout(500);
      check(`덱(PC ${size.width}): 첫 집(moves 0)에는 카드 줄이 없다`, (await page.locator('.deck-row').count()) === 0);
      await deckSet(page, ['P2', 'P3'], [['C1', 'C3', 'P2']], 1);
      await page.waitForTimeout(700);
      const f = await fit(page);
      check(`덱(PC ${size.width}): 카드 줄이 보이고 카드 고르기 버튼이 뜬다`, (await page.locator('.deck-row').isVisible()) && (await page.locator('.deck-alert').isVisible()) && f.rowH === 60 && f.gap >= 0, JSON.stringify(f));
      const ov = await page.evaluate(() => { const q = (x) => document.querySelector(x); const vis = (e) => !!e && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0; const m = q('.deck-mult'); const a = q('.deck-alert'); const bars = [...document.querySelectorAll('.deck-row .deck-bar')]; const mr = m?.getBoundingClientRect(); const ar = a?.getBoundingClientRect(); return { mult: /^×/.test(m?.textContent || ''), bars: bars.length, barH: bars.every((b) => b.getBoundingClientRect().height === 4), hit: vis(m) && vis(a) && mr.left < ar.right && mr.right > ar.left && mr.top < ar.bottom && mr.bottom > ar.top, sh: document.documentElement.scrollHeight, ih: innerHeight }; });
      check(`덱(PC ${size.width}): 공구함 ×N 숫자·충전 막대가 있고 카드 고르기 버튼과 안 겹치며 세로 넘침이 없다`, ov.mult && ov.bars === 2 && ov.barH && !ov.hit && ov.sh <= ov.ih, JSON.stringify(ov));
      check(`덱(PC ${size.width}): 카드 줄이 떠도 세로·가로로 넘치지 않는다`, f.scrollH <= f.innerH && !f.hs, JSON.stringify(f));
      await page.locator('.deck-alert').click();
      await page.waitForSelector('.modal.deck-pick .pcard');
      await page.waitForTimeout(1500);
      await page.locator('.pcard[data-card="C1"]').click();
      await page.waitForTimeout(1400);
      const s = await gs(page);
      check(`덱(PC ${size.width}): 카드를 고르면 칸에 들어가고 묶음이 사라진다`, s.deck.slots.map((x) => x.id).join() === 'P2,P3,C1' && s.deck.offers.length === 0 && (await page.locator('.modal').count()) === 0);
      await deckSet(page, ['P2', 'P3', 'C1', 'S3'], [['C3', 'P2', 'P3']], 1);
      await page.waitForTimeout(500);
      await page.locator('.deck-alert').click();
      await page.waitForSelector('.modal.deck-pick .pcard');
      await page.waitForTimeout(1500);
      await page.locator('.pcard[data-card="C3"]').click();
      await page.waitForTimeout(500);
      check(`덱(PC ${size.width}): 칸이 차면 바꿀 칸을 골라 교체된다`, (await text(page, '.modal-head h2')) === '바꿀 칸 고르기');
      await page.locator('.pcard[data-card="P3"]').click();
      await page.waitForTimeout(1400);
      check(`덱(PC ${size.width}): 교체 결과`, (await gs(page)).deck.slots.map((x) => x.id).join() === 'P2,C3,C1,S3');
      // 4단계: 4번째 탭 공구함 · 카드 줄 → 공구함 탭 · 상자 탭 토글
      const ov4 = () => page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight, hs: document.documentElement.scrollWidth > document.documentElement.clientWidth }));
      await deckSet(page, ['P2', 'P3', 'C1', 'S3'], [['C3', 'P2', 'P3']], 1);
      await page.waitForTimeout(500);
      check(`덱 4단계(PC ${size.width}): 4번째 탭이 공구함이고 알림 점이 있다`, (await page.locator('.dock [data-ux="deck"]').innerText()).includes('공구함') && (await page.locator('.dock [data-ux="dex"]').count()) === 0 && (await page.locator('.dock [data-ux="deck"] .dot:visible').count()) === 1);
      await page.locator('.deck-row').click();
      await page.waitForTimeout(500);
      const o1 = await ov4();
      check(`덱 4단계(PC ${size.width}): 카드 줄을 누르면 공구함 탭, 패널에 배율·카드 고르기 버튼·4칸, 가로 넘침 없음`, (await page.locator('.dock [data-ux="deck"].active').count()) === 1 && (await page.locator('.deck-panel .dp-mult').isVisible()) && (await page.locator('.deck-panel .dp-pick').isVisible()) && (await page.locator('.deck-panel .perk-row').count()) === 4 && !o1.hs, JSON.stringify(o1));
      await page.locator('.dock [data-ux="box"]').click();
      await page.locator('.view-btn[data-view="dex"]').click();
      await page.waitForTimeout(500);
      check(`덱 4단계(PC ${size.width}): 상자 탭 도감 토글로 도감이 열린다`, (await page.locator('.dex-grid').isVisible()) && (await page.locator('.dex-cell').count()) === 80);
      await ctx.close();
    }
    // 2단계: 특전 알림과 카드 고르기 알림이 같이 떠도 1440x900에서 세로 스크롤이 없고 이사 줄과 안 겹친다
    for (const size of [{ width: 1440, height: 900 }, { width: 1440, height: 940 }]) {
      const { ctx, page } = await open(size);
      await page.waitForTimeout(500);
      await deckSet(page, ['P2', 'P3'], [['C1', 'C3', 'P1']], 1);
      await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, perkOffers: [['crit', 'fever_long', 'strike_power']] }); });
      await page.waitForTimeout(700);
      const a = await page.evaluate(() => { const b = (q) => document.querySelector(q)?.getBoundingClientRect(); const pa = b('.perk-alert:not(.deck-alert)'); const da = b('.deck-alert'); const mv = b('.move-row'); const ch = b('.charge'); return { both: !!pa && !!da && pa.width > 0 && da.width > 0, sh: document.documentElement.scrollHeight, ih: innerHeight, hs: document.documentElement.scrollWidth > document.documentElement.clientWidth, apart: !!pa && !!da && pa.left >= da.right, aboveMove: !!pa && !!da && Math.max(pa.bottom, da.bottom) <= mv.top, belowCharge: !!da && da.top >= ch.bottom }; });
      check(`덱(PC ${size.width}x${size.height}): 알림 2개가 한 줄에 떠도 세로 스크롤이 없고 이사 줄·게이지와 안 겹친다`, a.both && a.sh <= a.ih && !a.hs && a.apart && a.aboveMove && a.belowCharge, JSON.stringify(a));
      await ctx.close();
    }
  }

  // ---- 덱 스택(PC) ----
  {
    const UN = [...ALL, 'deck', 'fever', 'special'];
    const stackSet = (pg, slots, ex = {}) => pg.evaluate(([sl, ex2, un]) => { window.__ajd.guide('done'); const s = window.__ajd.get(); window.__ajd.set({ ...s, moves: 1, unlocked: un, deck: { ...s.deck, offers: [], boostPacks: 0, ...ex2, slots: sl.map(([id, stacks, charge = 0]) => ({ id, star: 1, charge, stacks })) } }); window.__ajd.rush(0); }, [slots, ex, UN]);
    const badges = (pg) => pg.evaluate(() => [...document.querySelectorAll('.deck-slot')].map((s) => { const b = s.querySelector('.deck-stack'); return b && !b.hidden ? `${b.textContent}/${b.dataset.tier}` : ''; }));
    const { ctx, page } = await open();
    await page.waitForTimeout(500);
    await stackSet(page, [['P2', 3], ['P3', 12], ['C1', 27], ['S3', 0, 5]]);
    await page.waitForTimeout(800);
    const b = await badges(page);
    check('스택(PC): 배지 숫자·단계가 맞게 보인다(3·12·27)', b.join('|') === '×3/0|×12/1|×27/2|', b.join('|'));
    check('스택(PC): 덱 줄 옆에 스택 합(42)', (await text(page, '.deck-ss')).includes('42'));
    await page.screenshot({ path: path.join(__dirname, '..', 'screenshots', 's1-1440-row.png') });
    await stackSet(page, [['P2', 300], ['P3', 99], ['C1', 30], ['S3', 1]]);
    await page.waitForTimeout(600);
    const geo = await page.evaluate(() => [...document.querySelectorAll('.deck-slot')].map((s) => { const bb = s.querySelector('.deck-stack').getBoundingClientRect(); const r = s.getBoundingClientRect(); return bb.left >= r.left - 2 && bb.right <= r.right + 4; }));
    check('스택(PC): 스택 300도 배지가 칸 밖으로 안 나간다', geo.every(Boolean), JSON.stringify(geo));
    await stackSet(page, [['P2', 3], ['P3', 12], ['C1', 27], ['S3', 0, 5]], { boostPacks: 1, boostMade: 1, chargedStacks: 6 });
    await page.waitForTimeout(700);
    check('강화(PC): 알림 버튼이 뜨고 가로 넘침이 없다', (await text(page, '.deck-alert')).includes('강화 고르기') && !(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)));
    await page.locator('.deck-alert').click();
    await page.waitForSelector('.modal.deck-pick .pcard');
    await page.waitForTimeout(1400);
    const before = (await gs(page)).deck.slots.map((x) => x.stacks);
    await page.locator('.deck-pick .pcard.boostopt').first().click();
    await page.waitForTimeout(2200);
    const after = (await gs(page)).deck;
    const diff = after.slots.map((x, i) => x.stacks - before[i]);
    check('강화(PC): 고르면 한 카드에 스택 +2, 묶음 0, 창 닫힘', diff.filter((d) => d === 2).length === 1 && diff.filter((d) => d !== 0 && d !== 2).length === 0 && after.boostPacks === 0 && (await page.locator('.modal').count()) === 0, JSON.stringify(diff));
    await ctx.close();
  }

  // ---- 특별 상자 설명 창 + 처음 만날 때 토스트(PC) ----
  {
    const { ctx, page } = await open();
    await page.evaluate(() => window.__ajd.guide('done'));
    await setS(page, { unlocked: [...ALL, 'deck', 'special', 'fever'], moves: 1, points: 1e6, earned: 1e5, tapLevel: 80, unpack: { box: 30, damage: 1e15 } });
    await page.waitForTimeout(600);
    await page.waitForTimeout(2800);
    await page.locator('.gear-loupe').scrollIntoViewIfNeeded();
    const ib = await page.locator('.gear-loupe .gear-info').boundingBox();
    check('특별 상자(PC): 돋보기 카드에 i 버튼(누르는 영역 44px 이상)', !!ib && ib.width + 32 >= 44 && ib.height + 32 >= 44, JSON.stringify(ib));
    check('특별 상자(PC): 돋보기 카드가 잘리거나 강화 버튼과 겹치지 않는다', await page.evaluate(() => { const c = document.querySelector('.gear-loupe'); const i = c.querySelector('.gear-info').getBoundingClientRect(); const b = c.querySelector('.btn.buy').getBoundingClientRect(); const cr = c.getBoundingClientRect(); const info = c.querySelector('.card-info'); return i.right <= b.left && i.left >= cr.left && i.right <= cr.right && info.scrollWidth <= info.clientWidth + 1; }));
    await page.locator('.gear-loupe .gear-info').click();
    await page.waitForSelector('.modal');
    const mt = await text(page, '.modal');
    check('특별 상자(PC): 창 제목·확률·3종 줄이 보인다', mt.includes('특별 상자') && /지금 확률 \d/.test(mt) && ['황금 상자', '폭탄 상자', '시계 상자'].every((n) => mt.includes(n)), mt.replace(/\n/g, ' '));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(__dirname, '..', 'screenshots', 'special', '1440-2-modal.png') });
    await page.locator('.modal .modal-actions .btn').click();
    await page.waitForTimeout(300);
    check('특별 상자(PC): 닫기를 누르면 창이 닫힌다', (await page.locator('.modal').count()) === 0);
    await page.evaluate(() => { window.scrollTo(0, 0); window.__ajd.special('bomb', 0); });
    await page.waitForTimeout(600);
    const pb = await page.locator('.phone').boundingBox();
    await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2);
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.toast')).some((e) => e.textContent.includes('폭탄 상자 ·')), null, { timeout: 4000 }).catch(() => {});
    const t1 = await page.evaluate(() => Array.from(document.querySelectorAll('.toast')).map((e) => e.textContent).join('|'));
    check('특별 상자(PC): 처음 터질 때 토스트 "폭탄 상자 · 상자 5개 연쇄"', t1.includes('폭탄 상자 · 상자 5개 연쇄'), t1);
    await ctx.close();
  }


  // ---- 이야기(PC): 인트로 Space 진행, 도착 쪽지, 끝 화면 ----
  {
    const { ctx, page } = await (async () => {
      const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
      await c.addInitScript((p) => localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p)), PREFS);
      const pg = await c.newPage();
      pg.on('pageerror', (e) => !IGNORE.test(e.message) && errors.push(`pageerror: ${e.message}`));
      await pg.goto(URL + '?debug&guide');
      await pg.waitForSelector('.phone');
      await pg.evaluate(() => document.fonts.ready);
      return { ctx: c, page: pg };
    })();
    await page.waitForSelector('.story-ov .sn-note');
    await page.waitForTimeout(700);
    const nb = await page.evaluate(() => { const b = document.querySelector('.sn-note').getBoundingClientRect(); return { w: b.width, inside: b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight }; });
    check('인트로(PC): 창이 화면 안, 폭 480 이하', nb.inside && nb.w <= 520, JSON.stringify(nb));
    for (let i = 0; i < 3; i++) await page.keyboard.press('Space');
    await page.waitForTimeout(150);
    const s1 = await gs(page);
    check('인트로(PC): Space는 문단을 넘기고 상자를 치지 않는다', (await page.locator('.story-ov').count()) === 1 && s1.stats.totalTaps === 0 && s1.unpack.damage === 0, (await text(page, '.sn-pg.cur')));
    for (let i = 0; i < 6 && (await page.locator('.story-ov').count()) > 0; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(80); }
    await page.waitForTimeout(400);
    const s2 = await gs(page);
    check('인트로(PC): Space·Enter로 끝까지 넘기면 닫히고 탭은 0, 인트로 봄', (await page.locator('.story-ov').count()) === 0 && s2.stats.totalTaps === 0 && s2.story.intro === true, `taps=${s2.stats.totalTaps}`);
    await ctx.close();
  }
  {
    const seed = { version: 9, unlocked: ALL, points: 5e9, earned: 1e60, moves: 7, tapLevel: 12, strikeLevel: 4, gear: { level: 3 }, homeLv: [3, 2, 1, 0, 0, 0, 0, 0], unpack: { box: 40, damage: 0, roomDone: false, hp: 1e15, salt: 5, rushSec: 0 } };
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await ctx.addInitScript((p) => localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p)), PREFS);
    await ctx.addInitScript(([key, s]) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem(key, JSON.stringify({ ...s, savedAt: Date.now() })); }, [KEY, seed]);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => !IGNORE.test(e.message) && errors.push(`pageerror: ${e.message}`));
    await page.goto(URL + '?debug');
    await page.waitForSelector('.phone');
    await page.waitForTimeout(600);
    const through = async (sel) => { for (let i = 0; i < 40; i++) { if (await page.locator(sel).count()) return; if (await page.locator('.move-scene').count()) await page.mouse.click(100, 400).catch(() => {}); await page.waitForTimeout(350); } };
    await page.locator('.move-btn').click();
    await page.waitForSelector('.modal');
    await page.locator('.modal .btn.primary').click();
    await through('.story-ov .sn-note');
    await page.waitForTimeout(800);
    const n = await page.evaluate(() => { const b = document.querySelector('.sn-note').getBoundingClientRect(); return { title: document.querySelector('.sn-title').textContent, txt: document.querySelector('.sn-pg.cur').textContent, inside: b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight, modals: document.querySelectorAll('.modal').length }; });
    check('도착 쪽지(PC): 우주 끝 신도시 쪽지가 창 안에, 특전 창은 아직 없다', n.title === '우주 끝 신도시' && n.txt.includes('마지막 상자는 맨 뒤에 있어요') && n.inside && n.modals === 0, JSON.stringify(n));
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await page.waitForSelector('.modal');
    check('쪽지를 Enter로 닫으면 기존 특전 창이 이어진다', (await page.locator('.story-ov').count()) === 0 && (await page.locator('.modal').count()) === 1);
    // 이제 이사 8회 상태에서 엔딩 끝 화면(PC): 집 9개 한 줄
    await page.evaluate(() => { document.querySelectorAll('.overlay').forEach((o) => o.remove()); });
    await setS(page, { earned: 1e60, points: 1e60, perkOffers: [] });
    await page.waitForTimeout(400);
    await page.locator('.move-btn').click();
    await page.waitForSelector('.modal');
    await page.locator('.modal .btn.primary').click();
    await page.waitForSelector('.story-ov.ending');
    await page.waitForSelector('.story-ov .sn-note', { timeout: 6000 });
    for (let i = 0; i < 12 && (await page.locator('.story-ov.end').count()) === 0; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(120); }
    await page.waitForSelector('.story-ov.end');
    await page.waitForTimeout(2800);
    const e = await page.evaluate(() => ({ tops: [...new Set([...document.querySelectorAll('.sn-h')].map((q) => Math.round(q.getBoundingClientRect().top)))].length, lit: document.querySelectorAll('.sn-h.lit').length, go: getComputedStyle(document.querySelector('.sn-go')).visibility, over: document.documentElement.scrollWidth > document.documentElement.clientWidth }));
    check('끝 화면(PC): 집 아이콘 9개가 한 줄로 모두 켜지고 버튼이 보인다', e.tops === 1 && e.lit === 9 && e.go === 'visible' && !e.over, JSON.stringify(e));
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    await page.waitForSelector('.story-ov', { state: 'detached' });
    await through('.modal');
    await page.waitForTimeout(600);
    const sx = await gs(page);
    check('계속 까기(PC): 평소 이사 -> 우주 끝 신도시 1차', sx.moves === 9 && sx.story.ending === true && (await text(page, '.house-name')) === '우주 끝 신도시 1차', `moves=${sx.moves}`);
    await ctx.close();
  }

  // ---- 가이드 2부·도움말(PC) ----
  {
    const SHOTS = path.join(__dirname, '..', 'screenshots');
    const { ctx, page } = await open();
    const ids = await page.evaluate(() => window.__ajd.cards());
    await page.evaluate((c) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, moves: 1, guide2: { step: 0, done: false }, deck: { ...s.deck, slots: [{ id: c[0], star: 1, charge: 0, stacks: 1 }], offers: [] } }); }, ids);
    await page.waitForTimeout(3500);
    const row = await page.evaluate(() => { const r = document.querySelector('.guide-row'); const b = r && r.getBoundingClientRect(); return { vis: !!r && !r.hidden && b.width > 0, chip: document.querySelector('.gd-chip')?.textContent, fit: !!r && [...r.querySelectorAll('.gd-head, .gd-text')].every((e) => e.scrollWidth <= e.clientWidth + 1), in: !!b && b.bottom <= innerHeight && b.right <= innerWidth }; });
    check('2부(PC): 가이드 줄이 보이고 안 넘친다', row.vis && row.fit && row.in && /^가이드 2부 [2-3]\/5$/.test(row.chip || ''), JSON.stringify(row));
    await page.screenshot({ path: path.join(SHOTS, 'g2-1440-part2.png') });
    const ar = await page.evaluate(() => { const a = document.querySelector('.gd-point'), g = document.querySelector('.guide-row'); if (!a || a.hidden) return { none: true }; const x = a.getBoundingClientRect(), y = g.getBoundingClientRect(); return { ov: x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top, a: [x.top, x.bottom], g: [y.top, y.bottom] }; });
    check('2부(PC): 화살표가 가이드 줄을 덮지 않는다', ar.none !== true && ar.ov === false, JSON.stringify(ar));
    const fit = await page.evaluate(() => { const b = document.querySelector('.move-btn').getBoundingClientRect(); const l = document.querySelector('.deck-label').getBoundingClientRect(), g = document.querySelector('.guide-row').getBoundingClientRect(); return { bb: b.bottom, ih: innerHeight, sh: document.documentElement.scrollHeight, gap: l.top - g.bottom }; });
    check('2부(PC): 이사 버튼 아랫변이 화면 안이고 세로 스크롤 없음', fit.bb <= fit.ih && fit.sh <= fit.ih, JSON.stringify(fit));
    await page.evaluate((c) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, deck: { ...s.deck, slots: [{ id: c[0], star: 1, charge: 0, stacks: 1 }, { id: c[1], star: 1, charge: 0, stacks: 0 }, { id: c[2], star: 1, charge: 0, stacks: 0 }] } }); }, ids);
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(SHOTS, 'g2-1440-part2-b.png') });
    await page.locator('button[aria-label="설정"]').click();
    await page.getByText('도움말', { exact: true }).click();
    await page.waitForSelector('.help-list');
    await page.waitForTimeout(900);
    const hp = await page.evaluate(() => { const rows = [...document.querySelectorAll('.help-row')]; const ov = document.querySelector('.help-list').getBoundingClientRect(); return { n: rows.length, pc: rows[0].textContent, over: rows.filter((r) => r.scrollWidth > r.clientWidth + 1 || r.getBoundingClientRect().right > ov.right + 1).length, h: document.documentElement.scrollWidth <= innerWidth }; });
    check('도움말(PC): 10줄·가로 넘침 없음·조작 줄에 Space·클릭', hp.n === 10 && hp.over === 0 && hp.h && hp.pc.includes('Space') && hp.pc.includes('클릭'), JSON.stringify(hp));
    await page.screenshot({ path: path.join(SHOTS, 'g2-1440-help.png') });
    await ctx.close();
  }

  check('콘솔 오류 0건', errors.length === 0, errors.slice(0, 3).join(' | '));
  const pass = results.filter(Boolean).length;
  console.log(`\nPC 스모크 ${pass}/${results.length}`);
  await ctx.close();
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.log('FAIL 스모크 실행 예외 - ' + e.message); process.exit(1); });
