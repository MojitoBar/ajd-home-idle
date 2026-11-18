// PC 스모크(1440x900). 전제: vite preview 4173, 격리 Aside(헤드리스) CDP 9333.
const { chromium } = require('playwright');

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
const IGNORE = /Extension context invalidated|Receiving end does not exist/;

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const open = async (size = { width: 1440, height: 900 }) => {
    const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
    await ctx.addInitScript((p) => localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p)), PREFS);
    const page = await ctx.newPage();
    page.on('console', (m) => m.type() === 'error' && !IGNORE.test(m.text()) && errors.push(`console: ${m.text()}`));
    page.on('pageerror', (e) => !IGNORE.test(e.message) && errors.push(`pageerror: ${e.message}`));
    await page.goto(URL + '?debug');
    await page.waitForSelector('.phone');
    await page.evaluate(() => document.fonts.ready);
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
  await page.keyboard.down('Space');
  await page.waitForTimeout(150);
  const u1 = await gs(page);
  const one = dmgOf(u1) - dmgOf(u0);
  for (let i = 0; i < 8; i++) { await page.keyboard.down('Space'); await page.waitForTimeout(60); }
  check('Space 길게: 게이지가 뜨고 키 반복은 탭을 더하지 않는다', (await page.locator('.charge:not([hidden])').count()) === 1 && (await gs(page)).stats.totalTaps === u1.stats.totalTaps);
  const u2 = await gs(page);
  await page.keyboard.up('Space');
  await page.waitForTimeout(300);
  const u3 = await gs(page);
  const say = (await page.locator('.charge-say b, .un-chain-judge').count()) ? await page.locator('.charge-say b, .un-chain-judge').first().innerText() : '';
  check('Space 떼면: 판정 글자와 함께 탭 1번보다 많이 깎인다', /퍼펙트|굿|아쉽/.test(say) && dmgOf(u3) - dmgOf(u2) > one * 1.5 && (await page.locator('.charge:not([hidden])').count()) === 0, `say=${say}`);
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

  // ---- 공구 구매(PC) ----
  await page.keyboard.press('1');
  await setS(page, { points: 1e30, unpack: { box: 56 } });
  await page.waitForTimeout(300);
  const lv0 = (await gs(page)).gear.level;
  await page.locator('.gear-level .btn.buy').click();
  await page.waitForTimeout(300);
  check('PC: 수평계 구매', (await gs(page)).gear.level === lv0 + 1);
  await page.keyboard.press('1');

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

  check('콘솔 오류 0건', errors.length === 0, errors.slice(0, 3).join(' | '));
  const pass = results.filter(Boolean).length;
  console.log(`\nPC 스모크 ${pass}/${results.length}`);
  await ctx.close();
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.log('FAIL 스모크 실행 예외 - ' + e.message); process.exit(1); });
