// 브라우저 스모크(모바일 390x844). 전제: vite preview 4173, 격리 Aside(헤드리스) CDP 9333. 스크린샷은 screenshots/.
const { chromium } = require('playwright');
const path = require('path');

const URL = 'http://localhost:4173';
const KEY = 'ajd-home-idle:save';
const SHOTS = path.join(__dirname, '..', 'screenshots');
require('fs').mkdirSync(SHOTS, { recursive: true });
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const PREFS = { sound: false, music: false, haptics: false, chargeDone: true, weakDone: true };
const ALL = ['tap', 'home', 'box', 'dex', 'mult', 'badge', 'perk'];
const results = [];
const errors = [];

function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' - ' + detail : ''}`);
}

const IGNORE = /Extension context invalidated|Receiving end does not exist/;
/** 새 컨텍스트·페이지. seed가 있으면 첫 로드 때만 저장 칸에 넣는다(새로고침은 그대로 이어짐) */
/** 새 게임 인트로가 떠 있으면 건너뛰기로 닫는다 */
async function skipIntro(page) {
  const sk = page.locator('.story-ov .sn-skip');
  if ((await sk.count()) === 0) return;
  await sk.click();
  await page.waitForSelector('.story-ov', { state: 'detached' });
}

async function newPage(browser, seed, query = '?debug', opts = MOBILE, keepIntro = false) {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript((p) => localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p)), PREFS);
  if (seed) {
    await ctx.addInitScript(([key, s]) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem(key, JSON.stringify({ ...s, savedAt: Date.now() }));
    }, [KEY, seed]);
  }
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && !IGNORE.test(m.text()) && errors.push(`console: ${m.text()}`));
  page.on('pageerror', (e) => !IGNORE.test(e.message) && errors.push(`pageerror: ${e.message}`));
  await page.goto(URL + query);
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  if (!keepIntro) await skipIntro(page);
  return { ctx, page };
}

const gs = (page) => page.evaluate(() => window.__ajd.get());
/** 상태에 덮어쓴다. unpack은 병합(상자는 hp를 크게 해서 안 터지게 하려면 hp를 넘긴다) */
const setS = (page, over) => page.evaluate((o) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, ...o, unpack: { ...s.unpack, ...(o.unpack || {}) } }); }, over);
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
const text = (page, sel) => page.locator(sel).first().innerText();
const vis = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);
const dmg = (s) => s.unpack.box * 1e12 + s.unpack.damage;
const num = (t) => parseFloat(String(t).replace(/[^0-9.]/g, ''));
const tab = (page, id) => page.locator(id === 'tap' ? '.dock .tab:not([data-ux])' : `.dock [data-ux="${id}"]`);
const loadedIn = (page, sel) => page.evaluate((q) => { const n = [...document.querySelectorAll(q)]; return n.length > 0 && n.every((i) => i.complete && i.naturalWidth > 0); }, sel);
const save = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const mid = async (page) => { const b = await page.locator('.phone').boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };

/** 글자가 칸 밖으로 넘치거나 카드 안에서 본문과 버튼이 겹치는 곳을 찾는다 */
const layoutIssues = (page, root) => page.evaluate((r) => {
  const out = [];
  const scope = document.querySelector(r);
  for (const e of scope.querySelectorAll('.card-name, .card-info, .buy, .card-lv, .tag, .ms-label, .note, .home-sum-lbl, .home-sum-num')) {
    if (e.getBoundingClientRect().width === 0) continue;
    if (e.scrollWidth > e.clientWidth + 1) out.push(`넘침 ${e.className}:${e.textContent.slice(0, 14)}`);
  }
  for (const c of scope.querySelectorAll('.card')) {
    if (c.getBoundingClientRect().width === 0) continue;
    const m = c.querySelector('.card-main')?.getBoundingClientRect();
    const b = c.querySelector('.btn.buy:not([hidden])')?.getBoundingClientRect();
    if (m && b && b.width > 0 && m.right > b.left + 1 && m.left < b.right && m.bottom > b.top + 1 && m.top < b.bottom - 1) out.push(`겹침 ${c.className}`);
    if (c.scrollWidth > c.clientWidth + 1) out.push(`카드 넘침 ${c.className}`);
  }
  return out;
}, root);

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  try {
    // 1. 새 게임: 공구 카드 2장 + 다음 공구 안내, 살림 탭 자물쇠, 치면 포인트, 공구 강화 구매
    {
      const { ctx, page } = await newPage(browser);
      await page.waitForTimeout(600);
      check('새 게임 첫 화면', (await text(page, '.house-name')) === '원룸' && /탭 1회/.test(await text(page, '.speed-num')));
      check('가로 스크롤 없음(시작)', await noHScroll(page));
      check('새 게임: 공구 카드 2장(공구·오함마)', (await page.locator('.panel .tap-card:visible').count()) === 2 && (await vis(page, '.strike-card')), String(await page.locator('.panel .tap-card:visible').count()));
      check('새 게임: 다음 공구 안내 한 줄', (await text(page, '.gear-next')).includes('상자 15개 더 열면') && (await text(page, '.gear-next')).includes('수평계'), await text(page, '.gear-next'));
      check('새 게임: 살림 탭은 자물쇠 칸', !(await vis(page, '.dock [data-ux="home"]')) && (await vis(page, '.tab-lock[data-lock="home"]')));
      check('새 게임: 상자·도감 탭도 닫혀 있다', !(await vis(page, '.dock [data-ux="box"]')) && !(await vis(page, '.dock [data-ux="dex"]')));
      const p0 = (await gs(page)).points;
      const m = await mid(page);
      for (let i = 0; i < 6; i++) { await page.mouse.click(m.x, m.y); await page.waitForTimeout(170); }
      check('새 게임: 치면 포인트가 오른다', (await gs(page)).points > p0, `${p0} -> ${(await gs(page)).points}`);
      const t0 = num(await text(page, '.speed-num'));
      await setS(page, { points: 1e6 });
      await page.waitForTimeout(300);
      await page.locator('.tap-card:not(.gear-card):not(.strike-card) .btn.buy').click();
      await page.waitForTimeout(700);
      const t1 = num(await text(page, '.speed-num'));
      check('공구 강화를 사면 "탭 1회" 값이 오른다', t1 > t0 && (await gs(page)).tapLevel === 1, `${t0} -> ${t1}`);
      check('글자 겹침·넘침 없음(공구 탭, 새 게임)', (await layoutIssues(page, '.panel')).length === 0, (await layoutIssues(page, '.panel')).join(','));
      await page.screenshot({ path: path.join(SHOTS, 'sm-01-new.png') });
      await ctx.close();
    }

    // 2. 공구 7종: 상자 수에 따라 차례로 열림, 구매, 상한 최대 칩, 퍼펙트 칸 폭, 선반 아이콘
    {
      const { ctx, page } = await newPage(browser);
      await setS(page, { unlocked: ALL, points: 1e15, earned: 1e6, tapLevel: 3, unpack: { box: 0, damage: 0, hp: 1e15 } });
      await page.waitForTimeout(500);
      const open = () => page.evaluate(() => [...document.querySelectorAll('.panel .tap-card')].filter((c) => c.getBoundingClientRect().height > 0).map((c) => c.querySelector('.card-name').textContent));
      const steps = [[0, ['공구 강화', '오함마']], [15, ['수평계']], [25, ['돋보기']], [35, ['빠루']], [45, ['안전모']], [55, ['송곳']]];
      let names = await open();
      for (const [box, add] of steps) {
        await setS(page, { unpack: { box } });
        await page.waitForTimeout(300);
        names = await open();
        if (box === 0) check('상자 0개: 카드 2장', names.length === 2 && names.join() === add.join(), names.join());
        else check(`상자 ${box}개: ${add[0]} 카드가 열린다`, names.includes(add[0]) && names.length === 2 + steps.findIndex(([b]) => b === box), names.join());
      }
      check('상자 55개: 카드 7장·다음 공구 안내 없음', names.length === 7 && !(await vis(page, '.gear-next')));
      const sc = async () => page.locator('.px-svc').count();
      const sh0 = await sc();
      const lvTxt = () => text(page, '.gear-level .card-lv');
      const price0 = await text(page, '.gear-level .buy-p');
      await page.locator('.gear-level .btn.buy').click();
      await page.waitForTimeout(500);
      const price1 = await text(page, '.gear-level .buy-p');
      check('수평계 구매: 레벨·가격이 바뀐다', (await lvTxt()) === 'Lv 1/5' && price0 !== price1 && (await gs(page)).gear.level === 1, `${await lvTxt()} ${price0} -> ${price1}`);
      check('선반: 공구를 사면 아이콘이 는다', (await sc()) === sh0 + 1, `${sh0} -> ${await sc()}`);
      // 상한 -> 최대 칩
      await page.evaluate(() => { window.__ajd.gear('level', 5); window.__ajd.gear('helmet', 3); window.__ajd.gear('crowbar', 5); window.__ajd.gear('awl', 5); window.__ajd.gear('loupe', 5); });
      await page.waitForTimeout(400);
      const maxed = await page.evaluate(() => ['level', 'helmet', 'crowbar', 'awl', 'loupe'].map((id) => { const c = document.querySelector(`.gear-${id}`); return !c.querySelector('.gear-max').hidden && c.querySelector('.btn.buy').hidden; }));
      check('상한(수평계5·안전모3·빠루5·송곳5·돋보기5)에서 `최대` 칩만 보인다', maxed.every(Boolean) && (await text(page, '.gear-helmet .gear-max')) === '최대', maxed.join());
      check('선반: 공구 7개 모두', (await sc()) === 7, String(await sc()));
      check('글자 겹침·넘침 없음(공구 탭, 7종·상한)', (await layoutIssues(page, '.panel')).length === 0, (await layoutIssues(page, '.panel')).join(','));
      check('가로 스크롤 없음(공구 7종)', await noHScroll(page));
      await page.screenshot({ path: path.join(SHOTS, 'sm-02-gear.png') });
      // 퍼펙트 칸 폭: 수평계 레벨이 오를수록 넓다
      const pw = async (lv) => {
        await page.evaluate((l) => { window.__ajd.gear('level', l); }, lv);
        await page.waitForTimeout(250);
        await page.evaluate(() => window.__ajd.zone(0.5));
        await page.waitForTimeout(150);
        return page.evaluate(() => parseFloat(document.querySelector('.charge-perfect').style.width));
      };
      const w0 = await pw(0);
      const w3 = await pw(3);
      const w5 = await pw(5);
      check('수평계 레벨이 오를수록 퍼펙트 칸이 넓어진다', w0 > 0 && w3 > w0 && w5 > w3, `Lv0 ${w0} / Lv3 ${w3} / Lv5 ${w5}`);
      await ctx.close();
    }

    // 3. 실드(안전모): 굿/미스가 나와도 연속 배수 유지·칸이 줄고, 0칸이면 끊김
    {
      const { ctx, page } = await newPage(browser);
      await setS(page, { unlocked: ALL, points: 1e9, earned: 1e6, tapLevel: 5, unpack: { box: 5, damage: 0, hp: 1e15 } });
      await page.evaluate(() => window.__ajd.gear('helmet', 2));
      await page.waitForTimeout(1500);
      const cells = () => page.locator('.sh-cell.on').count();
      const chip = async () => ((await page.locator('.streak-chip').isVisible()) ? page.locator('.streak-chip').innerText() : '');
      await page.evaluate(() => { window.__ajd.shield(2, 5); window.__ajd.streak(4); window.__ajd.zone(0.8); });
      await page.waitForTimeout(400);
      const c0 = await chip();
      check('실드: 배수 칩과 실드 칸이 보인다', /^x\d/.test(c0) && (await cells()) === 2 && (await vis(page, '.shield')), `chip=${c0} cells=${await cells()}`);
      await page.evaluate(() => window.__ajd.charge(0.2));
      await page.waitForTimeout(1200);
      check('실드: 미스가 나와도 연속 배수가 유지되고 칸이 하나 줄어든다', (await chip()) === c0 && (await cells()) === 1, `chip=${await chip()} cells=${await cells()}`);
      await page.evaluate(() => { window.__ajd.zone(0.8); window.__ajd.charge(0.2); });
      await page.waitForTimeout(1200);
      check('실드: 칸이 0이 되어도 한 번 더 막아 준다', (await chip()) === c0 && (await cells()) === 0, `chip=${await chip()} cells=${await cells()}`);
      await page.evaluate(() => { window.__ajd.zone(0.8); window.__ajd.charge(0.2); });
      await page.waitForTimeout(1500);
      check('실드 0칸이면 연속이 끊긴다', (await chip()) === '' && (await page.locator('.sh-cell.on').count()) === 0, `chip=${await chip()}`);
      await page.evaluate(() => window.__ajd.save());
      await page.waitForTimeout(300);
      check('안전모가 없는 집(Lv0)에는 실드 칸이 없다', await (async () => { await page.evaluate(() => window.__ajd.gear('helmet', 0)); await page.waitForTimeout(300); return !(await vis(page, '.shield')); })());
      await ctx.close();
    }

    // 4. 살림: 첫 살림을 얻으면 탭이 열림, 살림 배율 숫자 = 총 배율, 레벨을 올리면 총 배율 칩이 오름, 배율 내역 창
    {
      const { ctx, page } = await newPage(browser);
      await setS(page, { unlocked: ['tap'], points: 1e6, earned: 1e5 });
      await page.waitForTimeout(500);
      check('살림 전: 살림 탭 닫힘', !(await vis(page, '.dock [data-ux="home"]')));
      await page.evaluate(() => window.__ajd.home(0, 1));
      await page.waitForFunction(() => { const b = document.querySelector('.dock [data-ux="home"]'); return b && b.getBoundingClientRect().width > 0; }, null, { timeout: 5000 }).catch(() => {});
      check('첫 살림을 얻으면 살림 탭이 열린다', await vis(page, '.dock [data-ux="home"]') && !(await vis(page, '.tab-lock[data-lock="home"]')));
      await setS(page, { unlocked: ALL });
      await tab(page, 'home').click();
      await page.waitForTimeout(700);
      const badge = () => page.locator('.badge-val').innerText();
      check('살림 탭: 요약 카드 + 살림 8칸', (await page.locator('.home-sum').count()) === 1 && (await page.locator('.home-card').count()) === 8 && (await text(page, '.home-sum-lbl')) === '살림 배율');
      const sum1 = await text(page, '.home-sum-num');
      check('살림 배율 숫자가 총 배율 칩과 맞는다(다른 배율 없음)', sum1 === (await badge()), `${sum1} / ${await badge()}`);
      await page.evaluate(() => window.__ajd.home(0, 10));
      await page.evaluate(() => window.__ajd.home(1, 10));
      await page.waitForTimeout(1200);
      const sum2 = await text(page, '.home-sum-num');
      check('살림 레벨을 올리면 살림 배율·총 배율 칩이 오른다', num(sum2) > num(sum1) && (await badge()) === sum2, `${sum1} -> ${sum2} / chip ${await badge()}`);
      check('글자 겹침·넘침 없음(살림 탭)', (await layoutIssues(page, '.panel')).length === 0, (await layoutIssues(page, '.panel')).join(','));
      check('가로 스크롤 없음(살림 탭)', await noHScroll(page));
      await page.screenshot({ path: path.join(SHOTS, 'sm-03-home.png') });
      // 총 배율 칩 -> 내역 창
      await page.locator('.badge').click();
      await page.waitForSelector('.modal');
      const mp = await text(page, '.modal');
      check('총 배율 칩을 누르면 배율 내역 창', mp.includes('배율 내역') && mp.includes('살림') && mp.includes(sum2), mp.replace(/\n/g, ' ').slice(0, 100));
      await page.locator('.modal .modal-actions .btn').first().click();
      await page.waitForTimeout(250);
      check('배율 내역 창이 닫힌다', (await page.locator('.modal').count()) === 0);
      await page.locator('.speed-num').click();
      await page.waitForSelector('.modal');
      check('"탭 1회" 줄을 눌러도 내역 창', (await text(page, '.modal')).includes('배율 내역'));
      await page.locator('.modal .modal-actions .btn').first().click();
      await ctx.close();
    }

    // 5. 옛 저장(v8): 안내 창은 한 번만
    {
      const base = await (async () => { const b = await newPage(browser); const s = await gs(b.page); await b.ctx.close(); return s; })();
      const { notice, ...rest } = base;
      void notice;
      const v8 = { ...rest, version: 8, moves: 1, earned: 5e5, points: 4e5, services: [100, 50, 30, 20, 10, 5, 0, 0], contracts: [] };
      const { ctx, page } = await newPage(browser, v8);
      await page.waitForTimeout(800);
      const ntxt = (await page.locator('.modal').count()) ? await text(page, '.modal') : '';
      check('v8 저장을 불러오면 안내 창이 한 번 뜬다', ntxt.includes('집 키우기가 바뀌었어요'), ntxt.replace(/\n/g, ' ').slice(0, 80));
      check('v8 안내: 선물 상자 문구', ntxt.includes('선물 상자'), ntxt.replace(/\n/g, ' ').slice(0, 120));
      check('가로 스크롤 없음(안내 창)', await noHScroll(page));
      await page.locator('.modal .btn.primary').click();
      await page.waitForTimeout(400);
      const sv = await save(page);
      check('안내를 닫으면 notice가 지워지고 현재 version 17로 저장', sv.version === 17 && !sv.notice && (await page.locator('.modal').count()) === 0, `v${sv.version}`);
      await page.reload();
      await page.waitForSelector('.phone');
      await page.waitForTimeout(800);
      check('새로고침하면 안내 창이 다시 뜨지 않는다', (await page.locator('.modal').count()) === 0);
      check('서비스는 선물 상자로 바뀌어 저장에 services가 없다', !('services' in sv) || sv.services === undefined);
      await ctx.close();
    }

    // 6. 콤보·꾹 눌러 강타·급소
    {
      const { ctx, page } = await newPage(browser);
      await setS(page, { unlocked: ALL, points: 1e6, earned: 1e5, tapLevel: 3, unpack: { box: 3, damage: 0, hp: 1e15 } });
      await page.waitForTimeout(500);
      const m = await mid(page);
      for (let i = 0; i < 13; i++) { await page.mouse.click(m.x, m.y); await page.waitForTimeout(170); }
      const num0 = (await page.locator('.combo.on .combo-n').count()) ? Number(await page.locator('.combo.on .combo-n').innerText()) : 0;
      check('콤보: 10번 넘게 치면 콤보 표시', num0 >= 10 && (await page.locator('.combo.on .combo-chip').count()) === 1, `n=${num0}`);
      await page.waitForTimeout(1800);
      const st = await page.evaluate(() => ({ best: window.__ajd.get().bestCombo, n: window.__ajd.getCombo().n }));
      check('콤보: 끊기면 0으로 돌아가고 최고 기록이 남는다', st.n === 0 && st.best >= 10, JSON.stringify(st));
      // 강타
      await setS(page, { unpack: { box: 3, damage: 0, hp: 1e15 } });
      await page.waitForTimeout(700);
      const s0 = await gs(page);
      await page.mouse.click(m.x, m.y);
      await page.waitForTimeout(450);
      const s1 = await gs(page);
      const one = dmg(s1) - dmg(s0);
      check('강타: 짧은 탭은 게이지도 판정 글자도 없는 일반 탭', (await page.locator('.charge.on:not(.res)').count()) === 0 && (await page.locator('.charge-say').count()) === 0 && s1.stats.totalTaps - s0.stats.totalTaps === 1 && one > 0, `taps +${s1.stats.totalTaps - s0.stats.totalTaps}`);
      await page.waitForTimeout(600);
      const ys = () => page.evaluate(() => ['.move-block', '.card', '.px-strip'].map((q) => Math.round(document.querySelector(q).getBoundingClientRect().y)).join(','));
      const y0 = await ys();
      await page.mouse.move(m.x, m.y);
      await page.mouse.down();
      await page.waitForTimeout(500);
      check('강타: 길게 누르면 게이지가 뜬다', (await page.locator('.charge.on:not(.res)').count()) === 1 && (await page.locator('.charge-mark').count()) === 1);
      const geo = await page.evaluate(() => { const r = document.querySelector('.room').getBoundingClientRect(); const c = document.querySelector('.charge-bar').getBoundingClientRect(); return { dy: Math.round(c.top - r.bottom), barH: c.height, barW: c.width, roomW: r.width }; });
      check('강타: 게이지 띠가 방 사각형 밖(아래)에 있고 방 폭에 가깝고 막대가 16px보다 두껍다', geo.dy >= 0 && geo.barW >= geo.roomW - 20 && geo.barH >= 16, JSON.stringify(geo));
      check('강타: 누르기 전후로 아래 줄(이사 줄·카드·내구도 줄)의 y가 같다(밀림 없음)', (await ys()) === y0, `${y0} -> ${await ys()}`);
      await page.waitForTimeout(200);
      const s2 = await gs(page);
      await page.mouse.up();
      await page.waitForTimeout(300);
      const s3 = await gs(page);
      const say = (await page.locator('.charge-say b, .un-chain:not([hidden]) .un-chain-judge').count()) ? await page.locator('.charge-say b, .un-chain:not([hidden]) .un-chain-judge').first().innerText() : '';
      check('강타: 떼면 판정 글자와 함께 탭 1번보다 많이 깎이고 게이지가 사라진다', /퍼펙트|굿|아쉽/.test(say) && dmg(s3) - dmg(s2) > one * 1.5 && (await page.locator('.charge.on:not(.res)').count()) === 0, `say=${say} 탭1번=${one} 강타=${dmg(s3) - dmg(s2)}`);
      // 급소
      await page.waitForTimeout(500);
      await page.evaluate(() => window.__ajd.weak(0.8, 0.2));
      await page.waitForTimeout(300);
      const wb = await page.locator('.weak').boundingBox();
      check('급소: 과녁이 보이고 누르는 영역이 44px 이상', (await page.locator('.weak:not([hidden])').count()) === 1 && wb.width >= 44 && wb.height >= 44, `${wb.width}x${wb.height}`);
      const w0 = await gs(page);
      await page.mouse.click(wb.x + wb.width / 2 - 70, wb.y + wb.height / 2);
      await page.waitForTimeout(450);
      const w1 = await gs(page);
      check('급소: 과녁 밖을 누르면 일반 탭(급소는 그대로)', w1.stats.totalTaps - w0.stats.totalTaps === 1 && (await page.locator('.weak-say').count()) === 0 && (await page.locator('.weak:not([hidden])').count()) === 1);
      await page.waitForTimeout(500);
      const w2 = await gs(page);
      await page.mouse.click(wb.x + wb.width / 2, wb.y + wb.height / 2);
      await page.waitForTimeout(300);
      const w3 = await gs(page);
      const wsay = (await page.locator('.weak-say b, .un-chain:not([hidden]) .un-chain-judge').count()) ? await page.locator('.weak-say b, .un-chain:not([hidden]) .un-chain-judge').first().innerText() : '';
      check('급소: 과녁을 누르면 `급소!`와 함께 탭 1번보다 많이 깎이고 과녁이 사라진다', wsay === '급소!' && dmg(w3) - dmg(w2) > (dmg(w1) - dmg(w0)) * 1.5 && (await page.locator('.weak:not([hidden])').count()) === 0, `say=${wsay}`);
      check('가로 스크롤 없음(전투)', await noHScroll(page));
      await ctx.close();
    }

    // 6b. 연쇄 도중 꾹 누르기: 차징이 켜지고, 퍼펙트 칸에서 떼면 이전 연쇄가 서둘러 끝난 뒤 강타가 한 번만 나간다
    {
      const { ctx, page } = await newPage(browser);
      await setS(page, { unlocked: ALL, points: 1e6, earned: 1e5, tapLevel: 200, unpack: { box: 30, damage: 0, hp: 1 } });
      await page.waitForTimeout(600);
      const m = await mid(page);
      const p0 = (await gs(page)).points;
      await page.evaluate(() => {
        window.__seen = [];
        const c = document.querySelector('.un-chain');
        const rec = () => window.__seen.push(document.querySelector('.un-chain b')?.textContent ?? '');
        window.__ajd.chain(1700);
        new MutationObserver(rec).observe(document.querySelector('.un-chain'), { childList: true, characterData: true, subtree: true });
        window.__p1 = window.__ajd.get().points;
      });
      await page.waitForTimeout(250);
      await page.mouse.move(m.x, m.y);
      await page.mouse.down();
      await page.waitForTimeout(500);
      const c1 = await page.evaluate(() => ({ playing: window.__ajd.getChain().playing, on: document.querySelectorAll('.charge.on:not(.res)').length, x: document.querySelector('.charge-mark')?.style.translate }));
      await page.waitForTimeout(120);
      const x2 = await page.evaluate(() => document.querySelector('.charge-mark')?.style.translate);
      check('연쇄 도중 꾹 누르면 게이지가 켜지고 눈금이 움직인다', c1.playing && c1.on === 1 && !!c1.x && c1.x !== x2, JSON.stringify({ ...c1, x2 }));
      const rel = await page.evaluate(async () => {
        const t0 = performance.now();
        while (!document.querySelector('.charge-mark.in') && performance.now() - t0 < 4000) await new Promise((q) => requestAnimationFrame(q));
        const inZone = !!document.querySelector('.charge-mark.in');
        const tRel = performance.now();
        window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
        let tStrike = -1;
        while (performance.now() - tRel < 4000) {
          await new Promise((q) => requestAnimationFrame(q));
          if (document.querySelector('.un-chain-judge')?.textContent.includes('x1.5')) { tStrike = Math.round(performance.now() - tRel); break; }
        }
        return { inZone, tStrike };
      });
      await page.mouse.up();
      await page.waitForTimeout(3000);
      const s1 = await gs(page);
      const p1 = await page.evaluate(() => window.__p1);
      const seen = await page.evaluate(() => window.__seen);
      const jt = await page.evaluate(() => document.querySelector('.un-chain-judge')?.textContent ?? '');
      check('연쇄 도중 떼면 강타가 한 번 나가고(x1.5, x2 아님) 이전 연쇄 수익이 전부 들어온다', rel.inZone && rel.tStrike > 0 && rel.tStrike < 1500 && /x1\.5/.test(jt) && !/x2/.test(jt) && seen.some((t) => /^1[67]\d\d연쇄!$/.test(t)) && p1 > p0 && s1.points > p1, JSON.stringify({ ...rel, jt, p0, p1, p: s1.points, last: seen.slice(-3) }));
      await ctx.close();
    }

    // 7. 연쇄·피버·특별 상자
    {
      const { ctx, page } = await newPage(browser);
      await setS(page, { unlocked: ALL, points: 1e6, earned: 1e5, tapLevel: 40, unpack: { box: 10, damage: 0, hp: 1 } });
      await page.waitForTimeout(600);
      const b0 = (await gs(page)).unpack.box;
      await page.evaluate(() => window.__ajd.chain(6));
      await page.waitForTimeout(1800);
      const chainTxt = await page.evaluate(() => document.querySelector('.un-chain')?.textContent ?? '');
      check('연쇄: 6연쇄를 쓰면 상자 번호가 6 이상 오른다', (await gs(page)).unpack.box >= b0 + 6, `${b0} -> ${(await gs(page)).unpack.box} ${chainTxt}`);
      await page.waitForTimeout(1500);
      await setS(page, { unlocked: ALL, points: 1e6, earned: 1e5, tapLevel: 200, unpack: { box: 30, damage: 0, hp: 1 } });
      await page.waitForTimeout(600);
      const long = await page.evaluate(async () => {
        window.__ajd.chain(1700);
        const t0 = performance.now();
        while (window.__ajd.getChain().playing && performance.now() - t0 < 20000) await new Promise((r) => requestAnimationFrame(r));
        return { ms: Math.round(performance.now() - t0), n: window.__ajd.getChain().n, txt: document.querySelector('.un-chain b')?.textContent ?? '' };
      });
      check('긴 연쇄: 연쇄 1,700이 3.5초 안에 끝난다', long.ms <= 3500 && long.n === 1700, `${long.ms}ms n=${long.n}`);
      check('긴 연쇄: 끝난 뒤 표시가 1700연쇄다', long.txt === '1700연쇄!', long.txt);
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.__ajd.fever());
      await page.waitForTimeout(500);
      check('피버: 켜면 피버 표시가 뜬다', (await page.evaluate(() => document.body.classList.contains('fever'))) && (await page.locator('.fever-tag.active').count()) === 1);
      check('가로 스크롤 없음(피버)', await noHScroll(page));
      await ctx.close();

      // 6c. 연쇄 연출 한계: 1000단 재생 중 프레임·입자·DOM 수, 끝난 뒤 연출 DOM 정리
      {
        const r = await newPage(browser);
        await setS(r.page, { unlocked: ALL, points: 1e6, earned: 1e5, tapLevel: 200, unpack: { box: 30, damage: 0, hp: 1 } });
        await r.page.waitForTimeout(600);
        await r.page.evaluate(() => window.__ajd.chain(50));
        await r.page.waitForTimeout(3500);
        await setS(r.page, { unpack: { box: 30, damage: 0, hp: 1 } });
        const m = await r.page.evaluate(async () => {
          const SEL = '.un-bit, .un-flat, .fx-flash, .fx-edge, .fx-edgebox:not(.combo-heat)';
          let maxGap = 0, maxP = 0, maxDom = 0, n = 0;
          window.__ajd.chain(1000);
          let last = performance.now();
          const t0 = last;
          await new Promise((res) => {
            const tick = (now) => {
              if (n++ > 1) maxGap = Math.max(maxGap, now - last);
              last = now;
              maxP = Math.max(maxP, window.__ajd.particles());
              maxDom = Math.max(maxDom, document.querySelectorAll(SEL).length);
              if (now - t0 > 5000) return res();
              requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          });
          // 시계 상자가 켠 자동 연타가 계속 상자를 터뜨리니 끄고 본다
          { const s = window.__ajd.get(); window.__ajd.set({ ...s, unpack: { ...s.unpack, rushSec: 0 } }); }
          await new Promise((q) => setTimeout(q, 2800));
          const stale = [...document.querySelectorAll(SEL)].filter((e) => !e.classList.contains('un-bit') || performance.now() - Number(e.dataset.t || 0) > 1500).length;
          return { maxGap: Math.round(maxGap), maxP, maxDom, stale, playing: window.__ajd.getChain().playing };
        });
        check('연쇄 1000단: 재생 중 가장 긴 프레임 50ms 이하(첫 두 프레임 제외)', m.maxGap <= 50, JSON.stringify(m));
        check('연쇄 1000단: 입자 최대 400 이하', m.maxP <= 400 && m.maxP > 100, JSON.stringify(m));
        check('연쇄 1000단: 연출 DOM 최대 80 이하', m.maxDom <= 80, JSON.stringify(m));
        check('연쇄 1000단: 연쇄가 끝나고(자동 연타를 끈 뒤) 2.8초 안에 연출 DOM 0개', !m.playing && m.stale === 0, JSON.stringify(m));
        await r.ctx.close();
      }

      const prep = async (kind) => {
        const r = await newPage(browser);
        await setS(r.page, { unlocked: ALL, points: 1e6, earned: 1e5, tapLevel: 80, unpack: { box: 30, damage: 1e15 } });
        await r.page.evaluate((k) => window.__ajd.special(k, 0), kind);
        await r.page.waitForTimeout(800);
        return r;
      };
      let sp = await prep('gold');
      check('특별: 황금 상자 그림이 보인다', await sp.page.evaluate(() => { const im = Array.from(document.querySelectorAll('.un-box-img.on')).find((e) => /gold/.test(e.src)); return !!im && im.getBoundingClientRect().width > 0; }));
      let mm = await mid(sp.page);
      await sp.page.mouse.click(mm.x, mm.y);
      await sp.page.waitForTimeout(250);
      check('특별: 황금 상자가 터지면 보상 숫자에 x10', /x10/.test(await sp.page.evaluate(() => Array.from(document.querySelectorAll('.un-gain.gold')).map((e) => e.textContent).join(' '))));
      await sp.ctx.close();
      sp = await prep('bomb');
      mm = await mid(sp.page);
      await sp.page.mouse.click(mm.x, mm.y);
      await sp.page.waitForTimeout(700);
      const ct = await sp.page.evaluate(() => document.querySelector('.un-chain')?.textContent ?? '');
      const cn = Number((ct.match(/(\d+)\s*연쇄/) || [])[1] || 0);
      check('특별: 폭탄 상자가 터지면 연쇄 6 이상 + 폭발!', cn >= 6 && ct.includes('폭발!'), ct);
      await sp.ctx.close();
      sp = await prep('clock');
      mm = await mid(sp.page);
      await sp.page.mouse.click(mm.x, mm.y);
      await sp.page.waitForTimeout(300);
      check('특별: 시계 상자가 터지면 `자동 N초` 칩과 rushSec > 0', (await sp.page.locator('.rush-tag').isVisible()) && /자동 \d+초/.test(await sp.page.locator('.rush-tag').innerText()) && (await gs(sp.page)).unpack.rushSec > 0);
      await sp.page.evaluate(() => window.__ajd.rush(130));
      await sp.page.waitForTimeout(400);
      const rl = (await gs(sp.page)).unpack.rushSec;
      check('특별: 자동 연타가 15초를 넘어 쌓인다(상한 없음)', rl > 15 && /자동 1\d\d초/.test(await sp.page.locator('.rush-tag').innerText()), `rushSec=${rl}`);
      const r0 = (await gs(sp.page)).unpack.box;
      await sp.page.waitForTimeout(1500);
      check('특별: 러시 중 손을 안 대도 상자 번호가 오른다', (await gs(sp.page)).unpack.box > r0, `${r0} -> ${(await gs(sp.page)).unpack.box}`);
      await sp.page.evaluate(() => window.__ajd.rush(0.4));
      await sp.page.waitForTimeout(1200);
      check('특별: 러시가 끝나면 칩이 사라진다', !(await sp.page.locator('.rush-tag').isVisible()) && (await gs(sp.page)).unpack.rushSec === 0);
      await sp.ctx.close();
    }

    // 8. 러시 토스트(30분 넘게 비웠다 돌아옴)·오프라인 보상 창 없음
    {
      const base = await (async () => { const b = await newPage(browser); const s = await gs(b.page); await b.ctx.close(); return s; })();
      const old = { ...base, unlocked: ALL, tapLevel: 5 };
      const ctx = await browser.newContext(MOBILE);
      await ctx.addInitScript(([key, s, p]) => {
        localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify(p));
        localStorage.setItem(key, JSON.stringify({ ...s, savedAt: Date.now() - 3 * 3600 * 1000 }));
      }, [KEY, old, PREFS]);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      await page.goto(URL + '?debug');
      await page.waitForSelector('.phone');
      await page.waitForTimeout(1200);
      const toastTxt = (await page.locator('.toast').allInnerTexts()).join(' | ');
      check('오래 비웠다 돌아오면 러시 토스트(오프라인 보상 창은 없음)', /자동|러시/.test(toastTxt) && (await page.locator('.modal').count()) === 0 && (await gs(page)).unpack.rushSec > 0, toastTxt);
      await ctx.close();
    }

    // 9. 상자 탭·열기 연출·도감
    {
      const { ctx, page } = await newPage(browser);
      await setS(page, { unlocked: ALL, points: 1e8, earned: 1e6 });
      await page.waitForTimeout(500);
      await tab(page, 'box').click();
      await page.waitForTimeout(500);
      check('상자 가격·열기 버튼', /가격|P/.test(await text(page, '.box-price')) && (await page.locator('.box-open.ready').count()) === 1, await text(page, '.box-price'));
      await page.locator('.odds-toggle').click();
      await page.waitForSelector('.modal');
      const oddsTxt = await text(page, '.modal');
      check('확률 창·합 100%·10개 열기 보장 문구', (oddsTxt.match(/100%/g) || []).length === 2 && oddsTxt.includes('10개 열기에서는 레어 이상이 1개 꼭 나와요'), oddsTxt.replace(/\n/g, ' ').slice(0, 100));
      await page.locator('.modal .btn', { hasText: '닫기' }).click();
      check('가로 스크롤 없음(상자 탭)', await noHScroll(page));
      await page.evaluate(() => { const o = Math.random; window.__q = [0.9985, 0.5, 0.99]; Math.random = () => (window.__q.length ? window.__q.shift() : o()); });
      await page.locator('.box-open').click();
      await page.waitForSelector('.box-scene');
      await page.waitForSelector('.bs-card', { timeout: 8000 });
      await page.waitForTimeout(450);
      const card = await text(page, '.bs-card');
      check('신화 공개: 이름·새로 얻음 칩', card.includes('우주 정수기') && card.includes('새로 얻음') && card.includes('황금'), card.replace(/\n/g, ' '));
      check('상자 결과에 수집품 그림', await loadedIn(page, '.bs-card img'));
      await page.waitForTimeout(1500);
      await page.locator('.bs-actions .btn.primary').click();
      await page.waitForSelector('.box-scene', { state: 'detached' });
      const sv = await gs(page);
      check('상자 개봉 상태', sv.collection.space_purifier?.gold === 1 && sv.stats.boxesOpened === 1, JSON.stringify(sv.collection.space_purifier));
      await tab(page, 'box').click();
      await page.locator('.box-ten').click();
      await page.waitForSelector('.sum-grid', { timeout: 12000 });
      await page.waitForSelector('.bs-actions:not(.lock)', { timeout: 15000 });
      await page.waitForTimeout(700);
      check('10개 요약: 10칸·그림·최고 등급', (await page.locator('.sum-cell').count()) === 10 && (await loadedIn(page, '.sum-cell img')) && (await text(page, '.sum-best')).includes('최고 등급'));
      check('가로 스크롤 없음(10개 요약)', await noHScroll(page));
      await page.locator('.bs-actions .btn.primary').click();
      await page.waitForSelector('.box-scene', { state: 'detached' });
      check('10개 개봉 뒤 총 11개', (await gs(page)).stats.boxesOpened === 11);
      await tab(page, 'dex').click();
      await page.waitForTimeout(900);
      check('도감 칸 80·세트 5줄', (await page.locator('.dex-cell').count()) === 80 && (await page.locator('.dex-set').count()) === 5);
      check('도감 획득 칸에 그림', await loadedIn(page, '.dex-cell.got img'));
      check('가로 스크롤 없음(도감)', await noHScroll(page));
      await page.locator('.dex-cell.got').first().click();
      await page.waitForSelector('.modal');
      check('도감 상세 창', (await text(page, '.modal')).includes('보유'));
      await page.locator('.modal .modal-actions .btn').click();
      await ctx.close();
    }

    // 10. 이사: 공구 5종·살림 유지, 탭·오함마 강화 초기화, 저장 유지, 설정
    {
      const gear = { level: 3, helmet: 2, crowbar: 1, awl: 4, loupe: 5 };
      const seed = { version: 9, unlocked: ALL, points: 5e9, earned: 1e30, moves: 0, tapLevel: 12, strikeLevel: 4, gear, homeLv: [3, 2, 1, 0, 0, 0, 0, 0], unpack: { box: 40, damage: 0, roomDone: false, hp: 1e15, salt: 5, rushSec: 0 } };
      const { ctx, page } = await newPage(browser, seed);
      await page.waitForTimeout(700);
      const mv = page.locator('.move-btn');
      check('이사 버튼 활성', await mv.isEnabled());
      await mv.click();
      await page.waitForSelector('.modal');
      check('이사 확인창 문구', (await text(page, '.modal')).includes('이사 갈까요?') && /영구 배율은 x1 → x\d/.test(await text(page, '.modal')), (await text(page, '.modal-body')).replace(/\n/g, ' '));
      await page.locator('.modal .btn.primary').click();
      await page.waitForFunction(() => window.__ajd.get().moves === 1, null, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2500);
      const s = await gs(page);
      check('이사 뒤: 공구 5종·살림 레벨 유지', JSON.stringify(s.gear) === JSON.stringify(gear) && s.homeLv.slice(0, 3).join() === '3,2,1', JSON.stringify(s.gear));
      check('이사 뒤: 탭·오함마 강화·포인트·상자 번호 초기화', s.moves === 1 && s.tapLevel === 0 && s.strikeLevel === 0 && s.points === 0 && s.earned === 0 && s.unpack.box === 0, `tap=${s.tapLevel} strike=${s.strikeLevel}`);
      check('이사 뒤: 집 이름', (await text(page, '.house-name')) !== '원룸', await text(page, '.house-name'));
      check('가로 스크롤 없음(이사 뒤)', await noHScroll(page));
      if ((await page.locator('.modal').count()) > 0) await page.keyboard.press('Escape');
      check('이사 뒤: 특전 상자 2개(3택 묶음 2개) 대기', s.perkOffers.length === 2 && s.perkOffers.every((o) => o.length === 3), String(s.perkOffers.length));
      // 저장 유지: 새로고침
      await page.waitForTimeout(500);
      await page.reload();
      await page.waitForSelector('.phone');
      await page.waitForTimeout(800);
      const r = await gs(page);
      check('새로고침 뒤에도 이사·공구·살림이 유지된다', r.moves === 1 && r.gear.awl === 4 && r.homeLv[0] === 3, `moves=${r.moves}`);
      // 설정 창: 내보내기 -> 불러오기
      await page.locator('button[aria-label="설정"]').click();
      await page.waitForSelector('.modal');
      check('가로 스크롤 없음(설정 창)', await noHScroll(page));
      await page.locator('.modal .btn', { hasText: '내보내기' }).click();
      const code = await page.locator('.modal textarea').inputValue();
      check('설정: 내보내기 문자열', code.length > 50);
      await page.locator('.modal .btn', { hasText: '불러오기' }).click();
      await page.waitForTimeout(600);
      check('설정: 불러오기 뒤에도 상태 유지', (await gs(page)).moves === 1 && (await gs(page)).gear.loupe === 5);
      await ctx.close();
    }

    // 11. 폭별 글자 넘침(320·360·430) — 공구 탭·살림 탭
    for (const w of [320, 360, 430]) {
      const { ctx, page } = await newPage(browser, null, '?debug', { ...MOBILE, viewport: { width: w, height: 760 } });
      await setS(page, { unlocked: ALL, points: 5e12, earned: 1e6, tapLevel: 30, strikeLevel: 8, gear: { level: 5, helmet: 3, crowbar: 2, awl: 1, loupe: 4 }, homeLv: [12, 20, 48, 60, 200, 5, 3, 1], unpack: { box: 70, damage: 0, hp: 1e15 } });
      await page.waitForTimeout(900);
      const bar = await page.evaluate(() => { const t = document.querySelector('.bar-text'); return { fit: t.scrollWidth <= t.clientWidth, txt: t.textContent }; });
      check(`${w} 폭: 공구 탭 글자 넘침·겹침 없음`, (await layoutIssues(page, '.panel')).length === 0 && (await noHScroll(page)), (await layoutIssues(page, '.panel')).join(','));
      check(`${w} 폭: 이사 줄 글자가 넘치지 않는다`, bar.fit, bar.txt);
      await tab(page, 'home').click();
      await page.waitForTimeout(600);
      check(`${w} 폭: 살림 탭 글자 넘침·겹침 없음`, (await layoutIssues(page, '.panel')).length === 0 && (await noHScroll(page)), (await layoutIssues(page, '.panel')).join(','));
      await ctx.close();
    }

    // 12. 첫 가이드: 새 게임 1단계, 잠긴 요소, 단계 진행, 열림, 문턱 대기, 선물 상자 보상, 이사로 종료
    {
      const sumColl = (s) => Object.values(s.collection).reduce((a, c) => a + c.base + c.shiny + c.gold + c.rainbow, 0);
      const waitChip = (page, chip) => page.waitForFunction((c) => document.querySelector('.guide-row .gd-chip')?.textContent === c && !document.querySelector('.guide-row.done'), chip, { timeout: 5000 }).catch(() => {});
      const guideRowInfo = (page) => page.evaluate(() => {
        const r = document.querySelector('.guide-row');
        const vis = !!r && !r.hidden && r.getBoundingClientRect().height > 0;
        const t = document.querySelector('.guide-row .gd-text');
        const h = document.querySelector('.guide-row .gd-head');
        return { vis, chip: document.querySelector('.guide-row .gd-chip')?.textContent, text: t?.textContent, reward: document.querySelector('.guide-row .gd-reward')?.textContent, fit: !!t && t.scrollWidth <= t.clientWidth && h.scrollWidth <= h.clientWidth };
      });
      // 실제 새 게임(?debug 없음): 가이드 1단계
      {
        const { ctx, page } = await newPage(browser, null, '');
        await page.waitForTimeout(500);
        const g = await guideRowInfo(page);
        check('가이드: 새 게임은 가이드 1/18', g.vis && g.chip === '가이드 1/18' && g.text.includes('10번'), `${g.chip} ${g.text}`);
        check('가이드: 잠긴 요소(피버 막대·오함마 카드·강타 게이지·연속 칩)가 안 보인다', !(await vis(page, '.fever-gauge')) && !(await vis(page, '.strike-card')) && !(await vis(page, '.streak-chip')) && !(await vis(page, '.charge')));
        check('가이드: 잠긴 새 게임에는 게이지 띠가 없다(자리도 없다)', await page.evaluate(() => { const e = document.querySelector('.charge'); return !e || e.getBoundingClientRect().height === 0; }));
        const mv = await page.evaluate(() => ({ w: document.querySelector('.move-block')?.getBoundingClientRect().width, txt: document.querySelector('.bar-text')?.textContent, fit: (() => { const e = document.querySelector('.bar-text'); return e.scrollWidth <= e.clientWidth; })() }));
        check('가이드: 새 게임 첫 화면에 이사 줄과 다음 집 이름이 보인다', mv.w > 0 && mv.txt.includes('투룸으로') && mv.fit, `${mv.w} ${mv.txt}`);
        check('가이드: 새 게임에서 열림 토스트가 뜨지 않는다', (await page.locator('.toast').allInnerTexts()).join(' ').indexOf('이사') < 0);
        await ctx.close();
      }
      // 선반 오함마: 가이드 7단계까지 숨김, 8단계(연쇄)부터 보임
      {
        const { ctx, page } = await newPage(browser, null, '?debug&guide');
        await page.waitForTimeout(500);
        const n1 = await page.locator('.px-svc').count();
        await page.evaluate(() => window.__ajd.guide(7)); await page.waitForTimeout(400);
        const n7 = await page.locator('.px-svc').count();
        await page.evaluate(() => window.__ajd.guide(8)); await page.waitForTimeout(400);
        const n8 = await page.locator('.px-svc').count();
        check('가이드: 선반 오함마는 8단계부터 보인다', n1 === 1 && n7 === 1 && n8 === 2, `${n1},${n7},${n8}`);
        await ctx.close();
      }
      // 시험 모드: 10번 치면 2단계, 공구 강화하면 3단계
      {
        const { ctx, page } = await newPage(browser, null, '?debug&guide');
        await page.waitForTimeout(400);
        const m = await mid(page);
        for (let i = 0; i < 10; i++) { await page.mouse.click(m.x, m.y); await page.waitForTimeout(170); }
        await page.waitForTimeout(400);
        const sayTxt = (await page.locator('.un-home-say').allInnerTexts()).join(' ');
        const toastTxt = (await page.locator('.toast').allInnerTexts()).join(' ');
        check('가이드: 단계 완료 시 머리글이 뜬다(토스트 중복 없음)', sayTxt.includes('가이드 1 완료!') && !toastTxt.includes('가이드 1 완료'), `${sayTxt} | ${toastTxt}`);
        const held = await guideRowInfo(page);
        check('가이드: 완료 순간 줄이 가득 찬 막대로 붙잡힌다', held.text.includes('완료'), held.text);
        await waitChip(page, '가이드 2/18');
        let g = await guideRowInfo(page);
        check('가이드: 10번 치면 2단계', g.chip === '가이드 2/18', `${g.chip}`);
        await setS(page, { points: 1e6 });
        await page.waitForTimeout(200);
        await page.locator('.tap-card .btn.buy').first().click();
        await waitChip(page, '가이드 3/18');
        g = await guideRowInfo(page);
        check('가이드: 공구를 강화하면 3단계', g.chip === '가이드 3/18', g.chip);
        await ctx.close();
      }
      // 단계를 건너뛰며 요소가 열린 뒤 보이는지(가이드 n에서 열림: 콤보 4·강타 5·급소 6·피버 7·오함마 8·연속 9·특별 11·공구 12)
      {
        const { ctx, page } = await newPage(browser, null, '?debug&guide');
        const bad = [];
        for (const n of [3, 4, 5, 6, 7, 8, 9, 11, 12]) {
          await page.evaluate((k) => { window.__ajd.guide(k); window.__ajd.heat(40); window.__ajd.streak(3); window.__ajd.combo(30); }, n);
          await page.waitForTimeout(250);
          const o = await page.evaluate(() => {
            const v = (q) => { const e = document.querySelector(q); return !!e && e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== 'none'; };
            return { fever: v('.fever-gauge'), strike: v('.strike-card'), chip: v('.streak-chip'), charge: v('.charge'), combo: !!document.querySelector('.combo.on') && v('.combo') };
          });
          // 콤보 표시는 탭할 때 켜지므로 body 클래스로 확인한다
          const noCombo = await page.evaluate(() => document.body.classList.contains('g-no-combo'));
          const want = { fever: n >= 7, strike: n >= 8, chip: n >= 9, charge: n >= 5, combo: n >= 4 };
          if (o.fever !== want.fever) bad.push(`${n}:피버`);
          if (o.strike !== want.strike) bad.push(`${n}:오함마`);
          if (o.chip !== want.chip) bad.push(`${n}:연속칩`);
          if (o.charge !== want.charge) bad.push(`${n}:강타게이지`);
          if (noCombo === want.combo) bad.push(`${n}:콤보`);
        }
        check('가이드: 각 요소가 열린 단계부터 보인다', bad.length === 0, bad.join(','));
        // 강타가 열린 뒤(9단계)에는 띠 자리가 늘 있어, 눌러도 가이드 줄·이사 줄이 밀리지 않는다
        {
          await page.evaluate(() => window.__ajd.guide(9));
          await page.waitForTimeout(300);
          const gy = () => page.evaluate(() => ['.guide-row', '.move-block'].map((q) => Math.round(document.querySelector(q).getBoundingClientRect().y)).join(','));
          const before = await gy();
          await page.evaluate(() => window.__ajd.holdAt(0.4));
          await page.waitForTimeout(200);
          const during = await gy();
          await page.evaluate(() => window.__ajd.release());
          check('가이드: 게이지를 눌러도 가이드 줄·이사 줄의 y가 같다(밀림 없음)', before === during && !before.startsWith('0,'), `${before} -> ${during}`);
        }
        // 영구 공구 카드: 12단계 전에는 없다
        await page.evaluate(() => window.__ajd.guide(11));
        await setS(page, { earned: 1e20, points: 1e20, tapLevel: 40, unpack: { box: 70 } });
        await page.waitForTimeout(300);
        const gear11 = await page.locator('.gear-card:not([hidden])').count();
        await page.evaluate(() => window.__ajd.guide(12));
        await page.waitForTimeout(300);
        const gear12 = await page.locator('.gear-card:not([hidden])').count();
        check('가이드: 영구 공구 카드는 12단계부터', gear11 === 0 && gear12 > 0, `${gear11}->${gear12}`);
        // 특전 상자 카드: 13단계 전에는 숨고, 13단계에서 상자 탭에 보인다
        await page.evaluate(() => window.__ajd.guide(12));
        await page.locator('.tab', { hasText: '상자' }).click();
        await page.waitForTimeout(400);
        const pb12 = await page.locator('.perkbox-card').evaluate((e) => !e.hidden && e.getBoundingClientRect().height > 0);
        await page.evaluate(() => window.__ajd.guide(13));
        await page.waitForTimeout(400);
        const pb13 = await page.locator('.perkbox-card').evaluate((e) => !e.hidden && e.getBoundingClientRect().height > 0);
        check('가이드: 특전 상자 카드는 12단계까지 숨고 13단계부터 보인다', !pb12 && pb13, `${pb12}->${pb13}`);
        await ctx.close();
      }
      // 누적 P 문턱 대기 문구, 문턱을 넘으면 다음 단계
      {
        const { ctx, page } = await newPage(browser, null, '?debug&guide');
        await setS(page, { guide: { step: 2, n: 1, done: false }, earned: 100, points: 100 });
        await page.waitForTimeout(400);
        let g = await guideRowInfo(page);
        check('가이드: 누적 P 문턱 대기 문구', g.text.includes('누적') && g.text.includes('모아요') && g.chip === '가이드 3/18', `${g.chip} ${g.text}`);
        await setS(page, { earned: 5000 });
        await waitChip(page, '가이드 4/18');
        g = await guideRowInfo(page);
        check('가이드: 문턱을 넘으면 다음 단계', g.chip === '가이드 4/18', g.chip);
        // 선물 상자 보상 단계: 도감 수집품이 는다
        const before = sumColl(await gs(page));
        await setS(page, { guide: { step: 13, n: 0, done: false }, tapLevel: 100, earned: 1e14, points: 1e14 });
        const scene = await page.waitForSelector('.box-scene', { timeout: 6000 }).then(() => true).catch(() => false);
        check('가이드: 선물 상자 단계 완료 시 결과 장면이 뜬다', scene);
        const closed = await page.waitForSelector('.box-scene', { state: 'detached', timeout: 12000 }).then(() => true).catch(() => false);
        check('가이드: 선물 상자 결과 장면이 저절로 닫힌다', closed);
        const after = await gs(page);
        check('가이드: 선물 상자 보상 단계를 끝내면 도감 수집품이 는다', sumColl(after) === before + 4 && after.guide.step === 14, `${before}->${sumColl(after)} step=${after.guide.step}`);
        await ctx.close();
      }
      // 이사하면 가이드 줄이 사라진다
      {
        const seed = { version: 11, unlocked: ALL, points: 5e9, earned: 1e30, moves: 0, tapLevel: 12, guide: { step: 17, n: 0, done: false } };
        const { ctx, page } = await newPage(browser, seed, '?debug&guide');
        await page.waitForTimeout(700);
        let g = await guideRowInfo(page);
        check('가이드: 18단계에서는 줄이 보인다', g.vis && g.chip === '가이드 18/18', `${g.chip}`);
        await page.locator('.move-btn').click();
        await page.waitForSelector('.modal');
        await page.locator('.modal .btn.primary').click();
        await page.waitForFunction(() => window.__ajd.get().moves === 1, null, { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(2500);
        g = await guideRowInfo(page);
        check('가이드: 이사하면 1부는 완료로 저장되고 줄은 2부로 바뀐다', g.vis && g.chip.startsWith('가이드 2부') && (await gs(page)).guide.done === true, g.chip);
        await ctx.close();
      }
      // 가이드 완료 저장·기본 ?debug에는 줄이 없다
      {
        const { ctx, page } = await newPage(browser, { version: 11, unlocked: ALL, guide: { step: 18, n: 0, done: true } }, '');
        await page.waitForTimeout(500);
        check('가이드: 완료 저장을 불러오면 줄이 없다', !(await guideRowInfo(page)).vis);
        await ctx.close();
        const d = await newPage(browser, null, '?debug');
        await d.page.waitForTimeout(400);
        check('가이드: ?debug 기본은 가이드 완료(줄 없음·요소 전부 보임)', !(await guideRowInfo(d.page)).vis && (await vis(d.page, '.fever-gauge')) && (await vis(d.page, '.strike-card')));
        await d.ctx.close();
      }
      // 폭 320·360·430 x 높이 640: 모든 단계 문구와 문턱 대기 문구가 줄 안에 든다
      for (const w of [320, 360, 430]) {
        const { ctx, page } = await newPage(browser, null, '?debug&guide', { ...MOBILE, viewport: { width: w, height: 640 } });
        const bad = [];
        for (let n = 1; n <= 18; n++) {
          for (const wait of [false, true]) {
            await page.evaluate(([k, ww]) => {
              const s = window.__ajd.get();
              const goal = [10, 1, 1, 10, 1, 1, 1, 3, 3, 1, 1, 1, 1, 100, 2000, 100, 3e5, 1][k - 1];
              window.__ajd.set({ ...s, earned: ww ? 1.5e14 / 7 : 1e30, guide: { step: k - 1, n: ww ? goal : 0, done: false } });
            }, [n, wait]);
            await page.waitForTimeout(120);
            const g = await guideRowInfo(page);
            if (!g.vis || !g.fit) bad.push(`${n}${wait ? 'w' : ''}`);
          }
        }
        check(`${w}x640: 가이드 줄 글자 넘침 없음(34칸)`, bad.length === 0 && (await noHScroll(page)), bad.join(','));
        await ctx.close();
      }
    }

    // 낮은 화면(320x640, 390x664) 새 게임: 가이드 줄·이사 줄이 있어도 강화 버튼이 아래 고정 바에 가리지 않는다
    for (const [w, h] of [[320, 640], [390, 664]]) {
      const { ctx, page } = await newPage(browser, null, '', { ...MOBILE, viewport: { width: w, height: h } });
      await page.waitForTimeout(400);
      const r = await page.evaluate(() => ({ bot: document.querySelector('.tap-card .buy').getBoundingClientRect().bottom, dock: document.querySelector('.dock-band').getBoundingClientRect().top }));
      check(`${w}x${h}: 새 게임에서 강화 버튼이 고정 바에 가리지 않는다`, r.bot <= r.dock, `버튼 아랫변 ${Math.round(r.bot)} / 고정 바 윗변 ${Math.round(r.dock)}`);
      await ctx.close();
    }

    // 특전 상자: 구매 -> 3택 창 -> 고르면 레벨 +1·가격 2배, 이사 보상 수 표기, 폭별 글자 넘침
    {
      const { ctx, page } = await newPage(browser, null, '?debug');
      await setS(page, { unlocked: ALL });
      await page.locator('.tab', { hasText: '상자' }).click();
      await page.waitForTimeout(400);
      check('특전 상자: 카드에 이름·설명·가격·확률 안내가 있다', (await text(page, '.perkbox-card')).includes('특전 상자') && (await text(page, '.perkbox-card')).includes('특전 3개 중 하나를 골라요') && (await text(page, '.perkbox-card')).includes('같은 확률로 3개'));
      await setS(page, { points: 0 });
      await page.waitForTimeout(300);
      check('특전 상자: 포인트가 모자라면 버튼이 꺼진다', await page.locator('.perkbox-buy').isDisabled());
      const st0 = await gs(page);
      const costOf = () => page.evaluate(() => { const t = document.querySelector('.perkbox-buy .bx-cost').textContent; const u = { 만: 1e4, 억: 1e8, 조: 1e12, 경: 1e16 }; const m = t.replace(/,/g, '').match(/([0-9.]+)\s*([만억조경]?)/); return Number(m[1]) * (u[m[2]] || 1); });
      const cost0 = await costOf();
      await setS(page, { points: 1e10 });
      await page.waitForTimeout(300);
      check('특전 상자: 포인트가 있으면 버튼이 켜진다', !(await page.locator('.perkbox-buy').isDisabled()));
      const pBefore = (await gs(page)).points;
      await page.locator('.perkbox-buy').click();
      await page.waitForSelector('.modal .pcard', { timeout: 8000 });
      const st1 = await gs(page);
      check('특전 상자: 구매하면 포인트가 줄고 3택 묶음이 1개 생기고 바로 3택 창이 뜬다', st1.points < pBefore && st1.perkBoxBought === 1 && st1.perkOffers.length === 1 && (await page.locator('.modal .pcard').count()) === 3, `bought=${st1.perkBoxBought} offers=${st1.perkOffers.length}`);
      const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
      await page.locator('.modal .pcard:not(:disabled)').first().click();
      await page.waitForSelector('.modal', { state: 'detached', timeout: 8000 });
      const st2 = await gs(page);
      check('특전 상자: 고르면 특전 레벨이 합계 1 오르고 대기 묶음이 사라진다', sum(st2.perks) === sum(st1.perks) + 1 && st2.perkOffers.length === 0, `${sum(st1.perks)}->${sum(st2.perks)}`);
      await page.waitForTimeout(400);
      const cost1 = await costOf();
      check('특전 상자: 다음 가격이 2배', cost1 > 0 && Math.abs(cost1 / cost0 - 2) < 0.05, `${cost0}->${cost1}`);
      check('특전 상자: 이번 집에서 1번 뽑음 안내', (await text(page, '.pb-hint')).includes('1번 뽑음'));
      await page.locator('.pb-odds-btn').click();
      await page.waitForSelector('.modal');
      check('특전 상자: 확률 보기에 후보와 같은 확률이 보인다', (await page.locator('.modal .odds-row').count()) >= 3 && (await text(page, '.modal')).includes('같은 확률'));
      await ctx.close();
    }
    for (const w of [390, 360, 320]) {
      const { ctx, page } = await newPage(browser, null, '?debug', { ...MOBILE, viewport: { width: w, height: 800 } });
      await setS(page, { points: 1e30, unlocked: ALL });
      await page.locator('.tab', { hasText: '상자' }).click();
      await page.waitForTimeout(400);
      const bad = await page.evaluate(() => [...document.querySelectorAll('.perkbox-card, .perkbox-card *')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).display !== 'inline').map((e) => e.className || e.tagName));
      check(`${w}px: 특전 상자 카드 글자 넘침 없음`, bad.length === 0 && (await noHScroll(page)), bad.join(','));
      await ctx.close();
    }
    // 특전 목록: 무한 특전은 'Lv N'과 상한 없음, 상한 있는 특전은 'Lv N/최대'
    {
      const { ctx, page } = await newPage(browser, null, '?debug');
      await setS(page, { unlocked: ALL, perks: { tap_power: 7, crit: 2 } });
      await page.locator('.perk-btn').click();
      await page.waitForSelector('.perk-list');
      const rows = await page.evaluate(() => [...document.querySelectorAll('.perk-row')].map((r) => `${r.querySelector('.fb').textContent}|${r.querySelector('.pr-lv b').textContent}|${r.querySelector('.pr-lv').textContent}`));
      check('특전 목록: 무한 특전 Lv 7·상한 없음, 상한 있는 특전 Lv 2/5', rows.some((r) => r.startsWith('손목 단련|Lv 7|') && r.includes('상한 없음')) && rows.some((r) => r.startsWith('촉이 좋은 손가락|Lv 2/5')) && rows.length === 12, rows.slice(0, 3).join(' / '));
      await ctx.close();
    }

    // 가이드 화살표: 2단계(포인트 충분)는 강화 버튼 위, 모자라면 없음, 10단계는 상자 탭 → 뽑기 버튼, 완료 후엔 없음, 완료 머리글과 말풍선은 겹치지 않는다
    {
      const { ctx, page } = await newPage(browser, null, '?debug&guide');
      const arrowBox = (p) => p.evaluate(() => { const e = document.querySelector('.gd-point'); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return { cx: r.left + r.width / 2, top: r.top, bot: r.bottom }; });
      const btnBox = (p, sel) => p.evaluate((q) => { const e = typeof q === 'string' ? document.querySelector(q) : null; const r = e.getBoundingClientRect(); return { cx: r.left + r.width / 2, top: r.top, bot: r.bottom }; }, sel);
      const setG = (p, i, over) => p.evaluate(([i, o]) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, guide: { step: i, n: 0, done: false }, unlocked: ['tap', 'home', 'box', 'dex', 'move', 'mult', 'badge', 'perk'], ...o }); }, [i, over]);
      await setG(page, 1, { points: 1e6 }); await page.waitForTimeout(600);
      let a = await arrowBox(page); let b = await btnBox(page, '.panel .btn.buy');
      check('가이드 2단계: 화살표가 강화 버튼 바로 위', !!a && Math.abs(a.cx - b.cx) < 30 && b.top - a.bot >= 0 && b.top - a.bot < 12, JSON.stringify({ a, b }));
      await setG(page, 1, { points: 0 }); await page.waitForTimeout(500);
      check('가이드 2단계: 포인트가 모자라면 화살표 없음', (await arrowBox(page)) === null);
      await setG(page, 7, { points: 1e6, earned: 3e6 }); await page.waitForTimeout(500);
      const gtxt = () => page.evaluate(() => document.querySelector('.guide-row .gd-text')?.textContent || '');
      await page.evaluate(() => window.__ajd.guideEv({ type: 'strike' })); await page.waitForTimeout(400);
      const t1 = await gtxt();
      await page.evaluate(() => window.__ajd.guideEv({ type: 'strike' })); await page.waitForTimeout(700);
      const t2 = await gtxt();
      a = await arrowBox(page); b = await btnBox(page, '.strike-card .btn.buy');
      check('가이드 8단계: 약한 강타 2번 뒤 보조 안내로 바뀌고 화살표가 오함마 강화 버튼에 있다', t1.includes('3개') && t2.includes('강타가 약하면') && !!a && Math.abs(a.cx - b.cx) < 30 && Math.abs(b.top - a.bot) < 14, JSON.stringify({ t1, t2, a, b }));
      await setG(page, 9, { points: 1e13, earned: 1e13 }); await page.waitForTimeout(600);
      a = await arrowBox(page); b = await page.evaluate(() => { const r = [...document.querySelectorAll('.tab')].find((x) => x.textContent.includes('상자')).getBoundingClientRect(); return { cx: r.left + r.width / 2, top: r.top, bot: r.bottom }; });
      check('가이드 10단계: 화살표가 상자 탭 버튼 바로 위', !!a && Math.abs(a.cx - b.cx) < 30 && Math.abs(b.top - a.bot) < 12, JSON.stringify({ a, b }));
      await page.evaluate(() => [...document.querySelectorAll('.tab')].find((x) => x.textContent.includes('상자')).click()); await page.waitForTimeout(600);
      a = await arrowBox(page); b = await btnBox(page, '.box-open');
      const edge = b.top >= (await page.evaluate(() => document.querySelector('.dock-band').getBoundingClientRect().top)) - 2;
      check('가이드 10단계: 상자 탭에서 뽑기 버튼(화면 밖이면 탭 바 위 가장자리)', !!a && Math.abs(a.cx - b.cx) < 80 && (edge || Math.abs(b.top - a.bot) < 12), JSON.stringify({ a, b }));
      await setG(page, 12, { points: 1e30, earned: 1e30 }); await page.waitForTimeout(600);
      a = await arrowBox(page); b = await btnBox(page, '.perkbox-buy');
      const edge13 = b.top >= (await page.evaluate(() => document.querySelector('.dock-band').getBoundingClientRect().top)) - 2;
      check('가이드 13단계: 상자 탭에서 특전 상자 뽑기 버튼(화면 밖이면 탭 바 위 가장자리)', !!a && Math.abs(a.cx - b.cx) < 80 && (edge13 || Math.abs(b.top - a.bot) < 12), JSON.stringify({ a, b }));
      await page.evaluate(() => window.__ajd.guide('done')); await page.waitForTimeout(500);
      check('가이드 완료: 화살표 없음', (await arrowBox(page)) === null);
      await setG(page, 4, { points: 1e7, earned: 3e6, stats: { ...(await page.evaluate(() => window.__ajd.get().stats)), totalTaps: 30 } }); await page.waitForTimeout(800);
      await page.evaluate(() => window.__ajd.guideEv({ type: 'strike' }));
      let overlap = false;
      for (let i = 0; i < 80; i++) { overlap = overlap || (await page.evaluate(() => { const bx = window.__ajd.textBoxes(); const tips = bx.filter((x) => x.kind === 'tip'); const hs = bx.filter((x) => x.kind === 'head'); return tips.some((t) => hs.some((h) => Math.min(t.x + t.w, h.x + h.w) > Math.max(t.x, h.x) && Math.min(t.y + t.h, h.y + h.h) > Math.max(t.y, h.y))); })); await page.waitForTimeout(50); }
      check('가이드 단계 완료 머리글이 말풍선과 겹치지 않는다', !overlap);
      await ctx.close();
    }

    // ---- 공구함 덱 1단계(화면) ----
    {
      const DECK_ALL = [...ALL, 'deck'];
      const GUIDE_DONE = { step: 18, n: 0, done: true };
      const deckSet = (page, slots, offers, moves = 1) => page.evaluate(([sl, of, m]) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, moves: m, unlocked: ['tap', 'home', 'box', 'dex', 'mult', 'badge', 'perk', 'deck'], deck: { ...s.deck, slots: sl.map((id) => ({ id, star: 1, charge: 0, stacks: 0 })), offers: of } }); }, [slots, offers, moves]);
      {
        const { ctx, page } = await newPage(browser, { version: 12, unlocked: ALL, moves: 0, guide: GUIDE_DONE });
        await page.waitForTimeout(700);
        check('덱: 첫 집에는 카드 줄이 없다', (await page.locator('.deck-row').count()) === 0 && !(await vis(page, '.deck-alert')));
        check('덱 4단계: 첫 집은 4번째 탭이 도감 그대로(공구함 탭·토글 없음)', (await text(page, '.dock [data-ux="dex"]')).includes('도감') && (await page.locator('.dock [data-ux="deck"]').count()) === 0 && (await page.locator('.view-btn').count()) === 0);
        await ctx.close();
      }
      {
        const { ctx, page } = await newPage(browser, { version: 12, unlocked: ALL, moves: 0, guide: GUIDE_DONE });
        await page.waitForTimeout(500);
        await deckSet(page, [], [['P2', 'C1', 'P3']]);
        await page.waitForTimeout(600);
        check('덱: 이사 뒤 카드 줄(칸 4개)과 노란 카드 고르기 버튼이 보인다', (await vis(page, '.deck-row')) && (await page.locator('.deck-slot').count()) === 4 && (await text(page, '.deck-alert')).includes('카드 고르기'));
        const g = await page.evaluate(() => { const r = document.querySelector('.deck-row').getBoundingClientRect(); const m = document.querySelector('.move-row').getBoundingClientRect(); const c = document.querySelector('.charge')?.getBoundingClientRect(); return { rowBottom: r.bottom, moveTop: m.top, chargeBottom: c && c.width ? c.bottom : 0, rowTop: r.top, h: r.height }; });
        check('덱: 카드 줄(높이 60)이 이사 줄·강타 띠와 겹치지 않는다', g.h === 60 && g.rowBottom <= g.moveTop && g.rowTop >= g.chargeBottom, JSON.stringify(g));
        check('덱 4단계: 이사 뒤 4번째 탭이 공구함이고 대기 묶음이 있으면 주황 점(공구 강화 탭엔 점 없음)', (await text(page, '.dock [data-ux="deck"]')).includes('공구함') && (await page.locator('.dock [data-ux="dex"]').count()) === 0 && (await page.locator('.dock [data-ux="deck"] .dot:visible').count()) === 1 && (await page.locator('.dock .tab:not([data-ux]) .dot:visible').count()) === 0);
        await tab(page, 'deck').click();
        await page.waitForTimeout(300);
        check('덱 4단계: 공구함 탭을 열면 점이 사라지고 패널에 카드 고르기 버튼·배율·4칸이 보인다', (await page.locator('.dock [data-ux="deck"] .dot:visible').count()) === 0 && (await vis(page, '.deck-panel .dp-pick')) && (await text(page, '.deck-panel .dp-mult')).startsWith('×') && (await page.locator('.deck-panel .perk-row').count()) === 4 && (await text(page, '.deck-panel')).includes('이사하면 공구함은 비워져요'));
        await tab(page, 'tap').click();
        await page.locator('.deck-alert').click();
        await page.waitForSelector('.modal.deck-pick .pcard');
        const backs = () => page.evaluate(() => [...document.querySelectorAll('.deck-pick .pcard')].map((c) => ({ back: c.classList.contains('back') || c.classList.contains('pre'), shown: getComputedStyle(c.querySelector('.pface')).visibility })));
        const b0 = await backs();
        check('덱 연출: 창이 열린 직후 카드 3장이 뒷면이다', b0.length === 3 && b0.every((x) => x.back && x.shown === 'hidden'), JSON.stringify(b0));
        await page.locator('.pcard[data-card="C1"]').click({ force: true });
        await page.waitForTimeout(150);
        const sk = await gs(page);
        const b1 = await backs();
        check('덱 연출: 연출 중 누르면 즉시 모두 앞면이 되고 카드는 안 골라진다', b1.every((x) => !x.back && x.shown === 'visible') && sk.deck.slots.length === 0 && sk.deck.offers.length === 1 && (await page.locator('.modal.deck-pick').count()) === 1, JSON.stringify([b1, sk.deck.slots.length]));
        await page.locator('.modal-actions .btn', { hasText: '나중에 고르기' }).click();
        await page.waitForTimeout(300);
        await page.locator('.deck-alert').click();
        await page.waitForSelector('.modal.deck-pick .pcard');
        await page.waitForTimeout(250);
        const b2 = await backs();
        await page.locator('.pcard[data-card="P2"]').click({ force: true });
        await page.waitForTimeout(100);
        check('덱 연출: 뒤집히기 전에는 눌러도 안 골라진다', b2.some((x) => x.back) && (await gs(page)).deck.slots.length === 0);
        await page.locator('.modal-actions .btn', { hasText: '나중에 고르기' }).click();
        await page.waitForTimeout(300);
        await page.locator('.deck-alert').click();
        await page.waitForSelector('.modal.deck-pick .pcard');
        await page.waitForTimeout(1500);
        const b3 = await backs();
        check('덱 연출: 1.5초 뒤 3장 모두 앞면이다', b3.length === 3 && b3.every((x) => !x.back && x.shown === 'visible'), JSON.stringify(b3));
        check('덱: 카드 고르기 창에 카드 3장 + 건너뛰기', (await page.locator('.deck-pick .pcard').count()) === 3 && (await page.locator('.deck-pick .modal-actions .btn', { hasText: '건너뛰기' }).count()) === 1);
        await page.locator('.pcard[data-card="P2"]').click();
        await page.waitForTimeout(1400);
        const s1 = await gs(page);
        check('덱 연출: 고른 뒤 카드 줄 첫 칸에 그 카드가 들어간다', (await page.locator('.deck-slot').first().getAttribute('data-card')) === 'P2' && (await page.locator('.deck-fly').count()) === 0);
        check('덱: 카드를 고르면 칸에 들어가고 묶음이 사라진다', s1.deck.slots.map((x) => x.id).join() === 'P2' && s1.deck.offers.length === 0 && (await page.locator('.deck-slot.on').count()) === 1 && (await page.locator('.modal').count()) === 0 && !(await vis(page, '.deck-alert')));
        await deckSet(page, ['P2', 'C1', 'P3', 'S3'], [['C3', 'P2', 'C1']]);
        await page.waitForTimeout(400);
        await page.locator('.deck-alert').click();
        await page.waitForSelector('.modal.deck-pick .pcard');
        await page.waitForTimeout(1500);
        check('덱 5단계: 이미 낀 카드는 막히지 않고 ★ 올리기 버튼이 된다', (await page.locator('.deck-pick .pcard.maxed').count()) === 0 && (await page.locator('.deck-pick .pcard.starup .pick-btn', { hasText: '★ 올리기' }).count()) === 2);
        await page.locator('.pcard[data-card="C3"]').click();
        await page.waitForTimeout(500);
        const stage = await page.evaluate(() => ({ title: document.querySelector('.modal-head h2')?.textContent, modals: document.querySelectorAll('.modal').length, cards: [...document.querySelectorAll('.deck-pick .pcard')].map((c) => c.dataset.card).join() }));
        check('덱: 칸이 차면 같은 창 안에서 바꿀 칸 고르기로 넘어간다', stage.title === '바꿀 칸 고르기' && stage.modals === 1 && stage.cards === 'P2,C1,P3,S3', JSON.stringify(stage));
        await page.locator('.modal-actions .btn', { hasText: '돌아가기' }).click();
        await page.waitForTimeout(500);
        check('덱: 돌아가기로 카드 고르기로 돌아간다', (await text(page, '.modal-head h2')).includes('카드 고르기') && (await gs(page)).deck.slots.length === 4);
        await page.locator('.pcard[data-card="C3"]').click();
        await page.waitForTimeout(400);
        await page.locator('.pcard[data-card="C1"]').click();
        await page.waitForTimeout(1400);
        const s2 = await gs(page);
        check('덱: 바꿀 칸을 고르면 교체되고 묶음이 사라진다', s2.deck.slots.map((x) => x.id).join() === 'P2,C3,P3,S3' && s2.deck.offers.length === 0 && (await page.locator('.modal').count()) === 0, s2.deck.slots.map((x) => x.id).join());
        await deckSet(page, ['P2'], [['C1', 'P3', 'C3'], ['C3', 'C1', 'P3']]);
        await page.waitForTimeout(400);
        await page.locator('.deck-alert').click();
        await page.waitForSelector('.modal.deck-pick .pcard');
        await page.waitForTimeout(1500);
        await page.locator('.modal-actions .btn', { hasText: '건너뛰기' }).click();
        await page.waitForTimeout(1500);
        const s3 = await gs(page);
        check('덱: 건너뛰면 묶음만 사라지고 다음 묶음으로 이어진다', s3.deck.slots.map((x) => x.id).join() === 'P2' && s3.deck.offers.length === 1 && (await page.locator('.modal .pcard').count()) === 3);
        await page.locator('.modal-actions .btn', { hasText: '건너뛰기' }).click();
        await page.waitForTimeout(500);
        check('덱: 마지막 묶음을 건너뛰면 창이 닫힌다', (await gs(page)).deck.offers.length === 0 && (await page.locator('.modal').count()) === 0);
        await page.locator('.deck-row').click();
        await page.waitForTimeout(400);
        check('덱 4단계: 카드 줄을 누르면 공구함 탭으로 간다(창은 안 뜬다, 낀 카드 이름·빈 칸)', (await page.locator('.modal').count()) === 0 && (await vis(page, '.deck-panel')) && (await page.locator('.dock [data-ux="deck"].active').count()) === 1 && (await text(page, '.deck-panel')).includes('먹줄 튕기기') && (await page.locator('.deck-panel .deck-card-empty').count()) === 3);
        await tab(page, 'box').click();
        await page.waitForTimeout(300);
        check('덱 4단계: 이사 뒤 상자 탭 맨 위에 [뽑기 / 도감] 토글, 기본은 뽑기', (await page.locator('.box-view .view-btn').count()) === 2 && (await page.locator('.view-btn.on').innerText()) === '뽑기' && (await vis(page, '.box-hero')) && !(await vis(page, '.dex-grid')));
        await page.locator('.view-btn[data-view="dex"]').click();
        await page.waitForTimeout(400);
        check('덱 4단계: 도감 토글을 누르면 도감 패널(칸·세트)이 그 자리에 나온다', (await vis(page, '.dex-grid')) && (await vis(page, '.dex-head')) && (await vis(page, '#dex-sets')) && (await page.locator('.dex-grid > *').count()) > 20 && !(await vis(page, '.box-hero')) && (await page.locator('.view-btn.on').innerText()) === '도감');
        const lay = await page.evaluate(() => { const r = (e) => e.getBoundingClientRect(); const tabs = [...document.querySelectorAll('.dock .tab')].filter((t) => r(t).width > 0); const lblOk = tabs.every((t) => { const l = t.querySelector('.tab-lbl'); return l && r(l).left >= r(t).left - 0.5 && r(l).right <= r(t).right + 0.5; }); const gap = tabs.every((t, i) => i === 0 || r(t).left >= r(tabs[i - 1]).right - 0.5); const vb = [...document.querySelectorAll('.view-btn')].map(r); const sw = document.documentElement.scrollWidth <= document.documentElement.clientWidth; return { lblOk, gap, vbOk: vb.length === 2 && vb[0].right <= vb[1].left && vb.every((b) => b.right <= innerWidth && b.height >= 32), sw, n: tabs.length }; });
        check('덱 4단계: 독 탭 글자·토글이 겹치거나 넘치지 않는다(가로 스크롤 없음)', lay.lblOk && lay.gap && lay.vbOk && lay.sw && lay.n === 4, JSON.stringify(lay));
        await page.locator('.view-btn[data-view="draw"]').click();
        await page.waitForTimeout(200);
        await tab(page, 'tap').click();
        await ctx.close();
      }
      {
        const { ctx, page } = await newPage(browser, { version: 12, unlocked: DECK_ALL, moves: 1, guide: GUIDE_DONE });
        await page.waitForTimeout(500);
        await deckSet(page, ['C3'], []);
        await setS(page, { points: 1e6, earned: 1e5, tapLevel: 200, unpack: { box: 30, damage: 0, hp: 1 } });
        await page.evaluate(() => { window.__xs = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('deck-x')) window.__xs.push(n.textContent); }).observe(document.querySelector('.deck-row'), { childList: true, subtree: true }); window.__ajd.chain(3000); });
        for (let i = 0; i < 300; i++) { await page.waitForTimeout(100); const w = await page.evaluate(() => ({ p: window.__ajd.getChain().playing, n: window.__xs.length })); if (i > 5 && !w.p && w.n > 0) break; }
        await page.waitForTimeout(1500);
        const xs = await page.evaluate(() => window.__xs);
        check('덱: 3,000연쇄 강타 한 번에 C3 발동 표시가 ×30으로 한 번만 뜬다', xs.length === 1 && xs[0] === '×30', JSON.stringify(xs));
        await ctx.close();
      }
      // ---- 공구함 덱 2단계(화면): 카드 12장 · 발동 연출 · 피버 띠 ----
      const DECK2 = [...DECK_ALL, 'special', 'fever'];
      const deck2Set = (page, slots, offers = []) => page.evaluate(([sl, of, un]) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, moves: 1, unlocked: un, deck: { ...s.deck, slots: sl.map((id) => ({ id, star: 1, charge: 0, stacks: 0 })), offers: of } }); }, [slots, offers, DECK2]);
      const observeX = (page) => page.evaluate(() => { window.__xs = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('deck-x')) window.__xs.push(n.textContent); }).observe(document.querySelector('.deck-row'), { childList: true, subtree: true }); });
      {
        const { ctx, page } = await newPage(browser, { version: 12, unlocked: DECK2, moves: 1, guide: GUIDE_DONE });
        await page.waitForTimeout(500);
        const bundles = [['P2', 'C1', 'P3'], ['C3', 'P1', 'C4'], ['S1', 'S3', 'S4'], ['F1', 'F2', 'F3']];
        await deck2Set(page, [], bundles);
        await page.waitForTimeout(400);
        await page.locator('.deck-alert').click();
        await page.waitForSelector('.modal.deck-pick .pcard');
        const bad = [];
        const seen = [];
        for (let b = 0; b < bundles.length; b++) {
          await page.waitForTimeout(1300);
          const r = await page.evaluate(() => {
            const out = { ids: [], over: [], fb: document.querySelectorAll('.deck-pick .ico-fb').length, notLoaded: [...document.querySelectorAll('.deck-pick .pcard img.ico')].filter((i) => !(i.complete && i.naturalWidth > 0)).length, hs: document.documentElement.scrollWidth > document.documentElement.clientWidth };
            const body = document.querySelector('.deck-pick .modal-body');
            if (body && body.scrollWidth > body.clientWidth + 1) out.over.push('body');
            for (const c of document.querySelectorAll('.deck-pick .pcard')) {
              out.ids.push(c.dataset.card);
              const f = c.querySelector('.pface').getBoundingClientRect();
              for (const n of c.querySelectorAll('.pface *')) { const q = n.getBoundingClientRect(); if (q.width && (q.right > f.right + 1 || q.left < f.left - 1 || q.bottom > f.bottom + 1)) out.over.push(c.dataset.card + ':' + n.className); }
            }
            return out;
          });
          seen.push(...r.ids);
          if (r.over.length || r.fb || r.notLoaded || r.hs) bad.push(JSON.stringify(r));
          if (b < bundles.length - 1) await page.locator('.deck-pick .modal-actions .btn', { hasText: '건너뛰기' }).click();
        }
        check('덱 2단계: 카드 12장이 고르기 창에 잘림·가로 넘침 없이 그려지고 아이콘이 다 뜬다', new Set(seen).size === 12 && bad.length === 0, bad.slice(0, 2).join(' | ') + ' ' + seen.join());
        await ctx.close();
      }
      {
        const { ctx, page } = await newPage(browser, { version: 12, unlocked: DECK2, moves: 1, guide: GUIDE_DONE });
        await page.waitForTimeout(500);
        await deck2Set(page, ['P2', 'C1', 'P3']);
        const clash = await page.evaluate(() => { const own = new Set(window.__ajd.get().deck.slots.map((x) => x.id)); let hit = 0; for (let i = 0; i < 40; i++) { window.__ajd.offer(); } const offers = window.__ajd.get().deck.offers; for (const o of offers) for (const id of o) if (own.has(id)) hit++; return { hit, n: offers.length, uniq: offers.every((o) => new Set(o).size === o.length) }; });
        check('덱 2단계: 묶음 3장은 서로 다르다(낀 카드는 ★ 올리기 후보로 나올 수 있다)', clash.n >= 40 && clash.uniq, JSON.stringify(clash));
        await ctx.close();
      }
      for (const [golds, want] of [[3, ['×3']], [2, []]]) {
        const { ctx, page } = await newPage(browser, { version: 12, unlocked: DECK2, moves: 1, guide: GUIDE_DONE });
        await page.waitForTimeout(500);
        await deck2Set(page, ['S4']);
        await setS(page, { points: 1e6, earned: 1e5, tapLevel: 200, unpack: { box: 30, damage: 0, hp: 1 } });
        const ok = await page.evaluate(() => window.__ajd.special('gold', 0, { 5: 'gold', 10: 'gold' }));
        await observeX(page);
        await page.evaluate((n) => window.__ajd.chain(n), golds === 3 ? 11 : 10);
        for (let i = 0; i < 300; i++) { await page.waitForTimeout(100); const w = await page.evaluate(() => ({ p: window.__ajd.getChain().playing, n: window.__xs.length })); if (i > 5 && !w.p && (w.n > 0 || golds === 2)) break; }
        await page.waitForTimeout(1500);
        const xs = await page.evaluate(() => window.__xs);
        check(`덱 2단계: S4 황금 ${golds}개 강타에서 ${want.length ? '×3이 한 번 뜬다' : '발동 글자가 안 뜬다'}`, ok && JSON.stringify(xs) === JSON.stringify(want), JSON.stringify(xs));
        await ctx.close();
      }
      {
        const { ctx, page } = await newPage(browser, { version: 12, unlocked: DECK2, moves: 1, guide: GUIDE_DONE });
        await page.waitForTimeout(500);
        await deck2Set(page, ['F3']);
        await page.evaluate(() => window.__ajd.fever());
        await page.waitForTimeout(300);
        const before = await page.evaluate(() => window.__ajd.get().fever.activeSec);
        await observeX(page);
        await page.evaluate(() => { window.__ajd.zone(0.5); window.__ajd.charge(0.5); });
        for (let i = 0; i < 60 && (await page.evaluate(() => window.__xs.length)) === 0; i++) await page.waitForTimeout(50);
        await page.waitForTimeout(100);
        const after = await page.evaluate(() => ({ t: window.__ajd.get().fever.activeSec, xs: window.__xs, color: document.querySelector('.deck-x') ? getComputedStyle(document.querySelector('.deck-x')).color : '' }));
        check('덱 2단계: F3 피버 중 퍼펙트에 +2초가 한 번 뜨고 피버 남은 시간이 늘어난다', after.xs.length === 1 && after.xs[0] === '+2초' && after.t > before + 0.5, JSON.stringify({ before, after }));
        const tagTxt = await text(page, '.fever-tag');
        check('덱 2단계: 피버 칩이 늘어난 시간을 바로 보인다', num(tagTxt.split('·')[1]) >= Math.ceil(after.t) - 1, tagTxt);
        await ctx.close();
      }
      {
        const { ctx, page } = await newPage(browser, { version: 12, unlocked: DECK2, moves: 1, guide: GUIDE_DONE });
        await page.waitForTimeout(500);
        await deck2Set(page, ['F3']);
        await setS(page, { settings: { ...(await gs(page)).settings, reduceMotion: true } });
        await page.evaluate(() => window.__ajd.fever());
        await page.waitForTimeout(300);
        await page.evaluate(() => { window.__ajd.zone(0.5); window.__ajd.charge(0.5); });
        const t0 = Date.now();
        let lit = false; let still = false; let anim = -1; let litGone = 0; let markGone = 0; let particles = 0;
        for (let i = 0; i < 40; i++) {
          const st = await page.evaluate(() => { const m = document.querySelector('.deck-x'); const sl = document.querySelector('.deck-slot.on'); return { mark: !!m, still: !!m?.classList.contains('still'), lit: !!sl?.classList.contains('lit'), anim: (m?.getAnimations().length ?? 0) + (sl?.getAnimations().length ?? 0) }; });
          if (st.mark) { still = st.still; if (anim < 0 || st.anim > anim) anim = st.anim; }
          if (st.lit) lit = true;
          if (lit && !st.lit && !litGone) litGone = Date.now() - t0;
          if (still && !st.mark && !markGone) { markGone = Date.now() - t0; break; }
          await page.waitForTimeout(50);
        }
        check('덱 2단계: 움직임 줄이기에서 발동은 테두리 색 300ms + 제자리 글자 1초(튐·움직임 없음)', lit && still && anim === 0 && litGone >= 250 && litGone <= 700 && markGone >= 900 && markGone <= 1500, JSON.stringify({ lit, still, anim, litGone, markGone }));
        await ctx.close();
      }
      {
        const { ctx, page } = await newPage(browser, { version: 12, unlocked: DECK2, moves: 1, guide: GUIDE_DONE });
        await page.waitForTimeout(500);
        await deck2Set(page, ['F3']);
        await setS(page, { fever: { gauge: 0, activeSec: 25, cooldownSec: 0 } });
        await page.waitForTimeout(400);
        const g = await page.evaluate(() => { const bar = document.querySelector('.fv-bar').getBoundingClientRect(); const cells = [...document.querySelectorAll('.fv-cell')]; const on = cells.filter((c) => c.classList.contains('on')).length; const maxR = Math.max(...cells.map((c) => c.getBoundingClientRect().right)); const tag = document.querySelector('.fever-tag').getBoundingClientRect(); const room = document.querySelector('.room, .room-wrap')?.getBoundingClientRect(); return { n: cells.length, on, over: maxR > bar.right + 1, tagOver: !!room && tag.right > room.right + 1, hs: document.documentElement.scrollWidth > document.documentElement.clientWidth }; });
        check('덱 2단계: 피버 남은 시간이 피버 길이보다 길어도 띠가 넘치지 않고 가득 찬다', g.on === g.n && !g.over && !g.tagOver && !g.hs, JSON.stringify(g));
        await deck2Set(page, ['F2']);
        await setS(page, { fever: { gauge: 0, activeSec: 9, cooldownSec: 0 } });
        await page.waitForTimeout(400);
        const h = await page.evaluate(() => { const cells = [...document.querySelectorAll('.fv-cell')]; return { n: cells.length, on: cells.filter((c) => c.classList.contains('on')).length }; });
        check('덱 2단계: 숯불 유지(+8초)를 끼면 피버 띠가 18초 기준으로 줄어든다(9초 = 절반)', Math.abs(h.on - h.n / 2) <= 1, JSON.stringify(h));
        await ctx.close();
      }
      {
        const { ctx, page } = await newPage(browser, { version: 11, unlocked: ALL, moves: 2, earned: 1e6, points: 1e6, guide: GUIDE_DONE });
        await page.waitForTimeout(800);
        const sv = await gs(page);
        check('덱: v11 저장(moves > 0)으로 열면 대기 묶음이 1개 있고 카드 고르기 버튼이 뜬다', sv.deck.offers.length === 1 && sv.deck.offers[0].length === 3 && (await vis(page, '.deck-alert')), JSON.stringify(sv.deck));
        await ctx.close();
      }
    }


    // ---- 공구함 덱 3단계(화면): 충전 막대 · 공구함 ×N · 카드 완성 · 덱 완성 · 배율 내역 · 교체 ----
    {
      // moves 5의 필요 눈금: 일반 40 x 0.4 = 16, 레어 50 x 0.4 = 20(눈금이 필요 눈금에 닿으면 바로 넘쳐 스택 +1)
      const NEED = 16;
      const RARE = 20;
      const charged = (page, slots, offers = []) => page.evaluate(([sl, of]) => { window.__ajd.guide('done'); const s = window.__ajd.get(); window.__ajd.set({ ...s, moves: 5, unlocked: ['tap', 'home', 'box', 'dex', 'mult', 'badge', 'perk', 'deck', 'fever', 'special'], deck: { ...s.deck, slots: sl.map((x) => ({ id: x[0], star: 1, charge: x[1], stacks: 0 })), offers: of } }); }, [slots, offers]);
      const perfectHit = (page) => page.evaluate(() => { window.__ajd.zone(0.5); window.__ajd.charge(0.5); });
      const watch = (page) => page.evaluate(() => { window.__xs = []; window.__bn = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) { if (n.classList?.contains('deck-x')) window.__xs.push(n.textContent); if (n.classList?.contains('fx-banner')) window.__bn.push(n.textContent); } }).observe(document.body, { childList: true, subtree: true }); });
      const px = (page) => page.evaluate(() => [...document.querySelectorAll('.deck-row .deck-bar i')].map((i) => parseInt(i.style.width || '0', 10)));
      {
        const { ctx, page } = await newPage(browser, { version: 13, unlocked: [...ALL, 'deck', 'special', 'fever'], moves: 5, guide: { step: 18, n: 0, done: true } });
        await page.waitForTimeout(500);
        await charged(page, [['P1', 3], ['C1', 0]]);
        await page.waitForTimeout(400);
        const w0 = await px(page);
        const head0 = await text(page, '.badge');
        await perfectHit(page);
        await page.waitForTimeout(800);
        const w1 = await px(page);
        const sv = await gs(page);
        check('덱 3단계: 퍼펙트 강타로 정밀 카드의 충전 막대가 오른다(연쇄 카드는 그대로)', w1[0] > w0[0] && w1[1] === w0[1] && sv.deck.slots[0].charge === 7, JSON.stringify([w0, w1]));
        check('덱 3단계: 카드 줄 오른쪽에 공구함 ×N 숫자', /^×/.test(await text(page, '.deck-mult')) && (await text(page, '.deck-title')) === '공구함', await text(page, '.deck-mult'));
        check('덱 3단계: 칸 아래 충전 막대는 칸마다 4px', await page.evaluate(() => [...document.querySelectorAll('.deck-row .deck-bar')].every((b) => b.getBoundingClientRect().height === 4)));
        await page.evaluate((n) => window.__ajd.deckCharge(n), NEED);
        await page.waitForTimeout(500);
        check('덱 3단계: 머리 총 배율 칩은 덱 충전으로 안 변한다', (await text(page, '.badge')) === head0, `${head0} -> ${await text(page, '.badge')}`);
        await page.locator('.badge').click();
        await page.waitForSelector('.modal');
        const mp = await text(page, '.modal');
        check('덱 3단계: 배율 내역 창에 공구함(이 집) 줄이 총 배율 아래에 있다', mp.includes('공구함(이 집)') && mp.indexOf('공구함(이 집)') > mp.indexOf('총 배율'), mp.replace(/\n/g, ' ').slice(0, 140));
        await ctx.close();
      }
      {
        const { ctx, page } = await newPage(browser, { version: 13, unlocked: [...ALL, 'deck', 'special', 'fever'], moves: 5, guide: { step: 18, n: 0, done: true } });
        await page.waitForTimeout(500);
        await charged(page, [['P1', NEED - 1], ['C1', 0]]);
        await page.waitForTimeout(400);
        await watch(page);
        await perfectHit(page);
        await page.waitForTimeout(1200);
        const xs = await page.evaluate(() => window.__xs);
        const t = await text(page, '.deck-mult');
        check('덱 3단계: 눈금이 차 넘치면 칸 위에 ×4.6이 한 번 뜨고 공구함 숫자가 ×4.6이 된다(스택 1)', xs.filter((x) => x === '×4.6').length === 1 && t === '×4.6', JSON.stringify([xs, t]));
        check('덱 3단계: 넘치면 막대가 노랑 넘침 색(ov)으로 다시 찬다', (await page.locator('.deck-bar.ov').count()) === 1);
        await page.locator('.deck-row').click();
        await page.waitForTimeout(400);
        const tb = await text(page, '.deck-panel');
        check('덱 3단계: 공구함 탭에 배율 큰 숫자·지금/최대·충전 방법', tb.includes('공구함 배율') && tb.includes('지금 ×4.6') && tb.includes('최대 ×4') && tb.includes('퍼펙트 강타로 충전') && tb.includes('긴 연쇄로 충전'), tb.replace(/\n/g, ' ').slice(0, 160));
        await ctx.close();
      }
      {
        const { ctx, page } = await newPage(browser, { version: 13, unlocked: [...ALL, 'deck', 'special', 'fever'], moves: 5, guide: { step: 18, n: 0, done: true } });
        await page.waitForTimeout(500);
        await charged(page, [['P1', NEED - 1], ['P3', NEED], ['F3', RARE], ['C1', NEED]]);
        await page.waitForTimeout(400);
        await watch(page);
        await perfectHit(page);
        await page.waitForTimeout(5000);
        const bn = await page.evaluate(() => window.__bn);
        check('덱 3단계: 덱이 다 차면 큰 글자 "공구함 완성 ×N"이 한 번 뜬다', bn.filter((b) => /공구함 완성 ×\d+/.test(b)).length === 1, JSON.stringify(bn));
        await ctx.close();
      }
      {
        const { ctx, page } = await newPage(browser, { version: 13, unlocked: [...ALL, 'deck', 'special', 'fever'], moves: 5, guide: { step: 18, n: 0, done: true } });
        await page.waitForTimeout(500);
        await charged(page, [['P1', 9], ['P3', 5], ['C1', 7], ['S3', 3]], [['C3', 'F1', 'S1']]);
        await page.waitForTimeout(400);
        await page.locator('.deck-alert').click();
        await page.waitForSelector('.modal.deck-pick .pcard');
        await page.waitForTimeout(1500);
        check('덱 3단계: 고르기 창 카드마다 충전 방법 한 줄', (await page.locator('.deck-pick .pc-how').count()) === 3);
        await page.locator('.deck-pick .pcard').first().click();
        await page.waitForTimeout(500);
        const rt = await text(page, '.modal-body');
        check('덱 3단계: 교체 화면에 칸마다 지금 배수와 충전 소멸 안내', (rt.match(/지금 ×/g) || []).length === 4 && rt.includes('충전이 사라져요'), rt.replace(/\n/g, ' ').slice(0, 160));
        await page.locator('.deck-pick .pcard').nth(1).click();
        await page.waitForTimeout(1200);
        const sv = await gs(page);
        check('덱 3단계: 교체하면 그 칸의 충전은 0, 나머지는 그대로', sv.deck.slots.map((x) => `${x.id}:${x.charge}`).join() === 'P1:9,C3:0,C1:7,S3:3', sv.deck.slots.map((x) => `${x.id}:${x.charge}`).join());
        await ctx.close();
      }
    }


    // ---- 특별 상자 설명 창 + 처음 만날 때 토스트 ----
    {
      const { ctx, page } = await newPage(browser, { version: 13, unlocked: [...ALL, 'deck', 'special', 'fever'], moves: 1, guide: { step: 18, n: 0, done: true } });
      await setS(page, { points: 1e6, earned: 1e5, tapLevel: 80, unpack: { box: 30, damage: 1e15 } });
      await page.waitForTimeout(500);
      await page.waitForTimeout(2800);
      await page.locator('.gear-loupe').scrollIntoViewIfNeeded();
      const ib = await page.locator('.gear-loupe .gear-info').boundingBox();
      check('특별 상자: 돋보기 카드에 i 버튼(누르는 영역 44px 이상)', !!ib && ib.width + 32 >= 44 && ib.height + 32 >= 44, JSON.stringify(ib));
      check('특별 상자: 돋보기 카드가 잘리거나 강화 버튼과 겹치지 않는다', await page.evaluate(() => { const c = document.querySelector('.gear-loupe'); const i = c.querySelector('.gear-info').getBoundingClientRect(); const b = c.querySelector('.btn.buy').getBoundingClientRect(); const cr = c.getBoundingClientRect(); const ok = i.right <= b.left && i.left >= cr.left && i.right <= cr.right && i.width > 0; const info = c.querySelector('.card-info'); return ok && info.scrollWidth <= info.clientWidth + 1; }));
      await page.screenshot({ path: path.join(SHOTS, 'special', '390-1-card.png') });
      await page.locator('.gear-loupe .gear-info').click();
      await page.waitForSelector('.modal');
      const mt = await text(page, '.modal');
      check('특별 상자: 창 제목·확률·3종 줄이 보인다', mt.includes('특별 상자') && /지금 확률 \d/.test(mt) && mt.includes('집마다 처음 20개에는 안 나와요') && ['황금 상자', '폭탄 상자', '시계 상자'].every((n) => mt.includes(n)) && (await page.locator('.modal .sp-row img').count()) === 3, mt.replace(/\n/g, ' '));
      check('특별 상자: 창에 ✕ 없고 닫기 버튼 하나', (await page.locator('.modal .modal-actions .btn').count()) === 1 && (await text(page, '.modal .modal-actions .btn')) === '닫기');
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(SHOTS, 'special', '390-2-modal.png') });
      await page.locator('.modal .modal-actions .btn').click();
      await page.waitForTimeout(300);
      check('특별 상자: 닫기를 누르면 창이 닫힌다', (await page.locator('.modal').count()) === 0);
      await page.evaluate(() => { window.scrollTo(0, 0); window.__ajd.special('gold', 0); });
      await page.waitForTimeout(600);
      const mm = await mid(page);
      await page.mouse.click(mm.x, mm.y);
      await page.waitForFunction(() => Array.from(document.querySelectorAll('.toast')).some((e) => e.textContent.includes('황금 상자 ·')), null, { timeout: 4000 }).catch(() => {});
      const t1 = await page.evaluate(() => Array.from(document.querySelectorAll('.toast')).map((e) => e.textContent).join('|'));
      check('특별 상자: 처음 터질 때 토스트 "황금 상자 · 보상 x10"', t1.includes('황금 상자 · 보상 x10'), t1);
      await page.screenshot({ path: path.join(SHOTS, 'special', '390-3-toast.png') });
      await page.waitForTimeout(3200);
      await page.evaluate(() => window.__ajd.special('gold', 0));
      await page.waitForTimeout(600);
      await page.mouse.click(mm.x, mm.y);
      await page.waitForTimeout(2500);
      const t2 = await page.evaluate(() => Array.from(document.querySelectorAll('.toast')).map((e) => e.textContent).join('|'));
      check('특별 상자: 두 번째로 터질 때는 토스트가 없다', !t2.includes('황금 상자 ·'), t2);
      check('특별 상자: 본 종류는 별도 키에 적히고 게임 저장은 그대로', await page.evaluate(() => JSON.parse(localStorage.getItem('ajd-home-idle:seen-special')).join() === 'gold' && !('seenSpecial' in JSON.parse(localStorage.getItem('ajd-home-idle:save')))));
      await ctx.close();
    }


    // ---- 덱 5단계 화면: 확률 · ★ 올리기 · 공명 · 전설 · P4 · S2 · 겹침 ----
    {
      const d5 = ['tap', 'home', 'box', 'dex', 'mult', 'badge', 'perk', 'deck', 'fever', 'special'];
      const d5Set = (page, slots, offers = [], buff = {}) => page.evaluate(([sl, of, bf]) => { window.__ajd.guide('done'); const s = window.__ajd.get(); window.__ajd.set({ ...s, moves: 1, unlocked: ['tap', 'home', 'box', 'dex', 'mult', 'badge', 'perk', 'deck', 'fever', 'special'], deck: { ...s.deck, slots: sl.map((x) => ({ id: x[0], charge: x[1] || 0, star: x[2] || 1 })), offers: of, buff: { ...s.deck.buff, ...bf } } }); }, [slots, offers, buff]);
      {
        const { ctx, page } = await newPage(browser, { version: 15, unlocked: d5, moves: 1, guide: { step: 18, n: 0, done: true } });
        await page.waitForTimeout(500);
        const e0 = errors.length;
        await d5Set(page, [], [['P2', 'C1', 'P3']]);
        await page.waitForTimeout(400);
        await page.locator('.deck-alert').click();
        await page.waitForSelector('.modal.deck-pick .pcard');
        await page.waitForTimeout(1500);
        const ob = await page.locator('.deck-pick .deck-odds-btn').boundingBox();
        check('덱 5단계: 고르기 창에 확률 버튼(누르는 영역 48px)', !!ob && ob.width >= 48 && ob.height >= 48, JSON.stringify(ob));
        await page.locator('.deck-pick .deck-odds-btn').click();
        await page.waitForTimeout(300);
        const ot = await text(page, '.modal');
        check('덱 5단계: 확률 창에 일반 60% · 레어 32% · 전설 8%', ot.includes('일반 60% · 레어 32% · 전설 8%') && ot.includes('카드 3장을 따로 뽑아요'), ot.replace(/\n/g, '|'));
        await page.locator('.modal .modal-actions .btn', { hasText: '돌아가기' }).click();
        await page.waitForTimeout(300);
        check('덱 5단계: 확률 창에서 돌아가면 같은 묶음 3장', (await page.locator('.deck-pick .pcard').count()) === 3);
        await d5Set(page, [['P2', 0], ['C1', 0], ['P3', 0], ['S3', 0]], [['P2', 'C4', 'C3']]);
        await page.waitForTimeout(300);
        await page.locator('.modal .modal-actions .btn', { hasText: '나중에 고르기' }).click().catch(() => {});
        await page.waitForTimeout(300);
        await page.locator('.dock [data-ux="deck"]').click();
        await page.waitForTimeout(500);
        await page.locator('.deck-odds-btn', { hasText: '확률 보기' }).click();
        await page.waitForTimeout(300);
        const ot2 = await text(page, '.modal');
        check('덱 5단계: 공구함 패널의 확률 보기도 같은 창(60·32·8%)', ot2.includes('60%') && ot2.includes('32%') && ot2.includes('8%') && (await page.locator('.modal .modal-actions .btn', { hasText: '닫기' }).count()) === 1);
        await page.locator('.modal .modal-actions .btn', { hasText: '닫기' }).click();
        await page.waitForTimeout(300);
        await page.locator('.deck-alert').click();
        await page.waitForSelector('.modal.deck-pick .pcard');
        await page.waitForTimeout(1500);
        const up = await page.evaluate(() => { const c = document.querySelector('.pcard[data-card="P2"]'); return { btn: c.querySelector('.pick-btn').textContent, lv: c.querySelector('.pc-lv').textContent, disabled: c.disabled, other: document.querySelector('.pcard[data-card="C4"] .pick-btn').textContent }; });
        check('덱 5단계: 낀 카드 후보는 "★ 올리기"와 "칸 안 씀 / 최대 ×4 → ×5"', up.btn === '★ 올리기' && up.lv.includes('칸 안 씀') && up.lv.includes('최대 ×4 → ×5') && !up.disabled && up.other === '고르기', JSON.stringify(up));
        const vp0 = page.viewportSize();
        for (const w of [390, 360]) {
          await page.setViewportSize({ width: w, height: vp0.height });
          await page.waitForTimeout(400);
          const fit = await page.evaluate(() => { const g = document.querySelector('.deck-pick .pcards'); const m = document.querySelector('.deck-pick .modal-body') || document.querySelector('.deck-pick'); const mr = m.getBoundingClientRect(); const cs = [...document.querySelectorAll('.deck-pick .pcard')].map((c) => c.getBoundingClientRect().right); return { sw: g.scrollWidth, cw: g.clientWidth, msw: m.scrollWidth, mcw: m.clientWidth, n: cs.length, over: cs.some((r) => r > mr.right + 0.5), vw: window.innerWidth }; });
          check(`덱 5단계: ★ 올리기 후보가 든 고르기가 ${w}폭 창 안에 들어간다(가로 스크롤 없음)`, fit.n === 3 && fit.sw <= fit.cw && fit.msw <= fit.mcw && !fit.over, JSON.stringify(fit));
        }
        await page.setViewportSize(vp0);
        await page.waitForTimeout(300);
        await page.locator('.pcard[data-card="P2"]').click();
        await page.waitForTimeout(2200);
        const sv = await gs(page);
        check('덱 5단계: ★ 올리기는 칸이 다 차 있어도 교체 화면 없이 칸 수 그대로·★2', sv.deck.slots.length === 4 && sv.deck.slots[0].star === 2 && (await page.locator('.modal').count()) === 0, JSON.stringify(sv.deck.slots));
        check('덱 5단계: 카드 줄 첫 칸에 ★ 점 2개', (await page.locator('.deck-slot').first().locator('.deck-stars i').count()) === 2);
        await page.locator('.deck-row').click();
        await page.waitForTimeout(500);
        const pt = await text(page, '.deck-panel');
        check('덱 5단계: 패널에 "최대 ×5"와 공명 줄', pt.includes('최대 ×5') && pt.includes('정밀 2장') && pt.includes('충전 ×1.5'), pt.replace(/\n/g, '|').slice(0, 300));
        check('덱 5단계: 공명 걸린 카드의 막대는 res(주황 깜빡임) 표시', (await page.locator('.deck-row .deck-bar.res').count()) >= 2);
        await d5Set(page, [['P2', 0]]);
        await page.waitForTimeout(500);
        check('덱 5단계: 공명이 없으면 안내 한 줄', (await text(page, '.deck-panel')).includes('같은 태그를 2장 모으면 충전이 빨라져요'));
        // 전설이 든 고르기
        await d5Set(page, [['P2', 0]], [['P5', 'A1', 'F5']]);
        await page.waitForTimeout(400);
        await page.evaluate(() => { window.__deckSlow = 1; });
        await page.locator('.dock [data-ux="deck"]').click().catch(() => {});
        await page.locator('.deck-alert, .dp-pick').first().click();
        await page.waitForSelector('.modal.deck-pick .pcard');
        await page.waitForTimeout(2200);
        check('덱 5단계: 전설 카드가 든 고르기가 오류 없이 열린다', errors.length === e0 && (await page.locator('.deck-pick .pcard.r-legend').count()) === 3, errors.slice(e0).join('|'));
        const lg = await page.evaluate(() => { const c = document.querySelector('.pcard[data-card="P5"] .pface'); return getComputedStyle(c).animationName; });
        check('덱 5단계: 전설 앞면은 노랑 테두리 깜빡임 애니메이션', lg === 'legblink', lg);
        await ctx.close();
      }
      {
        const { ctx, page } = await newPage(browser, { version: 15, unlocked: d5, moves: 1, guide: { step: 18, n: 0, done: true } });
        await page.waitForTimeout(500);
        await d5Set(page, [['P4', 0]]);
        await page.waitForTimeout(500);
        await page.evaluate(() => window.__ajd.shield(0, 6));
        const n = () => page.locator('.shield .sh-cell.on').count();
        for (let i = 0; i < 5; i++) { await page.evaluate(() => { window.__ajd.zone(0.5); window.__ajd.charge(0.5); }); await page.waitForTimeout(250); }
        const n5 = await n();
        await page.evaluate(() => { window.__ajd.zone(0.5); window.__ajd.charge(0.5); });
        await page.waitForTimeout(500);
        const n6 = await n();
        check('덱 5단계: P4를 끼면 퍼펙트 6번째에 실드가 찬다(5번째까지는 안 참)', n5 === 0 && n6 === 1, `${n5} -> ${n6}`);
        await ctx.close();
      }
      {
        const { ctx, page } = await newPage(browser, { version: 15, unlocked: d5, moves: 1, guide: { step: 18, n: 0, done: true } });
        await setS(page, { points: 1e6, earned: 1e5, tapLevel: 80, unpack: { box: 30, damage: 1e15 } });
        await page.waitForTimeout(500);
        await d5Set(page, [['S2', 0]]);
        await page.waitForTimeout(2800);
        await page.locator('.gear-loupe').scrollIntoViewIfNeeded();
        await page.locator('.gear-loupe .gear-info').click();
        await page.waitForSelector('.modal');
        const sp = await text(page, '.modal');
        check('덱 5단계: S2를 끼면 특별 상자 창의 폭탄 문구가 "상자 8개"', sp.includes('상자 8개') && !sp.includes('상자 5개'), sp.replace(/\n/g, '|').slice(0, 200));
        await ctx.close();
      }
      for (const [w, h] of [[390, 844], [360, 800]]) {
        const { ctx, page } = await newPage(browser, { version: 15, unlocked: d5, moves: 1, guide: { step: 18, n: 0, done: true } }, '?debug', { viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        await page.waitForTimeout(500);
        await d5Set(page, [['C5', 20, 3], ['P3', 30, 2], ['P4', 12, 3], ['A1', 8, 3]], [], { nextStrike: true });
        await page.waitForTimeout(700);
        const g = await page.evaluate(() => {
          const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
          const side = document.querySelector('.deck-side').getBoundingClientRect();
          const cells = [...document.querySelectorAll('.deck-cell')];
          let bad = [];
          cells.forEach((c, i) => {
            const slot = c.querySelector('.deck-slot').getBoundingClientRect();
            const bar = c.querySelector('.deck-bar')?.getBoundingClientRect();
            const st = c.querySelector('.deck-stars')?.getBoundingClientRect();
            if (st && (st.left < slot.left || st.right > slot.right || st.top < slot.top || st.bottom > slot.bottom)) bad.push('stars-out' + i);
            if (st && bar && hit(st, bar)) bad.push('stars-bar' + i);
            if (st && hit(st, side)) bad.push('stars-side' + i);
            if (bar && hit(bar, side)) bad.push('bar-side' + i);
            if (hit(slot, side)) bad.push('slot-side' + i);
          });
          const row = document.querySelector('.deck-row');
          return { bad, over: document.documentElement.scrollWidth > document.documentElement.clientWidth, rowOver: row.scrollWidth > row.clientWidth + 1, armed: document.querySelectorAll('.deck-slot.armed').length, stars: [...document.querySelectorAll('.deck-stars')].map((x) => x.querySelectorAll('i').length).join() };
        });
        check(`덱 5단계 ${w}폭: 카드 줄 ★ 점·충전 막대·"공구함 ×N"이 겹치지 않고 넘치지 않는다`, g.bad.length === 0 && !g.over && !g.rowOver && g.stars === '3,2,3,3', JSON.stringify(g));
        check(`덱 5단계 ${w}폭: 장전된 C5 칸에 주황 깜빡임(armed)`, g.armed === 1);
        await ctx.close();
      }
    }


    // ---- 덱 스택(넘침) 화면 ----
    {
      const UN = [...ALL, 'deck', 'fever', 'special'];
      const GD = { step: 18, n: 0, done: true };
      const stackSet = (page, slots, ex = {}) => page.evaluate(([sl, ex2, un]) => { window.__ajd.guide('done'); const s = window.__ajd.get(); window.__ajd.set({ ...s, moves: 1, unlocked: un, deck: { ...s.deck, offers: [], boostPacks: 0, ...ex2, slots: sl.map(([id, stacks, charge = 0]) => ({ id, star: 1, charge, stacks })) } }); window.__ajd.rush(0); }, [slots, ex, UN]);
      const badges = (page) => page.evaluate(() => [...document.querySelectorAll('.deck-slot')].map((s) => { const b = s.querySelector('.deck-stack'); return b && !b.hidden ? `${b.textContent}/${b.dataset.tier}` : ''; }));
      const SH = path.join(SHOTS, 's1-390-');
      const need = (page, i) => page.evaluate((k) => Number(document.querySelectorAll('.deck-bar')[k].dataset.charge.split('/')[1]), i);
      {
        const { ctx, page } = await newPage(browser, { version: 16, unlocked: UN, moves: 1, guide: GD });
        await page.waitForTimeout(600);
        await stackSet(page, [['P2', 3], ['P3', 12], ['C1', 27], ['S3', 0, 5]]);
        await page.waitForTimeout(700);
        const b = await badges(page);
        check('스택: 저장에 스택이 있으면 배지 숫자·단계가 맞게 보인다(3·12·27, 0은 없음)', b.join('|') === '×3/0|×12/1|×27/2|', b.join('|'));
        const ov = await page.evaluate(() => [...document.querySelectorAll('.deck-bar')].map((e) => e.classList.contains('ov')).join());
        check('스택: 스택이 붙은 막대는 넘침 색(ov), 안 붙은 막대는 아님', ov === 'true,true,true,false', ov);
        const sum = await text(page, '.deck-ss');
        check('스택: 덱 줄 옆에 스택 합(42)이 보인다', sum.includes('42'), sum);
        await page.screenshot({ path: SH + 'row.png' });
        await stackSet(page, [['P2', 300], ['P3', 99], ['C1', 30], ['S3', 1]]);
        await page.waitForTimeout(700);
        const geo = await page.evaluate(() => [...document.querySelectorAll('.deck-slot')].map((s) => { const b = s.querySelector('.deck-stack').getBoundingClientRect(); const r = s.getBoundingClientRect(); const el = s.querySelector('.deck-stack'); return { l: b.left - r.left, r: b.right - r.right, fit: el.scrollWidth <= el.clientWidth + 1, vp: b.right <= innerWidth && b.left >= 0 }; }));
        check('스택: 스택 300·99도 배지 글자가 안 잘리고 칸 왼쪽으로 나가지 않는다', geo.every((g) => g.vp && g.l >= -2), JSON.stringify(geo));
        await page.screenshot({ path: SH + 'row-300.png' });
        await ctx.close();
      }
      {
        // 강타로 스택이 오른다: 배지 숫자 · 연출 클래스 붙었다 떨어짐 · 연속 사진
        const { ctx, page } = await newPage(browser, { version: 16, unlocked: UN, moves: 1, guide: GD });
        await page.waitForTimeout(600);
        await stackSet(page, [['P2', 3], ['P3', 12], ['C1', 27], ['S3', 0, 5]]);
        await page.waitForTimeout(600);
        const n0 = await need(page, 0);
        const nextNeed = n0 * 1.15 ** 3;
        await stackSet(page, [['P2', 3, Math.floor(nextNeed) - 1], ['P3', 12], ['C1', 27], ['S3', 0, 5]]);
        await page.waitForTimeout(600);
        await page.evaluate(() => { window.__deckSlow = 2; window.__cls = []; new MutationObserver((ms) => { for (const m of ms) if (m.attributeName === 'class' && m.target.classList.contains('stack-up') && !m.oldValue?.includes('stack-up')) window.__cls.push(performance.now()); }).observe(document.querySelector('.deck-row'), { attributes: true, subtree: true, attributeOldValue: true }); window.__ajd.zone(0.5); window.__ajd.charge(0.5); });
        await page.waitForSelector('.deck-slot.stack-up', { timeout: 15000 });
        for (let i = 1; i <= 8; i++) await page.screenshot({ path: `${SH}up-0${i}.png`, clip: { x: 0, y: 380, width: 390, height: 464 } });
        await page.waitForTimeout(1500);
        const st = (await gs(page)).deck.slots;
        const b = await badges(page);
        check('스택: 강타로 스택이 오르면 배지 숫자가 오른다', st[0].stacks >= 4 && b[0].startsWith(`×${st[0].stacks}/`), JSON.stringify([st.map((x) => x.stacks), b]));
        check('스택: 연출 클래스가 붙었다 떨어진다', (await page.evaluate(() => window.__cls.length)) >= 1 && (await page.locator('.deck-slot.stack-up').count()) === 0 && (await page.locator('.deck-stack.up').count()) === 0);
        // 한꺼번에 여러 스택: +N으로 합쳐 보인다
        await page.evaluate(() => { window.__xs = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('stack-plus')) window.__xs.push(n.textContent); }).observe(document.querySelector('.deck-row'), { childList: true, subtree: true }); });
        await stackSet(page, [['P2', st[0].stacks, 0], ['P3', 12], ['C1', 27], ['S3', 0, 5]]);
        await page.waitForTimeout(300);
        await page.evaluate((n) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, deck: { ...s.deck, slots: s.deck.slots.map((x, i) => (i === 1 ? { ...x, stacks: x.stacks + n } : x)) } }); window.__ajd.rush(0); }, 3);
        await page.waitForTimeout(1200);
        const xs = await page.evaluate(() => window.__xs);
        check('스택: 한 번에 3 오르면 "+3"으로 합쳐 한 번만 보인다', xs.join() === '+3', xs.join());
        // 연타해도 카드당 연출은 0.15초에 한 번
        await page.evaluate(() => { window.__deckSlow = 1; window.__cls.length = 0; });
        for (let i = 0; i < 10; i++) {
          await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, deck: { ...s.deck, slots: s.deck.slots.map((x, j) => (j === 2 ? { ...x, stacks: x.stacks + 1 } : x)) } }); window.__ajd.rush(0); });
          await page.waitForTimeout(25);
        }
        await page.waitForTimeout(900);
        const cl = await page.evaluate(() => ({ n: window.__cls.length, t: window.__cls.slice() }));
        const fin = (await gs(page)).deck.slots[2].stacks;
        const fb = await badges(page);
        check('스택: 10번 연속 올라도 연출은 묶여 4번 이하이고 배지는 끝 값에 닿는다', cl.n >= 1 && cl.n <= 4 && fb[2].startsWith(`×${fin}/`), JSON.stringify([cl.n, fin, fb[2]]));
        await ctx.close();
      }
      {
        // 강화 고르기 + 패널 + 교체 + 규칙 안내
        const { ctx, page } = await newPage(browser, { version: 16, unlocked: UN, moves: 1, guide: GD });
        await page.waitForTimeout(600);
        await stackSet(page, [['P2', 3], ['P3', 12], ['C1', 27], ['S3', 0, 5]], { boostPacks: 1, boostMade: 1, chargedStacks: 6 });
        await page.waitForTimeout(700);
        check('강화: 묶음이 있으면 주황 알림 점과 "강화 고르기" 버튼이 뜬다', (await vis(page, '.deck-alert')) && (await text(page, '.deck-alert')).includes('강화 고르기') && (await page.locator('.dock [data-ux="deck"] .dot:visible').count()) === 1);
        await tab(page, 'deck').click();
        await page.waitForTimeout(500);
        const pt = await text(page, '.deck-panel');
        check('패널: 스택 합·카드별 스택·다음 스택 배수가 보인다', pt.includes('스택 합 42') && (await page.locator('.deck-panel .pr-stack').count()) === 4 && pt.includes('스택 12') && pt.includes('다음 ×') && pt.includes('다음 스택까지'), pt.slice(0, 200));
        const po = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        check('패널: 가로 넘침 없음', !po);
        await page.locator('.deck-panel .dp-list').scrollIntoViewIfNeeded();
        await page.evaluate(() => document.querySelector('.deck-panel .dp-list').scrollIntoView({ block: 'start' }));
        await page.waitForTimeout(200);
        await page.screenshot({ path: SH + 'panel.png', fullPage: false });
        await page.locator('.deck-panel .dp-pick').first().click();
        await page.waitForSelector('.modal.deck-pick .pcard');
        await page.waitForTimeout(1400);
        const bo = await page.evaluate(() => ({ n: document.querySelectorAll('.deck-pick .pcard').length, boost: document.querySelectorAll('.deck-pick .pcard.boostopt').length, title: document.querySelector('.modal-head h2')?.textContent, hs: document.documentElement.scrollWidth > document.documentElement.clientWidth }));
        check('강화: 3택 창이 뜨고 스택 +2 후보가 둘 있다', bo.n === 3 && bo.boost === 2 && bo.title.includes('강화 고르기') && !bo.hs, JSON.stringify(bo));
        await page.screenshot({ path: SH + 'boost.png' });
        const before = (await gs(page)).deck.slots.map((x) => x.stacks);
        const idx = await page.evaluate(() => [...document.querySelectorAll('.deck-pick .pcard')].findIndex((c) => c.classList.contains('boostopt')));
        await page.evaluate(() => { window.__cls = []; new MutationObserver((ms) => { for (const m of ms) if (m.attributeName === 'class' && m.target.classList.contains('stack-up') && !m.oldValue?.includes('stack-up')) window.__cls.push(1); }).observe(document.body, { attributes: true, subtree: true, attributeOldValue: true }); });
        await page.locator('.deck-pick .pcard').nth(idx).click();
        await page.waitForTimeout(2200);
        const after = (await gs(page)).deck;
        const diff = after.slots.map((x, i) => x.stacks - before[i]);
        check('강화: 고르면 그 카드에 스택 +2, 묶음이 줄고 창이 닫히고 연출이 난다', diff.filter((d) => d === 2).length === 1 && diff.filter((d) => d !== 0 && d !== 2).length === 0 && after.boostPacks === 0 && (await page.locator('.modal').count()) === 0 && (await page.evaluate(() => window.__cls.length)) >= 1, JSON.stringify([diff, after.boostPacks]));
        // 교체 화면: 이 칸의 스택 N -> 절반
        await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, deck: { ...s.deck, offers: [['C3', 'S1', 'C2']] } }); window.__ajd.rush(0); });
        await page.waitForTimeout(500);
        await page.locator('.deck-alert').click();
        await page.waitForSelector('.modal.deck-pick .pcard');
        await page.waitForTimeout(1400);
        await page.evaluate(() => { const c = [...document.querySelectorAll('.deck-pick .pcard')].find((x) => !x.classList.contains('maxed')); c.click(); });
        await page.waitForTimeout(600);
        const rp = await text(page, '.modal.deck-pick');
        check('교체: 칸마다 "스택 N → N/2"가 보인다', /스택 \d+ → \d+/.test(rp) && rp.includes('절반'), rp.slice(0, 160));
        await page.screenshot({ path: SH + 'replace.png' });
        await page.locator('.modal-actions .btn', { hasText: '돌아가기' }).click();
        await page.waitForTimeout(300);
        await page.locator('.deck-pick .deck-odds-btn').click();
        const od = await text(page, '.modal.deck-pick');
        check('규칙 안내: 확률 창에 스택 규칙 단락이 있다', od.includes('스택 +1') && od.includes('강화 고르기') && od.includes('절반'), od.slice(-120));
        await ctx.close();
      }
      {
        // 고르기가 여러 개 연달아(v15 저장에서 한꺼번에 열리는 경우)
        const { ctx, page } = await newPage(browser, { version: 16, unlocked: UN, moves: 1, guide: GD });
        await page.waitForTimeout(600);
        await stackSet(page, [['P2', 3], ['P3', 12]], { boostPacks: 4, boostMade: 4, chargedStacks: 24 });
        await page.waitForTimeout(700);
        await page.locator('.deck-alert').click();
        await page.waitForSelector('.modal.deck-pick .pcard');
        await page.waitForTimeout(1300);
        let ok = true; let seen = [];
        for (let i = 0; i < 4; i++) {
          const g = await page.evaluate(() => ({ t: document.querySelector('.modal-head h2')?.textContent, n: document.querySelectorAll('.deck-pick .pcard').length, hs: document.documentElement.scrollWidth > document.documentElement.clientWidth, out: [...document.querySelectorAll('.deck-pick .pcard')].some((c) => { const r = c.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1; }) }));
          seen.push(g.t);
          ok = ok && g.n === 3 && !g.hs && !g.out;
          await page.locator('.deck-pick .modal-actions .btn', { hasText: '건너뛰기' }).click();
          await page.waitForTimeout(i < 3 ? 1500 : 600);
        }
        check('강화: 묶음 4개가 연달아 떠도 3택이 깨지지 않고 "남은 묶음 N"이 줄어든다', ok && seen[0].includes('남은 묶음 4') && seen[3].includes('강화 고르기') && !seen[3].includes('남은') && (await page.locator('.modal').count()) === 0 && (await gs(page)).deck.boostPacks === 0, JSON.stringify(seen));
        await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, deck: { ...s.deck, offers: [['C3', 'C1', 'S1'], ['C3', 'C1', 'S1'], ['C2', 'C1', 'S1']] } }); window.__ajd.rush(0); });
        await page.waitForTimeout(500);
        await page.locator('.deck-alert').click();
        await page.waitForSelector('.modal.deck-pick .pcard');
        await page.waitForTimeout(1300);
        const g2 = await page.evaluate(() => ({ t: document.querySelector('.modal-head h2')?.textContent, n: document.querySelectorAll('.deck-pick .pcard').length }));
        check('카드 고르기: 묶음 3개가 연달아 떠도 3택이 안 깨진다', g2.n === 3 && g2.t.includes('남은 묶음 3'), JSON.stringify(g2));
        await ctx.close();
      }
      {
        // v15 저장을 불러온다
        const v15 = { version: 15, unlocked: UN, moves: 1, guide: GD, earned: 1e5, deck: { slots: [{ id: 'P2', star: 1, charge: 6 }, { id: 'P3', star: 2, charge: 14 }], offers: [['C3', 'C1', 'S1']], rerolls: 2, mark: 1, seen: [], buff: { nextStrike: false, forceBomb: false, perfects: 0, boxesInFever: 0 }, targetScale: 1 } };
        const { ctx, page } = await newPage(browser, v15);
        await page.waitForTimeout(900);
        const s = await gs(page);
        check('v15 저장: 불러오면 스택 0으로 이어지고 줄이 정상으로 뜬다', s.deck.slots.length === 2 && s.deck.slots.every((x) => x.stacks === 0) && (await page.locator('.deck-slot.on').count()) === 2 && (await badges(page)).every((x) => x === ''), JSON.stringify(s.deck.slots));
        await ctx.close();
      }
      for (const w of [360]) {
        const { ctx, page } = await newPage(browser, { version: 16, unlocked: UN, moves: 1, guide: GD }, '?debug', { ...MOBILE, viewport: { width: w, height: 800 } });
        await page.waitForTimeout(600);
        await stackSet(page, [['P2', 3], ['P3', 12], ['C1', 27], ['S3', 0, 5]]);
        await page.waitForTimeout(700);
        const g = await page.evaluate(() => { const side = document.querySelector('.deck-side').getBoundingClientRect(); const ss = document.querySelector('.deck-ss').getBoundingClientRect(); const title = document.querySelector('.deck-title'); return { over: document.documentElement.scrollWidth > document.documentElement.clientWidth, ssOut: ss.right > side.right + 1 || ss.left < side.left - 1, tOver: title.scrollWidth > title.clientWidth + 1, hit: [...document.querySelectorAll('.deck-stack')].some((b) => { const r = b.getBoundingClientRect(); return r.right > side.left + 4 && r.left < side.right; }) }; });
        check(`스택 ${w}폭: 스택 합·배지가 옆 글자와 겹치지 않고 넘치지 않는다`, !g.over && !g.ssOut && !g.tOver, JSON.stringify(g));
        await page.screenshot({ path: path.join(SHOTS, `s1-${w}-row.png`) });
        await ctx.close();
      }
    }


    // 이야기(인트로·도착 쪽지·엔딩·다시 보기)
    {
      const UNL = ['tap', 'home', 'box', 'dex', 'mult', 'badge', 'perk'];
      const seedAt = (moves) => ({ version: 9, unlocked: UNL, points: 5e9, earned: 1e60, moves, tapLevel: 12, strikeLevel: 4, gear: { level: 3 }, homeLv: [3, 2, 1, 0, 0, 0, 0, 0], unpack: { box: 40, damage: 0, roomDone: false, hp: 1e15, salt: 5, rushSec: 0 } });
      const clickMove = async (page) => { await page.locator('.move-btn').click(); await page.waitForSelector('.modal'); await page.locator('.modal .btn.primary').click(); };
      /** 이사 장면을 눌러 건너뛰며 selector가 뜰 때까지 기다린다 */
      const through = async (page, sel) => {
        for (let i = 0; i < 40; i++) {
          if (await page.locator(sel).count()) return true;
          if (await page.locator('.move-scene').count()) await page.mouse.click(100, 400).catch(() => {});
          await page.waitForTimeout(350);
        }
        return false;
      };
      const advance = (page) => page.evaluate(() => { document.querySelector('.story-ov .sn-next')?.click(); });
      const typed = (page) => page.waitForFunction(() => { const c = document.querySelector('.sn-pg.cur'); return !!c && c.querySelectorAll('.sn-off').length > 0 && [...c.querySelectorAll('.sn-off')].every((n) => n.textContent === ''); }, null, { timeout: 3000 });

      // 인트로(새 게임, 가이드 시작 전)
      for (const w of [390, 360]) {
        const { ctx, page } = await newPage(browser, null, '?debug&guide', { ...MOBILE, viewport: { width: w, height: 844 } }, true);
        await page.waitForSelector('.story-ov .sn-note');
        await typed(page);
        const info = await page.evaluate(() => { const n = document.querySelector('.sn-note').getBoundingClientRect(); const sk = document.querySelector('.sn-skip').getBoundingClientRect(); return { title: document.querySelector('.sn-title').textContent, txt: document.querySelector('.sn-pg.cur').textContent, bottom: n.bottom, h: innerHeight, skipH: sk.height, overW: document.documentElement.scrollWidth > document.documentElement.clientWidth }; });
        check(`인트로(${w}): 제목 "이삿날"·첫 문단, 창이 화면 안, 건너뛰기 44px 이상`, info.title === '이삿날' && info.txt.includes('오늘 원룸으로 이사 왔어요.') && info.bottom <= info.h + 1 && info.skipH >= 44 && !info.overW, JSON.stringify(info));
        if (w === 390) {
          const m = await mid(page);
          const s0 = await gs(page);
          await page.mouse.click(m.x, m.y);
          await page.mouse.click(m.x, m.y - 60);
          await page.waitForTimeout(200);
          const s1 = await gs(page);
          check('인트로 중 방을 눌러도 상자를 치지 않는다', s1.stats.totalTaps === 0 && s1.points === s0.points && s1.unpack.damage === 0, `taps=${s1.stats.totalTaps}`);
          check('인트로 중 머리글·토스트 층이 숨는다', await page.evaluate(() => { const l = document.querySelector('.fx-layer'); return !l || getComputedStyle(l).visibility === 'hidden'; }));
          // 위의 두 탭은 가림막에 닿아 문단을 넘겼다: 첫 탭 = 다음 문단, 둘째 탭 = 즉시 다 찍기
          await page.waitForTimeout(100);
          check('인트로: 가림막 탭으로 문단 2가 뜨고 보기 점 2번째', (await text(page, '.sn-pg.cur')).includes('보낸 사람 칸은 비어 있고요') && (await page.locator('.sn-dots i:nth-child(2).on').count()) === 1);
          await page.locator('.story-ov').click({ position: { x: 100, y: 120 } });
          await page.locator('.story-ov').click({ position: { x: 100, y: 120 } });
          await page.waitForTimeout(100);
          check('인트로: 마지막 문단 버튼은 "까 보기"', (await text(page, '.sn-next')) === '까 보기' && (await text(page, '.sn-pg.cur')).includes('일단 까 볼까요?'));
          await page.locator('.sn-next').click();
          await page.waitForSelector('.story-ov', { state: 'detached' });
          await page.waitForTimeout(500);
          const gd = await page.evaluate(() => ({ chip: document.querySelector('.guide-row .gd-chip')?.textContent, tip: document.body.innerText.includes('상자를 눌러서 열어요') }));
          const gs2 = await gs(page);
          check('인트로 닫힘: 가이드 1/18과 "상자를 눌러서 열어요" 말풍선이 이어진다', gd.chip === '가이드 1/18' && gd.tip && gs2.guide.step === 0 && gs2.story.intro === true, JSON.stringify(gd));
          await page.reload();
          await page.waitForSelector('.phone');
          await page.waitForTimeout(500);
          check('인트로는 한 번만(새로고침해도 안 뜬다)', (await page.locator('.story-ov').count()) === 0 && (await gs(page)).story.intro === true);
        } else {
          await page.locator('.sn-next').click();
          await page.locator('.sn-next').click();
          await typed(page);
          const fit = await page.evaluate(() => { const n = document.querySelector('.sn-note').getBoundingClientRect(); const p = document.querySelector('.sn-pg.cur .sn-p').getBoundingClientRect(); return p.right <= n.right && p.left >= n.left && n.bottom <= innerHeight + 1; });
          check('인트로(360): 문단이 창 안에 다 들어간다', fit);
        }
        await ctx.close();
      }

      // v16 저장을 불러와도 인트로가 안 뜬다
      {
        const { page: p0, ctx: c0 } = await newPage(browser);
        const base = await gs(p0);
        await c0.close();
        const { story, ...rest } = base;
        void story;
        const seed = { ...rest, version: 16, stats: { ...rest.stats, totalTaps: 20 }, guide: { step: 3, n: 0, done: false } };
        const { ctx, page } = await newPage(browser, seed, '?debug&guide', MOBILE, true);
        await page.waitForTimeout(500);
        const g = await gs(page);
        check('v16 저장(탭 20번, 가이드 3단계)을 불러오면 인트로가 안 뜨고 진행이 그대로', (await page.locator('.story-ov').count()) === 0 && g.story.intro === true && g.guide.step === 3 && g.stats.totalTaps === 20 && g.version === 17, JSON.stringify(g.story));
        await ctx.close();
      }

      // 이사 뒤 도착 쪽지가 특전 상자·카드 고르기보다 먼저, 닫으면 기존 흐름
      {
        const { ctx, page } = await newPage(browser, seedAt(0));
        await page.waitForTimeout(600);
        await clickMove(page);
        const got = await through(page, '.story-ov .sn-note');
        await page.waitForTimeout(700);
        const first = await page.evaluate(() => ({ modals: document.querySelectorAll('.modal').length, title: document.querySelector('.sn-title')?.textContent, kick: document.querySelector('.sn-kick')?.textContent, txt: document.querySelector('.sn-pg.cur')?.textContent, btn: document.querySelector('.sn-next')?.textContent }));
        check('이사 뒤 도착 쪽지(투룸)가 먼저 뜬다: 특전 창 없음', got && first.modals === 0 && first.title === '투룸' && first.kick === '상자에 붙은 쪽지' && first.txt.includes('이사 축하해요. 상자는 먼저 보내 뒀어요.') && first.txt.includes('보낸 사람: (빈칸)') && first.btn === '상자 까러 가기', JSON.stringify(first));
        check('도착 쪽지가 뜬 동안 그 집은 이미 본 것으로 저장', (await gs(page)).story.notes.includes(1) && (await save(page)).story.notes.includes(1));
        await page.locator('.sn-next').click();
        await page.waitForSelector('.story-ov', { state: 'detached' });
        await page.waitForTimeout(900);
        const after = await page.evaluate(() => ({ modal: document.querySelector('.modal h2')?.textContent || '', ov: document.querySelectorAll('.overlay').length }));
        check('쪽지를 닫으면 기존 흐름(특전 상자 고르기 창)이 이어진다', after.modal !== '' && after.ov === 1, JSON.stringify(after));
        const s = await gs(page);
        check('이사 규칙은 그대로(집 1, 특전 상자 대기 2개)', s.moves === 1 && s.perkOffers.length === 2, `moves=${s.moves} offers=${s.perkOffers.length}`);
        await ctx.close();
      }
      // 달 기지: 쪽지 -> 달 기지 창
      {
        const { ctx, page } = await newPage(browser, seedAt(3));
        await page.waitForTimeout(600);
        await clickMove(page);
        await through(page, '.story-ov .sn-note');
        await page.waitForTimeout(600);
        check('달 기지 도착: 먼저 쪽지(달 기지)가 뜨고 달 기지 창은 아직 없다', (await text(page, '.sn-title')) === '달 기지' && (await page.locator('.modal').count()) === 0);
        await page.locator('.sn-next').click();
        await page.waitForSelector('.modal');
        check('쪽지 뒤에 "달 기지 도착!" 창이 그대로 뜬다', (await text(page, '.modal h2')).includes('달 기지 도착!'));
        await ctx.close();
      }
      // 우주 끝 신도시 쪽지
      {
        const { ctx, page } = await newPage(browser, seedAt(7));
        await page.waitForTimeout(600);
        await clickMove(page);
        await through(page, '.story-ov .sn-note');
        await page.waitForTimeout(700);
        const t = await text(page, '.sn-pg.cur');
        check('우주 끝 신도시 쪽지 문구', t.includes('더 보낼 곳이 없어요. 마지막 상자는 맨 뒤에 있어요.'), t);
        await ctx.close();
      }

      // 엔딩: 이사 8회 저장에서 이사
      for (const w of [390, 360]) {
        const { ctx, page } = await newPage(browser, seedAt(8), '?debug', { ...MOBILE, viewport: { width: w, height: 844 } });
        await page.waitForTimeout(600);
        await clickMove(page);
        await page.waitForSelector('.story-ov.ending');
        const cine = await page.evaluate(() => ({ modals: document.querySelectorAll('.modal').length, moveScene: document.querySelectorAll('.move-scene').length, bands: document.querySelectorAll('.sn-band').length, box: !!document.querySelector('.sn-box') }));
        await page.waitForSelector('.story-ov .sn-note', { timeout: 6000 });
        check(`엔딩(${w}): 시선 연출(띠·상자) 뒤 쪽지 창, 아직 이사 전`, cine.bands === 2 && cine.box && cine.moveScene === 0 && (await gs(page)).moves === 8, JSON.stringify(cine));
        check(`엔딩(${w}): 제목 "마지막 상자"`, (await text(page, '.sn-title')) === '마지막 상자');
        let ok = true;
        const seen = [];
        for (let i = 0; i < 4; i++) {
          await typed(page);
          const r = await page.evaluate(() => { const n = document.querySelector('.sn-note').getBoundingClientRect(); const c = document.querySelector('.sn-pg.cur'); const cr = c.getBoundingClientRect(); const rows = [...c.querySelectorAll('.sn-p, .sn-inv')].every((q) => { const b = q.getBoundingClientRect(); return b.right <= n.right + 1 && b.left >= n.left - 1; }); return { t: c.innerText.replace(/\n/g, ' / '), fit: rows && n.bottom <= innerHeight + 1 && cr.bottom <= n.bottom }; });
          seen.push(r.t);
          if (!r.fit) ok = false;
          if (i === 2) await page.waitForTimeout(1000);
          if (i < 3) await advance(page);
        }
        check(`엔딩(${w}): 문단 4개가 창 안에 다 들어가고 문구가 맞다`, ok && seen[0].includes('빈 송장 한 묶음과 펜') && seen[1].includes('아직 안 썼던 거예요') && seen[2].includes('받는 사람: 원룸의 나') && seen[2].includes('보낸 사람: 우주 끝의 나') && seen[3].includes('저쪽의 나도 일단 까 보겠죠'), seen.join(' | '));
        check(`엔딩(${w}): 송장이 찍힌 뒤 상자가 날아가 사라진다`, await page.evaluate(() => getComputedStyle(document.querySelector('.sn-box')).visibility === 'hidden'));
        await advance(page);
        await page.waitForSelector('.story-ov.end');
        let peak = 0;
        for (let k = 0; k < 6; k++) { await page.waitForTimeout(100); peak = Math.max(peak, await page.evaluate(() => window.__ajd.particles())); }
        await page.waitForTimeout(2200);
        const end = await page.evaluate(() => ({ fin: document.querySelector('.sn-fin')?.textContent, lit: document.querySelectorAll('.sn-h.lit').length, rows: [...document.querySelectorAll('.sn-rec div')].map((d) => d.textContent), credit: document.querySelector('.sn-credit')?.textContent, go: document.querySelector('.sn-go')?.textContent, goVis: getComputedStyle(document.querySelector('.sn-go')).visibility, within: (() => { const b = document.querySelector('.sn-go').getBoundingClientRect(); return b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth; })(), over: [...document.querySelectorAll('.sn-end *')].some((e) => e.getBoundingClientRect().right > innerWidth + 1), moves: window.__ajd.get().moves }));
        check(`끝 화면(${w}): 끝·집 9개 켜짐·기록 3줄·작은 글씨·버튼 "계속 까기", 넘침 없음`, end.fin === '끝' && end.lit === 9 && end.rows.length === 3 && end.rows[0].includes('이사 횟수') && end.rows[0].includes('8번') && end.rows[1].includes('최고 연쇄') && end.rows[2].includes('누적 수익') && end.credit === '우리 집 키우기' && end.go === '계속 까기' && end.goVis === 'visible' && end.within && !end.over && end.moves === 8, JSON.stringify(end));
        check(`끝 화면(${w}): 폭죽 최고점 입자 수가 400 이하이고 터지고 있다(50 이상)`, peak <= 400 && peak >= 50, `peak=${peak}`);
        await page.locator('.sn-go').click();
        await page.waitForSelector('.story-ov', { state: 'detached' });
        await through(page, '.modal');
        await page.waitForTimeout(800);
        const s = await gs(page);
        const hn = await text(page, '.house-name');
        check(`계속 까기(${w}): 평소 이사가 이어져 "우주 끝 신도시 1차", 엔딩은 본 것, 특전 상자 대기`, s.moves === 9 && s.story.ending === true && hn === '우주 끝 신도시 1차' && s.perkOffers.length >= 1 && (await page.locator('.story-ov').count()) === 0, `moves=${s.moves} ${hn}`);
        await ctx.close();
      }
      // 엔딩은 한 번만: 엔딩을 본 v17 저장(이사 9회)에서는 곧바로 이사 장면
      {
        const { page: p0, ctx: c0 } = await newPage(browser);
        const base = await gs(p0);
        await c0.close();
        const seed = { ...base, version: 17, moves: 9, earned: 1e90, points: 1e90, unlocked: UNL, story: { intro: true, notes: [1, 2, 3, 4, 5, 6, 7, 8], ending: true } };
        const { ctx, page } = await newPage(browser, seed);
        await page.waitForTimeout(600);
        await clickMove(page);
        await page.waitForSelector('.move-scene', { timeout: 6000 });
        check('엔딩은 한 번만: 본 저장에서는 이사 장면으로 바로 간다', (await page.locator('.story-ov').count()) === 0 && (await gs(page)).story.ending === true);
        await ctx.close();
      }
      // 엔딩 중 건너뛰기를 눌러도 끝 화면은 본다
      {
        const { ctx, page } = await newPage(browser, seedAt(8));
        await page.waitForTimeout(600);
        await clickMove(page);
        await page.waitForSelector('.story-ov .sn-skip', { timeout: 6000 });
        await page.locator('.sn-skip').click();
        await page.waitForSelector('.story-ov.end', { timeout: 3000 });
        await page.waitForTimeout(2800);
        check('엔딩 건너뛰기: 끝 화면은 그대로 보여 준다', (await page.locator('.sn-h.lit').count()) === 9 && (await page.locator('.sn-go.on').count()) === 1);
        await ctx.close();
      }
      // 설정 > 이야기 다시 보기, 움직임 줄이기
      {
        const { ctx, page } = await newPage(browser, seedAt(2));
        await page.waitForTimeout(500);
        await setS(page, { settings: { reduceMotion: true } });
        await page.waitForTimeout(300);
        await page.locator('.icon-btn[aria-label="설정"]').click();
        await page.waitForSelector('.modal');
        await page.locator('.modal .btn', { hasText: '이야기 다시 보기' }).click();
        await page.waitForSelector('.sn-list');
        const rows = await page.locator('.sn-rp').count();
        check('설정 > 이야기 다시 보기: 본 것(인트로·쪽지 2개)만 목록으로', rows === 3, String(rows));
        await page.screenshot({ path: path.join(SHOTS, 'st-390-replay.png') });
        const pick = async () => { const g = await gs(page); return JSON.stringify({ story: g.story, moves: g.moves, perkOffers: g.perkOffers, perks: g.perks, homeLv: g.homeLv, gear: g.gear, deck: g.deck }); };
        const before = await pick();
        await page.locator('.sn-rp').nth(2).click();
        await page.waitForSelector('.story-ov .sn-note');
        const instant = await page.evaluate(() => [...document.querySelectorAll('.sn-pg.cur .sn-off')].every((n) => n.textContent === ''));
        check('움직임 줄이기: 쪽지 글이 한 번에 보인다', instant);
        await page.locator('.sn-next').click();
        await page.waitForSelector('.sn-list');
        check('다시 보기: 닫으면 목록으로 돌아오고 저장·진행은 그대로', (await pick()) === before);
        await ctx.close();
      }
    }


    // 13. 가이드 2부·한 줄 설명·집 N/9·도움말(2차 가이드 강화)
    {
      const DECK_ALL = [...ALL, 'deck'];
      const GUIDE_DONE = { step: 18, n: 0, done: true };
      const g2 = async (page) => page.evaluate(() => ({ chip: document.querySelector('.guide-row .gd-chip')?.textContent || '', vis: !document.querySelector('.guide-row')?.hidden, text: document.querySelector('.guide-row .gd-text')?.textContent || '', done: !!document.querySelector('.guide-row.done') }));
      const wait2 = (page, c) => page.waitForFunction((x) => document.querySelector('.guide-row .gd-chip')?.textContent === x && !document.querySelector('.guide-row.done'), c, { timeout: 6000 }).catch(() => {});
      const deckSet = (page, deck, over = {}) => page.evaluate(([d, o]) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, ...o, deck: { ...s.deck, ...d } }); }, [deck, over]);
      const { ctx, page } = await newPage(browser, null, '?debug');
      await page.evaluate(() => window.__ajd.set({ ...window.__ajd.get(), moves: 1, guide2: { step: 0, done: false }, deck: { ...window.__ajd.get().deck, slots: [], offers: [] } }));
      await page.waitForTimeout(700);
      let g = await g2(page);
      check('2부: 이사 1회에 가이드 2부 1/5 줄이 뜬다', g.vis && g.chip === '가이드 2부 1/5' && g.text.includes('공구함 카드를 하나'), `${g.chip} ${g.text}`);
      const mk = (id, stacks = 0) => ({ id, star: 1, charge: 0, stacks });
      const c3 = await page.evaluate(() => window.__ajd.cards());
      check('2부: 디버그 훅으로 카드 id를 얻는다', c3.length >= 3, String(c3.length));
      await page.waitForTimeout(1800);
      await page.screenshot({ path: path.join(SHOTS, 'g2-390-part2-1.png') });
      await deckSet(page, { slots: [mk(c3[0])] });
      await wait2(page, '가이드 2부 2/5');
      g = await g2(page);
      check('2부: 카드를 끼우면 2/5(카드 눈금)', g.chip === '가이드 2부 2/5' && g.text.includes('눈금'), `${g.chip} ${g.text}`);
      await page.waitForTimeout(1800);
      await page.screenshot({ path: path.join(SHOTS, 'g2-390-part2-2.png') });
      const ar390 = await page.evaluate(() => { const a = document.querySelector('.gd-point'), g = document.querySelector('.guide-row'); if (!a || a.hidden) return { none: true }; const x = a.getBoundingClientRect(), y = g.getBoundingClientRect(); return { ov: x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top, a: [x.top, x.bottom], g: [y.top, y.bottom] }; });
      check('2부: 390에서 화살표가 가이드 줄(막대 포함)을 덮지 않는다', ar390.none !== true && ar390.ov === false, JSON.stringify(ar390));
      await page.setViewportSize({ width: 360, height: 800 });
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(SHOTS, 'g2-360-part2.png') });
      const o360 = await page.evaluate(() => { const r = document.querySelector('.guide-row'); return { fit: r.getBoundingClientRect().right <= innerWidth && document.documentElement.scrollWidth <= innerWidth, over: [...r.querySelectorAll('.gd-head, .gd-text')].filter((e) => e.scrollWidth > e.clientWidth + 1).length }; });
      check('2부: 360 폭에서도 가이드 줄이 안 넘친다', o360.fit && o360.over === 0, JSON.stringify(o360));
      await page.setViewportSize({ width: 390, height: 844 });
      await deckSet(page, { slots: [mk(c3[0], 1)] });
      await wait2(page, '가이드 2부 3/5');
      g = await g2(page);
      check('2부: 스택이 1이 되면 3/5(카드 2장 더)', g.chip === '가이드 2부 3/5' && g.text.includes('2장'), `${g.chip} ${g.text}`);
      await page.waitForTimeout(1800);
      await page.screenshot({ path: path.join(SHOTS, 'g2-390-part2-3.png') });
      await deckSet(page, { slots: [mk(c3[0], 1), mk(c3[1]), mk(c3[2])] });
      await wait2(page, '가이드 2부 4/5');
      g = await g2(page);
      check('2부: 카드 3장이면 4/5(강화 고르기)', g.chip === '가이드 2부 4/5' && g.text.includes('강화 고르기'), `${g.chip} ${g.text}`);
      await page.waitForTimeout(1800);
      await page.screenshot({ path: path.join(SHOTS, 'g2-390-part2-4.png') });
      await deckSet(page, { boostMade: 1, boostPacks: 0, chargedStacks: 6 });
      await wait2(page, '가이드 2부 5/5');
      g = await g2(page);
      check('2부: 강화 고르기를 끝내면 5/5(이사)', g.chip === '가이드 2부 5/5' && g.text.includes('이사'), `${g.chip} ${g.text}`);
      await page.waitForTimeout(1800);
      await page.screenshot({ path: path.join(SHOTS, 'g2-390-part2-5.png') });
      const lay = await page.evaluate(() => { const r = (s) => { const e = document.querySelector(s); const b = e && e.getBoundingClientRect(); return b && b.width > 0 ? { t: b.top, b: b.bottom } : null; }; return { charge: r('.charge'), deck: r('.deck-row'), move: r('.move-row'), guide: r('.guide-row'), h: innerHeight }; });
      check('2부: 줄이 있어도 390x844에서 게이지·덱 줄·이사 줄이 화면 안', lay.charge && lay.deck && lay.move && lay.charge.b <= lay.h && lay.deck.b <= lay.h && lay.move.b <= lay.h && lay.guide.b <= lay.deck.t + 1, JSON.stringify(lay));
      // 이사하면 2부 끝
      await setS(page, { moves: 2 });
      await page.waitForTimeout(1200);
      g = await g2(page);
      check('2부: 이사 2회가 되면 줄이 사라지고 끝으로 저장', !g.vis && (await gs(page)).guide2.done === true, JSON.stringify(g));
      await ctx.close();
    }
    const DECK_ALL = [...ALL, 'deck'];
    const GUIDE_DONE = { step: 18, n: 0, done: true };
    {
      // 이사 2회 저장에는 2부가 안 뜬다(v16 저장 이전 포함)
      const v16 = (moves) => ({ version: 16, moves, guide: GUIDE_DONE, unlocked: DECK_ALL });
      for (const mv of [2, 3]) {
        const { ctx, page } = await newPage(browser, v16(mv));
        await page.waitForTimeout(600);
        check(`2부: 이사 ${mv}회 저장은 줄이 없다`, !(await page.evaluate(() => !document.querySelector('.guide-row')?.hidden)) && (await gs(page)).guide2.done === true);
        await ctx.close();
      }
      const { ctx, page } = await newPage(browser, v16(1));
      await page.waitForTimeout(600);
      check('2부: 이사 1회 저장은 2부 1단계부터(카드 없음)', (await page.locator('.guide-row .gd-chip').innerText()).startsWith('가이드 2부 1/5'));
      await ctx.close();
    }
    {
      // 한 줄 설명은 한 번만: 스택 배지
      const { ctx, page } = await newPage(browser, { version: 16, moves: 1, guide: GUIDE_DONE, unlocked: DECK_ALL });
      await page.evaluate(() => localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify({ sound: false, music: false, haptics: false, chargeDone: true, weakDone: true, tips: [] })));
      await page.reload();
      await page.waitForSelector('.phone');
      await skipIntro(page);
      const REAL = await page.evaluate(() => window.__ajd.cards());
      const mk = (id, stacks = 0) => ({ id, star: 1, charge: 0, stacks });
      await page.evaluate(([c]) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, guide2: { step: 0, done: true }, deck: { ...s.deck, slots: [c], offers: [] } }); }, [mk(REAL[0], 2)]);
      const toasts = async () => (await page.locator('.toast').allInnerTexts()).join(' ');
      let seen = false;
      for (let i = 0; i < 40 && !seen; i++) { await page.waitForTimeout(250); seen = (await toasts()).includes('스택 하나마다'); }
      if (seen) await page.screenshot({ path: path.join(SHOTS, 'g2-390-tip-stack.png') });
      check('한 줄 설명: 스택이 처음 붙으면 토스트', seen);
      const n1 = (await page.evaluate(() => JSON.parse(localStorage.getItem('ajd-home-idle:ui-prefs')).tips)).filter((x) => x === 'stack').length;
      await page.evaluate(([c]) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, deck: { ...s.deck, slots: [{ ...c, stacks: 0 }] } }); }, [mk(REAL[0], 0)]);
      await page.waitForTimeout(1200);
      await page.evaluate(([c]) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, deck: { ...s.deck, slots: [c] } }); }, [mk(REAL[0], 3)]);
      await page.waitForTimeout(5500);
      const after = await page.evaluate(() => JSON.parse(localStorage.getItem('ajd-home-idle:ui-prefs')).tips.filter((x) => x === 'stack').length);
      check('한 줄 설명: 같은 설명은 다시 안 뜬다', n1 === 1 && after === 1 && !(await toasts()).includes('스택 하나마다'), `${n1},${after}`);
      // 자동 칩
      await page.evaluate(() => { const s = window.__ajd.get(); window.__ajd.set({ ...s, unpack: { ...s.unpack, rushSec: 12 } }); });
      let rush = false;
      for (let i = 0; i < 40 && !rush; i++) { await page.waitForTimeout(250); rush = (await toasts()).includes('자동 연타'); }
      if (rush) await page.screenshot({ path: path.join(SHOTS, 'g2-390-tip-auto.png') });
      check('한 줄 설명: 자동 칩이 처음 뜨면 토스트', rush);
      await ctx.close();
    }
    {
      // 집 N/9 버튼, 집 단계 창, 도움말
      const { ctx, page } = await newPage(browser, { version: 16, moves: 1, guide: GUIDE_DONE, unlocked: DECK_ALL });
      await page.waitForTimeout(600);
      const lbl = await page.locator('.step-btn').innerText();
      check('집 단계 버튼: 집 2/9', lbl.trim() === '집 2/9', lbl);
      await setS(page, { moves: 8 });
      await page.waitForTimeout(500);
      check('집 단계 버튼: 9번째 집은 집 9/9', (await page.locator('.step-btn').innerText()).trim() === '집 9/9');
      await setS(page, { moves: 10 });
      await page.waitForTimeout(500);
      check('집 단계 버튼: 9번째 이후는 N차', (await page.locator('.step-btn').innerText()).trim() === '2차', await page.locator('.step-btn').innerText());
      await setS(page, { moves: 8 });
      await page.waitForTimeout(400);
      await page.setViewportSize({ width: 360, height: 800 });
      await page.waitForTimeout(500);
      const fit360 = await page.evaluate(() => { const rs = ['.move-row .bar', '.step-btn', '.move-row .move-btn'].map((s) => document.querySelector(s).getBoundingClientRect()); return { ok: rs[0].right <= rs[1].left + 1 && rs[1].right <= rs[2].left + 1 && rs[2].right <= innerWidth && document.querySelector('.step-btn').scrollWidth <= document.querySelector('.step-btn').clientWidth + 1 }; });
      check('집 단계 버튼: 360px에서 안 넘치고 겹치지 않는다', fit360.ok, JSON.stringify(fit360));
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('.step-btn').click();
      await page.waitForSelector('.house-table');
      const last = await page.locator('.house-row.last').innerText();
      check('집 단계 창: 마지막 상자 줄(엔딩 전)', last.includes('마지막 상자') && !last.includes('엔딩 봄') && (await page.locator('.house-row.current').count()) === 1, last);
      await page.waitForTimeout(900);
      await page.evaluate(() => document.querySelector('.house-row.last')?.scrollIntoView({ block: 'center' }));
      await page.screenshot({ path: path.join(SHOTS, 'g2-390-house-table.png') });
      await page.locator('.overlay .btn').last().click();
      await setS(page, { story: { ...(await gs(page)).story, ending: true } });
      await page.locator('.step-btn').click();
      await page.waitForSelector('.house-table');
      check('집 단계 창: 엔딩을 봤으면 엔딩 봄', (await page.locator('.house-row.last').innerText()).includes('엔딩 봄'));
      await page.locator('.overlay .btn').last().click();
      // 이사 확인 창
      await setS(page, { moves: 1, points: 1e30, earned: 1e30 });
      await page.waitForTimeout(500);
      await page.locator('.move-btn').click();
      await page.waitForSelector('.mv-box');
      const mvTxt = await page.locator('.overlay').innerText();
      check('이사 확인 창: 남는 것과 처음부터가 적혀 있다', mvTxt.includes('처음부터') && mvTxt.includes('남는 것'), mvTxt.slice(0, 80));
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(SHOTS, 'g2-390-move-confirm.png') });
      await page.locator('.overlay .btn').first().click();
      // 도움말
      await page.locator('button[aria-label="설정"]').click();
      await page.waitForSelector('.overlay');
      await page.getByText('도움말', { exact: true }).click();
      await page.waitForSelector('.help-list');
      await page.waitForTimeout(900);
      const hp = await page.evaluate(() => { const rows = [...document.querySelectorAll('.help-row')]; const ov = document.querySelector('.help-list').getBoundingClientRect(); return { n: rows.length, over: rows.filter((r) => r.scrollWidth > r.clientWidth + 1 || r.getBoundingClientRect().right > ov.right + 1).length, imgs: rows.every((r) => r.querySelector('img') && r.querySelector('img').naturalWidth > 0), h: document.documentElement.scrollWidth <= innerWidth }; });
      check('도움말: 줄 10개·아이콘·가로 넘침 없음', hp.n === 10 && hp.over === 0 && hp.imgs && hp.h, JSON.stringify(hp));
      await page.screenshot({ path: path.join(SHOTS, 'g2-390-help.png') });
      await ctx.close();
    }

    check('콘솔 오류 0건', errors.length === 0, errors.slice(0, 3).join(' | '));
  } catch (e) {
    check('스모크 실행 예외 없음', false, e.message);
  }
  const pass = results.filter((r) => r.ok).length;
  console.log(`\n${pass}/${results.length} 통과`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
