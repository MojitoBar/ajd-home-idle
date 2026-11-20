import { GEARS } from '../data/gear';
import { PERKS, PERK_OFFER_SIZE } from '../data/perks';
import { CARDS, CARD_OFFER_SIZE, DECK_MARKS, cardDef } from '../data/cards';
import { cardChargeNeed, deckSlots, emptyBuff, emptyDeck, marksPassed, rollCardOffer, stackNeed, type DeckSlot, type DeckState } from './deck';
import { rollPerkOffer, seededRng } from './perks';
import { BOX_PATTERN, ROOM_BOXES } from '../data/unpack';
import { boxHp, endlessHp } from './unpack';
import { addToCollection, rollBox } from './gacha';
import { houseInfo } from './house';
import { GUIDE_STEPS, finishedGuide, initialGuide } from './guide';
import { UNLOCK_IDS } from './unlock';
import { CURRENT_VERSION, HOME_SLOTS, defaultState, type CollectionSlot, type GameState } from './state';

export const SAVE_KEY = 'ajd-home-idle:save';
export const BACKUP_KEY = 'ajd-home-idle:save:backup';

type Raw = Record<string, unknown>;
export type Migration = (save: Raw) => Raw;
export type Migrations = Record<number, Migration>;

/** v9 서비스 보상: 서비스 레벨 합 25마다 상자 1개, 최대 30개 */
const V9_REWARD_PER_LEVELS = 25;
const V9_REWARD_MAX_BOXES = 30;
/** v9에서 사라진 특전 id(레벨 1마다 3택 묶음 1개로 돌려준다) */
const V9_DEAD_PERKS = ['svc_power', 'bundle_boost', 'contract_slot', 'penalty_cut', 'offline_rate', 'offline_cap'];
/** v9 수치 정리: 보유 P는 새 목표의 30%까지만 */
const V9_POINTS_CAP_RATIO = 0.3;

/** v11에서 특전 상자 단계가 끼어든 가이드 단계 번호(0부터, 영구 공구 단계 바로 뒤) */
const V11_GUIDE_INSERT_AT = 12;

// 키 N: 버전 N 저장을 N+1로 올린다.
export /** 14 -> 15 이전용: v14까지의 집 길이 필요 눈금 보정표(옛 값을 코드에 고정해 둔다) */
const V14_NEED_SCALE = [1, 0.35, 1.1, 1.5, 4.5, 2.6];

const MIGRATIONS: Migrations = {
  0: (s) => ({ ...s, version: 1, stats: s.stats ?? {}, settings: s.settings ?? {} }),
  // 1 -> 2: 이벤트 진행 상태(배너·문제·결과) 추가. 1차 저장 데이터는 대기 상태로 시작
  1: (s) => ({
    ...s,
    version: 2,
    collection: isObj(s.collection) ? s.collection : {},
    event: { ...(isObj(s.event) ? s.event : {}), bannerSec: 0, question: null, questionSec: 0, result: null },
  }),
  // 2 -> 3: 이사 특전 추가. 이미 이사한 횟수만큼 선택 대기를 소급(이사 횟수 기반 결정적 시드)
  2: (s) => {
    const moves = typeof s.moves === 'number' && Number.isFinite(s.moves) && s.moves > 0 ? Math.floor(s.moves) : 0;
    const cap = PERKS.reduce((n, p) => n + p.maxLevel, 0);
    const perkOffers: string[][] = [];
    for (let i = 0; i < Math.min(moves, cap); i++) perkOffers.push(rollPerkOffer({}, seededRng(i * 7919 + 13)));
    return { ...s, version: 3, perks: {}, perkOffers };
  },
  // 3 -> 4: 약정 필드 정리(약정은 v9에서 사라져 버전만 올린다)
  3: (s) => ({ ...s, version: 4 }),
  // 4 -> 5: 이삿짐 상자 진행(unpack) 추가. 기존 저장은 첫 상자부터
  4: (s) => ({ ...s, version: 5, unpack: { box: 0, damage: 0, roomDone: false } }),
  // 5 -> 6: 상자 HP 저장(hp 0 = 불러올 때 계산)과 살림 레벨. 푼 방 단계 큰 상자만큼 그 칸 Lv 1
  5: (s) => {
    const old = isObj(s.unpack) ? s.unpack : {};
    const done = Math.floor(Math.min(num(old.box, 0, true), ROOM_BOXES) / BOX_PATTERN.length);
    return { ...s, version: 6, unpack: { ...old, hp: 0 }, homeLv: Array.from({ length: HOME_SLOTS }, (_, i) => (i < done ? 1 : 0)) };
  },
  // 6 -> 7: 강타 힘 강화 레벨과 최고 연쇄 추가
  6: (s) => ({ ...s, version: 7, strikeLevel: 0, bestChain: 0 }),
  // 7 -> 8: 특별 상자 배치 salt(이사 횟수·진행에서 유도)와 러시 시간 추가
  7: (s) => {
    const old = isObj(s.unpack) ? s.unpack : {};
    const salt = (num(s.moves, 0, true) * 7919 + num(old.box, 0, true) * 31 + 17) & 0x7fffffff;
    return { ...s, version: 8, unpack: { ...old, salt, rushSec: 0 } };
  },
  // 8 -> 9: 서비스·결합·약정 삭제. 서비스 레벨 25마다(최대 30개) 무료 상자를 도감에 넣고, P·누적을 새 목표 기준으로 자른다
  8: (s) => {
    const moves = num(s.moves, 0, true);
    const lv = Array.isArray(s.services) ? s.services.reduce<number>((a, v) => a + num(v, 0, true), 0) : 0;
    const boxes = Math.min(V9_REWARD_MAX_BOXES, Math.floor(lv / V9_REWARD_PER_LEVELS));
    const rng = seededRng(moves * 7919 + 9);
    let collection: Record<string, CollectionSlot> = isObj(s.collection) ? (s.collection as Record<string, CollectionSlot>) : {};
    for (let i = 0; i < boxes; i++) {
      const { item, variant } = rollBox(rng);
      collection = addToCollection(collection, item, variant).collection;
    }
    const target = houseInfo(moves).target;
    const { services, contracts, event, ...rest } = s;
    void services, contracts, event;
    // 죽은 특전: 레벨 1마다 3택 묶음 1개를 더하고, 기존 묶음에서는 죽은 id를 빼 3개로 다시 채운다
    const oldPerks = isObj(s.perks) ? s.perks : {};
    const perks: Record<string, number> = {};
    let dead = 0;
    for (const [id, v] of Object.entries(oldPerks)) {
      if (V9_DEAD_PERKS.includes(id)) dead += num(v, 0, true);
      else perks[id] = num(v, 0, true);
    }
    const prng = seededRng(moves * 7919 + 21);
    const perkOffers: string[][] = [];
    for (const o of Array.isArray(s.perkOffers) ? s.perkOffers : []) {
      if (!Array.isArray(o)) continue;
      const kept = o.filter((id): id is string => typeof id === 'string' && !V9_DEAD_PERKS.includes(id));
      perkOffers.push(kept.length >= PERK_OFFER_SIZE ? kept : rollPerkOffer(perks, prng));
    }
    for (let i = 0; i < dead; i++) perkOffers.push(rollPerkOffer(perks, prng));
    return {
      ...rest,
      version: 9,
      gear: {},
      collection,
      perks,
      perkOffers,
      points: Math.min(num(s.points, 0), target * V9_POINTS_CAP_RATIO),
      earned: Math.min(num(s.earned, 0), target),
      notice: { kind: 'v9', boxes },
    };
  },
  // 9 -> 10: 첫 가이드(손맛 요소가 하나씩 열림). 이미 하던 사람의 요소가 잠기면 안 되므로 전부 가이드 완료로 바꾼다. 탭을 한 번도 안 한 저장만 처음부터
  9: (s) => {
    const stats = isObj(s.stats) ? s.stats : {};
    const fresh = num(s.moves, 0, true) === 0 && num(stats.totalTaps, 0, true) === 0;
    return { ...s, version: 10, guide: fresh ? initialGuide() : finishedGuide() };
  },
  // 10 -> 11: 특전 상자(perkBoxBought). 가이드 12단계(영구 공구) 뒤에 특전 상자 단계가 끼어들었으니 진행 중인 가이드는 같은 단계에 머물도록 step을 민다
  10: (s) => {
    const g = isObj(s.guide) ? s.guide : null;
    const guide = g && g.done !== true && num(g.step, 0, true) >= V11_GUIDE_INSERT_AT ? { ...g, step: num(g.step, 0, true) + 1 } : s.guide;
    return { ...s, version: 11, perkBoxBought: 0, guide };
  },
  // 11 -> 12: 공구함 덱(deck). 이사한 적이 있으면 지금 진행으로 이미 지난 문턱 수를 채우고 소개용 3택 1묶음을 준다. 첫 집은 빈 덱
  11: (s) => {
    const moves = num(s.moves, 0, true);
    if (moves === 0) return { ...s, version: 12, deck: emptyDeck() };
    const mark = marksPassed({ moves, deck: emptyDeck() }, num(s.earned, 0));
    return { ...s, version: 12, deck: { ...emptyDeck(), mark, offers: [rollCardOffer([], moves * 7919 + 29)] } };
  },
  // 12 -> 13: 공구함 배율. 낀 카드는 눈금 0(공구함 x1부터라 지금보다 줄지 않는다), 이 집의 목표 배수는 1(지금 있는 집의 목표·진행 막대 그대로). 다음 이사부터 표 값
  12: (s) => {
    const d = isObj(s.deck) ? s.deck : {};
    const slots = Array.isArray(d.slots) ? d.slots.map((o) => (isObj(o) ? { ...o, charge: 0 } : o)) : [];
    return { ...s, version: 13, deck: { ...d, slots, targetScale: 1 } };
  },
  // 13 -> 14: 4칸·문턱 = 칸 + 3(6곳). 낀 카드·눈금·targetScale·묶음은 그대로, 4번째 칸은 빈 칸. mark는 새 표로 이미 넘은 문턱까지 채우되(묶음은 안 준다, 단 빈 칸이 있는데 고르기가 0이면 1개) 지금보다 줄이지 않는다
  13: (s) => {
    const d = isObj(s.deck) ? s.deck : {};
    const moves = num(s.moves, 0, true);
    if (moves === 0) return { ...s, version: 14, deck: d };
    const targetScale = Math.max(1e-6, num(d.targetScale, 1));
    const passed = marksPassed({ moves, deck: { ...emptyDeck(), targetScale } }, num(s.earned, 0));
    const mark = Math.max(num(d.mark, 0, true), passed);
    const slots = Array.isArray(d.slots) ? d.slots.filter(isObj) : [];
    const offers = Array.isArray(d.offers) ? d.offers : [];
    // 문턱을 이미 다 넘어 새 4번째 칸을 채울 방법이 없으면 묶음 1개를 준다
    if (slots.length < deckSlots(moves) && DECK_MARKS - mark + offers.length === 0) return { ...s, version: 14, deck: { ...d, mark, offers: [rollCardOffer(slots as unknown as DeckSlot[], moves * 7919 + 31)] } };
    return { ...s, version: 14, deck: { ...d, mark } };
  },
  // 14 -> 15: 희귀도별 필요 눈금·★·공명·증폭 카드·발동 진행 값(buff). 낀 카드(모두 ★1)의 눈금은 "옛 필요(일반 40 x 옛 보정표) 대비 비율"을 새 필요(희귀도별)에 그대로 옮겨 공구함 배율이 줄지 않는다. 이미 들어간 집의 targetScale·목표·묶음은 그대로
  14: (s) => {
    const d = isObj(s.deck) ? s.deck : {};
    const moves = num(s.moves, 0, true);
    const oldNeed = 40 * V14_NEED_SCALE[Math.min(Math.max(moves, 0), V14_NEED_SCALE.length - 1)];
    const slots = Array.isArray(d.slots)
      ? d.slots.map((o) => {
          if (!isObj(o)) return o;
          const ratio = Math.min(1, Math.max(0, num(o.charge, 0)) / oldNeed);
          return { ...o, star: Math.min(3, Math.max(1, num(o.star, 1, true))), charge: ratio * cardChargeNeed(moves, cardDef(typeof o.id === 'string' ? o.id : '')?.rarity) };
        })
      : [];
    return { ...s, version: 15, deck: { ...d, slots, buff: emptyBuff() } };
  },
  // 15 -> 16: 넘침 스택. 칸마다 stacks 0, 충전 스택 누계·강화 고르기 묶음 0. 눈금·★·targetScale·mark·묶음은 그대로라 공구함 배율이 이전과 같다
  15: (s) => {
    const d = isObj(s.deck) ? s.deck : {};
    const slots = Array.isArray(d.slots) ? d.slots.map((o) => (isObj(o) ? { ...o, stacks: 0 } : o)) : [];
    return { ...s, version: 16, deck: { ...d, slots, chargedStacks: 0, boostPacks: 0, boostMade: 0 } };
  },
};

export type LoadResult =
  | { kind: 'ok'; state: GameState }
  | { kind: 'empty'; state: GameState }
  | { kind: 'corrupt'; state: GameState }
  | { kind: 'future'; state: GameState; version: number };

export function migrate(save: Raw, migrations: Migrations = MIGRATIONS, target = CURRENT_VERSION): Raw | null {
  let cur = save;
  let v = typeof cur.version === 'number' ? cur.version : 0;
  while (v < target) {
    const step = migrations[v];
    if (!step) return null;
    cur = step(cur);
    v += 1;
    cur.version = v;
  }
  return cur;
}

function isObj(x: unknown): x is Raw {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function num(x: unknown, fallback: number, int = false): number {
  if (typeof x !== 'number' || !Number.isFinite(x) || x < 0) return fallback;
  return int ? Math.floor(x) : x;
}

export function sanitize(raw: Raw): GameState {
  const d = defaultState();
  const stats = isObj(raw.stats) ? raw.stats : {};
  const settings = isObj(raw.settings) ? raw.settings : {};
  const collection: Record<string, CollectionSlot> = {};
  if (isObj(raw.collection)) {
    for (const [k, v] of Object.entries(raw.collection)) {
      if (!isObj(v)) continue;
      collection[k] = {
        base: num(v.base, 0, true),
        shiny: num(v.shiny, 0, true),
        gold: num(v.gold, 0, true),
        rainbow: num(v.rainbow, 0, true),
      };
    }
  }
  const perks: Record<string, number> = {};
  if (isObj(raw.perks)) {
    for (const p of PERKS) {
      const lv = Math.min(p.maxLevel, num((raw.perks as Raw)[p.id], 0, true));
      if (lv > 0) perks[p.id] = lv;
    }
  }
  const gear: GameState['gear'] = {};
  if (isObj(raw.gear)) {
    for (const g of GEARS) {
      const lv = Math.min(g.maxLevel, num(raw.gear[g.id], 0, true));
      if (lv > 0) gear[g.id] = lv;
    }
  }
  const perkOffers: string[][] = [];
  if (Array.isArray(raw.perkOffers)) {
    for (const o of raw.perkOffers) {
      if (!Array.isArray(o)) continue;
      const ids = [...new Set(o.filter((id): id is string => typeof id === 'string' && PERKS.some((p) => p.id === id)))].slice(0, PERK_OFFER_SIZE);
      if (ids.length > 0) perkOffers.push(ids);
    }
  }
  const moves = num(raw.moves, d.moves, true);
  const rawDeck = isObj(raw.deck) ? raw.deck : {};
  const deckSlotsMax = deckSlots(moves);
  const slots: DeckSlot[] = [];
  if (Array.isArray(rawDeck.slots)) {
    for (const o of rawDeck.slots) {
      if (!isObj(o) || typeof o.id !== 'string' || !cardDef(o.id) || slots.some((s) => s.id === o.id) || slots.length >= deckSlotsMax) continue;
      const stacks = num(o.stacks, 0, true);
      slots.push({ id: o.id, star: Math.min(3, Math.max(1, num(o.star, 1, true))), charge: Math.min(stackNeed(cardChargeNeed(moves, cardDef(o.id)?.rarity), stacks), num(o.charge, 0)), stacks });
    }
  }
  const cardOffers: string[][] = [];
  if (Array.isArray(rawDeck.offers)) {
    for (const o of rawDeck.offers) {
      if (!Array.isArray(o)) continue;
      const ids = [...new Set(o.filter((id): id is string => typeof id === 'string' && CARDS.some((c) => c.id === id)))].slice(0, CARD_OFFER_SIZE);
      if (ids.length > 0) cardOffers.push(ids);
    }
  }
  const deck: DeckState = {
    slots,
    offers: cardOffers,
    rerolls: Math.min(9, num(rawDeck.rerolls, d.deck.rerolls, true)),
    mark: Math.min(DECK_MARKS, num(rawDeck.mark, 0, true)),
    targetScale: Math.max(1e-6, num(rawDeck.targetScale, 1)),
    chargedStacks: num(rawDeck.chargedStacks, 0, true),
    boostPacks: num(rawDeck.boostPacks, 0, true),
    boostMade: num(rawDeck.boostMade, 0, true),
    buff: isObj(rawDeck.buff)
      ? { nextStrike: rawDeck.buff.nextStrike === true, forceBomb: rawDeck.buff.forceBomb === true, perfects: Math.min(99, num(rawDeck.buff.perfects, 0, true)), boxesInFever: num(rawDeck.buff.boxesInFever, 0, true) }
      : emptyBuff(),
    seen: Array.isArray(rawDeck.seen) ? [...new Set(rawDeck.seen.filter((id): id is string => typeof id === 'string' && !!cardDef(id)))] : [],
  };
  const rawUnpack = isObj(raw.unpack) ? raw.unpack : {};
  const unpackBox = num(rawUnpack.box, 0, true);
  const rawLv = Array.isArray(raw.homeLv) ? raw.homeLv : [];
  const homeLv = Array.from({ length: HOME_SLOTS }, (_, i) => num(rawLv[i], 0, true));
  const unpack = {
    box: unpackBox,
    damage: num(rawUnpack.damage, 0, true),
    roomDone: rawUnpack.roomDone === true,
    hp: num(rawUnpack.hp, 0, true),
    salt: num(rawUnpack.salt, 0, true),
    rushSec: num(rawUnpack.rushSec, 0, true),
  };
  const out: GameState = {
    version: CURRENT_VERSION,
    savedAt: num(raw.savedAt, d.savedAt),
    points: num(raw.points, d.points),
    earned: num(raw.earned, d.earned),
    moves,
    tapLevel: num(raw.tapLevel, d.tapLevel, true),
    strikeLevel: num(raw.strikeLevel, 0, true),
    boxesThisRun: num(raw.boxesThisRun, d.boxesThisRun, true),
    collection,
    fever: d.fever,
    parcel: d.parcel,
    unpack,
    homeLv,
    gear,
    perks,
    perkOffers,
    deck,
    perkBoxBought: num(raw.perkBoxBought, 0, true),
    stats: {
      totalTaps: num(stats.totalTaps, 0, true),
      totalEarned: num(stats.totalEarned, 0),
      playSec: num(stats.playSec, 0),
      boxesOpened: num(stats.boxesOpened, 0, true),
    },
    settings: { reduceMotion: settings.reduceMotion === true },
    bestCombo: num(raw.bestCombo, 0, true),
    bestChain: num(raw.bestChain, 0, true),
    guide: finishedGuide(),
    ...(isObj(raw.notice) && raw.notice.kind === 'v9' ? { notice: { kind: 'v9' as const, boxes: num(raw.notice.boxes, 0, true) } } : {}),
    ...(Array.isArray(raw.unlocked) ? { unlocked: UNLOCK_IDS.filter((id) => (raw.unlocked as unknown[]).includes(id)) } : {}),
  };
  const rawGuide = isObj(raw.guide) ? raw.guide : null;
  const guideStep = rawGuide ? Math.min(GUIDE_STEPS.length, num(rawGuide.step, 0, true)) : GUIDE_STEPS.length;
  out.guide = rawGuide && guideStep < GUIDE_STEPS.length && rawGuide.done !== true && moves === 0 ? { step: guideStep, n: num(rawGuide.n, 0, true), done: false } : finishedGuide();
  const k = out.unpack.box;
  const hp = out.unpack.hp >= 1 ? out.unpack.hp : k < ROOM_BOXES ? boxHp(k) : endlessHp(out, k);
  out.unpack = { ...out.unpack, hp, damage: Math.min(out.unpack.damage, hp - 1) };
  return out;
}

export function parseSave(raw: string | null): LoadResult {
  if (raw === null || raw === '') return { kind: 'empty', state: defaultState() };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: 'corrupt', state: defaultState() };
  }
  if (!isObj(parsed)) return { kind: 'corrupt', state: defaultState() };
  const version = typeof parsed.version === 'number' ? parsed.version : 0;
  if (version > CURRENT_VERSION) return { kind: 'future', state: defaultState(), version };
  const migrated = migrate(parsed);
  if (!migrated) return { kind: 'corrupt', state: defaultState() };
  return { kind: 'ok', state: sanitize(migrated) };
}

export function serialize(state: GameState, now: number): string {
  // 피버·택배 상자는 저장하지 않는다(불러오면 초기값)
  const { fever, parcel, ...rest } = state;
  void fever, parcel;
  return JSON.stringify({ ...rest, savedAt: now });
}

export function exportString(state: GameState, now: number): string {
  return btoa(serialize(state, now));
}

export function importString(text: string): LoadResult {
  try {
    return parseSave(atob(text.trim()));
  } catch {
    return { kind: 'corrupt', state: defaultState() };
  }
}
