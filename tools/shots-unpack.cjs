// 상자 풀기 연속 장면 촬영: node tools/shots-unpack.cjs  -> screenshots/unpack-study/{hit,break,place,done,after,dock}.png
// 전제: 개발 서버 localhost:5173, 격리 Aside CDP 9333. CDP Page.startScreencast(png) 프레임을 타임스탬프로 받아 STEP ms 간격 격자에 맞춰 고른다.
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const BASE = process.env.URL || 'http://localhost:5173';
const OUT = path.resolve(__dirname, '..', process.env.OUT_DIR ? (process.env.OUT_DIR.startsWith('screenshots') ? process.env.OUT_DIR : path.join('screenshots', process.env.OUT_DIR)) : 'screenshots/unpack-study');
const TMP = process.env.TMP_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'unpack-'));
const VW = Number(process.env.VW || 390), VH = Number(process.env.VH || 844);
const MOB = { viewport: { width: VW, height: VH }, deviceScaleFactor: 1, isMobile: VW < 900, hasTouch: VW < 900, reducedMotion: 'no-preference' };
const SEED = { version: 3, points: 5e6, earned: 5e6, moves: 0, tapLevel: 3, services: [20, 12, 11, 10, 0, 0, 0, 0], event: { nextInSec: 9999, remainSec: 0, streak: 0 }, perks: {}, perkOffers: [], contracts: [], collection: {} };
const PATTERN = ['small', 'small', 'normal', 'small', 'small', 'normal', 'small', 'small', 'normal', 'big'];
const MULT = { small: 0.7, normal: 1.6, big: 3 };
const hpOf = (k) => Math.ceil(10 * 1.07 ** k * MULT[k >= 80 ? 'small' : PATTERN[k % 10]] - 1e-9);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(browser) {
  const ctx = await browser.newContext(MOB);
  await ctx.addInitScript(([s]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('ajd-home-idle:save', JSON.stringify({ ...s, stats: { totalEarned: 0, playSec: 0, boxesOpened: 0, ...(s.stats || {}), totalTaps: Math.max(500, (s.stats && s.stats.totalTaps) || 0) }, savedAt: Date.now() }));
    localStorage.setItem('ajd-home-idle:ui-prefs', JSON.stringify({ sound: false, music: false, haptics: false }));
  }, [SEED]);
  const page = await ctx.newPage();
  await page.goto(BASE + '/?debug');
  await page.waitForSelector('.phone');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  return { ctx, page };
}
const setUn = async (page, u) => { await page.evaluate((x) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, unpack: { ...s.unpack, ...x } }); }, u); await page.waitForTimeout(500); };
const setHome = async (page, lv) => { await page.evaluate((x) => { const s = window.__ajd.get(); window.__ajd.set({ ...s, homeLv: x }); }, lv); await page.waitForTimeout(500); };
const info = (page) => page.evaluate(() => { const s = window.__ajd.get(); return { box: s.unpack.box, damage: s.unpack.damage, roomDone: s.unpack.roomDone, points: s.points }; });
const clip = (page) => page.evaluate(() => {
  const r = document.querySelector('.room').getBoundingClientRect();
  const s = document.querySelector('.px-strip')?.getBoundingClientRect() ?? r;
  const top = Math.max(0, Math.floor(Math.min(r.top, s.top))), bot = Math.ceil(Math.max(r.bottom, s.bottom));
  if (window.__full) return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
  return { x: 0, y: top, w: window.innerWidth, h: bot - top };
});

// taps: [{at: ms 오프셋, via: 'room'|'dock'}]. 첫 탭 직전부터 total ms 동안 프레임 수집.
async function shoot(ctx, page, name, { taps, step = 50, count = 14, pre = 1, noCrit = true, extra = 0 }) {
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', (f) => {
    frames.push({ t: f.metadata.timestamp * 1000, data: f.data });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  if (noCrit) await page.evaluate(() => { window.__rnd = Math.random; Math.random = () => 0.99; });
  const box = await page.evaluate(() => { const r = document.querySelector('.un-box[data-pos="0"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.6 }; });
  const dock = await page.evaluate(() => { const r = document.querySelector('.dock-phone').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1, maxWidth: VW, maxHeight: VH });
  await sleep(250);
  const cr = await clip(page);
  const t0 = Date.now();
  const log = [];
  for (const tp of taps) {
    const wait = t0 + tp.at - Date.now();
    if (wait > 0) await sleep(wait);
    const p = tp.via === 'dock' ? dock : { x: box.x + (tp.dx || 0), y: box.y };
    log.push(Date.now() - t0);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.up();
  }
  const end = t0 + (count - pre) * step + extra;
  await sleep(Math.max(0, end - Date.now()) + 200);
  await cdp.send('Page.stopScreencast');
  if (noCrit) await page.evaluate(() => { Math.random = window.__rnd; });
  // 프레임 격자: 탭 시각 t0(실제 첫 mouse.down 시각)을 0으로, -pre*step ~ (count-pre-1)*step
  const t00 = t0 + taps[0].at;
  const dir = path.join(TMP, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const picked = [];
  for (let i = 0; i < count; i++) {
    const want = t00 + (i - pre) * step;
    let best = null;
    for (const f of frames) if (f.t <= want + 1) best = f;
    if (!best) best = frames[0];
    const file = path.join(dir, `${String(i).padStart(2, '0')}.png`);
    fs.writeFileSync(file, Buffer.from(best.data, 'base64'));
    picked.push({ file, ms: (i - pre) * step, src: Math.round(best.t - t00) });
  }
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ frames: picked, clip: cr, taps: log }));
  const uniq = new Set(picked.map((p) => p.src)).size;
  console.log(name, 'raw frames', frames.length, 'distinct picked', uniq, 'tap offsets', log.join(','), 'state', JSON.stringify(await info(page)));
  await cdp.detach();
  return dir;
}

const STRIP_PY = `
import json, sys
from PIL import Image, ImageDraw, ImageFont
d, out = sys.argv[1], sys.argv[2]
m = json.load(open(d + '/meta.json'))
c = m['clip']
tiles = []
for f in m['frames']:
    im = Image.open(f['file']).convert('RGB')
    tiles.append((im.crop((c['x'], c['y'], c['x'] + c['w'], c['y'] + c['h'])), f['ms']))
w, h = tiles[0][0].size
cols = 4
rows = (len(tiles) + cols - 1) // cols
G = 6
sheet = Image.new('RGB', (cols * w + (cols + 1) * G, rows * h + (rows + 1) * G), (30, 30, 30))
try:
    font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 16)
except Exception:
    font = ImageFont.load_default()
for i, (t, ms) in enumerate(tiles):
    x = G + (i % cols) * (w + G)
    y = G + (i // cols) * (h + G)
    sheet.paste(t, (x, y))
    dr = ImageDraw.Draw(sheet)
    label = '%+d ms' % ms
    dr.rectangle((x, y, x + 8 * len(label) + 10, y + 22), fill=(0, 0, 0))
    dr.text((x + 5, y + 2), label, fill=(255, 255, 0), font=font)
sheet.save(out)
print(out, sheet.size)
`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const jobs = [];
  const scene = async (name, state, opts) => {
    const { ctx, page } = await open(browser);
    await setUn(page, state);
    jobs.push([name, await shoot(ctx, page, name, opts)]);
    await ctx.close();
  };
  const old = !process.env.ONLY;
  if (process.env.ONLY === 'room') {
    const FULL = !!process.env.FULL;
    const sc = async (name, state, opts, home) => {
      const { ctx, page } = await open(browser);
      await setUn(page, state);
      if (home) await setHome(page, home);
      if (FULL) await page.evaluate(() => { window.__full = true; });
      jobs.push([name, await shoot(ctx, page, name, opts)]);
      await ctx.close();
    };
    const w = process.env.SCENE;
    if (w === 'care') await sc('care', { box: 89, damage: 9, hp: 10, roomDone: true }, { taps: [{ at: 0 }], step: 100, count: 16 }, [1, 4, 12, 5, 6, 7, 9, 15]);
    if (w === 'tierup') await sc('tierup', { box: 89, damage: 9, hp: 10, roomDone: true }, { taps: [{ at: 0 }], step: 400, count: 12 }, [2, 3, 3, 3, 3, 3, 3, 3]);
    if (w === 'pile36') await sc('pile36', { box: 36, damage: hpOf(36) - 1, hp: hpOf(36), roomDone: false }, { taps: [{ at: 0 }], step: 100, count: 12 });
    if (w === 'pile76') await sc('pile76', { box: 76, damage: hpOf(76) - 1, hp: hpOf(76), roomDone: false }, { taps: [{ at: 0 }], step: 100, count: 12 });
    if (w === 'big') await sc('big', { box: 9, damage: hpOf(9) - 1, hp: hpOf(9), roomDone: false }, { taps: [{ at: 0 }, { at: 700 }, { at: 800 }], step: 100, count: 16 });
  }
  if (process.env.ONLY === 'break') await scene('break', { box: 22, damage: hpOf(22) - 1, hp: hpOf(22), roomDone: false }, { taps: [{ at: 0 }], step: 50, count: 16 });
  if (old) {
  // hit: 20번째(작은 상자, 처음 멀쩡) 평범한 1타
  await scene('hit', { box: 20, damage: 0, hp: hpOf(20), roomDone: false }, { taps: [{ at: 0 }], step: 50, count: 14 });
  // break: 21번째(index 22, 보통 상자) 남은 피 1에서 터지는 타
  await scene('break', { box: 22, damage: hpOf(22) - 1, hp: hpOf(22), roomDone: false }, { taps: [{ at: 0 }], step: 50, count: 16 });
  // place: 10번째 큰 상자(index 9, 냉장고) 터짐. 날아가는 시간이 길어 100ms 간격
  await scene('place', { box: 9, damage: hpOf(9) - 1, hp: hpOf(9), roomDone: false }, { taps: [{ at: 0 }], step: 100, count: 16 });
  // done: 80번째 상자(index 79) 터짐
  await scene('done', { box: 79, damage: hpOf(79) - 1, hp: hpOf(79), roomDone: false }, { taps: [{ at: 0 }], step: 100, count: 16 });
  // after: 방 완성 뒤(덤 상자 구간) 여러 번 탭. 탭 250ms 간격 4회
  await scene('after', { box: 85, damage: 0, hp: 0, roomDone: true }, { taps: [0, 250, 500, 750].map((at) => ({ at })), step: 60, count: 16 });
  // 도구 버튼(독 가운데)으로 치기
  await scene('dock', { box: 20, damage: 0, hp: hpOf(20), roomDone: false }, { taps: [{ at: 0, via: 'dock' }], step: 50, count: 12 });
  }
  // U5 살림 손질: 손질 큰 상자(89번째, 손질 묶음의 열 번째)가 터져 레벨이 오른다 / 단계가 오른다 / 정지 화면
  const careScene = async (name, home, opts) => {
    const { ctx, page } = await open(browser);
    await setUn(page, { box: 89, damage: 9, hp: 10, roomDone: true });
    await setHome(page, home);
    jobs.push([name, await shoot(ctx, page, name, opts)]);
    await ctx.close();
  };
  if (!process.env.ONLY || process.env.ONLY === 'u5') {
    await careScene('care', [1, 4, 12, 5, 6, 7, 9, 15], { taps: [{ at: 0 }], step: 100, count: 16 });
    await careScene('tierup', [2, 3, 3, 3, 3, 3, 3, 3], { taps: [{ at: 0 }], step: 100, count: 16 });
    {
      const { ctx, page } = await open(browser);
      await setUn(page, { box: 85, damage: 0, hp: 20, roomDone: true });
      await setHome(page, [1, 3, 12, 48, 192, 5, 20, 2]);
      await page.waitForTimeout(700);
      const cr = await clip(page);
      await page.screenshot({ path: path.join(OUT, 'care-idle.png'), clip: { x: cr.x, y: cr.y, width: cr.w, height: cr.h } });
      await ctx.close();
    }
  }
  fs.writeFileSync(path.join(TMP, 'strip.py'), STRIP_PY);
  for (const [name, dir] of jobs) execFileSync('python3', ['-I', path.join(TMP, 'strip.py'), dir, path.join(OUT, `${name}.png`)], { stdio: 'inherit' });
  await browser.close();
  console.log('tmp', TMP);
})().catch((e) => { console.error(e); process.exit(1); });
