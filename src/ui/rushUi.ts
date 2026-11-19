// 시계 상자 러시 표시: 방 테두리 파랑 깜빡임 + 피버 칩 바로 위의 남은 시간 칩. 상태는 읽기만 한다.
import type { GameState } from '../logic/state';
import { el, setText, toggleClass } from './dom';
import * as fx from './fx';
import { tag as feverTag } from './feverUi';

const bar = el('i', { cls: 'rush-bar' });
const txt = el('span');
/** 남은 시간 칩 `자동 N초`(999초 위는 `자동 N분` 올림): 피버 칩과 같은 폭·모양, 파랑 면 + 흰 글자. 아랫변 막대는 0이 된 뒤 지금까지 쌓인 최대값 대비 남은 비율 */
export const tag = el('div', { cls: 'rush-tag', attrs: { 'aria-live': 'off', hidden: '' } }, txt, bar);
let roomEl: HTMLElement;
let last = 0;
let peak = 0;

export function initRush(room: HTMLElement): void {
  roomEl = room;
  room.append(tag);
}

export function syncRush(state: GameState): void {
  const sec = state.unpack.rushSec;
  const on = sec > 0;
  toggleClass(roomEl, 'rush', on);
  if (tag.hidden === on) tag.hidden = !on;
  if (!on) peak = 0;
  if (on) {
    peak = Math.max(peak, sec);
    const s = Math.ceil(sec);
    setText(txt, s <= 999 ? `자동 ${s}초` : `자동 ${Math.ceil(s / 60)}분`);
    bar.style.setProperty('--r', String(Math.round((sec / peak) * 40) / 40));
    // 피버 칩이 떠 있으면 그 바로 위(4px 틈), 없으면 같은 자리
    const f = !feverTag.classList.contains('blank') && feverTag.offsetHeight > 0 ? feverTag : null;
    tag.style.bottom = f ? `${6 + f.offsetHeight + 4}px` : '';
    tag.style.minWidth = f ? `${f.offsetWidth}px` : '';
    if (sec > last && last > 0 && !fx.isReduced()) fx.pxFrames(tag, [1.25, 1.12, 1].map((v) => ({ scale: String(v) })), 40);
  }
  last = sec;
}
