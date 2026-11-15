// 단계적 공개 페이스 측정: 새 게임에서 초당 4탭 + 회수 시간이 짧은 순으로 구매하는 사람 모형.
// 실행: node tools/unlock-pace.mjs
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const eco = await vite.ssrLoadModule('/src/logic/economy.ts');
const { tapAndHit } = await vite.ssrLoadModule('/src/logic/unpack.ts');
const { defaultState } = await vite.ssrLoadModule('/src/logic/state.ts');
const { seededRng } = await vite.ssrLoadModule('/src/logic/perks.ts');
const { boxPrice } = await vite.ssrLoadModule('/src/logic/gacha.ts');
const { bundleStatuses } = await vite.ssrLoadModule('/src/logic/bundle.ts');
const { SERVICES } = await vite.ssrLoadModule('/src/data/services.ts');
const { UNLOCK_IDS, isMet } = await vite.ssrLoadModule('/src/logic/unlock.ts');

const rng = seededRng(777);
let s = defaultState();
const DT = 0.25;
let t = 0;
const hit = {};
const mark = (k, c) => { if (c && !(k in hit)) hit[k] = t; };
while (t < 900) {
  t += DT;
  s = eco.tick(s, DT, rng);
  s = tapAndHit(s, rng, false).state;
  for (;;) {
    let best = null;
    const base = eco.pps(s);
    const tapRate = 4;
    for (let i = 0; i < SERVICES.length; i++) {
      if (!eco.isUnlocked(s, i)) continue;
      const c = eco.serviceCost(i, s.services[i]);
      if (c > s.points) continue;
      const n = eco.buyService(s, i, 1); if (!n) continue;
      const gain = eco.pps(n) - base;
      const pb = c / Math.max(gain, 1e-9);
      if (!best || pb < best.pb) best = { pb, n };
    }
    const tc = eco.tapCost(s.tapLevel);
    if (tc <= s.points && ('[tap]' in hit)) {
      const n = eco.buyTapUpgrade(s);
      if (n) { const gain = (eco.tapValue(n) - eco.tapValue(s)) * tapRate; const pb = tc / Math.max(gain, 1e-9); if (!best || pb < best.pb) best = { pb, n }; }
    }
    if (!best) break;
    s = best.n;
  }
  const owned = s.services.filter((v) => v > 0).length;
  for (const id of UNLOCK_IDS) mark(`[${id}]`, isMet(s, id));
  for (const k of [1e4, 2.5e4, 5e4, 1e5, 3e5, 1e6]) mark(`earned${k}`, s.earned >= k);
  mark('boxes3', s.unpack.box >= 3);
  mark('tapLv1', s.tapLevel >= 1);
  mark('svc1', owned >= 1);
  mark('svc2', owned >= 2);
  mark('svc3', owned >= 3);
  mark('half-box-price', s.points >= boxPrice(s) / 2);
  mark('box-price', s.points >= boxPrice(s));
  mark('move5%', s.earned >= 5.5e7 * 0.05);
  mark('move1%', s.earned >= 5.5e7 * 0.01);
  mark('move0.1%', s.earned >= 5.5e7 * 0.001);
  mark('bundleStage1', bundleStatuses(s).some((b) => b.stage > 0));
  mark('roomDone', s.unpack.roomDone);
  mark('boxes10', s.unpack.box >= 10);
  mark('boxes40', s.unpack.box >= 40);
}
console.log(Object.entries(hit).map(([k, v]) => `${k} ${v.toFixed(0)}s`).join(' | '));
console.log('끝', t, 'pps', eco.pps(s).toFixed(0), 'earned', s.earned.toFixed(0), 'tapLv', s.tapLevel, 'svc', s.services.join(','), 'box', s.unpack.box);
await vite.close();
