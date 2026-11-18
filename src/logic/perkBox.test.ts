import { describe, expect, it } from 'vitest';
import { PERK_BOX_FRAC, PERK_BOX_GROWTH } from '../data/perks';
import { buyPerkBox, canBuyPerkBox, perkBoxCost } from './perkBox';
import { finishedGuide } from './guide';
import { houseInfo } from './house';
import { seededRng } from './perks';
import { defaultState } from './state';

const open = (extra: object = {}) => ({ ...defaultState(0, 1), guide: finishedGuide(), points: 1e30, ...extra });

describe('특전 상자', () => {
  it('가격 = 이 집 목표 x FRAC x GROWTH^산 개수', () => {
    expect(perkBoxCost(open())).toBeCloseTo(houseInfo(0).target * PERK_BOX_FRAC, 0);
    expect(perkBoxCost(open({ perkBoxBought: 3 }))).toBeCloseTo(houseInfo(0).target * PERK_BOX_FRAC * PERK_BOX_GROWTH ** 3, 0);
    expect(perkBoxCost(open({ moves: 2 }))).toBeCloseTo(houseInfo(2).target * PERK_BOX_FRAC, -3);
  });
  it('사면 포인트가 깎이고 3택 묶음 1개가 대기열 끝에 들어가며 다음 가격이 오른다', () => {
    const s = open({ points: 1e12, perkOffers: [['crit', 'fever_long', 'box_discount']] });
    const cost = perkBoxCost(s);
    const n = buyPerkBox(s, seededRng(3))!;
    expect(n.points).toBeCloseTo(1e12 - cost, 0);
    expect(n.perkBoxBought).toBe(1);
    expect(n.perkOffers).toHaveLength(2);
    expect(n.perkOffers[0]).toEqual(['crit', 'fever_long', 'box_discount']);
    expect(n.perkOffers[1]).toHaveLength(3);
    expect(new Set(n.perkOffers[1]).size).toBe(3);
    expect(perkBoxCost(n)).toBeCloseTo(cost * PERK_BOX_GROWTH, 0);
  });
  it('rng를 생략해도 결정적이다', () => {
    const s = open();
    expect(buyPerkBox(s)!.perkOffers).toEqual(buyPerkBox(s)!.perkOffers);
  });
  it('돈이 모자라면 null', () => {
    const s = open({ points: 1 });
    expect(canBuyPerkBox(s)).toBe(false);
    expect(buyPerkBox(s)).toBeNull();
  });
  it('가이드가 특전 상자 단계에 닿기 전에는 잠겨 있다(null), 닿으면 열린다', () => {
    const early = { ...open(), guide: { step: 11, n: 0, done: false } };
    expect(canBuyPerkBox(early)).toBe(false);
    expect(buyPerkBox(early)).toBeNull();
    expect(buyPerkBox({ ...early, guide: { step: 12, n: 0, done: false } })).not.toBeNull();
    expect(buyPerkBox({ ...early, moves: 1 })).not.toBeNull();
  });
});
