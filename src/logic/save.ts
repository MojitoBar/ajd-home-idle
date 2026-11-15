import { SERVICES } from '../data/services';
import { BASE_CONTRACT_SLOTS, CONTRACTS } from '../data/contracts';
import { PERKS, PERK_OFFER_SIZE } from '../data/perks';
import { contractPenaltyBase } from './contract';
import { perkEffects, rollPerkOffer, seededRng } from './perks';
import { BOX_PATTERN, ROOM_BOXES } from '../data/unpack';
import { boxHp, endlessHp } from './unpack';
import { UNLOCK_IDS } from './unlock';
import { CURRENT_VERSION, HOME_SLOTS, defaultState, type CollectionSlot, type ContractState, type GameState } from './state';

export const SAVE_KEY = 'ajd-home-idle:save';
export const BACKUP_KEY = 'ajd-home-idle:save:backup';

type Raw = Record<string, unknown>;
export type Migration = (save: Raw) => Raw;
export type Migrations = Record<number, Migration>;

// 키 N: 버전 N 저장을 N+1로 올린다.
export const MIGRATIONS: Migrations = {
  0: (s) => ({ ...s, version: 1, stats: s.stats ?? {}, settings: s.settings ?? {} }),
  // 1 -> 2: 이벤트 진행 상태(배너·문제·결과) 추가. 1차 저장 데이터는 대기 상태로 시작
  1: (s) => ({
    ...s,
    version: 2,
    collection: isObj(s.collection) ? s.collection : {},
    event: { ...(isObj(s.event) ? s.event : {}), bannerSec: 0, question: null, questionSec: 0, result: null },
  }),
  // 2 -> 3: 이사 특전·약정 추가. 이미 이사한 횟수만큼 선택 대기를 소급(이사 횟수 기반 결정적 시드)
  2: (s) => {
    const moves = typeof s.moves === 'number' && Number.isFinite(s.moves) && s.moves > 0 ? Math.floor(s.moves) : 0;
    const cap = PERKS.reduce((n, p) => n + p.maxLevel, 0);
    const perkOffers: string[][] = [];
    for (let i = 0; i < Math.min(moves, cap); i++) perkOffers.push(rollPerkOffer({}, seededRng(i * 7919 + 13)));
    return { ...s, version: 3, perks: {}, perkOffers, contracts: [] };
  },
  // 3 -> 4: 약정에 전체 기간·위약금 기준 금액 추가. 기존 약정은 현재 집 목표와 종류로 채운다
  3: (s) => {
    const moves = typeof s.moves === 'number' && Number.isFinite(s.moves) && s.moves > 0 ? Math.floor(s.moves) : 0;
    const contracts = Array.isArray(s.contracts)
      ? s.contracts.map((c) => {
          if (!isObj(c)) return c;
          const kind = CONTRACTS.find((k) => k.kind === c.kind);
          return kind ? { ...c, totalSec: kind.sec, penaltyBase: contractPenaltyBase(moves, kind.kind) } : c;
        })
      : [];
    return { ...s, version: 4, contracts };
  },
  // 4 -> 5: 이삿짐 상자 진행(unpack) 추가. 기존 저장은 첫 상자부터
  4: (s) => ({ ...s, version: 5, unpack: { box: 0, damage: 0, roomDone: false } }),
  // 5 -> 6: 상자 HP 저장(hp 0 = 불러올 때 계산)과 살림 레벨. 푼 방 단계 큰 상자만큼 그 칸 Lv 1
  5: (s) => {
    const old = isObj(s.unpack) ? s.unpack : {};
    const done = Math.floor(Math.min(num(old.box, 0, true), ROOM_BOXES) / BOX_PATTERN.length);
    return { ...s, version: 6, unpack: { ...old, hp: 0 }, homeLv: Array.from({ length: HOME_SLOTS }, (_, i) => (i < done ? 1 : 0)) };
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
  const services = Array.isArray(raw.services) ? raw.services : [];
  const event = isObj(raw.event) ? raw.event : {};
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
  const perkOffers: string[][] = [];
  if (Array.isArray(raw.perkOffers)) {
    for (const o of raw.perkOffers) {
      if (!Array.isArray(o)) continue;
      const ids = [...new Set(o.filter((id): id is string => typeof id === 'string' && PERKS.some((p) => p.id === id)))].slice(0, PERK_OFFER_SIZE);
      if (ids.length > 0) perkOffers.push(ids);
    }
  }
  const moves = num(raw.moves, d.moves, true);
  const rawUnpack = isObj(raw.unpack) ? raw.unpack : {};
  const unpackBox = num(rawUnpack.box, 0, true);
  const rawLv = Array.isArray(raw.homeLv) ? raw.homeLv : [];
  const homeLv = Array.from({ length: HOME_SLOTS }, (_, i) => num(rawLv[i], 0, true));
  const unpack = {
    box: unpackBox,
    damage: num(rawUnpack.damage, 0, true),
    roomDone: rawUnpack.roomDone === true,
    hp: num(rawUnpack.hp, 0, true),
  };
  const contracts: ContractState[] = [];
  if (Array.isArray(raw.contracts)) {
    for (const c of raw.contracts) {
      if (!isObj(c)) continue;
      const service = num(c.service, -1, true);
      const kind = CONTRACTS.find((k) => k.kind === c.kind);
      const remainSec = Math.min(num(c.remainSec, 0), kind?.sec ?? 0);
      if (service < 0 || service >= SERVICES.length || !kind || remainSec <= 0) continue;
      if (contracts.some((x) => x.service === service)) continue;
      if (contracts.length >= BASE_CONTRACT_SLOTS + perkEffects({ perks }).extraSlots) break;
      const penaltyBase = num(c.penaltyBase, contractPenaltyBase(moves, kind.kind));
      contracts.push({ service, kind: kind.kind, remainSec, totalSec: kind.sec, penaltyBase: Math.min(penaltyBase, contractPenaltyBase(moves, kind.kind)) });
    }
  }
  const out: GameState = {
    version: CURRENT_VERSION,
    savedAt: num(raw.savedAt, d.savedAt),
    points: num(raw.points, d.points),
    earned: num(raw.earned, d.earned),
    moves,
    tapLevel: num(raw.tapLevel, d.tapLevel, true),
    services: SERVICES.map((_, i) => num(services[i], 0, true)),
    boxesThisRun: num(raw.boxesThisRun, d.boxesThisRun, true),
    collection,
    // 배너·문제·결과는 저장하지 않는다(불러오면 대기 상태). 진행 중이던 문제는 사라진다.
    event: {
      ...d.event,
      nextInSec: num(event.nextInSec, d.event.nextInSec),
      remainSec: num(event.remainSec, d.event.remainSec),
      streak: num(event.streak, d.event.streak, true),
    },
    fever: d.fever,
    parcel: d.parcel,
    unpack,
    homeLv,
    perks,
    perkOffers,
    contracts,
    stats: {
      totalTaps: num(stats.totalTaps, 0, true),
      totalEarned: num(stats.totalEarned, 0),
      playSec: num(stats.playSec, 0),
      boxesOpened: num(stats.boxesOpened, 0, true),
    },
    settings: { reduceMotion: settings.reduceMotion === true },
    ...(Array.isArray(raw.unlocked) ? { unlocked: UNLOCK_IDS.filter((id) => (raw.unlocked as unknown[]).includes(id)) } : {}),
  };
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
  const { bannerSec, question, questionSec, result, ...event } = state.event;
  void bannerSec, question, questionSec, result;
  // 피버·택배 상자는 저장하지 않는다(불러오면 초기값)
  const { fever, parcel, ...rest } = state;
  void fever, parcel;
  return JSON.stringify({ ...rest, event, savedAt: now });
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
