// 상자 탭 맨 위 [뽑기 / 도감] 토글(이사 1회 이상일 때만). 도감 패널 자체는 dex.ts가 그대로 그린다.
import { el } from './dom';

export type BoxView = 'draw' | 'dex';

let view: BoxView = 'draw';
let onChange: (v: BoxView) => void = () => {};

const mk = (id: BoxView, label: string): HTMLButtonElement => {
  const b = el('button', { cls: 'btn sm view-btn', text: label, attrs: { type: 'button', 'data-view': id, 'aria-pressed': 'false' } });
  b.append(el('i', { cls: 'dot', attrs: { hidden: '' } }));
  b.addEventListener('click', () => setView(id));
  return b;
};
const draw = mk('draw', '뽑기');
const dex = mk('dex', '도감');
export const viewBar = el('div', { cls: 'box-view', attrs: { role: 'group', 'aria-label': '상자 화면' } }, draw, dex);

export const getView = (): BoxView => view;
export function initBoxView(cb: (v: BoxView) => void): void {
  onChange = cb;
}
export function setView(v: BoxView): void {
  if (v === view) return;
  view = v;
  onChange(v);
}
/** 도감 칸 알림 점과 선택 표시를 맞춘다 */
export function syncBoxView(dexDot: boolean): void {
  for (const b of [draw, dex]) {
    const on = (b === dex ? 'dex' : 'draw') === view;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  }
  const d = dex.querySelector<HTMLElement>('.dot')!;
  if (d.hidden === dexDot) d.hidden = !dexDot;
}
