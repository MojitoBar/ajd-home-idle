// 공구 탭의 새 공구 5종 카드(수평계·안전모·빠루·송곳·돋보기). 구매 처리(소리·숫자 튐)는 app.ts가 attach로 붙이고, 여기는 카드 모양과 값 줄만 맡는다.
import { GEARS, gearDef, type GearId } from '../data/gear';
import { chainBonus } from '../logic/unpack';
import { formatNumber } from '../logic/format';
import { gearCost, gearEffects, gearLevel, gearUnlocked } from '../logic/gear';
import type { GameState } from '../logic/state';
import { el, glyph, setDisabled, setText, toggleClass } from './dom';
import { iconImg, type IconName } from './icons';

export const GEAR_ICON: Record<GearId, IconName> = { level: 'tool/level', helmet: 'tool/hardhat', crowbar: 'tool/crowbar', awl: 'tool/awl', loupe: 'tool/magnifier' };

export interface GearCard {
  id: GearId;
  card: HTMLElement;
  lv: HTMLElement;
  info: HTMLElement;
  btn: HTMLButtonElement;
  buyHead: HTMLElement;
  buyPrice: HTMLElement;
  max: HTMLElement;
  help?: HTMLButtonElement;
}

const pct = (v: number): string => `${Number((v * 100).toFixed(1))}%`;

/** 지금 값과 한 레벨 위 값(앞말, 지금, 다음). 상한이면 다음이 null */
export function gearLine(state: GameState, id: GearId): { pre: string; now: string; next: string | null } {
  const at = (lv: number): GameState => ({ ...state, gear: { ...state.gear, [id]: lv } });
  const lv = gearLevel(state, id);
  const f = (s: GameState): string => {
    const e = gearEffects(s);
    switch (id) {
      case 'level': return pct(e.perfectHalf * 2);
      case 'helmet': return `${e.shieldMax}칸`;
      case 'crowbar': return `x${formatNumber(chainBonus(e.chainCap, e.chainCap))}`;
      case 'awl': return `${e.weakTaps}`;
      case 'loupe': return pct(e.specialRate);
    }
  };
  const pre = { level: '퍼펙트 칸 ', helmet: '실드 ', crowbar: '연쇄 최대 ', awl: '급소 탭 ', loupe: '특별 상자 ' }[id];
  return { pre, now: f(state), next: lv >= gearDef(id).maxLevel ? null : f(at(lv + 1)) };
}

/** 카드 5장. attach는 구매 버튼에 onBuy를 붙인다 */
export function createGearCards(attach: (c: GearCard) => void): GearCard[] {
  return GEARS.map((g) => {
    const lv = el('div', { cls: 'card-lv' });
    const info = el('div', { cls: 'card-info key' });
    const buyHead = el('span', { cls: 'buy-h' });
    const buyPrice = el('span', { cls: 'buy-p fb' });
    const btn = el('button', { cls: 'btn buy fb', attrs: { type: 'button' } }, buyHead, buyPrice);
    const max = el('span', { cls: 'tag gold gear-max', text: '최대' });
    const help = g.id === 'loupe' ? el('button', { cls: 'i-chip gear-info', attrs: { type: 'button', 'aria-label': '특별 상자 설명 보기', title: '특별 상자 설명 보기' } }, glyph('i', 8)) : undefined;
    const card = el(
      'div',
      { cls: `card tap-card gear-card gear-${g.id}` },
      el('div', { cls: 'card-icon' }, iconImg(GEAR_ICON[g.id], { size: 48 })),
      el('div', { cls: 'card-main' }, el('div', { cls: 'card-title' }, el('span', { cls: 'card-name', text: g.name }), lv), help ? el('div', { cls: 'tap-info-row' }, info, help) : info),
      btn,
      max,
    );
    const c: GearCard = { id: g.id, card, lv, info, btn, buyHead, buyPrice, max, help };
    attach(c);
    return c;
  });
}

function setVal(node: HTMLElement, pre: string, num: string, unit: string): void {
  const key = `${pre}|${num}|${unit}`;
  if (node.dataset.v === key) return;
  node.dataset.v = key;
  node.replaceChildren(el('span', { cls: 'v-u', text: pre }), el('span', { cls: 'v-n', text: num }), el('span', { cls: 'v-u', text: unit }));
}

/** 카드 값 갱신. 해금 전 카드는 숨기고, 다음에 열릴 공구 이름과 남은 상자 수를 돌려준다(없으면 null) */
export function syncGearCards(cards: GearCard[], state: GameState): { name: string; left: number } | null {
  let next: { name: string; left: number } | null = null;
  for (const c of cards) {
    const open = gearUnlocked(state, c.id);
    c.card.hidden = !open;
    if (!open) {
      const left = gearDef(c.id).unlockBox - state.unpack.box;
      if (!next || left < next.left) next = { name: gearDef(c.id).name, left };
      continue;
    }
    const def = gearDef(c.id);
    const lv = gearLevel(state, c.id);
    const line = gearLine(state, c.id);
    setText(c.lv, `Lv ${lv}/${def.maxLevel}`);
    setVal(c.info, line.pre, line.now, line.next ? ` → ${line.next}` : '');
    const full = lv >= def.maxLevel;
    c.btn.hidden = full;
    c.max.hidden = !full;
    toggleClass(c.card, 'maxed', full);
    if (full) continue;
    const cost = gearCost(state, c.id);
    const can = cost <= state.points;
    setText(c.buyHead, '강화');
    setText(c.buyPrice, `${formatNumber(cost)} P`);
    setDisabled(c.btn, !can);
    toggleClass(c.card, 'affordable', can);
  }
  return next;
}
