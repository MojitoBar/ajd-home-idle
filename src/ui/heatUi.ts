// 열기 줄: 타이밍 막대 아래 8px 줄과 이름표. 값은 app.ts가 매 프레임 render로 넘긴다(저장·판정은 모른다). 달아오름·과열 연출도 여기서 맡는다.
import { HEAT_HOT, heatZone, type HeatState } from '../logic/heat';
import { el } from './dom';
import * as fx from './fx';
import { sfx } from './sound';
import { boxAnchor } from './unpackUi';

/** 이 값 이상이면 과열 임박(채움이 빨강으로 깜박이고 탭마다 경고음) */
const HEAT_WARN = 88;
const FLASH_MS = 83;
const STEAM_MS = 420;

let root: HTMLElement;
let fillEl: HTMLElement;
let chipEl: HTMLElement;
let flashEl: HTMLElement;
let lastW = -1;
let lastKey = '';
let lastSteam = 0;

const CHIP: Record<string, string> = { cool: '파워', warm: '파워', hot: '파워 x1.5', over: '과열' };

/** 열기 줄을 만들어 게이지 위젯 안에 붙인다 */
export function mount(parent: HTMLElement): void {
  fillEl = el('i', { cls: 'heat-fill' });
  chipEl = el('span', { cls: 'heat-chip', text: CHIP.cool });
  flashEl = el('i', { cls: 'heat-flash', attrs: { hidden: '' } });
  root = el('div', { cls: 'charge-heat z-cool' }, fillEl, el('i', { cls: 'heat-tick' }), flashEl, chipEl);
  root.querySelector<HTMLElement>('.heat-tick')!.style.left = `${HEAT_HOT * 2}px`;
  parent.append(root);
}

/** 채움은 2px(1도트) 단위로 끊고, 구간이 바뀌면 색·이름표를 바꾼다. 과열 중에는 김이 드문드문 오른다 */
export function render(h: HeatState): void {
  const w = Math.round(h.v) * 2;
  if (w !== lastW) {
    lastW = w;
    fillEl.style.width = `${w}px`;
  }
  const z = heatZone(h);
  const key = `${z}${z !== 'over' && h.v >= HEAT_WARN ? ' warn' : ''}${fx.isReduced() ? ' rd' : ''}`;
  if (key !== lastKey) {
    lastKey = key;
    root.className = `charge-heat z-${key.replace(/ /g, ' z-')}`;
    chipEl.textContent = CHIP[z];
  }
  if (z === 'over' && performance.now() - lastSteam > STEAM_MS) {
    lastSteam = performance.now();
    steam(1 + Math.floor(Math.random() * 2));
  }
}

/** 상자 윗부분에서 위로 오르는 입자 */
function fromBox(n: number, colors: string[], o: { speed?: number; lift?: number; gravity?: number; size?: number } = {}): void {
  const a = boxAnchor();
  fx.burst(a.x, a.y - a.half * 0.8, { n, colors, up: true, speed: (o.speed ?? 200) * a.k, lift: (o.lift ?? -80) * a.k, gravity: (o.gravity ?? 700) * a.k, size: (o.size ?? 4) * a.k, clip: true });
}

function steam(n: number): void {
  fromBox(n, ['k5', 'k4'], { speed: 120, lift: -90, gravity: -120, size: 6 });
}

/** 줄이 한 프레임 흰색으로 번쩍 */
function blink(): void {
  if (fx.isReduced()) return;
  flashEl.hidden = false;
  window.setTimeout(() => (flashEl.hidden = true), FLASH_MS);
}

/** 줄 양 끝에서 위로 튀는 입자 */
function ends(colors: string[]): void {
  const r = root.getBoundingClientRect();
  if (!r.width) return;
  const a = boxAnchor();
  for (const x of [r.left, r.right]) fx.burst(x, r.top, { n: 4, colors, up: true, speed: 180 * a.k, lift: -60 * a.k, gravity: 500 * a.k, size: 4 * a.k, clip: true });
}

/** 탭마다: 달아오름이면 상자에서 주황·노랑 입자, 과열 임박이면 경고음 */
export function tap(h: HeatState): void {
  const z = heatZone(h);
  if (z === 'hot') fromBox(1 + Math.round(Math.random()), ['or', 'g2']);
  if (z !== 'over' && h.v >= HEAT_WARN) sfx.heatWarn();
}

/** 과열이 막 시작됐다 */
export function over(): void {
  sfx.heatOver();
  steam(8);
}

/** 과열이 막 끝났다 */
export function recovered(): void {
  blink();
  sfx.heatBack();
}

/** 달아오름 구간에 막 들어섰다 */
export function hot(): void {
  blink();
  ends(['or', 'g2']);
  sfx.heatUp();
}
