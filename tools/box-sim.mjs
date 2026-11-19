// 상자깡 루프 진행 속도 시뮬: 실제 로직(src/logic)을 vite ssr로 불러 초 단위로 한 판을 돈다. 실행: node tools/box-sim.mjs
// 정책 3개 x 시드 5개. 전부 강타 1회에 sSec초가 걸려 그동안 다른 행동을 못 한다.
// 현실(판정 기준, 사용자 실측 초당 약 100탭어치에 맞춤): 초당 3행동·강타 10%·퍼펙트 25% / 가볍게: 초당 2.5행동·강타 5%·퍼펙트 15% / 고수: 초당 4행동·강타 20%·퍼펙트 50%. 가볍게·고수는 참고만(첫 이사까지).
// 급소가 떠 있으면 70% 맞힘, 나머지는 일반 탭. 콤보 배율은 반영하되 콤보 정산 보너스·택배·시계 러시는 뺀다.
// 업그레이드는 싼 것부터, 상자는 가격이 P의 10% 이하일 때, 공구 5종은 해금됐고 비용이 P의 25% 이하일 때, 이사는 조건이 되면 바로, 특전 상자는 가격이 보유 P의 35% 이하일 때(PERK_SHARE) 사서 3택에서 배수 특전부터 고른다(PERK_PRIO). NOPERK=1이면 가이드 단계의 상자 1개만 사고 특전은 고르지 않는다(비교용).
// 연속 퍼펙트는 resolveStreak(안전모 실드)로 갱신하고, 퍼펙트 확률은 수평계 반폭에 비례해 올린다(0.97 상한).
// 첫 가이드(src/logic/guide.ts): 새 게임은 가이드 1단계라 잠긴 요소(콤보·강타·급소·피버·연쇄·연속 배수·특별 상자·영구 공구)는 못 쓰고,
// 지금 단계의 목표를 우선 수행한다(강타 단계는 강타만, 급소가 떠 있으면 맞힘). 상자·영구 공구 단계는 첫 구매가 가능해지면 바로 산다.
// 출력: 가이드 단계별 완료 시각, 첫 집에서 누적 P가 1e3·1e6·1e9·1e12·1e15를 넘는 시각, J 커브(초반 1/3 vs 마지막 1/3 자릿수 증가 속도), 1분 최대 배수(누적 P 1e3 이후 시작하는 1분 창).
// 환경변수: POLICY=현실,고수,가볍게 · SEED_N=시드 수(최대 20) · SEED_FROM=시작 번호(기본 0, 시드를 나눠 돌릴 때) · MAX_MOVES · MAX_SEC · TARGETS
// 공구함 덱 정책: DECK=없음,정밀,연쇄,특별,피버 (쉼표로 여럿). 문턱마다 그 원형 태그 카드를 우선 고르고(없으면 칸이 비었을 때만 아무 카드), 칸이 차면 원형 밖 카드부터 바꾼다.
//   3단계: 덱 정책이 충전·deckMult·houseTarget을 그대로 쓴다. 출력에 집별 공구함 배율(떠날 때)과 카드 완성 시점(집 시간 %)이 붙는다. 시험용 덮어쓰기: DTS=1,58,... (DECK_TARGET_SCALE) · CNS=1,0.35,... (CHARGE_NEED_SCALE) · DIG='[[6개]x5행]' (DECK_MARK_DIGITS) · DQ=0.1,0.22,... (문턱 d 후보 시점 6개). 4단계: 4칸·고르기 7번(문턱 6곳), 출력에 한 행동에 문턱 2개 이상 넘은 빈도가 붙는다. 시드를 나눠 병렬로 돌릴 때는 DECK=원형 하나씩 + DECK_DUMP.
//   5단계: 카드 22장·★·공명·희귀도 추첨. 정책은 원형 카드를 우선 끼고 칸이 차면 낀 원형 카드를 ★로 올린다. 증폭 덱은 DECK=고정:A1+A2+P3+C3 처럼 천장 사례로 잰다. CR='{"precise":4,"preciseTen":9}' 로 충전 상수를 덮어쓴다.
//   출력은 원형별 이사 시각 표와 문턱 k별 통과 시점(집 시간 대비 %)뿐이다. DECK_DUMP=파일.json이면 결과를 저장하고, DECK_LOAD=a.json,b.json이면 돌리지 않고 합쳐서 표만 낸다(원형별로 나눠 병렬로 돌릴 때). DECK을 안 주면 위의 기본 출력 그대로다.
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const ld = (p) => vite.ssrLoadModule(p);
const { tapAndHit } = await ld('/src/logic/unpack.ts');
const eco = await ld('/src/logic/economy.ts');
const { defaultState } = await ld('/src/logic/state.ts');
const { seededRng, choosePerk } = await ld('/src/logic/perks.ts');
const { buyPerkBox, perkBoxCost } = await ld('/src/logic/perkBox.ts');
const { releaseCharge, CHARGE_PERFECT, CHARGE_GOOD } = await ld('/src/logic/charge.ts');
const { initialWeak, advanceWeak, weakVisible, hitWeak } = await ld('/src/logic/weak.ts');
const combo = await ld('/src/logic/combo.ts');
const gear = await ld('/src/logic/gear.ts');
const { GEAR_IDS } = await ld('/src/data/gear.ts');
const { openBox, boxPrice } = await ld('/src/logic/gacha.ts');
const { move, canMove } = await ld('/src/logic/prestige.ts');
const { tierOf } = await ld('/src/logic/unpack.ts');
const guide = await ld('/src/logic/guide.ts');
const { HOUSES, MOON_STAGE } = await ld('/src/data/houses.ts');
const { chooseCard, deckFull, deckMult, slotNeed } = await ld('/src/logic/deck.ts');
const { houseTarget } = await ld('/src/logic/house.ts');
const { CARDS, DECK_TARGET_SCALE, CHARGE_NEED_SCALE, DECK_MARK_DIGITS, CHARGE_RULES } = await ld('/src/data/cards.ts');
// 시험용: CR='{"precise":2,"preciseTen":5}' 충전 조건 상수를 메모리에서만 덮어쓴다
if (process.env.CR) Object.assign(CHARGE_RULES, JSON.parse(process.env.CR));
// 시험용: DTS=1,8,9,... 집 목표 배수 표 / CNS=1,0.3,... 필요 눈금 보정 표를 메모리에서만 덮어쓴다(길이는 그대로 6)
if (process.env.DTS) process.env.DTS.split(',').forEach((v, i) => { DECK_TARGET_SCALE[i] = Number(v); });
// DIG='[[..5개..],[..]]' (행 5개) 문턱 자릿수 표를 덮어쓴다
if (process.env.DIG) JSON.parse(process.env.DIG).forEach((row, i) => row.forEach((v, k) => { DECK_MARK_DIGITS[i][k] = v; }));
if (process.env.CNS) process.env.CNS.split(',').forEach((v, i) => { CHARGE_NEED_SCALE[i] = Number(v); });

/** 문턱 d 후보를 재는 집 시간 비율(문턱 6곳). DQ=0.1,0.2,... 로 덮어쓴다 */
const DIG_Q = process.env.DQ ? process.env.DQ.split(',').map(Number) : [0.1, 0.22, 0.35, 0.5, 0.66, 0.82];
const DECKS = process.env.DECK ? process.env.DECK.split(',') : process.env.DECK_LOAD ? [] : undefined;
const ARCH = { 정밀: 'precise', 연쇄: 'chain', 특별: 'special', 피버: 'fever' };
/** 같은 원형 카드끼리는 이 순서로 고른다(레어·효과가 큰 것 먼저) */
const DECK_PRIO = ['P5', 'C5', 'F5', 'S5', 'P2', 'P3', 'C3', 'C4', 'S4', 'F3', 'C2', 'S2', 'F4', 'P4', 'S1', 'F1', 'F2', 'C1', 'S3', 'P1'];
const inArch = (id, tag) => CARDS.find((c) => c.id === id)?.tags.includes(tag);
/** 대기 중인 카드 묶음을 전부 처리한다: 원형 카드가 있으면 낀다(칸이 차면 원형 밖 카드를 바꾸고, 바꿀 칸이 없으면 건너뜀), 없으면 빈 칸일 때만 아무 카드 */
function takeCards(s, name) {
  if (name.startsWith('고정:')) { // 시험용: DECK=고정:P2+P3 이면 이사마다 그 카드들을 낀 채 시작한다(묶음은 무시)
    return s.deck.slots.length === 0 || s.deck.offers.length > 0 ? { ...s, deck: { ...s.deck, slots: name.slice(3).split('+').map((id) => ({ id, star: 1, charge: 0 })), offers: [] } } : s;
  }
  const tag = ARCH[name];
  while (s.deck.offers.length > 0) {
    const offer = s.deck.offers[0];
    const mine = offer.filter((id) => inArch(id, tag) && !s.deck.slots.some((x) => x.id === id)).sort((a, b) => DECK_PRIO.indexOf(a) - DECK_PRIO.indexOf(b))[0];
    const held = (id) => s.deck.slots.find((x) => x.id === id);
    const up = offer.find((id) => inArch(id, tag) && held(id) && held(id).star < 3);
    const off = s.deck.slots.findIndex((x) => !inArch(x.id, tag));
    let n = null;
    if (mine && !held(mine)) n = deckFull(s) ? (off >= 0 ? chooseCard(s, 0, mine, off) : null) : chooseCard(s, 0, mine);
    if (!n && up) n = chooseCard(s, 0, up);
    if (!n && !mine && !up && !deckFull(s)) n = chooseCard(s, 0, offer.find((id) => !held(id)) ?? offer[0]);
    s = n ?? chooseCard(s, 0, null);
  }
  return s;
}

// 가이드 단계 누적 P 문턱 시험용: GATES=0,0,1e3,... (13개) node tools/box-sim.mjs
if (process.env.GATES) process.env.GATES.split(',').forEach((v, i) => { guide.GUIDE_STEPS[i].gate = Number(v); });

if (process.env.NOBOX) guide.GUIDE_STEPS.forEach((s) => { s.rewardBoxes = 0; }); // 선물 상자 없이 시험용

// 목표 값 시험용: TARGETS=1e10,1e11,... node tools/box-sim.mjs (houses.ts 값을 메모리에서만 덮어쓴다)
if (process.env.TARGETS) process.env.TARGETS.split(',').forEach((v, i) => { HOUSES[i].target = Number(v); });

const WEAK_HIT = 0.7, BOX_SHARE = 0.1, GEAR_SHARE = 0.25;
/** 특전 상자: 가격이 보유 P의 이 비율 이하이면 산다(가이드 특전 상자 단계는 살 수 있으면 바로). NOPERK=1이면 가이드 단계의 1개만 사고 특전은 하나도 안 고른다(비교용) */
const PERK_SHARE = Number(process.env.PERK_SHARE ?? 0.35), NOPERK = !!process.env.NOPERK;
/** 3택에서 고르는 규칙: 배수 특전 먼저(손목 단련·강타 단련·살림 장인·도감 수집가), 그다음 손맛·운 특전, 마지막에 확률·시간류. 앞선 것이 3택에 없으면 그다음 순서 */
const PERK_PRIO = ['tap_power', 'strike_power', 'home_boost', 'dex_boost', 'streak_coef', 'fever_charge', 'special_freq', 'box_discount', 'fever_long', 'crit', 'tap_crit_power', 'parcel_freq'];
const pickPerk = (offer) => [...offer].sort((a, b) => PERK_PRIO.indexOf(a) - PERK_PRIO.indexOf(b))[0];
/** 대기 중인 특전 묶음을 전부 고른다(NOPERK면 고르지 않고 버린다) */
function takePerks(s) {
  if (NOPERK) return { ...s, perkOffers: [] };
  while (s.perkOffers.length > 0) { const n = choosePerk(s, 0, pickPerk(s.perkOffers[0])); if (!n) break; s = { ...n }; }
  return s;
}
/** 상자·영구 공구 가이드 단계: 목표 가격이 보유 P의 이 배수 안이면 강화를 멈추고 모은다 */
const SAVE_RATIO = Number(process.env.SAVE_RATIO ?? 4);
const MAX_MOVES = Number(process.env.MAX_MOVES ?? 6), MAX_SEC = Number(process.env.MAX_SEC ?? 5 * 3600);
const SEEDS = [12345, 777, 4242, 90210, 31337, 555, 8080, 2024, 6061, 1357, 9001, 271, 1618, 4096, 65537, 2718, 1414, 7777, 123, 999].slice(Number(process.env.SEED_FROM ?? 0), Number(process.env.SEED_FROM ?? 0) + Number(process.env.SEED_N ?? 5));
const POLICIES = [
  { name: '가볍게', tps: 2.5, strike: 0.05, perfect: 0.15, good: 0.35, sSec: 0.9, maxMoves: Number(process.env.REF_MOVES ?? 1) },
  { name: '현실', tps: 3, strike: 0.1, perfect: 0.25, good: 0.4, sSec: 0.9 },
  { name: '고수', tps: 4, strike: 0.2, perfect: 0.5, good: 0.35, sSec: 0.9, maxMoves: Number(process.env.REF_MOVES ?? 1) },
].filter((p) => (process.env.POLICY ? process.env.POLICY.split(',').includes(p.name) : true));

function run(pol, seed, dk) {
  const DT = 1 / pol.tps;
  const rng = seededRng(seed);
  let s = defaultState(0, 1);
  let w = initialWeak(rng), c = combo.initialCombo(), streak = 0, shield = gear.initialShield(0);
  let t = 0, last = 0;
  const rows = [];
  const stepAt = []; // 첫 집에서 가이드 단계를 끝낸 시각(초)
  const crossAt = {}; // 첫 집에서 누적 P가 10^k를 넘은 시각(초)
  let firstPerkAt, boxesInHouse = 0;
  let trT = [], trV = []; // 이 집의 (시각, log10 이 집에서 번 P): 문턱 자릿수 d를 구할 때 쓴다
  let fullAt = {}; // 이 집에서 카드가 꽉 찬 시각(낀 채로)
  let markT = [], markSeen = 0, markActs = 0, markMulti = 0; // 이 집에서 진행 문턱 k(1~6)를 넘은 시각, 문턱을 넘긴 행동 수, 그중 2개 이상 한꺼번에 넘긴 행동 수(DECK 시험 때만)
  const logT = [], logV = []; // 첫 집 행동마다 (시각, log10(누적 P))
  const ev = (e) => {
    const r = guide.guideEvent(s, e);
    s = r.state;
    if (r.completed && rows.length === 0 && stepAt.length < guide.GUIDE_STEPS.length) { stepAt.push(t); if (process.env.DBG) console.log(`dbg ${stepAt.length} t=${t.toFixed(1)} lv=${s.tapLevel} sl=${s.strikeLevel} tier=${Math.max(...s.homeLv.map((x) => tierOf(x)))} lvs=${s.homeLv.join(',')} dex=${Object.keys(s.collection).length} boxes=${s.boxesThisRun} M=${(eco.multBreakdown(s, 'tap').total / eco.multBreakdown(s, 'tap').fever).toFixed(1)} e=${s.earned.toExponential(1)}`); }
  };
  const open = (f) => guide.featureOpen(s, f);
  const stepId = () => { const v = guide.guideView(s); return v && v.n < v.goal ? v.event : null; }; // 목표를 아직 못 채운 단계의 사건
  while (rows.length < Math.min(MAX_MOVES, pol.maxMoves ?? MAX_MOVES) && t < MAX_SEC) {
    t += DT;
    const ms = t * 1000;
    const g = gear.gearEffects(s);
    const feverBefore = s.fever.activeSec > 0;
    s = eco.tick(s, DT, rng);
    if (open('weak')) {
      const wa = advanceWeak(w, DT * 1000, true, rng, g.weakDelayMult);
      w = wa.weak;
    }
    const win = combo.comboWindowMs(s.fever.activeSec > 0);
    if (combo.comboExpired(c, ms, win)) c = combo.initialCombo();
    const want = stepId();
    const strikeFirst = want === 'strike' || want === 'chain' || want === 'perfect';
    let r, acted;
    if (open('weak') && weakVisible(w) && rng() < WEAK_HIT) {
      r = hitWeak(s, rng, w, combo.comboMultOf(s, c.n));
      w = r.weak;
      c = combo.comboAdd(c, ms, r.comboAdd).combo;
      acted = 'weak';
    } else if (open('charge') && (strikeFirst || rng() < pol.strike)) {
      const pp = Math.min(0.97, pol.perfect * (g.perfectHalf / 0.05));
      const gp = Math.min(pol.good, 1 - pp);
      const q = rng();
      const pos = q < pp ? (CHARGE_PERFECT[0] + CHARGE_PERFECT[1]) / 2 : q < pp + gp ? CHARGE_GOOD[0] + 0.01 : 0.1;
      r = releaseCharge(s, rng, pos, streak, combo.comboMultOf(s, c.n));
      const st = gear.resolveStreak(streak, r.grade, shield, g.shieldMax);
      streak = st.streak;
      shield = st.shield;
      c = combo.comboAdd(c, ms, r.comboAdd).combo;
      acted = 'strike';
    } else {
      const h = combo.comboHit(c, ms, win, false);
      c = h.combo;
      r = tapAndHit(s, rng, false, combo.comboMultOf(s, c.n));
      acted = 'tap';
    }
    s = r.state;
    if (dk !== undefined && rows.length > 0) {
      if (dk) s = takeCards(s, dk);
      const dm = s.deck.mark - 1 - markSeen;
      if (dm > 0) { markActs++; if (dm >= 2) markMulti++; }
      while (markSeen < s.deck.mark - 1) { markT.push(t); markSeen++; }
      const held = new Set(s.deck.slots.map((x) => x.id));
      for (const id of Object.keys(fullAt)) if (!held.has(id)) delete fullAt[id];
      for (const sl of s.deck.slots) if (sl.charge >= slotNeed(sl, s.moves) && fullAt[sl.id] === undefined) fullAt[sl.id] = t;
      trT.push(t); trV.push(Math.log10(Math.max(1, s.earned)));
    }
    if (acted === 'strike' && pol.sSec) { t += pol.sSec; s = eco.tick(s, pol.sSec, rng); }
    // 가이드 사건(화면이 알리는 것과 같은 것)
    ev({ type: 'tick' });
    if (acted === 'tap') ev({ type: 'tap' });
    if (acted === 'weak') ev({ type: 'weak' });
    if (acted === 'strike') { ev({ type: 'strike' }); ev({ type: 'perfect', value: streak }); }
    if (open('combo')) ev({ type: 'combo', value: c.n });
    if (r.bursts.some((b) => b.item)) ev({ type: 'unbox' });
    if (r.chain > 0) ev({ type: 'chain', value: r.chain });
    if (r.bursts.some((b) => b.special)) ev({ type: 'special' });
    if (!feverBefore && s.fever.activeSec > 0) ev({ type: 'fever' });
    // 공구 강화(상자 앞): 가이드의 상자·영구 공구 단계는 첫 구매를 위해 모은다
    const buyGuideBox = want === 'boxBuy';
    const gearGoal = want === 'gearBuy' ? GEAR_IDS.filter((id) => gear.gearUnlocked(s, id)).map((id) => gear.gearCost(s, id)).sort((a, b) => a - b)[0] : undefined;
    const perkGoal = want === 'perkBoxBuy' ? perkBoxCost(s) : undefined;
    const saving = (perkGoal !== undefined && perkGoal <= s.points * SAVE_RATIO) || (buyGuideBox && boxPrice(s) <= s.points * SAVE_RATIO) || (gearGoal !== undefined && gearGoal <= s.points * SAVE_RATIO);
    // 상자(뽑기): 가이드 중엔 상자 단계부터, 가격이 보유 P의 10% 이하일 때(상자 단계는 살 수 있으면 바로)
    if (!guide.guideEnded(s) ? guide.guideReached(s, 'boxBuy') : true) {
      for (let i = 0; i < 50 && (boxPrice(s) <= s.points * BOX_SHARE || (buyGuideBox && boxPrice(s) <= s.points)); i++) { const o = openBox(s, rng); if (!o) break; s = o.state; ev({ type: 'boxBuy' }); }
    }
    // 특전 상자: 영구 공구 단계 뒤(가이드 중엔 단계에 닿은 뒤)부터, 가격이 보유 P의 PERK_SHARE 이하일 때(가이드 단계는 살 수 있으면 바로)
    {
      for (let i = 0; i < 20; i++) {
        const forGuide = want === 'perkBoxBuy';
        if (NOPERK && !forGuide) break;
        if (!(perkBoxCost(s) <= s.points * PERK_SHARE || (forGuide && perkBoxCost(s) <= s.points))) break;
        const b = buyPerkBox(s, rng);
        if (!b) break;
        s = takePerks(b);
        if (firstPerkAt === undefined) firstPerkAt = t;
        boxesInHouse++;
        ev({ type: 'perkBoxBuy' });
      }
    }
    // 업그레이드: 싼 것부터
    for (; !saving;) {
      const tc = eco.tapCost(s.tapLevel), sc = open('chain') ? eco.strikeCost(s.strikeLevel) : Infinity;
      const b = tc <= sc ? eco.buyTapUpgrade(s) : eco.buyStrikeUpgrade(s);
      if (!b) break;
      s = b;
      ev({ type: 'upgrade' });
    }
    // 공구 5종: 해금됐고 비용이 보유 P의 25% 이하면 산다(영구 공구 단계는 살 수 있으면 바로, 안전모는 사는 순간 한 칸 채움)
    for (const id of GEAR_IDS) {
      if (!gear.gearUnlocked(s, id)) continue;
      if (gear.gearCost(s, id) > s.points * GEAR_SHARE && !(want === 'gearBuy' && gear.gearCost(s, id) <= s.points)) continue;
      const b = gear.buyGear(s, id);
      if (!b) continue;
      s = b;
      ev({ type: 'gearBuy' });
      if (id === 'helmet') shield = { ...shield, n: shield.n + 1 };
    }
    if (process.env.TRACE && rows.length === 0 && Math.floor(t / Number(process.env.TRACE)) !== Math.floor((t - DT) / Number(process.env.TRACE))) console.log(`trace t=${t.toFixed(0)} e=${s.earned.toExponential(1)} lv=${s.tapLevel} sl=${s.strikeLevel} home=${s.homeLv.reduce((x, y) => x + y, 0)} M=${(eco.multBreakdown(s, 'tap').total / eco.multBreakdown(s, 'tap').fever).toFixed(0)} step=${s.guide.step + 1}`);
    if (rows.length === 0) {
      logT.push(t); logV.push(Math.log10(Math.max(1, s.earned)));
      for (const k of [3, 6, 9, 12, 15]) if (crossAt[k] === undefined && s.earned >= 10 ** k) crossAt[k] = t;
    }
    if (canMove(s)) {
      const bd = eco.multBreakdown(s, 'tap');
      const row = { to: HOUSES[s.moves]?.name ?? `${s.moves + 1}번째`, sec: t - last, total: t, H: eco.homeMult(s), C: eco.collectionMult(s), M: bd.total / bd.fever, tapLv: s.tapLevel, gear: GEAR_IDS.map((id) => s.gear[id] ?? 0).join('') };
      if (rows.length === 0) {
        row.crossAt = crossAt;
        row.guideDone = s.guide.step;
        const T = t;
        const lg = (x) => { let lo = 0, hi = logT.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (logT[m] <= x) lo = m; else hi = m - 1; } return logV[lo]; };
        let mx = 0, mxAt = 0;
        for (let x = 0; x + 60 <= T; x += 5) { if (lg(x) < 3) continue; const d = lg(x + 60) - lg(x); if (d > mx) { mx = d; mxAt = x; } }
        row.maxMin = mx; row.maxMinAt = mxAt;
        row.jEarly = lg(T / 3) / (T / 3 / 60); // 자릿수/분
        row.jMid = (lg((2 * T) / 3) - lg(T / 3)) / (T / 3 / 60);
        row.jLate = (Math.log10(s.earned) - lg((2 * T) / 3)) / (T / 3 / 60);
      }
      row.mult = deckMult(s); row.tgt = houseTarget(s); row.cards = s.deck.slots.map((sl) => ({ id: sl.id, at: fullAt[sl.id] === undefined ? null : (fullAt[sl.id] - last) / row.sec }));
      fullAt = {};
      last = t;
      row.perkBoxes = boxesInHouse; boxesInHouse = 0; row.firstPerkAt = firstPerkAt;
      s = move(s, rng);
      ev({ type: 'move' });
      if (rows.length === 0) row.stepAt = stepAt.slice();
      shield = gear.initialShield(gear.gearEffects(s).shieldMax);
      s = takePerks(s);
      if (dk !== undefined) {
        row.marks = markT.map((x) => (x - (t - row.sec)) / row.sec);
        const t0 = t - row.sec, lgt = Math.log10(row.tgt);
        row.markActs = markActs; row.markMulti = markMulti;
        row.dig = DIG_Q.map((q) => { const x = t0 + q * row.sec; let lo = 0, hi = trT.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (trT[m] <= x) lo = m; else hi = m - 1; } return lgt - trV[lo]; });
        markT = []; markSeen = 0; markActs = 0; markMulti = 0; trT = []; trV = [];
        if (dk) s = takeCards(s, dk);
      }
      rows.push(row);
    }
  }
  if (rows.length === 0) rows.stuck = { step: s.guide.step, t, earned: s.earned, lv: s.tapLevel, crossAt };
  return rows;
}


// 진단 모드: PROBE=1 node tools/box-sim.mjs. 사용자 실측 상태(공구 Lv100·오함마 Lv50·영구 공구 0·총 배율 약 11.5만·손질 단계)에서
// 강화 구매 없이 120초를 돌려 수익원별 초당 P와 "탭 몇 번어치"(= 피버 제외 탭 1회 값 tapStable 기준)를 표로 낸다.
// 정책 추가: PROBE_SPEC="이름:초당행동:강타확률:퍼펙트:굿:강타소요초,..." / PROBE_SEC=120 / PROBE_MULT=115000
if (process.env.PROBE) {
  const { COLLECTIBLES, VARIANTS } = await ld('/src/data/collectibles.ts');
  const mk = (seed, targetMult) => {
    const rng = seededRng(seed);
    let s = defaultState(0, 1);
    const coll = {};
    for (const c of COLLECTIBLES.slice(0, Number(process.env.PROBE_DEX ?? 4))) coll[c.id] = Object.fromEntries(VARIANTS.map((v) => [v.id, 3]));
    s = { ...s, tapLevel: 100, strikeLevel: 50, guide: guide.finishedGuide(), collection: coll, unpack: { ...s.unpack, box: 200, roomDone: true, hp: 0 } };
    const withL = (L) => ({ ...s, homeLv: s.homeLv.map((_, i) => (i === 0 ? 920 : L)) });
    let lo = 0, hi = 5000;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; const b = eco.multBreakdown(withL(Math.round(m)), 'tap'); if (b.total / b.fever < targetMult) lo = m; else hi = m; }
    s = withL(Math.round(hi));
    s = { ...s, unpack: { ...s.unpack, hp: 0 } };
    return { s, rng };
  };
  const specs = (process.env.PROBE_SPEC ?? '시뮬기본:4:0.3:0.6:0.3:0,시간반영:4:0.3:0.6:0.3:0.9').split(',').map((x) => { const [name, tps, strike, perfect, good, sSec] = x.split(':'); return { name, tps: +tps, strike: +strike, perfect: +perfect, good: +good, sSec: +sSec }; });
  const SEC = Number(process.env.PROBE_SEC ?? 120), TM = Number(process.env.PROBE_MULT ?? 115000);
  for (const pol of specs) {
    const { s: s0, rng } = mk(12345, TM);
    let s = s0;
    const b0 = eco.multBreakdown(s, 'tap');
    const unit = eco.tapStable(s);
    console.log(`\n[PROBE ${pol.name}] 초당행동 ${pol.tps}, 강타 ${pol.strike}, 퍼펙트 ${pol.perfect}, 굿 ${pol.good}, 강타 1회 소요 ${pol.sSec}초 | 총배율(피버 제외) x${(b0.total / b0.fever).toFixed(0)} (H ${b0.home.toFixed(0)} C ${b0.collection.toFixed(1)} 세트 ${b0.set.toFixed(2)}) | 탭 1회(피버 제외) ${unit.toExponential(2)} | ${SEC}초`);
    let w = initialWeak(rng), c = combo.initialCombo(), streak = 0, shield = gear.initialShield(0);
    const src = {}; // 이름 -> {n, base, box, prize}
    const add = (k, base, box, prize) => { const a = (src[k] ??= { n: 0, base: 0, box: 0, prize: 0 }); a.n++; a.base += base; a.box += box; a.prize += prize; };
    let t = 0, feverSec = 0, comboSum = 0, comboN = 0, chainSum = 0, chainN = 0, maxChain = 0, streakMax = 0, streakSum = 0, strikeN = 0, tapsSum = 0;
    const startEarned = s.earned;
    while (t < SEC) {
      const dt = 1 / pol.tps;
      const ms = t * 1000;
      const g = gear.gearEffects(s);
      if (s.fever.activeSec > 0) feverSec += dt;
      s = eco.tick(s, dt, rng);
      const wa = advanceWeak(w, dt * 1000, true, rng, g.weakDelayMult); w = wa.weak;
      const win = combo.comboWindowMs(s.fever.activeSec > 0);
      if (combo.comboExpired(c, ms, win)) c = combo.initialCombo();
      const cm = combo.comboMultOf(s, c.n);
      comboSum += cm; comboN++;
      const e0 = s.earned;
      let r, kind;
      if (weakVisible(w) && rng() < WEAK_HIT) {
        r = hitWeak(s, rng, w, cm); w = r.weak; c = combo.comboAdd(c, ms, r.comboAdd).combo; kind = '급소';
      } else if (rng() < pol.strike) {
        const pp = Math.min(0.97, pol.perfect * (g.perfectHalf / 0.05));
        const gp = Math.min(pol.good, 1 - pp);
        const q = rng();
        const pos = q < pp ? (CHARGE_PERFECT[0] + CHARGE_PERFECT[1]) / 2 : q < pp + gp ? CHARGE_GOOD[0] + 0.01 : 0.1;
        r = releaseCharge(s, rng, pos, streak, cm);
        const st = gear.resolveStreak(streak, r.grade, shield, g.shieldMax);
        streak = st.streak; shield = st.shield;
        streakMax = Math.max(streakMax, streak); streakSum += streak; strikeN++; tapsSum += r.taps;
        c = combo.comboAdd(c, ms, r.comboAdd).combo; kind = `강타-${r.grade}`;
      } else {
        const h = combo.comboHit(c, ms, win, false); c = h.combo;
        r = tapAndHit(s, rng, false, cm); kind = '일반탭';
      }
      s = r.state;
      const box = r.bursts.reduce((a, b) => a + b.gain, 0), prize = r.prize ? r.prize.gain : 0;
      add(kind, s.earned - e0 - box - prize, box, prize);
      if (r.chain > 0) { chainSum += r.chain; chainN++; maxChain = Math.max(maxChain, r.chain); }
      t += dt + (kind.startsWith('강타') ? pol.sSec : 0); // 강타하는 동안은 다른 행동을 못 한다(시간만 흐름)
      if (kind.startsWith('강타') && pol.sSec > 0) s = eco.tick(s, pol.sSec, rng);
    }
    const tot = s.earned - startEarned;
    const f = (x) => x.toExponential(2);
    console.log('수익원 | 횟수 | 직접(탭값x배수) /초 | 상자 보상 /초 | 연쇄 상금 /초 | 합계 /초 | 탭어치/초 | 비중');
    for (const [k, a] of Object.entries(src).sort((x, y) => y[1].base + y[1].box + y[1].prize - x[1].base - x[1].box - x[1].prize)) {
      const sum = a.base + a.box + a.prize;
      console.log(`${k} | ${a.n} | ${f(a.base / SEC)} | ${f(a.box / SEC)} | ${f(a.prize / SEC)} | ${f(sum / SEC)} | ${(sum / SEC / unit).toFixed(0)} | ${((sum / tot) * 100).toFixed(1)}%`);
    }
    const sumOf = (key) => Object.values(src).reduce((a, x) => a + x[key], 0);
    console.log(`합계 | | ${f(sumOf('base') / SEC)} | ${f(sumOf('box') / SEC)} | ${f(sumOf('prize') / SEC)} | ${f(tot / SEC)} | ${(tot / SEC / unit).toFixed(0)}탭어치/초 (사용자 실측 약 100)`);
    console.log(`부가: 피버 켜진 시간 ${((feverSec / SEC) * 100).toFixed(0)}% · 평균 콤보 배수 x${(comboSum / comboN).toFixed(2)} · 강타 ${strikeN}회(초당 ${(strikeN / SEC).toFixed(2)}), 평균 연속 퍼펙트 ${(streakSum / Math.max(1, strikeN)).toFixed(1)}(최대 ${streakMax}) · 강타 1회 평균 ${(tapsSum / Math.max(1, strikeN)).toFixed(0)}탭어치 · 상자 터진 행동당 평균 연쇄 ${(chainSum / Math.max(1, chainN)).toFixed(1)}(최대 ${maxChain}) · 최종 P ${s.points.toExponential(2)}`);
  }
  await vite.close();
  process.exit(0);
}

const fx = (x) => (x >= 1e4 ? x.toExponential(1) : x.toFixed(1));
const min = (sec) => (sec / 60).toFixed(1);
const med = (a) => { const b = [...a].sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
if (DECKS !== undefined) {
  const fs = await import('node:fs');
  /** { 정책: { 덱: [시드별 rows([{sec, marks}])] } } */
  const data = {};
  for (const f of (process.env.DECK_LOAD ?? '').split(',').filter(Boolean)) for (const [pn, byDeck] of Object.entries(JSON.parse(fs.readFileSync(f, 'utf8')))) for (const [dn, runs] of Object.entries(byDeck)) ((data[pn] ??= {})[dn] ??= []).push(...runs);
  for (const pol of POLICIES) for (const name of DECKS) (data[pol.name] ??= {})[name] = SEEDS.map((sd) => run(pol, sd, name === '없음' ? null : name).map((r) => ({ sec: r.sec, total: r.total, marks: r.marks, dig: r.dig, markActs: r.markActs, markMulti: r.markMulti, mult: r.mult, cards: r.cards })));
  if (process.env.DECK_DUMP) fs.writeFileSync(process.env.DECK_DUMP, JSON.stringify(data));
  const allNames = [...new Set(POLICIES.flatMap((p) => Object.keys(data[p.name] ?? {})))];
  const names = ['없음', ...Object.keys(ARCH), ...allNames.filter((n) => n !== '없음' && !ARCH[n])].filter((n) => allNames.includes(n));
  const archs = names.filter((n) => ARCH[n]);
  for (const pol of POLICIES) {
    const d = data[pol.name] ?? {};
    const secAt = (n, i) => (d[n] ?? []).map((r) => r[i]?.sec).filter((v) => v !== undefined);
    console.log(`\n[${pol.name}] 덱 정책별 집마다 걸린 분 중앙(없음 대비 증감 %, 음수가 단축) | 시드 ${SEEDS.length}개 | 원형 평균 = 원형 4개 중앙값의 평균 | 차이 = 가장 느린 원형 / 가장 빠른 원형`);
    console.log(['이사', ...names, '원형 평균', '차이'].join(' | '));
    const maxI = Math.max(...names.map((n) => Math.max(0, ...(d[n] ?? []).map((r) => r.length))));
    for (let i = 1; i < maxI; i++) {
      const base = secAt('없음', i);
      const bm = base.length ? med(base) : undefined;
      const cell = (n) => { const v = secAt(n, i); if (!v.length) return '-'; const m = med(v); return n === '없음' || bm === undefined ? `${min(m)}` : `${min(m)} (${((m / bm - 1) * 100).toFixed(0)}%)`; };
      const am = archs.map((n) => secAt(n, i)).filter((v) => v.length).map(med);
      const avg = am.length && bm !== undefined ? am.reduce((x, y) => x + y, 0) / am.length : undefined;
      console.log([`${i + 1}회 ${HOUSES[i - 1 + 1]?.name ?? ''}`.trim(), ...names.map(cell), avg === undefined ? '-' : `${min(avg)} (${((avg / bm - 1) * 100).toFixed(0)}%)`, am.length > 1 ? `x${(Math.max(...am) / Math.min(...am)).toFixed(2)}` : '-'].join(' | '));
    }
    // 집별 시간은 앞 집 결과에 끌려가므로, 첫 이사(덱이 열리기 전, 모든 정책에서 같음) 뒤부터 센 누적 분을 따로 낸다
    const post = (n, i) => (d[n] ?? []).map((r) => (r[i] && r[0] ? r[i].total - r[0].total : undefined)).filter((v) => v !== undefined);
    console.log(`첫 이사 뒤 누적 분 중앙(없음 대비 %): ${Array.from({ length: maxI - 1 }, (_, q) => q + 1).map((i) => { const b = post('없음', i); return `${i + 1}회까지 ${names.map((n) => { const v = post(n, i); return v.length && b.length ? (n === '없음' ? min(med(v)) : `${((med(v) / med(b) - 1) * 100).toFixed(0)}%`) : '-'; }).join('/')}`; }).join(' | ')}`);
    console.log(`\n[${pol.name}] 집별 공구함 배율(떠날 때, 원형별 시드 중앙) | 카드 완성 시점(집 시간 %, 그 원형 태그 카드 x 시드의 중앙. 못 찬 카드는 100 초과로 셈 / 찬 비율) | 원형 밖 카드 완성 중앙`);
    for (let i = 1; i < maxI; i++) {
      const parts = archs.map((n) => {
        const runs = (d[n] ?? []).map((r) => r[i]).filter((x) => x && x.cards);
        if (!runs.length) return `${n} -`;
        const mine = runs.flatMap((r) => r.cards.filter((c) => CARDS.find((cd) => cd.id === c.id)?.tags.includes(ARCH[n])));
        const other = runs.flatMap((r) => r.cards.filter((c) => !CARDS.find((cd) => cd.id === c.id)?.tags.includes(ARCH[n])));
        const at = (v) => (v.length ? med(v.map((c) => (c.at === null ? 999 : c.at * 100))) : NaN);
        const f = (x) => (x >= 999 ? '>100' : Number.isNaN(x) ? '-' : x.toFixed(0));
        return `${n} x${med(runs.map((r) => r.mult)).toFixed(1)} | ${f(at(mine))}(${mine.filter((c) => c.at !== null).length}/${mine.length}) | ${f(at(other))}(${other.filter((c) => c.at !== null).length}/${other.length})`;
      });
      console.log(`${i + 1}회: ${parts.join('  //  ')}`);
    }
    console.log(`\n[${pol.name}] 문턱 자릿수 d 후보(원형 4개 x 시드 중앙값. 집 시간 DQ(기본 10·22·35·50·66·82%) 시점의 log10(목표) - log10(번 P))`);
    for (let i = 1; i < maxI; i++) {
      const v = archs.flatMap((n) => (d[n] ?? []).map((r) => r[i]?.dig)).filter(Boolean);
      if (v.length) console.log(`  [${DIG_Q.map((_, k) => med(v.map((x) => x[k])).toFixed(2)).join(', ')}], // ${i + 1}번째 집(moves ${i}), ${v.length}개`);
    }
    console.log(`\n[${pol.name}] 문턱 k=1..6 통과 시점(집 시간 대비 %, 중앙(최소~최대)). 원형 = 원형 4개 x 시드 전체를 합쳐서 / 없음은 참고`);
    for (let i = 1; i < maxI; i++) {
      const at = (ns, k) => ns.flatMap((n) => (d[n] ?? []).map((r) => r[i]?.marks?.[k])).filter((v) => v !== undefined).map((v) => v * 100);
      const f = (v) => (v.length ? `${med(v).toFixed(0)}(${Math.min(...v).toFixed(0)}~${Math.max(...v).toFixed(0)})` : '-');
      console.log(`${i + 1}회 원형: ${DIG_Q.map((_, k) => f(at(archs, k))).join(' | ')}   / 없음: ${DIG_Q.map((_, k) => f(at(['없음'], k))).join(' | ')}`);
      const mr = archs.flatMap((n) => (d[n] ?? []).map((r) => r[i])).filter((x) => x && x.markActs !== undefined);
      const acts = mr.reduce((a, x) => a + x.markActs, 0), multi = mr.reduce((a, x) => a + x.markMulti, 0);
      console.log(`   한 행동에 문턱 2개 이상 ${multi}/${acts}회(${acts ? ((multi / acts) * 100).toFixed(1) : 0}%)`);
    }
  }
  await vite.close();
  process.exit(0);
}
const results = POLICIES.map((pol) => ({ pol, runs: SEEDS.map((sd) => run(pol, sd)) }));
const polMax = (pol) => Math.min(MAX_MOVES, pol.maxMoves ?? MAX_MOVES);
for (const { pol, runs } of results) {
  console.log(`\n[${pol.name}] 이사 | 걸린 분 중앙(최소~최대) | 누적 분 중앙 | 도달 시드 | 탭Lv | H | C | 총 배율(피버 제외) | 공구Lv(수평계·안전모·빠루·송곳·돋보기)`);
  for (let i = 0; i < polMax(pol); i++) {
    const rs = runs.map((r) => r[i]).filter(Boolean);
    if (rs.length === 0) { console.log(`${i + 1}회 도달 시드 없음`); continue; }
    const secs = rs.map((r) => r.sec), tot = rs.map((r) => r.total), m = rs[rs.length >> 1];
    console.log(`${i + 1}회 ${rs[0].to} | ${min(med(secs))} (${min(Math.min(...secs))}~${min(Math.max(...secs))}) | ${min(med(tot))} | ${rs.length}/${SEEDS.length} | ${med(rs.map((r) => r.tapLv)).toFixed(0)} | x${fx(med(rs.map((r) => r.H)))} | x${fx(med(rs.map((r) => r.C)))} | x${fx(med(rs.map((r) => r.M)))} | ${m.gear}`);
  }
}

// 첫 가이드·J 커브 출력(첫 집 구간)
const realRes0 = (i) => results.find((x) => x.pol.name === '현실')?.runs.map((r) => r[i]).filter(Boolean) ?? [];
const first = (pol) => results.find((x) => x.pol.name === pol)?.runs.map((r) => r[0]).filter(Boolean) ?? [];
const secs = (v) => (v === undefined ? '-' : v < 100 ? `${v.toFixed(0)}초` : `${(v / 60).toFixed(1)}분`);
const stuckRuns = (pol) => results.find((x) => x.pol.name === pol)?.runs.filter((r) => r.length === 0) ?? [];
const nSteps = guide.GUIDE_STEPS.length;
/** 한 단계 최대 걸린 초(이사 단계 제외)와 그 단계 */
const worstGap = (rr) => {
  let worst = 0, wi = 0;
  for (const r of rr) for (let i = 0; i < nSteps - 1; i++) { if (r.stepAt?.[i] === undefined) continue; const d = r.stepAt[i] - (i ? r.stepAt[i - 1] : 0); if (d > worst) { worst = d; wi = i; } }
  return { worst, wi };
};
for (const { pol } of results) {
  const rs = first(pol.name);
  console.log(`\n[${pol.name}] 가이드 단계별 완료 시각(첫 집, 시드 중앙값 / 최대) · 한 단계 최대 걸린 초`);
  const line = [];
  for (let i = 0; i < nSteps; i++) {
    const at = rs.map((r) => r.stepAt?.[i]).filter((v) => v !== undefined);
    line.push(`${i + 1}.${guide.GUIDE_STEPS[i].id} ${at.length ? secs(med(at)) : '-'}/${at.length ? secs(Math.max(...at)) : '-'}`);
  }
  console.log(line.join(' | '));
  const done = rs.filter((r) => r.stepAt?.length === nSteps).length;
  const wg = worstGap(rs);
  console.log(`전 단계 완료 ${done}/${SEEDS.length}, 한 단계 최대 ${wg.worst.toFixed(0)}초(${wg.wi + 1}.${guide.GUIDE_STEPS[wg.wi].id}, 이사 단계 제외), 교착(이사 못 한 시드) ${stuckRuns(pol.name).length}`);
  for (const r of stuckRuns(pol.name)) if (r.stuck) console.log(`  교착: 단계 ${r.stuck.step + 1}에서 ${secs(r.stuck.t)} 경과(누적 ${r.stuck.earned.toExponential(1)}, 탭Lv ${r.stuck.lv}; 1e3·1e6·1e9·1e12 ${[3, 6, 9, 12].map((k) => secs(r.stuck.crossAt[k])).join('·')})`);
  console.log(`누적 P 1e3·1e6·1e9·1e12·1e15 도달(중앙): ${[3, 6, 9, 12, 15].map((k) => secs(med(rs.map((r) => r.crossAt[k]).filter((v) => v !== undefined)))).join(' · ')}, 이사 ${secs(med(rs.map((r) => r.sec)))}`);
  console.log(`자릿수 증가 속도(자릿수/분): 초반 1/3 ${med(rs.map((r) => r.jEarly)).toFixed(2)} -> 가운데 1/3 ${med(rs.map((r) => r.jMid)).toFixed(2)} -> 마지막 1/3 ${med(rs.map((r) => r.jLate)).toFixed(2)}`);
  console.log(`첫 특전 시각(중앙) ${secs(med(rs.map((r) => r.firstPerkAt).filter((v) => v !== undefined)))}, 이사 때까지 산 특전 상자 수(첫 집, 중앙) ${med(rs.map((r) => r.perkBoxes))}`);
  console.log(`1분 최대 배수(누적 1e3 이후 시작): 중앙 x${(10 ** med(rs.map((r) => r.maxMin))).toExponential(1)} (최대 x${(10 ** Math.max(...rs.map((r) => r.maxMin))).toExponential(1)}), 그 구간 시작 ${secs(med(rs.map((r) => r.maxMinAt)))}`);
}
console.log('\n[현실] 집마다 산 특전 상자 수(중앙)');
console.log([0, 1, 2, 3, 4].map((i) => { const rr = realRes0(i); return rr.length ? `${i + 1}회 ${med(rr.map((r) => r.perkBoxes))}` : null; }).filter(Boolean).join(' | '));
console.log('\n[현실] 시드별 걸린 분');
const realRes = results.find((x) => x.pol.name === '현실');
realRes?.runs.forEach((r, k) => console.log(`시드 ${SEEDS[k]}: ${r.map((x) => min(x.sec)).join(' / ')}${process.env.STEPS && r[0] ? ' | ' + r[0].stepAt.map((v) => v.toFixed(0)).join(',') : ''}`));
const stat = (pol, i) => { const rr = results.find((x) => x.pol.name === pol)?.runs.map((r) => r[i]).filter(Boolean) ?? []; return rr.length ? { sec: med(rr.map((r) => r.sec)), total: med(rr.map((r) => r.total)) } : null; };
const ok = (b) => (b ? 'OK' : 'NG');
const j = [];
const rs0 = () => first('현실');
const b1 = stat('현실', 0), b2 = stat('현실', 1), b3 = stat('현실', 2), bm = stat('현실', MOON_STAGE);
if (b1) {
  const a = b1.sec / 60;
  j.push(`1. 첫 이사 ${a.toFixed(1)}분 (10~12): ${ok(a >= 10 && a <= 12)}`);
  const rs = first('현실');
  const early = rs.map((r) => r.stepAt?.[2]).filter((v) => v !== undefined);
  j.push(`0. 첫 특전 ${secs(med(rs0().map((r) => r.firstPerkAt)))} (7~9분, 영구 공구 단계 뒤), 첫 집 특전 상자 ${med(rs0().map((r) => r.perkBoxes))}개 (3~5), 2·3번째 집 ${[1, 2].map((i) => med(realRes0(i).map((r) => r.perkBoxes))).join('·')}개 (5~10)`);
  j.push(`2a. 3단계까지 ${secs(med(early))} (<= 60초): ${ok(early.length > 0 && med(early) <= 60)}`);
  const all = rs.length === SEEDS.length; // 이사를 못 한 시드(교착)가 없다. 운 좋은 시드가 이사를 앞당겨 뒤 단계를 못 거치는 것은 허용
  const wg = worstGap(rs);
  const seedWorst = rs.map((r) => worstGap([r]).worst);
  const wmed = med(seedWorst);
  j.push(`2b. 교착 0 ${ok(all)}(전 단계 완료 ${rs.filter((r) => r.stepAt?.length === nSteps).length}/${SEEDS.length}), 시드별 한 단계 최대의 중앙 ${wmed.toFixed(0)}초 (<= 120, 판정) / 가장 느린 시드 ${wg.worst.toFixed(0)}초(${wg.wi + 1}.${guide.GUIDE_STEPS[wg.wi].id}): ${ok(all && wmed <= 120)}`);
  const tail = rs.map((r) => r.sec - (r.stepAt?.[10] ?? NaN)).filter((v) => !Number.isNaN(v));
  j.push(`2c. 영구 공구 열림(11단계 완료) -> 이사 ${med(tail).toFixed(0)}초 (120~180): ${ok(tail.length === rs.length && med(tail) >= 120 && med(tail) <= 180)}`);
  const opens = guide.GUIDE_STEPS.map((st, i) => (st.opens ? `${st.opens} ${secs(med(rs.map((r) => r.stepAt?.[i - 1] ?? 0)))}` : null)).filter(Boolean);
  j.push(`   요소 열림 시각(중앙, 이사 ${secs(b1.sec)}): ${opens.join(' · ')}`);
  const g12 = med(rs.map((r) => (r.stepAt?.[11] ?? NaN) - (r.stepAt?.[10] ?? NaN)));
  j.push(`5. 12단계(영구 공구 구매) 걸린 ${g12.toFixed(0)}초 (<= 45): ${ok(g12 <= 45)}`);
  const jm = med(rs.map((r) => r.jMid)), jl = med(rs.map((r) => r.jLate)), je = med(rs.map((r) => r.jEarly));
  j.push(`3a. 자릿수/분 초반 ${je.toFixed(2)} <= 가운데 ${jm.toFixed(2)} <= 마지막 ${jl.toFixed(2)} (이상형): ${ok(je <= jm && jm <= jl)}`);
  j.push(`3b. 마지막 1/3 ${jl.toFixed(2)} >= 가운데 1/3 x 0.7 (${(0.7 * jm).toFixed(2)}): ${ok(jl >= 0.7 * jm)}`);
  const mm = 10 ** Math.max(...rs.map((r) => r.maxMin));
  j.push(`3c. 1분 최대 배수(시드 최대) x${mm.toExponential(1)} (<= 1e3): ${ok(mm <= 1e3)}`);
  if (b2) j.push(`4a. 2회 ${(b2.sec / 60).toFixed(1)}분 (4~7): ${ok(b2.sec / 60 >= 4 && b2.sec / 60 <= 7)}`);
  if (b3) j.push(`4b. 3회 ${(b3.sec / 60).toFixed(1)}분 (12~20): ${ok(b3.sec / 60 >= 12 && b3.sec / 60 <= 20)}`);
  if (bm) j.push(`4c. 달 기지(${MOON_STAGE + 1}번째 집 도착) 누적 ${(bm.total / 3600).toFixed(2)}시간 (1.5~2.9): ${ok(bm.total / 3600 >= 1.5 && bm.total / 3600 <= 2.9)}`);
  const p = first('고수');
  if (p.length) j.push(`참고: 고수 첫 이사 ${secs(med(p.map((r) => r.sec)))} (현실 대비 x${(b1.sec / med(p.map((r) => r.sec))).toFixed(2)} 빠름), 한 단계 최대 ${worstGap(p).worst.toFixed(0)}초`);
  const l = first('가볍게');
  if (l.length) j.push(`참고: 가볍게 첫 이사 ${secs(med(l.map((r) => r.sec)))} (현실 대비 x${(med(l.map((r) => r.sec)) / b1.sec).toFixed(2)} 느림), 한 단계 최대 ${worstGap(l).worst.toFixed(0)}초`);
} else j.push('NG: 현실 정책이 시간 안에 첫 이사를 못 함');
console.log('\n판정(현실 정책 중앙값)\n' + j.join('\n'));
await vite.close();
