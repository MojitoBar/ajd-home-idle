import {
  BOX_KINDS,
  ENDLESS_K_MULT,
  ENDLESS_TAPS,
  ENDLESS_TOOL_STEP,
  TIER_BASE,
  TIER_STEP,
  BOX_PATTERN,
  NONCRIT_CAP,
  ROOM_BOXES,
  ROOM_ITEMS,
  TOOLS,
  UNPACK_HP_BASE,
  UNPACK_HP_GROWTH,
  type BoxKind,
  type ToolDef,
} from '../data/unpack';
import type { BoxResult } from './gacha';
import { tapBase, tapValue } from './economy';
import { chargeFever, feverMultOf } from './fever';
import { perkEffects, seededRng, tapPowerMult } from './perks';
import { HOME_SLOTS, type GameState } from './state';
import { grantFreeBox, tapWithRng, type TapResult } from './variety';

/** k번째(0부터) 상자 종류. 80개 뒤(살림 손질)도 같은 10개 묶음이 이어진다(80은 10의 배수) */
export function boxKind(k: number): BoxKind {
  return BOX_PATTERN[k % BOX_PATTERN.length];
}

/** 살림 레벨 -> 단계(0 기본 / 1 은 / 2 금 / 3 무지개 / 4+ 반짝 단계). 문턱 3·12·48·192… */
export function tierOf(lv: number): number {
  let tier = 0;
  for (let thr = TIER_BASE; lv >= thr; thr *= TIER_STEP) tier++;
  return tier;
}

/** 다음 단계 문턱까지 남은 레벨 */
function toNextTier(lv: number): number {
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
  /** 얻은 P 덩어리 */
  gain: number;
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
}

/** 상자 1탭 피해와 터짐 처리. 감쇠 탭은 피해 0. */
export function hitBox(state: GameState, o: HitOptions): { state: GameState; burst: BoxBurst | null } {
  if (o.damped) return { state, burst: null };
  const { box: k, damage } = state.unpack;
  const hp = currentHp(state);
  let dmg = unpackPower(state) * (o.crit ? (o.critMult ?? perkEffects(state).critMult) : 1) * o.feverMult;
  if (!o.crit) dmg = Math.min(dmg, Math.ceil(hp * NONCRIT_CAP));
  const total = damage + dmg;
  if (total < hp) return { state: { ...state, unpack: { ...state.unpack, damage: total } }, burst: null };

  const kind = boxKind(k);
  const gain = (tapValue(state) / feverMultOf(state.fever)) * BOX_KINDS[kind].k * (k < ROOM_BOXES ? 1 : ENDLESS_K_MULT);
  const inRoom = k < ROOM_BOXES;
  const slot = inRoom ? Math.floor(k / BOX_PATTERN.length) : undefined;
  const within = k % BOX_PATTERN.length;
  const completes = inRoom && k === ROOM_BOXES - 1 && !state.unpack.roomDone;
  let next: GameState = {
    ...state,
    points: state.points + gain,
    earned: state.earned + gain,
    stats: { ...state.stats, totalEarned: state.stats.totalEarned + gain },
    unpack: { box: k + 1, damage: 0, roomDone: state.unpack.roomDone || completes, hp: 0 },
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

/** 탭 1회 + 상자 피해. tapWithRng의 crit 판정을 그대로 쓴다(난수 1회, 방 완성 때만 추가). comboMult는 gain에만 곱하고 상자 피해에는 곱하지 않는다. */
export function tapAndHit(state: GameState, rng: () => number, damped = false, comboMult = 1): TapResult & { burst: BoxBurst | null } {
  const feverMult = feverMultOf(state.fever);
  const r = tapWithRng(state, rng, damped, comboMult);
  const h = hitBox(r.state, { crit: r.crit, damped, feverMult, rng, critMult: perkEffects(state).critMult });
  return { ...r, state: h.state, burst: h.burst };
}

export interface HeavyResult extends TapResult {
  /** 마지막으로 터진 상자(없으면 null). 여러 개가 터졌으면 전부 `bursts`에 순서대로 */
  burst: BoxBurst | null;
  bursts: BoxBurst[];
}

/**
 * 탭 taps번어치를 한 번에: 수익 = 탭 1회 수익 x taps x comboMult, 치명타는 한 번만 굴려 터지면 수익·타격 전체에 배율(상자 피해 상한도 풀린다).
 * 상자 피해는 탭 1회 피해 x taps를 한 타씩 넣어 `tapAndHit`을 taps번 부른 것과 같게 처리한다(터지면 보상·다음 상자, 남는 타격은 다음 상자로 이어진다).
 * 피버는 feverCharge만 채우고 피버 피해 배율은 시작 상태 기준 하나로 쓴다. 감쇠 없음.
 */
export function heavyHit(state: GameState, rng: () => number, taps: number, comboMult = 1, feverCharge = taps): HeavyResult {
  const feverMult = feverMultOf(state.fever);
  const critMult = perkEffects(state).critMult;
  const r = tapWithRng(state, rng, false, comboMult * taps);
  const fx = perkEffects(state);
  let next: GameState = {
    ...r.state,
    fever: chargeFever(state.fever, fx.feverSec, feverCharge),
    stats: { ...r.state.stats, totalTaps: state.stats.totalTaps + taps },
  };
  const bursts: BoxBurst[] = [];
  for (let i = 0; i < taps; i++) {
    const h = hitBox(next, { crit: r.crit, damped: false, feverMult, rng, critMult });
    next = h.state;
    if (h.burst) bursts.push(h.burst);
  }
  return { ...r, state: next, burst: bursts.length > 0 ? bursts[bursts.length - 1] : null, bursts };
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
