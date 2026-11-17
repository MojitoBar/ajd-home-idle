import { describe, expect, it } from 'vitest';
import { PERKS, PERK_OFFER_SIZE } from '../data/perks';
import { collectionMult } from './economy';
import { dexBoostMult, homeBoostMult, rollPerkOffer, seededRng } from './perks';
import { defaultState } from './state';

describe('특전 풀', () => {
  it('8종이고 죽은 특전은 없다', () => {
    expect(PERKS).toHaveLength(8);
    for (const id of ['svc_power', 'bundle_boost', 'contract_slot', 'penalty_cut', 'offline_rate', 'offline_cap']) {
      expect(PERKS.some((p) => p.id === id)).toBe(false);
    }
    expect(PERKS.find((p) => p.id === 'home_boost')!.maxLevel).toBe(4);
    expect(PERKS.find((p) => p.id === 'dex_boost')!.maxLevel).toBe(4);
  });
  it('3택이 유지된다(전부 만렙 직전까지)', () => {
    const perks = Object.fromEntries(PERKS.slice(0, 5).map((p) => [p.id, p.maxLevel]));
    const offer = rollPerkOffer(perks, seededRng(1));
    expect(offer).toHaveLength(PERK_OFFER_SIZE);
    expect(new Set(offer).size).toBe(PERK_OFFER_SIZE);
  });
  it('dex_boost는 도감 배율에 x(1+0.25Lv), home_boost는 값만 돌려준다', () => {
    const s = defaultState();
    const d = { ...s, perks: { dex_boost: 2 } };
    expect(dexBoostMult(d)).toBeCloseTo(1.5, 10);
    expect(collectionMult(d)).toBeCloseTo(collectionMult(s) * 1.5, 10);
    expect(homeBoostMult({ perks: { home_boost: 4 } })).toBeCloseTo(2, 10);
  });
});
