import { describe, expect, it } from 'vitest';
import { defaultState } from './testState';
import type { GameState } from './state';
import { isMet, isOpen, metIds, nextUnlock, pendingUnlocks, UNLOCK_IDS } from './unlock';
import { parseSave, serialize } from './save';

const base = (): GameState => defaultState(0);
const with_ = (p: Partial<GameState>): GameState => ({ ...base(), ...p });

describe('단계적 공개 판정', () => {
  it('새 게임에서는 아무것도 충족하지 않는다', () => {
    expect(metIds(base())).toEqual([]);
    expect(pendingUnlocks(base())).toEqual([]);
  });

  it('살림: 살림 레벨이 하나라도 오른 뒤', () => {
    expect(isMet(base(), 'home')).toBe(false);
    expect(isMet(with_({ homeLv: [0, 0, 1, 0, 0, 0, 0, 0] }), 'home')).toBe(true);
  });

  it('상자: 포인트가 가격 절반에 닿거나 사은품을 얻었을 때', () => {
    expect(isMet(with_({ points: 2499 }), 'box')).toBe(false);
    expect(isMet(with_({ points: 2500 }), 'box')).toBe(true);
    expect(isMet(with_({ unpack: { box: 80, damage: 0, roomDone: true, hp: 0, salt: 0, rushSec: 0 } }), 'box')).toBe(true);
  });

  it('도감: 사은품을 처음 얻은 뒤', () => {
    expect(isMet(base(), 'dex')).toBe(false);
    expect(isMet(with_({ collection: { a: { base: 1, shiny: 0, gold: 0, rainbow: 0 } } }), 'dex')).toBe(true);
  });

  it('배율 내역: 도감·특전 중 하나라도 배율이 생긴 뒤(일시 배율 제외)', () => {
    expect(isMet(base(), 'mult')).toBe(false);
    expect(isMet(with_({ collection: { fan: { base: 1, shiny: 0, gold: 0, rainbow: 0 } } }), 'mult')).toBe(true);
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
    const s = with_({ unlocked: ['box', 'dex'] });
    const r = parseSave(serialize(s, 1));
    expect(r.kind === 'ok' && r.state.unlocked).toEqual(['box', 'dex']);
    const raw = JSON.parse(serialize(s, 1));
    raw.unlocked = ['dex', 'move', 'zzz'];
    const r2 = parseSave(JSON.stringify(raw));
    expect(r2.kind === 'ok' && r2.state.unlocked).toEqual(['dex']);
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
    const n = nextUnlock(with_({ unlocked: [], earned: 3000 }));
    expect(n?.id).toBe('box');
    expect(n?.cond).toContain('P');
  });
  it('열린 것·이미 충족한 것은 건너뛴다', () => {
    const n = nextUnlock(with_({ unlocked: ['box'], unpack: { box: 99, damage: 0, roomDone: true, hp: 0, salt: 0, rushSec: 0 } }));
    expect(n?.id).not.toBe('box');
  });
  it('모두 열렸으면 null', () => {
    expect(nextUnlock(with_({ unlocked: [...UNLOCK_IDS] }))).toBeNull();
  });
});
