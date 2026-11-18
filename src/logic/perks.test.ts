import { describe, expect, it } from 'vitest';
import { PERKS, PERK_OFFER_SIZE } from '../data/perks';
import { collectionMult } from './economy';
import { choosePerk, dexBoostMult, homeBoostMult, movePerkBoxes, perkEffects, perkOfferViews, rollPerkOffer, seededRng } from './perks';
import { streakMult } from './charge';
import { defaultState } from './testState';

describe('특전 풀', () => {
  it('12종이고 죽은 특전은 없다', () => {
    expect(PERKS).toHaveLength(12);
    for (const id of ['svc_power', 'bundle_boost', 'contract_slot', 'penalty_cut', 'offline_rate', 'offline_cap']) {
      expect(PERKS.some((p) => p.id === id)).toBe(false);
    }
    for (const id of ['tap_power', 'home_boost', 'dex_boost', 'strike_power']) expect(PERKS.find((p) => p.id === id)!.maxLevel).toBe(Infinity);
    for (const p of PERKS) expect(p.emoji).toBe('');
  });
  it('배수 특전은 끝없이 오르고 maxed는 항상 false, 상한 있는 특전은 상한에서 멈춘다', () => {
    const s = { ...defaultState(), perks: { tap_power: 500, fever_charge: 5 }, perkOffers: [['tap_power', 'fever_charge', 'crit']] };
    const [views] = perkOfferViews(s);
    expect(views.find((v) => v.id === 'tap_power')).toMatchObject({ unlimited: true, maxed: false, level: 500 });
    expect(views.find((v) => v.id === 'fever_charge')).toMatchObject({ unlimited: false, maxed: true, maxLevel: 5 });
    expect(choosePerk(s, 0, 'tap_power')!.perks.tap_power).toBe(501);
    expect(choosePerk(s, 0, 'fever_charge')).toBeNull();
    expect(JSON.parse(JSON.stringify(s.perks)).tap_power).toBe(500);
  });
  it('새 특전 효과: 강타 단련·연속 퍼펙트 계수·특별 상자·피버 충전', () => {
    const fx = perkEffects({ perks: { strike_power: 2, streak_coef: 3, special_freq: 2, fever_charge: 4 } });
    expect(fx.strikeMult).toBeCloseTo(1.6, 10);
    expect(fx.streakBonus).toBeCloseTo(0.3, 10);
    expect(fx.specialRateMult).toBeCloseTo(1.5, 10);
    expect(fx.feverCharge).toBeCloseTo(1.6, 10);
    const base = perkEffects({ perks: {} });
    expect([base.strikeMult, base.streakBonus, base.specialRateMult, base.feverCharge]).toEqual([1, 0, 1, 1]);
    expect(streakMult(4)).toBe(3);
    expect(streakMult(4, fx.streakBonus)).toBeCloseTo(1 + 0.8 * 4, 10);
  });
  it('이사 보상 특전 상자 수: 2, 3, 4, 5, 5…', () => {
    expect([0, 1, 2, 3, 4, 10].map(movePerkBoxes)).toEqual([2, 3, 4, 5, 5, 5]);
  });
  it('3택이 유지된다(전부 만렙 직전까지)', () => {
    const perks = Object.fromEntries(PERKS.filter((p) => Number.isFinite(p.maxLevel)).slice(0, 5).map((p) => [p.id, p.maxLevel]));
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
    expect(homeBoostMult({ perks: { home_boost: 40 } })).toBeCloseTo(11, 10);
  });
});
