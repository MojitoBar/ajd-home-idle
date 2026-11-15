// 이삿짐 상자 페이스 측정: 새 게임에서 초당 4회 쉬지 않고 탭 + P가 되는 대로 탭 강화만 구매.
// 실제 로직(src/logic)을 vite ssr로 불러 직접 호출한다. 실행: node tools/unpack-pace.mjs
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { tapAndHit, toolOf } = await vite.ssrLoadModule('/src/logic/unpack.ts');
const { buyTapUpgrade, tick } = await vite.ssrLoadModule('/src/logic/economy.ts');
const { defaultState } = await vite.ssrLoadModule('/src/logic/state.ts');
const { seededRng } = await vite.ssrLoadModule('/src/logic/perks.ts');
const { boxKind } = await vite.ssrLoadModule('/src/logic/unpack.ts');

const TRAJ = process.argv.includes('--traj');
const TPS = 4, DT = 1 / TPS;
const rng = seededRng(12345);
let s = defaultState();
let t = 0, lastT = 0, taps = 0, lastTaps = 0;
const opened = [], tools = {};
let roomAt = null;
while (t < (TRAJ ? 900 : 1800) && s.unpack.box < 90) {
  t += DT;
  s = tick(s, DT, rng);
  const r = tapAndHit(s, rng, false);
  s = r.state;
  taps++;
  if (TRAJ) { // 참고용: 균형@3회 sim의 탭 레벨 궤적(13/25/33 @ 2.5/5/7.4분, 직선 보간)을 강제
    const pts = [[0, 0], [150, 13], [300, 25], [445, 33], [594, 33]];
    const i = pts.findIndex(([x]) => x >= t);
    const [x0, y0] = pts[Math.max(0, i - 1)], [x1, y1] = pts[Math.max(1, i)];
    s = { ...s, tapLevel: Math.round(y0 + ((y1 - y0) * Math.min(1, (t - x0) / (x1 - x0)))) };
  } else for (;;) { const b = buyTapUpgrade(s); if (!b) break; s = b; }
  const tool = toolOf(s.tapLevel).name;
  if (!(tool in tools)) tools[tool] = t;
  if (r.burst) {
    opened.push({ k: r.burst.k, kind: r.burst.kind, sec: t - lastT, taps: taps - lastTaps, t });
    lastT = t; lastTaps = taps;
    if (r.burst.roomDone) roomAt = t;
  }
}
const f = (x) => x.toFixed(1);
console.log('상자 N번째 터진 시각(초):', [1, 10, 20, 40, 80].map((n) => `${n}번째 ${opened[n - 1] ? f(opened[n - 1].t) : '-'}`).join(' | '));
const room = opened.filter((o) => o.k < 80);
for (const kind of ['small', 'normal', 'big']) {
  const xs = room.filter((o) => o.kind === kind);
  const m = (g) => xs.reduce((a, o) => a + g(o), 0) / xs.length;
  console.log(`${kind}: 평균 ${f(m((o) => o.sec))}초, ${f(m((o) => o.taps))}탭 (n=${xs.length}, 최소 ${f(Math.min(...xs.map((o) => o.sec)))}초, 최대 ${f(Math.max(...xs.map((o) => o.sec)))}초)`);
}
console.log(`80개 평균 간격 ${f(room.at(-1).t / room.length)}초 (목표 3.7초), 방 완성 ${roomAt === null ? '-' : f(roomAt)}초`);
console.log('도구 획득 시각(초):', Object.entries(tools).map(([n, x]) => `${n} ${f(x)}`).join(' | '));
console.log(`끝: ${f(t)}초, 탭 Lv ${s.tapLevel}`);
await vite.close();
