import {
  BOX_KINDS,
  ENDLESS_K_MULT,
  ENDLESS_TAPS,
  ENDLESS_TOOL_STEP,
  TIER_BASE,
  TIER_STEP,
  BOX_PATTERN,
  GOLD_GAIN_MULT,
  RUSH_SEC,
  SPECIAL_FREE_BOXES,
  SPECIAL_GAP,
  SPECIAL_RATE,
  SPECIAL_WEIGHTS,
  NONCRIT_CAP,
  CHAIN_BONUS_CAP,
  CHAIN_BONUS_STEP,
  CHAIN_PRIZES,
  ROOM_BOXES,
  ROOM_ITEMS,
  TOOLS,
  UNPACK_HP_BASE,
  UNPACK_HP_GROWTH,
  type BoxKind,
  type SpecialBox,
  type ToolDef,
} from '../data/unpack';
import type { BoxResult } from './gacha';
import { tapBase, tapValue } from './economy';
import { gearEffects } from './gear';
import { featureOpen } from './guide';
import { checkMarks, chargeOnStrike, deckChargeResult, deckCountFeverBoxes, deckEffects, deckEvent, type DeckChargeResult, type DeckFire } from './deck';
import { chargeFever, feverMultOf } from './fever';
import { perkEffects, seededRng, tapPowerMult } from './perks';
import { HOME_SLOTS, type GameState } from './state';
import { grantFreeBox, tapWithRng, type TapResult } from './variety';

/** k번째(0부터) 상자 종류. 80개 뒤(살림 손질)도 같은 10개 묶음이 이어진다(80은 10의 배수) */
export function boxKind(k: number): BoxKind {
  return BOX_PATTERN[k % BOX_PATTERN.length];
}

/** 정수 두 개를 섞는 간단한 해시(정수 연산만). 결과는 0 이상 2^32 미만 */
function mix(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return h >>> 0;
}

/** 간격 규칙 전의 후보: 큰 상자 자리와 처음 20개는 없고, 나머지는 rate 확률로 가중치에 따라 종류가 정해진다 */
function specialCandidate(salt: number, k: number, rate: number): SpecialBox | null {
  if (k < SPECIAL_FREE_BOXES || boxKind(k) === 'big') return null;
  if (mix(salt, k) / 4294967296 >= rate) return null;
  const kinds = Object.keys(SPECIAL_WEIGHTS) as SpecialBox[];
  let r = mix(salt ^ 0x5bd1e995, k) % kinds.reduce((a, x) => a + SPECIAL_WEIGHTS[x], 0);
  for (const kind of kinds) {
    if (r < SPECIAL_WEIGHTS[kind]) return kind;
    r -= SPECIAL_WEIGHTS[kind];
  }
  return null;
}

/**
 * k번째 상자의 특별 종류(결정적). 직전 4개 안에 특별 상자가 있으면 일반 상자.
 * 후보 없이 4칸이 이어진 곳까지 거슬러 올라가 거기서부터 앞으로 확정하므로 비용이 작다.
 */
export function specialAt(salt: number, k: number, rate = SPECIAL_RATE): SpecialBox | null {
  const kind = specialCandidate(salt, k, rate);
  if (!kind) return null;
  let start = k;
  for (let run = 0; start > 0 && run < SPECIAL_GAP; ) {
    start--;
    run = specialCandidate(salt, start, rate) ? 0 : run + 1;
  }
  let last = -Infinity;
  for (let j = start; j < k; j++) if (specialCandidate(salt, j, rate) && j - last > SPECIAL_GAP) last = j;
  return k - last > SPECIAL_GAP ? kind : null;
}

/** 지금 상자(offset 0)와 다음 상자들(offset 1, 2…)의 특별 종류. 화면의 대기 상자 표시용 */
export function boxSpecial(state: GameState, offset = 0): SpecialBox | null {
  return featureOpen(state, 'special') ? specialAt(state.unpack.salt, state.unpack.box + offset, gearEffects(state).specialRate) : null;
}

/** 새 게임·이사 때 뽑는 salt(0 이상 2^31 미만 정수) */
export function rollSalt(rng: () => number): number {
  return Math.floor(rng() * 2147483648);
}

/** 살림 레벨 -> 단계(0 기본 / 1 은 / 2 금 / 3 무지개 / 4+ 반짝 단계). 문턱 3·12·48·192… */
export function tierOf(lv: number): number {
  let tier = 0;
  for (let thr = TIER_BASE; lv >= thr; thr *= TIER_STEP) tier++;
  return tier;
}

/** 다음 단계 문턱까지 남은 레벨 */
export function toNextTier(lv: number): number {
  let thr = TIER_BASE;
  while (lv >= thr) thr *= TIER_STEP;
  return thr - lv;
}

/** 손질 큰 상자가 올릴 살림 칸: 단계가 가장 낮은 칸들 중 다음 문턱까지 가장 가까운 칸(같으면 앞 칸) */
export function nextCareSlot(state: GameState): number {
  const lv = state.homeLv;
  let best = 0;
  for (let i = 1; i < HOME_SLOTS; i++) {
    const dt = tierOf(lv[i]) - tierOf(lv[best]);
    if (dt < 0 || (dt === 0 && toNextTier(lv[i]) < toNextTier(lv[best]))) best = i;
  }
  return best;
}

/** 손질 단계(k >= 80) 상자 HP = ceil(힘 x 종류별 탭 수 x 0.75^도구 단계). 상자가 올 때 한 번 정해 저장한다 */
export function endlessHp(state: GameState, k: number): number {
  const toolIdx = TOOLS.indexOf(toolOf(state.tapLevel));
  return Math.max(1, Math.ceil(unpackPower(state) * ENDLESS_TAPS[boxKind(k)] * ENDLESS_TOOL_STEP ** toolIdx - 1e-9));
}

/** k번째 상자의 HP(방 단계는 고정식, 손질 단계는 지금 힘·도구 기준) */
export function hpFor(state: GameState, k: number): number {
  return k < ROOM_BOXES ? boxHp(k) : endlessHp(state, k);
}

/** 지금 상자의 HP. 저장값이 없으면 계산한다 */
export function currentHp(state: GameState): number {
  return state.unpack.hp >= 1 ? state.unpack.hp : hpFor(state, state.unpack.box);
}

export function boxHp(k: number): number {
  return Math.ceil(UNPACK_HP_BASE * UNPACK_HP_GROWTH ** k * BOX_KINDS[boxKind(k)].hpMult - 1e-9);
}

/** 힘 = tapBase(탭 강화 Lv) x (1 + 손목 단련 Lv). P와 달리 영구·도감·이벤트 배율은 넣지 않는다 */
export function unpackPower(state: GameState): number {
  return Math.round(tapBase(state.tapLevel) * tapPowerMult(state));
}

export function toolOf(level: number): ToolDef {
  let tool = TOOLS[0];
  for (const t of TOOLS) if (level >= t.minLevel) tool = t;
  return tool;
}

export interface BoxBurst {
  kind: BoxKind;
  /** 터진 상자 순번(0부터) */
  k: number;
  /** 얻은 P 덩어리(강타 연쇄 보너스 반영) */
  gain: number;
  /** 한 번의 강타에서 몇 번째로 터졌는가(1부터). 탭 하나로 터졌으면 1 */
  chain: number;
  /** 특별 상자 종류. 일반 상자는 null */
  special: SpecialBox | null;
  /** 폭탄에 휩쓸려 터졌는가(내구도와 상관없이 함께 터진 상자) */
  blast: boolean;
  /** 살림 id. 큰 상자(완성)에서만, 덤 짐은 없음 */
  item?: string;
  /** 살림 칸 번호(0~7). 덤 짐은 없음 */
  slot?: number;
  /** 터진 뒤 그 칸의 채움 비율(0.1~1). 덤 짐은 0 */
  slotFill: number;
  /** 80번째가 터져 방이 완성된 순간 */
  roomDone: boolean;
  /** 방 완성 때 받은 무료 사은품 상자(freeBoxes[0]과 같다. 단계 상승 사은품만 받았어도 첫 번째가 들어간다) */
  freeBox?: BoxResult;
  /** 이 터짐에서 받은 무료 사은품 상자 전부(방 완성 사은품 -> 단계 상승 사은품 순서) */
  freeBoxes: BoxResult[];
  /** 큰 상자가 살림 레벨을 올렸을 때: 올라간 칸, 새 레벨, 단계가 올랐는가 */
  care?: { slot: number; lv: number; tierUp: boolean };
}

export interface HitOptions {
  crit: boolean;
  damped: boolean;
  /** 이 탭에 적용할 피버 피해 배율(탭 전 상태 기준, 보통 1 또는 3) */
  feverMult: number;
  /** 방 완성 사은품 난수. 생략하면 상자 순번 기반 고정 시드 */
  rng?: () => number;
  /** 치명타 배율(perkEffects 값). 생략하면 현재 상태의 값 */
  critMult?: number;
  /** 강타·급소: 비치명타도 상자의 남은 내구도까지 한 번에 깎는다(hp/3 제한 없음) */
  pierce?: boolean;
  /** 터질 때 받는 P 덩어리에 곱할 연쇄 보너스. 생략하면 1 */
  gainMult?: number;
  /** 이번 터짐이 연쇄 몇 번째인가(1부터). 생략하면 1 */
  chain?: number;
  /** 폭탄 폭발: 내구도와 상관없이 지금 상자를 터뜨린다 */
  force?: boolean;
  /** 폭탄에 휩쓸린 터짐 표시 */
  blast?: boolean;
}

/** 상자 1탭 피해와 터짐 처리. 감쇠 탭은 피해 0. */
export function hitBox(state: GameState, o: HitOptions): { state: GameState; burst: BoxBurst | null } {
  if (o.damped) return { state, burst: null };
  const { box: k, damage } = state.unpack;
  const hp = currentHp(state);
  if (!o.force) {
    let dmg = unpackPower(state) * (o.crit ? (o.critMult ?? perkEffects(state).critMult) : 1) * o.feverMult;
    if (!o.crit && !o.pierce) dmg = Math.min(dmg, Math.ceil(hp * NONCRIT_CAP));
    const total = damage + dmg;
    if (total < hp) return { state: { ...state, unpack: { ...state.unpack, damage: total } }, burst: null };
  }

  const kind = boxKind(k);
  const natural = boxSpecial(state);
  const forced = natural === null && state.deck.buff.forceBomb;
  const special = forced ? 'bomb' : natural;
  const gain =
    (tapValue(state) / feverMultOf(state.fever, deckEffects(state).feverMultAdd)) * BOX_KINDS[kind].k * (k < ROOM_BOXES ? 1 : ENDLESS_K_MULT) * (o.gainMult ?? 1) * (special === 'gold' ? GOLD_GAIN_MULT + deckEffects(state).goldMultAdd : 1);
  const inRoom = k < ROOM_BOXES;
  const slot = inRoom ? Math.floor(k / BOX_PATTERN.length) : undefined;
  const within = k % BOX_PATTERN.length;
  const completes = inRoom && k === ROOM_BOXES - 1 && !state.unpack.roomDone;
  let next: GameState = {
    ...state,
    deck: forced ? { ...state.deck, buff: { ...state.deck.buff, forceBomb: false } } : state.deck,
    points: state.points + gain,
    earned: state.earned + gain,
    stats: { ...state.stats, totalEarned: state.stats.totalEarned + gain },
    unpack: {
      ...state.unpack,
      box: k + 1,
      damage: 0,
      roomDone: state.unpack.roomDone || completes,
      hp: 0,
      rushSec: special === 'clock' ? state.unpack.rushSec + RUSH_SEC : state.unpack.rushSec,
    },
  };
  next.unpack.hp = hpFor(next, k + 1);
  const rng = o.rng ?? seededRng(k * 7919 + 3);
  const freeBoxes: BoxResult[] = [];
  if (completes) {
    const g = grantFreeBox(next, rng);
    next = g.state;
    freeBoxes.push(g.result);
  }
  let care: BoxBurst['care'];
  if (kind === 'big') {
    const cs = inRoom ? (slot as number) : nextCareSlot(next);
    const lv = next.homeLv[cs] + 1;
    const tierUp = tierOf(lv) > tierOf(next.homeLv[cs]);
    next = { ...next, homeLv: next.homeLv.map((x, i) => (i === cs ? lv : x)) };
    care = { slot: cs, lv, tierUp };
    if (tierUp) {
      const g = grantFreeBox(next, rng);
      next = g.state;
      freeBoxes.push(g.result);
    }
  }
  const burst: BoxBurst = {
    kind,
    k,
    gain,
    chain: o.chain ?? 1,
    special,
    blast: o.blast === true,
    slotFill: inRoom ? (kind === 'big' ? 1 : (within + 1) / BOX_PATTERN.length) : 0,
    roomDone: completes,
    freeBoxes,
  };
  if (slot !== undefined) burst.slot = slot;
  if (slot !== undefined && kind === 'big') burst.item = ROOM_ITEMS[slot].id;
  if (freeBoxes.length > 0) burst.freeBox = freeBoxes[0];
  if (care) burst.care = care;
  return { state: next, burst };
}

/**
 * 한 번의 피해(hitBox)와 그 뒤의 폭발. 터진 상자는 bursts 뒤에 붙고 연쇄 보너스·순번은 bursts 길이를 따른다.
 * 폭탄이 터지면 뒤따르는 BOMB_BLAST개가 내구도와 상관없이 함께 터지고, 휩쓸린 폭탄은 거기서 다시 BOMB_BLAST개를 터뜨린다.
 */
function hitChained(state: GameState, base: HitOptions, bursts: BoxBurst[]): GameState {
  const opts = (extra: Partial<HitOptions>): HitOptions => ({ ...base, gainMult: featureOpen(state, 'chain') ? chainBonus(bursts.length, gearEffects(state).chainCap, deckEffects(state).chainStep) : 1, chain: bursts.length + 1, ...extra });
  const h = hitBox(state, opts({}));
  if (!h.burst) return h.state;
  bursts.push(h.burst);
  let next = h.state;
  const blast = deckEffects(state).bombBlast;
  let pending = h.burst.special === 'bomb' ? blast : 0;
  while (pending > 0) {
    pending--;
    const b = hitBox(next, opts({ force: true, blast: true }));
    next = b.state;
    if (!b.burst) continue;
    bursts.push(b.burst);
    if (b.burst.special === 'bomb') pending += blast;
  }
  return next;
}

/** 연쇄 상금(5·10·20개 이상). 없으면 null. 상금은 시작 상태 기준 탭 1회 수익(피버 제외) x taps */
function chainPrize(start: GameState, state: GameState, chain: number): { state: GameState; prize: HeavyResult['prize'] } {
  if (!featureOpen(start, 'chain')) return { state, prize: null };
  for (let t = CHAIN_PRIZES.length - 1; t >= 0; t--) {
    if (chain < CHAIN_PRIZES[t].n) continue;
    const gain = (tapValue(start) / feverMultOf(start.fever, deckEffects(start).feverMultAdd)) * CHAIN_PRIZES[t].taps;
    return {
      prize: { tier: t as 0 | 1 | 2, n: chain, gain },
      state: { ...state, points: state.points + gain, earned: state.earned + gain, stats: { ...state.stats, totalEarned: state.stats.totalEarned + gain } },
    };
  }
  return { state, prize: null };
}

function tapCore(state: GameState, rng: () => number, damped: boolean, comboMult: number, charge: boolean): HeavyResult {
  const feverMult = feverMultOf(state.fever, deckEffects(state).feverMultAdd);
  const r = tapWithRng(state, rng, damped, comboMult);
  const bursts: BoxBurst[] = [];
  const start = charge ? r.state : { ...r.state, fever: state.fever };
  const next = hitChained(start, { crit: r.crit, damped, feverMult, rng, critMult: perkEffects(state).critMult }, bursts);
  const chain = bursts.length;
  const p = chainPrize(state, next, chain);
  let out = p.state;
  if (chain > 1 && chain > out.bestChain) out = { ...out, bestChain: chain };
  const d = settleDeck(state, out, 0, bursts, false);
  return { ...r, state: d.state, burst: chain > 0 ? bursts[chain - 1] : null, bursts, chain, prize: p.prize, deckFires: [], deckOffered: d.offered, deckCharge: d.charge };
}

/**
 * 탭 1회 + 상자 피해. tapWithRng의 crit 판정을 그대로 쓴다(난수 1회, 방 완성 때만 추가). comboMult는 gain에만 곱하고 상자 피해에는 곱하지 않는다.
 * 폭탄 상자가 터지면 여러 개가 함께 터지므로 강타와 같은 모양으로 `bursts`·`chain`·`prize`도 돌려준다(`burst`는 마지막으로 터진 상자).
 */
export function tapAndHit(state: GameState, rng: () => number, damped = false, comboMult = 1): HeavyResult {
  return tapCore(state, rng, damped, comboMult, true);
}

/** 러시(시계 상자) 탭: 일반 탭과 같은 피해·보상·치명타지만 피버 게이지를 올리지 않는다. 열기·콤보는 화면이 다룬다 */
export function rushTap(state: GameState, rng: () => number, comboMult = 1): HeavyResult {
  return tapCore(state, rng, false, comboMult, false);
}

export interface HeavyResult extends TapResult {
  /** 마지막으로 터진 상자(없으면 null). 여러 개가 터졌으면 전부 `bursts`에 순서대로 */
  burst: BoxBurst | null;
  bursts: BoxBurst[];
  /** 이번에 터진 상자 수(= bursts.length) */
  chain: number;
  /** 연쇄 상금(5·10·20개 이상). 없으면 null. tier는 CHAIN_PRIZES 인덱스 */
  prize: { tier: 0 | 1 | 2; n: number; gain: number } | null;
  /** 이번 강타에 터진 공구함 카드(강타·급소만. 카드마다 한 줄, 곱하는 카드는 `releaseCharge`가 앞에 붙인다). 보상 카드는 `gain`(P)이 이미 `state`에 들어 있다 */
  deckFires: DeckFire[];
  /** 이번에 진행 문턱을 넘어 카드 3택 묶음이 새로 생겼는가(`state.deck.offers`에 들어 있다) */
  deckOffered: boolean;
  /** 이번 강타의 공구함 충전 결과(일반 탭·러시는 변화 없음: `full` 빈 배열, 전·후 같음). `releaseCharge`는 정밀 충전까지 합친 값으로 덮어쓴다 */
  deckCharge: DeckChargeResult;
}

/** 공구함 정산: 강타 사건의 보상 카드(탭 1회 수익 x taps, 연쇄 상금과 같은 방식)를 P·누적에 더하고, 진행 문턱을 판정한다. 일반 탭은 chain을 0으로 넘겨 문턱만 본다 */
function settleDeck(start: GameState, state: GameState, chain: number, bursts: readonly BoxBurst[], strike: boolean): { state: GameState; fires: DeckFire[]; offered: boolean; charge: DeckChargeResult } {
  let out = deckCountFeverBoxes(state, bursts.length);
  const fires = chain > 0 ? deckEvent(out, { chain, gold: out.deck.slots.length > 0 ? bursts.reduce((n, b) => n + (b.special === 'gold' ? 1 : 0), 0) : 0 }) : [];
  if (fires.length > 0) {
    const unit = tapValue(start) / feverMultOf(start.fever, deckEffects(start).feverMultAdd);
    let gain = 0;
    for (const f of fires) {
      if (f.taps === undefined) continue;
      f.gain = unit * f.taps;
      gain += f.gain;
    }
    if (gain > 0) out = { ...out, points: out.points + gain, earned: out.earned + gain, stats: { ...out.stats, totalEarned: out.stats.totalEarned + gain } };
  }
  if (strike) out = chargeOnStrike(out, { chain, specials: bursts.reduce((n, b) => n + (b.special ? 1 : 0), 0), feverBefore: start.fever.activeSec > 0, feverAfter: out.fever.activeSec > 0 });
  const marked = checkMarks(out);
  return { state: marked, fires, offered: marked.deck.mark > out.deck.mark, charge: deckChargeResult(start, marked) };
}

/** i번째(0부터) 터진 상자의 연쇄 보너스 배율 */
export function chainBonus(i: number, cap = CHAIN_BONUS_CAP, step = CHAIN_BONUS_STEP): number {
  return 1 + step * Math.min(i, cap);
}

/**
 * 탭 taps번어치를 한 번에: 수익 = 탭 1회 수익 x taps x comboMult, 치명타는 한 번만 굴려 터지면 수익·타격 전체에 배율(상자 피해 상한도 풀린다).
 * 상자 피해는 탭 1회 피해 x taps를 한 타씩 넣어 `tapAndHit`을 taps번 부른 것과 같게 처리한다(터지면 보상·다음 상자, 남는 타격은 다음 상자로 이어진다).
 * 강타는 상자를 뚫는다: 탭 한 단위가 상자 하나를 끝낼 수 있고(hp/3 제한 없음), 터진 순서대로 연쇄 보너스가 붙으며, 5·10·20개 이상이면 연쇄 상금을 더한다. 최고 연쇄도 갱신한다.
 * 피버는 feverCharge만 채우고 피버 피해 배율은 시작 상태 기준 하나로 쓴다. 감쇠 없음.
 */
export function heavyHit(state: GameState, rng: () => number, taps: number, comboMult = 1, feverCharge = taps): HeavyResult {
  const feverMult = feverMultOf(state.fever, deckEffects(state).feverMultAdd);
  const critMult = perkEffects(state).critMult;
  const r = tapWithRng(state, rng, false, comboMult * taps);
  const fx = perkEffects(state);
  let next: GameState = {
    ...r.state,
    fever: featureOpen(state, 'fever') ? chargeFever(state.fever, fx.feverSec, feverCharge * fx.feverCharge) : state.fever,
    stats: { ...r.state.stats, totalTaps: state.stats.totalTaps + taps },
  };
  const bursts: BoxBurst[] = [];
  for (let i = 0; i < taps; i++) {
    next = hitChained(next, { crit: r.crit, damped: false, feverMult, rng, critMult, pierce: featureOpen(state, 'chain') }, bursts);
  }
  const chain = bursts.length;
  const p = chainPrize(state, next, chain);
  next = p.state;
  const prize = p.prize;
  if (chain > next.bestChain) next = { ...next, bestChain: chain };
  const d = settleDeck(state, next, chain, bursts, true);
  return { ...r, state: d.state, burst: chain > 0 ? bursts[chain - 1] : null, bursts, chain, prize, deckFires: d.fires, deckOffered: d.offered, deckCharge: d.charge };
}

export interface RoomProgress {
  /** 이 집에서 연 상자 수(80 상한) */
  opened: number;
  total: number;
  /** 완성된 살림 칸 수 */
  slotsDone: number;
  /** 지금 채우는 칸의 채움 비율(0~0.9). 방을 다 채웠으면 0 */
  slotFill: number;
  complete: boolean;
  /** 손질 단계에서 지금 묶음의 진행(0~9). 방 단계는 0 */
  careStep: number;
  /** 살림 레벨 합 */
  lvSum: number;
}

export function roomProgress(state: GameState): RoomProgress {
  const opened = Math.min(state.unpack.box, ROOM_BOXES);
  const per = BOX_PATTERN.length;
  return {
    opened,
    total: ROOM_BOXES,
    slotsDone: Math.floor(opened / per),
    slotFill: opened >= ROOM_BOXES ? 0 : (opened % per) / per,
    complete: state.unpack.roomDone,
    careStep: state.unpack.box >= ROOM_BOXES ? (state.unpack.box - ROOM_BOXES) % per : 0,
    lvSum: state.homeLv.reduce((a, b) => a + b, 0),
  };
}

export interface BoxCondition {
  kind: BoxKind;
  k: number;
  hp: number;
  damage: number;
  /** 남은 내구도 비율(1 = 멀쩡, 0 직전) */
  ratio: number;
  /** 겉모습 단계(0부터). 보통·작은 3단계, 큰 상자 4단계 */
  stage: number;
  stages: number;
}

export function boxCondition(state: GameState): BoxCondition {
  const { box: k, damage } = state.unpack;
  const kind = boxKind(k);
  const hp = currentHp(state);
  const ratio = Math.max(0, Math.min(1, 1 - damage / hp));
  const stage = ratio > 2 / 3 ? 0 : ratio > 1 / 3 ? 1 : kind === 'big' && ratio <= 0.15 ? 3 : 2;
  return { kind, k, hp, damage, ratio, stage, stages: kind === 'big' ? 4 : 3 };
}
