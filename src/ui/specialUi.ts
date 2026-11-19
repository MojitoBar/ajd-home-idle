// 특별 상자 설명 창 본문과 처음 만날 때 알림 문구. 수치는 모두 logic/data 의 실제 값을 읽는다(화면에서 따로 계산하지 않는다).
import { GOLD_GAIN_MULT, RUSH_SEC, SPECIAL_FREE_BOXES, type SpecialBox } from '../data/unpack';
import { deckEffects } from '../logic/deck';
import { gearEffects } from '../logic/gear';
import type { GameState } from '../logic/state';
import { el } from './dom';
import { pxImg } from './px/art';

const SEEN_KEY = 'ajd-home-idle:seen-special';
export const SPECIAL_KINDS: SpecialBox[] = ['gold', 'bomb', 'clock'];
const NAME: Record<SpecialBox, string> = { gold: '황금 상자', bomb: '폭탄 상자', clock: '시계 상자' };

const pct = (v: number): string => `${Number((v * 100).toFixed(1))}%`;

function effect(state: GameState, sp: SpecialBox): string {
  if (sp === 'gold') return `보상 x${GOLD_GAIN_MULT + deckEffects(state).goldMultAdd}`;
  if (sp === 'bomb') return `상자 ${deckEffects(state).bombBlast}개 연쇄`;
  return `자동 +${RUSH_SEC}초`;
}

/** 설명 창 본문: 지금 확률 + 안내 + 종류별 줄 */
export function specialBody(state: GameState): HTMLElement[] {
  const rows = SPECIAL_KINDS.map((sp) => {
    const text =
      sp === 'gold' ? `이 상자의 보상이 ${effect(state, sp).replace('보상 x', '')}배가 돼요.`
      : sp === 'bomb' ? `터지면 뒤따르는 상자 ${deckEffects(state).bombBlast}개가 함께 터져요.`
      : `터지면 자동 연타 시간이 ${RUSH_SEC}초 늘어요. 쌓이는 데 상한이 없어요.`;
    return el('div', { cls: 'sp-row pf' }, pxImg(`box/${sp}-small-1`, 'sp-img'), el('div', { cls: 'sp-main' }, el('b', { text: NAME[sp] }), el('span', { text })));
  });
  return [
    el('p', { cls: 'sp-rate' }, '지금 확률 ', el('b', { text: pct(gearEffects(state).specialRate) })),
    el('p', { cls: 'dim', text: `집마다 처음 ${SPECIAL_FREE_BOXES}개에는 안 나와요` }),
    el('div', { cls: 'sp-list' }, ...rows),
  ];
}

function readSeen(): SpecialBox[] {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is SpecialBox => SPECIAL_KINDS.includes(x)) : [];
  } catch {
    return [];
  }
}

/** 이번에 터진 특별 상자 중 평생 처음인 종류의 알림 문구(최대 2개). 본 것으로 적는 것은 띄운 종류뿐 */
export function newSpecialToasts(state: GameState, kinds: Iterable<SpecialBox>): string[] {
  const got = new Set(kinds);
  if (got.size === 0) return [];
  const seen = readSeen();
  const fresh = SPECIAL_KINDS.filter((k) => got.has(k) && !seen.includes(k)).slice(0, 2);
  if (fresh.length === 0) return [];
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, ...fresh]));
  } catch {
    /* 저장이 막히면 다음에 또 보여 준다 */
  }
  return fresh.map((k) => `${NAME[k]} · ${effect(state, k)}`);
}
