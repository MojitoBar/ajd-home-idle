import { describe, expect, it } from 'vitest';
import { defaultState, type GameState } from './state';
import { houseInfo } from './house';
import { isMet, isOpen, metIds, nextUnlock, pendingUnlocks, UNLOCK_IDS, UNLOCK_RULE } from './unlock';
import { parseSave, serialize } from './save';

const base = (): GameState => defaultState(0);
const with_ = (p: Partial<GameState>): GameState => ({ ...base(), ...p });
const target = houseInfo(0).target;

describe('단계적 공개 판정', () => {
  it('새 게임에서는 아무것도 충족하지 않는다', () => {
    expect(metIds(base())).toEqual([]);
    expect(pendingUnlocks(base())).toEqual([]);
  });

  it('공구 강화: 상자를 문턱값만큼 터뜨린 뒤', () => {
    expect(isMet(with_({ unpack: { box: UNLOCK_RULE.tapBoxes - 1, damage: 0, roomDone: false, hp: 0 } }), 'tap')).toBe(false);
    expect(isMet(with_({ unpack: { box: UNLOCK_RULE.tapBoxes, damage: 0, roomDone: false, hp: 0 } }), 'tap')).toBe(true);
  });

  it('결합: 서비스를 3종 가진 뒤, 또는 결합 단계가 오른 뒤', () => {
    expect(isMet(with_({ services: [5, 1, 0, 0, 0, 0, 0, 0] }), 'bundle')).toBe(false);
    expect(isMet(with_({ services: [5, 1, 1, 0, 0, 0, 0, 0] }), 'bundle')).toBe(true);
  });

  it('상자: 포인트가 가격 절반에 닿거나 사은품을 얻었을 때', () => {
    expect(isMet(with_({ points: 2499 }), 'box')).toBe(false);
    expect(isMet(with_({ points: 2500 }), 'box')).toBe(true);
    expect(isMet(with_({ unpack: { box: 80, damage: 0, roomDone: true, hp: 0 } }), 'box')).toBe(true);
  });

  it('도감: 사은품을 처음 얻은 뒤', () => {
    expect(isMet(base(), 'dex')).toBe(false);
    expect(isMet(with_({ collection: { a: { base: 1, shiny: 0, gold: 0, rainbow: 0 } } }), 'dex')).toBe(true);
  });

  it('이사 줄·약정 칸: 이사 목표 대비 번 포인트', () => {
    expect(isMet(with_({ earned: target * UNLOCK_RULE.moveRatio * 0.99 }), 'move')).toBe(false);
    expect(isMet(with_({ earned: target * UNLOCK_RULE.moveRatio }), 'move')).toBe(true);
    const owned = [3, 0, 0, 0, 0, 0, 0, 0];
    expect(isMet(with_({ earned: target * UNLOCK_RULE.moveRatio, services: owned }), 'contract')).toBe(false);
    expect(isMet(with_({ earned: target * UNLOCK_RULE.contractRatio, services: owned }), 'contract')).toBe(true);
    expect(isMet(with_({ earned: target * UNLOCK_RULE.contractRatio }), 'contract')).toBe(false);
  });

  it('배율 내역: 결합·약정·도감·특전 중 하나라도 배율이 생긴 뒤(일시 배율 제외)', () => {
    expect(isMet(base(), 'mult')).toBe(false);
    expect(isMet(with_({ services: [10, 0, 0, 10, 0, 0, 0, 0] }), 'mult')).toBe(true);
    expect(isMet(with_({ perks: { tap_power: 1 } }), 'mult')).toBe(true);
  });

  it('이사를 한 번이라도 했으면 전부 열린 채로 본다', () => {
    expect(metIds(with_({ moves: 1 }))).toEqual([...UNLOCK_IDS]);
  });

  it('열림 기록은 이사해도 남고, 기록이 없으면 대기 목록에 오른다', () => {
    const s = with_({ points: 3000, unlocked: ['box'] });
    expect(isOpen(s, 'box')).toBe(true);
    expect(pendingUnlocks(s)).toEqual([]);
    expect(pendingUnlocks({ ...s, unlocked: [] })).toEqual(['box']);
  });
});

describe('unlocked 저장', () => {
  it('저장하고 불러와도 유지된다(알 수 없는 id는 버린다)', () => {
    const s = with_({ unlocked: ['tap', 'dex'] });
    const r = parseSave(serialize(s, 1));
    expect(r.kind === 'ok' && r.state.unlocked).toEqual(['tap', 'dex']);
    const raw = JSON.parse(serialize(s, 1));
    raw.unlocked = ['move', 'zzz'];
    const r2 = parseSave(JSON.stringify(raw));
    expect(r2.kind === 'ok' && r2.state.unlocked).toEqual(['move']);
  });

  it('예전 저장(필드 없음)은 undefined로 남아 화면이 조건에서 유도한다', () => {
    const raw = JSON.parse(serialize(base(), 1));
    delete raw.unlocked;
    const r = parseSave(JSON.stringify(raw));
    expect(r.kind === 'ok' && r.state.unlocked).toBeUndefined();
  });
});

describe('다음 열림 한 줄', () => {
  it('새 게임: 진행률이 가장 높은 항목의 실제 조건 문구', () => {
    const n = nextUnlock(with_({ unlocked: [], unpack: { box: 4, damage: 0, roomDone: false, hp: 0 } }));
    expect(n?.id).toBe('tap');
    expect(n?.cond).toBe(`상자 ${UNLOCK_RULE.tapBoxes}개 열기`);
  });
  it('열린 것·이미 충족한 것은 건너뛴다', () => {
    const n = nextUnlock(with_({ unlocked: ['tap'], unpack: { box: 99, damage: 0, roomDone: false, hp: 0 } }));
    expect(n?.id).not.toBe('tap');
  });
  it('모두 열렸으면 null', () => {
    expect(nextUnlock(with_({ unlocked: [...UNLOCK_IDS] }))).toBeNull();
  });
});
