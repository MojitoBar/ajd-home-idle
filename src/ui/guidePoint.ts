// 가이드 화살표: 지금 단계에서 눌러야 할 화면 요소 옆에 도트 화살표를 띄운다. 상태는 읽기만 하고, 누를 수 있는 요소를 가리지 않는다(pointer-events: none).
import { GUIDE_STEPS, guideEnded } from '../logic/guide';
import { canBuyGear, gearUnlocked } from '../logic/gear';
import { strikeCost, tapCost } from '../logic/economy';
import type { GameState } from '../logic/state';
import type { GearId } from '../data/gear';

export type PointTab = 'tap' | 'home' | 'box' | 'dex';
type Dir = 'down' | 'up' | 'left' | 'right';

export interface PointHost {
  state: () => GameState;
  activeTab: () => PointTab;
  tab: (id: PointTab) => HTMLElement | undefined;
  panel: HTMLElement;
  tapBtn: HTMLElement;
  strikeBtn: HTMLElement;
  multBtn: HTMLElement;
  moveBtn: HTMLElement;
  boxBtn: HTMLElement;
  canBuyBox: () => boolean;
  perkBtn: HTMLElement;
  canBuyPerkBox: () => boolean;
  gears: () => { id: GearId; btn: HTMLElement }[];
  /** 방 안 상자 자리(화면 좌표). 못 찾으면 x·y가 0 */
  boxAt: () => { x: number; y: number; half: number };
  /** 가이드 줄이 단계 완료를 붙잡고 있나 */
  holding: () => boolean;
}

/** 아무 입력이 없어서 방 안 행동 단계에서도 상자를 가리키기까지 */
const IDLE_MS = 4000;
const ROOM_STEPS = new Set(['tap', 'unbox', 'combo', 'strike', 'weak', 'fever', 'chain', 'streak', 'special']);

// 도트 그림(1도트 = 2px): '#' 남색 외곽선, 'o' 주황 면. 아래를 가리키는 화살표를 돌려서 네 방향을 만든다
const DOWN = ['....#####....', '....#ooo#....', '....#ooo#....', '....#ooo#....', '....#ooo#....', '#####ooo#####', '#ooooooooooo#', '.#ooooooooo#.', '..#ooooooo#..', '...#ooooo#...', '....#ooo#....', '.....#o#.....', '......#......'];
const D = 2;
const NS = 'http://www.w3.org/2000/svg';

function rotate(g: string[]): string[] {
  const h = g.length;
  const w = g[0].length;
  return Array.from({ length: w }, (_, y) => Array.from({ length: h }, (_, x) => g[h - 1 - x][y]).join(''));
}
const flipV = (g: string[]): string[] => [...g].reverse();
const flipH = (g: string[]): string[] => g.map((r) => [...r].reverse().join(''));
const GRIDS: Record<Dir, string[]> = { down: DOWN, up: flipV(DOWN), right: flipH(rotate(DOWN)), left: rotate(DOWN) };

function svgOf(grid: string[]): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  const w = grid[0].length * D;
  const h = grid.length * D;
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(h));
  svg.setAttribute('viewBox', `0 0 ${grid[0].length} ${grid.length}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      if (c === '.') {
        x++;
        continue;
      }
      let e = x;
      while (e < row.length && row[e] === c) e++;
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', String(x));
      r.setAttribute('y', String(y));
      r.setAttribute('width', String(e - x));
      r.setAttribute('height', '1');
      r.setAttribute('class', c === '#' ? 'l' : 'f');
      svg.append(r);
      x = e;
    }
  });
  return svg;
}

let host: PointHost;
let root: HTMLElement;
const inner = document.createElement('i');
let shown: Dir | null = null;
let loop = 0;
let lastInput = performance.now();
const arrows = {} as Record<Dir, SVGSVGElement>;

interface Spot {
  /** 화살표 끝이 가리키는 상자(화면 좌표) */
  x: number;
  y: number;
  w: number;
  h: number;
  prefer: Dir[];
  /** 탭 내용 영역 안의 요소: 스크롤 밖이면 영역 가장자리에 붙인다 */
  clip?: boolean;
}

export function initGuidePoint(h: PointHost): void {
  host = h;
  root = document.createElement('div');
  root.className = 'gd-point';
  root.hidden = true;
  root.setAttribute('aria-hidden', 'true');
  root.append(inner);
  document.body.append(root);
  for (const d of Object.keys(GRIDS) as Dir[]) arrows[d] = svgOf(GRIDS[d]);
  const mark = (): void => {
    lastInput = performance.now();
  };
  for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) window.addEventListener(ev, mark, { capture: true, passive: true });
}

const rectOf = (e: HTMLElement): Spot | null => {
  const r = e.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  return { x: r.left, y: r.top, w: r.width, h: r.height, prefer: ['down', 'up'] };
};

/** 눌러야 할 버튼이 다른 탭에 있으면 그 탭 버튼, 그 탭에 와 있으면 실제 버튼을 가리킨다. 살 수 없으면 가리키지 않는다 */
function viaTab(tab: PointTab, btn: HTMLElement | null, can: boolean): Spot | null {
  if (!can) return null;
  if (host.activeTab() !== tab) {
    const t = host.tab(tab);
    return t ? rectOf(t) : null;
  }
  const r = btn ? rectOf(btn) : null;
  return r && { ...r, clip: true };
}

function target(s: GameState): Spot | null {
  const id = GUIDE_STEPS[s.guide.step]?.id;
  if (!id) return null;
  switch (id) {
    case 'upgrade':
    case 'tapLv':
      return viaTab('tap', host.tapBtn, tapCost(s.tapLevel) <= s.points);
    case 'strikeLv':
      return viaTab('tap', host.strikeBtn, strikeCost(s.strikeLevel) <= s.points);
    case 'gear': {
      const g = host.gears().find((c) => gearUnlocked(s, c.id) && canBuyGear(s, c.id));
      return viaTab('tap', g?.btn ?? null, !!g);
    }
    case 'boxBuy':
      return viaTab('box', host.boxBtn, host.canBuyBox());
    case 'perkBox':
      return viaTab('box', host.perkBtn, host.canBuyPerkBox());
    case 'home':
      return host.activeTab() === 'home' ? null : viaTab('home', null, true);
    case 'mult': {
      const r = rectOf(host.multBtn);
      return r ? { ...r, prefer: ['up', 'left'] } : null;
    }
    case 'move': {
      const b = host.moveBtn as HTMLButtonElement;
      return b.disabled ? null : rectOf(b);
    }
  }
  if (ROOM_STEPS.has(id) && performance.now() - lastInput >= IDLE_MS) {
    const a = host.boxAt();
    if (a.x === 0 && a.y === 0) return null;
    return { x: a.x - a.half, y: a.y - a.half, w: a.half * 2, h: a.half * 2, prefer: ['up'] };
  }
  return null;
}

function hide(): void {
  if (root.hidden) return;
  root.hidden = true;
  shown = null;
}

function frame(): void {
  const s = host.state();
  if (guideEnded(s)) {
    hide();
    loop = 0;
    return;
  }
  loop = requestAnimationFrame(frame);
  if (host.holding() || document.querySelector('.overlay, .box-scene, .move-scene')) return hide();
  const t = target(s);
  if (!t) return hide();
  place(t);
}

/** 화살표를 놓는다. 대상이 화면 안이면 옆에 붙이고, 탭 내용 영역 밖이면 가장자리에 붙여 방향만 가리킨다 */
function place(t: Spot): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gap = 2;
  const size = (d: Dir): { w: number; h: number } => ({ w: arrows[d].width.baseVal.value, h: arrows[d].height.baseVal.value });
  const fits = (d: Dir): boolean => {
    const { w, h } = size(d);
    if (d === 'down') return t.y - gap - h >= 0;
    if (d === 'up') return t.y + t.h + gap + h <= vh;
    if (d === 'right') return t.x - gap - w >= 0;
    return t.x + t.w + gap + w <= vw;
  };
  let dir = t.prefer.find(fits) ?? t.prefer[0];
  const cx = t.x + t.w / 2;
  const cy = t.y + t.h / 2;
  let { w, h } = size(dir);
  let x = dir === 'right' ? t.x - gap - w : dir === 'left' ? t.x + t.w + gap : cx - w / 2;
  let y = dir === 'down' ? t.y - gap - h : dir === 'up' ? t.y + t.h + gap : cy - h / 2;
  if (t.clip) {
    // 탭 내용 영역: 패널 윗변부터 탭 바 윗변(PC는 화면 아래)까지
    const dock = host.tab('tap')?.getBoundingClientRect();
    const bottom = Math.min(vh, dock && dock.top > vh / 2 ? dock.top : vh);
    const top = Math.max(0, host.panel.getBoundingClientRect().top);
    if (t.y >= bottom) {
      dir = 'down';
      ({ w, h } = size(dir));
      x = cx - w / 2;
      y = bottom - h - gap;
    } else if (t.y + t.h <= top) {
      dir = 'up';
      ({ w, h } = size(dir));
      x = cx - w / 2;
      y = top + gap;
    }
  }
  x = Math.round(Math.min(vw - w - 4, Math.max(4, x)));
  y = Math.round(Math.min(vh - h, Math.max(0, y)));
  if (shown !== dir) {
    inner.replaceChildren(arrows[dir]);
    root.dataset.dir = dir;
    shown = dir;
  }
  root.style.left = `${x}px`;
  root.style.top = `${y}px`;
  root.hidden = false;
}

/** 화면이 갱신될 때마다 부른다. 가이드 중이면 위치를 매 프레임 따라가고, 끝났으면 멈춘다 */
export function syncGuidePoint(): void {
  if (guideEnded(host.state())) {
    if (loop) cancelAnimationFrame(loop);
    loop = 0;
    hide();
    return;
  }
  if (!loop) loop = requestAnimationFrame(frame);
}
