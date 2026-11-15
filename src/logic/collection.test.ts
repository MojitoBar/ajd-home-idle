import { describe, expect, it } from 'vitest';
import { COLLECTIBLES, SETS } from '../data/collectibles';
import { collectionMultOf, setEffects, setProgress, slotLevel, slotNextNeed } from './collection';
import { FEVER_SEC, CRIT_MULT } from './fever';
import { boxPrice, openBox, openBoxes, rollBox } from './gacha';
import { applyOffline } from './offline';
import { perkEffects } from './perks';
import { parseSave, serialize } from './save';
import { defaultState, type GameState } from './state';
import { multBreakdown } from './economy';

const rich = () => ({ ...defaultState(), points: 1e15 });
const fullSet = (rarity: string, count = 1): GameState['collection'] => {
  const col: GameState['collection'] = {};
  for (const c of COLLECTIBLES) if (c.rarity === rarity) col[c.id] = { base: count, shiny: 0, gold: 0, rainbow: 0 };
  return col;
};
const seq = (...v: number[]) => {
  let i = 0;
  return () => v[i++ % v.length];
};

describe('칸 레벨', () => {
  it('경계: 0·1·2·3·7·15·31·100', () => {
    expect([0, 1, 2, 3, 6, 7, 14, 15, 30, 31, 100].map(slotLevel)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });
  it('다음 레벨까지 남은 개수, 최대면 0', () => {
    expect([1, 2, 3, 7, 15, 31, 100].map(slotNextNeed)).toEqual([2, 1, 4, 8, 16, 0, 0]);
  });
  it('레벨이 배율에 반영: Lv 5는 3배', () => {
    const one = { fan: { base: 1, shiny: 0, gold: 0, rainbow: 0 } };
    expect(collectionMultOf(one)).toBeCloseTo(1.01, 10);
    expect(collectionMultOf({ fan: { base: 3, shiny: 0, gold: 0, rainbow: 0 } })).toBeCloseTo(1.015, 10);
    expect(collectionMultOf({ fan: { base: 31, shiny: 0, gold: 0, rainbow: 0 } })).toBeCloseTo(1.03, 10);
    expect(collectionMultOf({ fan: { base: 500, shiny: 0, gold: 0, rainbow: 0 } })).toBeCloseTo(1.03, 10);
  });
});

describe('등급 세트', () => {
  it('진행도: 변이와 상관없이 종 단위로 센다', () => {
    const col = { fan: { base: 0, shiny: 2, gold: 0, rainbow: 0 }, kettle: { base: 1, shiny: 0, gold: 0, rainbow: 0 } };
    const p = setProgress(col)[0];
    expect([p.have, p.total, p.done]).toEqual([2, 7, false]);
  });
  it('완성 전은 효과 없음, 완성하면 각 효과가 perkEffects에 합쳐진다', () => {
    const s = defaultState();
    const base = perkEffects(s);
    const partial = fullSet('common');
    delete partial.fan;
    expect(perkEffects({ ...s, collection: partial })).toEqual(base);
    const fx = (r: string) => perkEffects({ ...s, collection: fullSet(r) });
    expect(fx('common').tapMult).toBeCloseTo(base.tapMult * 1.5, 10);
    expect(fx('rare').serviceMult).toBeCloseTo(base.serviceMult * 1.25, 10);
    expect(fx('epic').offlineMult).toBeCloseTo(1.5, 10);
    expect(fx('legend').feverSec).toBe(FEVER_SEC + 5);
    expect(fx('myth').critMult).toBe(CRIT_MULT + 2);
    expect(SETS).toHaveLength(5);
    expect(setEffects({ collection: fullSet('myth') }).critMult).toBe(2);
  });
  it('오프라인 보상에 에픽 세트가 곱해지고 배율 내역에 세트가 보인다', () => {
    const s = { ...defaultState(), services: [10, 0, 0, 0, 0, 0, 0, 0], savedAt: 0 };
    const withSet = { ...s, collection: fullSet('epic') };
    const a = applyOffline(s, 3600_000).report!.gain;
    const b = applyOffline(withSet, 3600_000).report!.gain;
    expect(b / a).toBeGreaterThan(1.499);
    const tapSet = { ...s, collection: fullSet('common') };
    expect(multBreakdown(tapSet, 'tap').set).toBeCloseTo(1.5, 10);
    expect(multBreakdown(tapSet, 'tap').perk).toBeCloseTo(1, 10);
  });
  it('개봉으로 세트가 완성되면 completedSets에 나온다', () => {
    const col = fullSet('myth', 0);
    const s = { ...rich(), collection: col };
    const r = openBox(s, seq(0.9999, 0, 0))!;
    expect(r.result.item.id).toBe('space_purifier');
    expect(r.result.completedSets).toEqual(['myth']);
    expect(openBox(r.state, seq(0.9999, 0, 0))!.result.completedSets).toEqual([]);
  });
});

describe('가격·보장·저장', () => {
  it('가격: 최소 5000, 개봉마다 x1.06', () => {
    expect(boxPrice(defaultState())).toBe(5000);
    expect(boxPrice({ ...defaultState(), boxesThisRun: 10 })).toBeCloseTo(5000 * 1.06 ** 10, 6);
  });
  it('중복은 레벨업과 남은 개수를 돌려준다', () => {
    let s = rich();
    const levels: number[] = [];
    const needs: number[] = [];
    for (let i = 0; i < 3; i++) {
      const r = openBox(s, () => 0)!;
      s = r.state;
      levels.push(r.result.level);
      needs.push(r.result.nextNeed);
    }
    expect(levels).toEqual([1, 1, 2]);
    expect(needs).toEqual([2, 1, 4]);
  });
  it('10개 열기: 전부 일반이면 10번째가 레어 이상', () => {
    const r = openBoxes(rich(), () => 0, 10);
    expect(r.results).toHaveLength(10);
    expect(r.results.slice(0, 9).every((x) => x.item.rarity === 'common')).toBe(true);
    expect(r.results[9].item.rarity).not.toBe('common');
  });
  it('보장 롤은 레어 이상을 원래 비율대로 고른다', () => {
    expect(rollBox(seq(0, 0, 0), true).item.rarity).toBe('rare');
    expect(rollBox(seq(0.9999, 0, 0), true).item.rarity).toBe('myth');
    expect(rollBox(seq(0.6, 0, 0), true).item.rarity).toBe('rare');
    expect(rollBox(seq(0.7, 0, 0), true).item.rarity).toBe('epic');
  });
  it('9개만 열 수 있으면 보장 없음, 앞에 레어가 있으면 그대로', () => {
    const few = openBoxes({ ...defaultState(), points: 5000 * 9.5 }, () => 0, 10);
    expect(few.results.length).toBeLessThan(10);
    expect(few.results.every((x) => x.item.rarity === 'common')).toBe(true);
    const r = openBoxes(rich(), seq(0.7, 0, 0, 0, 0, 0), 10);
    expect(r.results[0].item.rarity).toBe('rare');
  });
  it('개수만 있는 v4 저장이 그대로 읽히고 레벨이 계산된다', () => {
    const s = { ...defaultState(), collection: { fan: { base: 7, shiny: 0, gold: 0, rainbow: 0 } } };
    const r = parseSave(serialize(s, 1));
    expect(r.kind).toBe('ok');
    const loaded = r.state;
    expect(JSON.parse(serialize(s, 1)).version).toBe(6);
    expect(loaded.collection.fan.base).toBe(7);
    expect(slotLevel(loaded.collection.fan.base)).toBe(3);
  });
});
