/*
 * 타격감·연출 모듈(도트 방식). app.ts·다른 화면(상자 열기 등)에서 호출만 한다. 좌표는 모두 clientX/Y(화면 기준).
 * 입자는 단색 정사각형(짝수 px), 회전·알파 없음, 2px 격자 반올림, 사라질 때 크기 8→6→4→2→없음. 프레임 기본 12fps.
 *
 *  입자 레이어(canvas 하나, 동시 입자 상한 80)
 *   burst(x, y, {n, colors, kind, speed, gravity, up})  사각 조각·별(십자)·동전 터짐
 *   confetti(x, y, n)  rain(n)                          색종이 분수·비(4·6px 사각)
 *   flyIcon / absorb / coinShower                       아이콘·동전이 요소로 날아감(도착 시 thump)
 *  DOM 연출(steps·2px 단위)
 *   floatText  banner  popIcon  milestoneCard  sparkle  edge  flash(화면 테두리 점멸)  shake(2px 정수 흔들림)
 *   thump bounce pop wobble
 *  숫자: roller / countUp
 *  조합: tapBurst, combo, moveScene, setReduced
 */
import { formatNumber } from '../logic/format';
import { sfx } from './sound';
import { houseIcon, iconImg, iconUrl, readyIcon, type IconName } from './icons';
import { vibrate } from './prefs';

type Pt = { x: number; y: number };
type Target = Pt | Element;
type Kind = 'dot' | 'chip' | 'coin' | 'confetti' | 'star' | 'emoji';

interface Particle {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  age: number;
  life: number;
  delay: number;
  size: number;
  color: string;
  text?: string;
  /** 방 안에서 태어난 입자: 방 밖으로 나가면 그리지 않는다 */
  clip?: boolean;
  avoid?: DOMRect;
  /** 이 사각형 밖으로 나가면 그리지 않는다(요소 강조 반짝이용) */
  bounds?: { left: number; right: number; top: number; bottom: number };
  floor?: number;
  tag?: string;
  /** 이 높이보다 위로 올라가면 사라진다(목록 윗변 등) */
  top?: number;
  fly?: { x0: number; y0: number; cx: number; cy: number; x1: number; y1: number; to?: Element; onArrive?: () => void };
}

const MAX_PARTICLES = 80;
const FRAME = 83;
const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
let reducedFlag = false;
export function setReduced(v: boolean): void {
  reducedFlag = v;
}
const reduced = (): boolean => reducedFlag || !!mq?.matches;
export const isReduced = reduced;
const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
const px = (v: number): number => Math.round(v / 2) * 2;
const even = (v: number, min = 2): number => Math.max(min, px(v));

// ---------- 팔레트 24색 ----------
const TOKENS: Record<string, string> = {
  k0: '#0d1430', k1: '#16224a', k2: '#3b4a7a', k3: '#8a96b8', k4: '#d6dcec', k5: '#ffffff', p1: '#fff3d6', p2: '#ecd3a0', w1: '#8a4f24', w2: '#d08a4a',
  b1: '#0b3aa0', b2: '#145ce6', b3: '#5b9bff', b4: '#bcd6ff', g0: '#7a4a00', g1: '#c98a00', g2: '#ffc83d', g3: '#ffeaa0', r1: '#a8142d', r2: '#e9304b',
  or: '#ff8a1f', gn: '#2fb36b', pu: '#8d5cf6', pk: '#ff6fb0',
};
const PAL_RGB = Object.entries(TOKENS).map(([name, hex]) => ({ name, hex, r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) }));
const snapCache = new Map<string, string>();
/** 아무 색이나 받아 팔레트 24색 중 가장 가까운 색(hex)으로 바꾼다 */
function snapHex(c: string): string {
  if (TOKENS[c]) return TOKENS[c];
  const hit = snapCache.get(c);
  if (hit) return hit;
  let s = c.replace('#', '');
  if (s.length === 3) s = s.replace(/./g, (m) => m + m);
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  let best = PAL_RGB[0];
  let bd = 1e9;
  for (const p of PAL_RGB) {
    const d = (p.r - r) ** 2 + (p.g - g) ** 2 + (p.b - b) ** 2;
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  snapCache.set(c, best.hex);
  return best.hex;
}
/** 팔레트 토큰으로 바꾼 중복 없는 색 목록(최대 4색) */
const snapAll = (cs: string[]): string[] => [...new Set(cs.map(snapHex))].slice(0, 4);
export const tokenName = (c: string): string => PAL_RGB.find((p) => p.hex === snapHex(c))!.name;
const CONFETTI_COLORS = [TOKENS.b2, TOKENS.g2, TOKENS.r2, TOKENS.k5];
/** 피버 중 색종이는 주황·노랑만(빨강은 약정·위험 전용) */
const FEVER_CONFETTI_COLORS = [TOKENS.or, TOKENS.g2, TOKENS.g3];

// ---------- DOM 레이어 ----------
let layer: HTMLDivElement;
let canvas: HTMLCanvasElement;
let g2: CanvasRenderingContext2D;
let dpr = 1;
let w = 0;
let h = 0;

/** 장면(상자·이사) 안으로 입자 캔버스를 옮긴다. 글자·버튼보다 아래, 장면 배경보다 위 */
export function hostParticles(scene: HTMLElement): void {
  ensure();
  canvas.classList.add('in-scene');
  scene.prepend(canvas);
}

export function clearParticles(): void {
  particles.length = 0;
  if (canvas) g2.clearRect(0, 0, canvas.width, canvas.height);
}

function ensure(): void {
  if (layer) {
    if (!canvas.isConnected) {
      canvas.classList.remove('in-scene');
      document.body.append(canvas);
    }
    return;
  }
  window.addEventListener('modal-open', clearParticles);
  layer = document.createElement('div');
  layer.className = 'fx-layer';
  canvas = document.createElement('canvas');
  canvas.className = 'fx-canvas';
  document.body.append(layer, canvas);
  g2 = canvas.getContext('2d')!;
  resize();
  window.addEventListener('resize', resize);
}
function resize(): void {
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  w = window.innerWidth;
  h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
}

function center(t: Target): Pt {
  if ('x' in t) return t;
  const r = t.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** 프레임 도우미: 키프레임 n개를 frameMs씩 끊어 그대로 보여 준다(easing을 효과 전체에 걸면 첫 프레임에서 멈춘다) */
export function pxFrames(el: Element, frames: Keyframe[], frameMs: number, o: KeyframeAnimationOptions = {}): Animation {
  const n = frames.length;
  const kf: Keyframe[] = frames.map((f, i) => ({ ...f, offset: i / n, easing: 'steps(1, end)' }));
  kf.push({ ...frames[n - 1], offset: 1, easing: 'linear' });
  return el.animate(kf, { ...o, duration: n * frameMs, easing: 'linear' });
}

/** 12fps 프레임 진행. fn이 false를 돌려주거나 개수가 차면 멈추고 done을 부른다 */
function frames(total: number, fn: (i: number) => boolean | void, done?: () => void): void {
  let i = 0;
  fn(0);
  const id = window.setInterval(() => {
    i++;
    if (i >= total || fn(i) === false) {
      clearInterval(id);
      done?.();
    }
  }, FRAME);
}

// ---------- 루프 ----------
const particles: Particle[] = [];
/** 지금 떠 있는 입자 수(성능 점검용) */
export const particleCount = (): number => particles.length;
let looping = false;
let last = 0;
let hadParticles = false;
const rollers = new Set<Roller>();

function wake(): void {
  if (looping) return;
  looping = true;
  last = performance.now();
  requestAnimationFrame(loop);
}

function loop(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  for (const r of rollers) r.step(dt);
  stepParticles(dt);
  if (particles.length || rollers.size) requestAnimationFrame(loop);
  else looping = false;
}

function addParticle(p: Particle): void {
  ensure();
  if (particles.length >= MAX_PARTICLES) {
    if (p.kind === 'dot' || p.kind === 'chip' || p.kind === 'confetti') return;
    const idx = particles.findIndex((q) => !q.fly);
    if (idx >= 0) particles.splice(idx, 1);
    else return;
  }
  if (!p.fly && !canvas.classList.contains('in-scene')) {
    const r = roomRect();
    if (r && p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom) p.clip = true;
  }
  particles.push(p);
  wake();
}

function roomRect(): DOMRect | null {
  const e = document.querySelector('.room');
  if (!e || !e.getClientRects().length) return null;
  return e.getBoundingClientRect();
}

function stepParticles(dt: number): void {
  if (!particles.length) {
    if (hadParticles) {
      g2.clearRect(0, 0, canvas.width, canvas.height);
      hadParticles = false;
    }
    return;
  }
  hadParticles = true;
  g2.setTransform(dpr, 0, 0, dpr, 0, 0);
  g2.imageSmoothingEnabled = false;
  g2.clearRect(0, 0, w, h);
  const room = particles.some((p) => p.clip) ? roomRect() : null;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.delay > 0) {
      p.delay -= dt;
      continue;
    }
    p.age += dt;
    const t = p.age / p.life;
    if (t >= 1) {
      if (p.fly) {
        if (p.fly.to) thump(p.fly.to);
        p.fly.onArrive?.();
      }
      particles.splice(i, 1);
      continue;
    }
    if (p.fly) {
      const f = p.fly;
      const e = t * t * (3 - 2 * t) * 0.35 + t * t * t * 0.65;
      const u = 1 - e;
      p.x = u * u * f.x0 + 2 * u * e * f.cx + e * e * f.x1;
      p.y = u * u * f.y0 + 2 * u * e * f.cy + e * e * f.y1;
    } else {
      p.vy += p.g * dt;
      p.vx *= 1 - 1.2 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    if ((p.floor !== undefined && p.vy > 0 && p.y >= p.floor) || (p.top !== undefined && p.y < p.top)) {
      particles.splice(i, 1);
      continue;
    }
    if (p.clip && room && (p.x < room.left || p.x > room.right || p.y < room.top || p.y > room.bottom)) continue;
    if (p.bounds && (p.x < p.bounds.left || p.x > p.bounds.right || p.y < p.bounds.top || p.y > p.bounds.bottom)) continue;
    if (p.avoid && p.x >= p.avoid.left && p.x <= p.avoid.right && p.y >= p.avoid.top && p.y <= p.avoid.bottom) continue;
    draw(p, t);
  }
}

/** 크기 단계: 앞 60%는 그대로, 뒤 40%는 100% → 75% → 50% → 25% (8 → 6 → 4 → 2) */
function shrink(size: number, t: number): number {
  if (t < 0.6) return size;
  const k = Math.min(3, Math.floor(((t - 0.6) / 0.4) * 4));
  return even(size * [1, 0.75, 0.5, 0.25][k]);
}

function draw(p: Particle, t: number): void {
  const f = Math.floor(p.age * 12);
  const x = p.x;
  const y = p.y;
  g2.fillStyle = p.color;
  switch (p.kind) {
    case 'dot': {
      const s = shrink(p.size, t);
      g2.fillRect(px(x - s / 2), px(y - s / 2), s, s);
      break;
    }
    case 'chip': {
      const s = shrink(p.size, t);
      const cx = px(x - s / 2);
      const cy = px(y - s / 2);
      if (s >= 6) {
        g2.fillStyle = TOKENS.k0;
        g2.fillRect(cx, cy, s, s);
        g2.fillStyle = p.color;
        g2.fillRect(cx + 1, cy + 1, s - 2, s - 2);
      } else g2.fillRect(cx, cy, s, s);
      break;
    }
    case 'confetti': {
      const s = shrink(p.size, t);
      const hh = f % 2 ? s : even(s - 2);
      const sway = Math.floor(f / 2) % 2 ? 2 : -2;
      g2.fillRect(px(x - s / 2 + sway), px(y - hh / 2), s, hh);
      break;
    }
    case 'coin': {
      const d = shrink(p.size, t);
      const cw = [d, even(d * 0.5), 2, even(d * 0.5)][f % 4];
      const cx = px(x - cw / 2);
      const cy = px(y - d / 2);
      g2.fillStyle = TOKENS.g2;
      g2.fillRect(cx, cy, cw, d);
      if (cw === d && d >= 6) {
        g2.fillStyle = TOKENS.g3;
        g2.fillRect(cx + 2, cy + 2, 2, 2);
      }
      break;
    }
    case 'star': {
      const arm = even(p.size * [0.5, 1, 1, 0.5][Math.min(3, Math.floor(t * 4))], 4);
      g2.fillRect(px(x - arm / 2), px(y - 1), arm, 2);
      g2.fillRect(px(x - 1), px(y - arm / 2), 2, arm);
      g2.fillStyle = TOKENS.k5;
      g2.fillRect(px(x - 1), px(y - 1), 2, 2);
      break;
    }
    case 'emoji': {
      const im = readyIcon((p.text ?? 'coin') as IconName);
      if (im) {
        const d = even(p.size * 2);
        g2.drawImage(im, px(x - d / 2), px(y - d / 2), d, d);
      }
      break;
    }
  }
}

function base(kind: Kind, x: number, y: number, o: Partial<Particle>): Particle {
  return { kind, x, y, vx: 0, vy: 0, g: 0, age: 0, life: 0.8, delay: 0, size: 4, color: TOKENS.k5, ...o };
}

// ---------- 입자 API ----------
export function burst(
  x: number,
  y: number,
  o: { n?: number; colors?: string[]; kind?: Kind; speed?: number; gravity?: number; size?: number; up?: boolean; lift?: number; life?: number; clip?: boolean; avoid?: DOMRect; bounds?: Particle['bounds']; tag?: string; floor?: number; top?: number; dir?: number } = {},
): void {
  if (reduced()) return;
  const kind = o.kind ?? 'dot';
  const n = Math.min(o.n ?? 8, kind === 'coin' ? 12 : 16);
  const colors = snapAll(o.colors ?? [TOKENS.g2, TOKENS.g3, TOKENS.k5]);
  const speed = o.speed ?? 260;
  const lift = o.lift ?? (speed > 0 ? -80 : 0);
  for (let i = 0; i < n; i++) {
    const a = o.dir !== undefined ? o.dir + rnd(-0.6, 0.6) : o.up ? rnd(-Math.PI * 0.95, -Math.PI * 0.05) : rnd(0, 6.283);
    const s = rnd(0.4, 1) * speed;
    const sz = even((o.size ?? 4) * rnd(0.8, 1.25), 4);
    addParticle(
      base(kind, x, y, {
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s + lift,
        g: o.gravity ?? 700,
        life: o.life ?? (kind === 'star' ? rnd(0.36, 0.5) : rnd(0.4, 0.75)),
        size: kind === 'star' ? even(sz * 1.5, 6) : kind === 'coin' ? even(sz * 1.6, 6) : sz,
        color: colors[(Math.random() * colors.length) | 0],
        clip: o.clip,
        avoid: o.avoid,
        bounds: o.bounds,
        tag: o.tag,
        floor: o.floor,
        top: o.top,
      }),
    );
  }
}

/** 태그가 붙은 입자를 모두 지운다 */
export function clearTagged(tag: string): void {
  for (let i = particles.length - 1; i >= 0; i--) if (particles[i].tag === tag) particles.splice(i, 1);
}

/** 한 곳에서 반짝(십자 4프레임) 하나 */
export function twinkle(x: number, y: number, color: string = TOKENS.g3, size = 8, life?: number): void {
  burst(x, y, { n: 1, kind: 'star', colors: [color], speed: 0, gravity: 0, size, life });
}

export function confetti(x: number, y: number, n = 40, o: { clip?: boolean; life?: number; avoid?: DOMRect; floor?: number; scale?: number } = {}): void {
  if (reduced()) return;
  const count = Math.min(n, 40);
  const palette = document.body.classList.contains('fever') ? FEVER_CONFETTI_COLORS : CONFETTI_COLORS;
  for (let i = 0; i < count; i++) {
    const a = rnd(-Math.PI * 0.95, -Math.PI * 0.05);
    const s = rnd(260, 620);
    addParticle(
      base('confetti', x, y, {
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        g: 900,
        life: o.life ?? rnd(1.1, 1.8),
        size: (Math.random() < 0.5 ? 4 : 6) * (o.scale ?? 1),
        color: palette[(Math.random() * palette.length) | 0],
        clip: o.clip,
        avoid: o.avoid,
        floor: o.floor,
      }),
    );
  }
}

/** 화면 위에서 색종이가 격자에 맞춰 떨어진다(이사 장면) */
export function rain(n = 30, colors: string[] = CONFETTI_COLORS, o: { clip?: boolean } = {}): void {
  if (reduced()) return;
  const cs = snapAll(colors);
  const room = o.clip ? roomRect() : null;
  const x0 = room ? room.left : 0;
  const xw = room ? room.width : window.innerWidth;
  for (let i = 0; i < Math.min(n, 40); i++) {
    addParticle(
      base('confetti', x0 + rnd(0, xw), -8, {
        clip: !!room,
        vx: 0,
        vy: rnd(110, 200),
        g: 0,
        delay: rnd(0, 0.9),
        life: rnd(2.2, 3.4),
        size: Math.random() < 0.5 ? 4 : 6,
        color: cs[(Math.random() * cs.length) | 0],
      }),
    );
  }
}

/** 그림 하나를 (x,y)에 톡 띄운다(치명타·피버 등). 위로 2px씩 오르다 깜빡이며 사라진다. */
export function popIcon(name: IconName, x: number, y: number, o: { size?: number; ms?: number; rise?: number } = {}): void {
  ensure();
  while (layer.querySelectorAll('.fx-pop').length > 4) layer.querySelector('.fx-pop')?.remove();
  const e = document.createElement('img');
  const size = even(o.size ?? 64);
  e.className = 'fx-pop';
  e.src = iconUrl(name);
  e.alt = '';
  e.draggable = false;
  e.width = size;
  e.height = size;
  e.style.left = `${px(x - size / 2)}px`;
  e.style.top = `${px(y - size / 2)}px`;
  layer.append(e);
  const rise = even(o.rise ?? 40);
  const total = Math.max(6, Math.round((o.ms ?? 900) / FRAME));
  if (reduced()) {
    window.setTimeout(() => e.remove(), total * FRAME * 0.6);
    return;
  }
  const ry = [-0.2, 0.5, 0.85, 1, 1].map((k) => px(rise * k));
  frames(
    total,
    (i) => {
      e.style.translate = `0 ${-(ry[Math.min(i, ry.length - 1)] ?? rise)}px`;
      e.style.visibility = i >= total - 4 && i % 2 === 0 ? 'hidden' : 'visible';
    },
    () => e.remove(),
  );
}

export function flyIcon(icon: IconName, from: Target, to: Target, o: { ms?: number; size?: number; onArrive?: () => void } = {}): void {
  if (reduced()) {
    o.onArrive?.();
    return;
  }
  const a = center(from);
  const b = center(to);
  addParticle(
    base('emoji', a.x, a.y, {
      text: icon,
      size: o.size ?? 20,
      life: (o.ms ?? 550) / 1000,
      fly: { x0: a.x, y0: a.y, cx: (a.x + b.x) / 2 + rnd(-60, 60), cy: Math.min(a.y, b.y) - 90, x1: b.x, y1: b.y, onArrive: o.onArrive },
    }),
  );
}

export function absorb(from: Target, toEl: Element, n = 3, o: { onArrive?: () => void; delay?: number; offset?: Pt } = {}): void {
  if (reduced()) {
    sfx.coin();
    o.onArrive?.();
    return;
  }
  const a = center(from);
  const b = center(toEl);
  b.x += o.offset?.x ?? 0;
  b.y += o.offset?.y ?? 0;
  const count = Math.max(1, Math.min(n, 4));
  for (let i = 0; i < count; i++) {
    addParticle(
      base('coin', a.x, a.y, {
        size: rnd(5, 7),
        life: rnd(0.45, 0.7),
        delay: (o.delay ?? 0.12) + i * 0.05,
        fly: {
          x0: a.x,
          y0: a.y,
          cx: a.x + rnd(-80, 80),
          cy: a.y - rnd(30, 110),
          x1: b.x + rnd(-10, 10),
          y1: b.y,
          to: toEl,
          onArrive: () => {
            sfx.coin();
            o.onArrive?.();
          },
        },
      }),
    );
  }
}

export function coinShower(from: Target, toEl: Element, n = 12, onDone?: () => void, offset?: Pt): void {
  sfx.reward();
  if (reduced()) {
    onDone?.();
    return;
  }
  const a = center(from);
  const count = Math.min(n, 12);
  for (let i = 0; i < count; i++) {
    const b = center(toEl);
    b.x += offset?.x ?? 0;
    b.y += offset?.y ?? 0;
    addParticle(
      base('coin', a.x, a.y, {
        size: rnd(5, 8),
        life: rnd(0.6, 0.95),
        delay: i * 0.04,
        fly: {
          x0: a.x,
          y0: a.y,
          cx: a.x + rnd(-150, 150),
          cy: a.y + rnd(-200, -40),
          x1: b.x + rnd(-12, 12),
          y1: b.y,
          to: toEl,
          onArrive: i === count - 1 ? onDone : undefined,
        },
      }),
    );
  }
  if (!count) onDone?.();
}

// ---------- DOM 연출 ----------
/** 튀는 숫자: 2px 격자에 놓고, 위로 톡톡 올라간 뒤 깜빡이며 사라진다(번짐·회전·알파 없음) */
export function floatText(x: number, y: number, text: string, o: { scale?: number; color?: string; spread?: number; ms?: number; cls?: string; minY?: number; k?: number; rise?: number; left?: boolean; at?: (w: number, h: number) => { x: number; y: number; rise: number } } = {}): HTMLElement {
  ensure();
  while (layer.querySelectorAll('.fx-float').length > 18) layer.querySelector('.fx-float')?.remove();
  const e = document.createElement('span');
  const s = o.scale ?? 1.1;
  const z = s < 0.95 ? 'z0' : s < 1.7 ? 'z1' : 'z2';
  e.className = ['fx-float', z, o.cls].filter(Boolean).join(' ');
  e.textContent = text;
  if (o.color) e.style.color = snapHex(o.color);
  layer.append(e);
  if ((o.k ?? 1) >= 2) {
    e.style.fontSize = `${parseFloat(getComputedStyle(e).fontSize) * 2}px`;
    e.style.textShadow = '2px 0 0 var(--k0), -2px 0 0 var(--k0), 0 2px 0 var(--k0), 0 -2px 0 var(--k0)';
  }
  const ang = rnd(-(o.spread ?? 55), o.spread ?? 55) * (Math.PI / 180);
  const dist = rnd(40, 72);
  const k = o.minY === undefined ? 1 : Math.max(0.1, Math.min(1, (y - o.minY) / (dist * 1.15 + 14)));
  const at = o.at?.(e.offsetWidth, e.offsetHeight);
  const dx = o.rise === undefined && !at ? Math.sin(ang) * dist * 0.6 : 0;
  const dy = at ? at.rise : o.rise ?? Math.cos(ang) * dist * k;
  e.style.left = `${at ? px(at.x) : px(o.left ? x : x + dx - e.offsetWidth / 2)}px`;
  e.style.top = `${at ? px(at.y) : px(y - e.offsetHeight / 2)}px`;
  const total = Math.max(8, Math.round((o.ms ?? 700) / FRAME));
  if (reduced()) {
    window.setTimeout(() => e.remove(), 500);
    return e;
  }
  const ry = [0.4, 0.7, 0.88, 1].map((r) => px(dy * r));
  frames(
    total,
    (i) => {
      if (!e.isConnected) return false;
      e.style.translate = `0 ${-ry[Math.min(i, ry.length - 1)]}px`;
      e.style.visibility = i >= total - 4 && i % 2 === 0 ? 'hidden' : 'visible';
    },
    () => e.remove(),
  );
  return e;
}

let bannerEl: HTMLDivElement | null = null;
export const bannerActive = (): boolean => bannerEl !== null;
/** 방 안 큰 글자(배너) 한 가지 자리 규칙: 방 안쪽 폭(좌우 12px 여백)을 넘지 않고, 토스트 띠(윗변 84px) 아래에서 시작해, 부제까지 방 아랫변 위 8px 안에 든다 */
export function banner(text: string, o: { sub?: string; tone?: 'gold' | 'red' | 'blue'; ms?: number } = {}): void {
  ensure();
  bannerEl?.remove();
  const e = document.createElement('div');
  e.className = `fx-banner ${o.tone ?? 'gold'}`;
  const big = document.createElement('div');
  big.className = 'fx-banner-big';
  big.textContent = text;
  e.append(big);
  if (o.sub) {
    const sub = document.createElement('div');
    sub.className = 'fx-banner-sub';
    sub.textContent = o.sub;
    e.append(sub);
  }
  const roomEl = document.querySelector<HTMLElement>('.room');
  const rr = roomEl?.getBoundingClientRect();
  const k = rr && roomEl && roomEl.offsetWidth ? rr.width / roomEl.offsetWidth : 1;
  const kk = k >= 2 ? 2 : 1;
  e.style.setProperty('--bk', String(kk));
  let drop = [0, 0, 0, 0];
  if (rr) {
    e.style.left = `${rr.left + rr.width / 2}px`;
    e.style.maxWidth = `${rr.width - 24 * kk}px`;
    e.classList.add('in-room');
  } else {
    e.style.left = '50%';
    e.style.top = '40%';
  }
  layer.append(e);
  if (rr) {
    // 글자가 안쪽 폭보다 넓으면 한 단계씩 작은 허용 크기로, 끝까지 넓으면 두 줄로 나눈다
    for (const size of [48, 36, 30, 24]) {
      e.style.setProperty('--bs', `${size * kk}px`);
      if (big.offsetHeight <= (size + 4) * kk * 1.5) break;
    }
    const topMin = rr.top + 84 * kk + 4 * kk;
    const botMax = rr.bottom - 8 * kk;
    const rest = Math.max(topMin, Math.min(topMin + 12 * kk, botMax - e.offsetHeight));
    e.style.top = `${rest + e.offsetHeight / 2}px`;
    // 톡 떨어지는 폭도 띠 아래·방 아래 여백 안에서만
    const up = rest - topMin;
    const down = Math.min(4 * kk, botMax - rest - e.offsetHeight);
    drop = [-up, down, -Math.min(down, up), 0];
  }
  e.style.marginLeft = `${-px(e.offsetWidth / 2)}px`;
  e.style.marginTop = `${-px(e.offsetHeight / 2)}px`;
  bannerEl = e;
  const total = Math.max(10, Math.round((o.ms ?? 1500) / FRAME));
  const end = (): void => {
    e.remove();
    if (bannerEl === e) bannerEl = null;
  };
  if (reduced()) {
    window.setTimeout(end, total * FRAME * 0.7);
    return;
  }
  // 위에서 톡 떨어져 두 번 튀고 자리 잡는다 → 마지막에 깜빡이며 사라진다

  frames(
    total,
    (i) => {
      if (!e.isConnected) return false;
      e.style.translate = `0 ${i < drop.length ? drop[i] : 0}px`;
      e.style.visibility = i >= total - 5 && i % 2 === 0 ? 'hidden' : 'visible';
    },
    end,
  );
}

let lastFlash = 0;
/** 번쩍임 대신 화면 가장자리 4px 테두리만 점멸한다(전체 채움 금지) */
export function flash(color: string = TOKENS.k5, ms = 450): void {
  const now = performance.now();
  if (now - lastFlash < 340) return;
  lastFlash = now;
  ensure();
  const e = document.createElement('div');
  e.className = 'fx-edge';
  e.style.borderColor = snapHex(color);
  layer.append(e);
  const total = reduced() ? 2 : Math.max(3, Math.min(5, Math.round(ms / (FRAME * 2))));
  frames(
    total,
    (i) => {
      e.style.visibility = i % 2 === 0 ? 'visible' : 'hidden';
    },
    () => e.remove(),
  );
}

/** 대상 안쪽에 4px 테두리를 프레임 단위로 점멸(색 반전). 구매·마일스톤·반짝임이 쓴다 */
export function edge(el: Element, color: string = TOKENS.g2, pattern: number[] = [1, 1]): void {
  if (reduced()) pattern = [1];
  const e = document.createElement('i');
  e.className = 'fx-edgebox';
  e.style.borderColor = snapHex(color);
  el.append(e);
  frames(
    pattern.length,
    (i) => {
      e.style.visibility = pattern[i] ? 'visible' : 'hidden';
    },
    () => e.remove(),
  );
}

export function shake(target: Element, pxAmt = 6, ms = 320): void {
  const el = (target.id === 'app' ? (target.querySelector('.page') ?? target) : target) as HTMLElement;
  if (reduced()) return;
  const amp = pxAmt <= 4 ? 2 : 4;
  const total = ms >= 300 || pxAmt >= 8 ? 5 : 3;
  const seq = [amp, -amp, amp, -2, 2].slice(0, total);
  frames(
    total + 1,
    (i) => {
      el.style.translate = i < total ? `${seq[i]}px ${i % 2 ? 0 : -2}px` : '';
    },
    () => {
      el.style.translate = '';
    },
  );
}

const lastAt = new WeakMap<Element, number>();
function gate(el: Element, ms: number): boolean {
  const now = performance.now();
  if (now - (lastAt.get(el) ?? 0) < ms) return false;
  lastAt.set(el, now);
  return true;
}

/** 톡 뜀: 4px 위로 1프레임 올랐다 내려온다 */
export function thump(el: Element): void {
  if (reduced() || !gate(el, 70)) return;
  pxFrames(el, [{ translate: '0 -4px' }, { translate: '0 0' }], 83);
}

/** 버튼 번쩍: 면이 g3 → g2 → g3 → g2 로 2번 번쩍였다가 원래 색으로 돌아온다(0.4초, 5프레임) */
export function btnFlash(el: Element): void {
  if (reduced()) return;
  const g3 = { '--face': 'var(--g3)', '--hi': 'var(--k5)', '--drop': 'var(--g1)', '--fg': 'var(--k0)' };
  const g2 = { '--face': 'var(--g2)', '--hi': 'var(--g3)', '--drop': 'var(--g1)', '--fg': 'var(--k0)' };
  pxFrames(el, [g3, g2, g3, g2, g3], FRAME);
}

/** 숫자 튐: 2프레임 빨강으로 바뀌며 4px 올랐다 내려온다 */
export function pop(el: Element, _scale = 1.6): void {
  if (reduced()) return;
  pxFrames(el, [{ translate: '0 -4px', background: 'var(--g2)', color: 'var(--k0)' }, { translate: '0 0', background: 'var(--g2)', color: 'var(--k0)' }, { translate: '0 0' }], 83);
}

/** 눌림: 2px 눌렸다 돌아온다. 카드면 테두리가 한 번 반전된다 */
export function bounce(el: Element, _depth = 0.88): void {
  if (reduced()) return;
  pxFrames(el, [{ translate: '0 2px' }, { translate: '0 0' }], 83);
  if (el.classList.contains('card')) edge(el, TOKENS.g2, [1, 1]);
}

/** 마일스톤: 카드 테두리가 세 번 점멸하고 배율 도장이 톡 떨어진다 */
export function milestoneCard(card: Element, text: string): void {
  const stamp = document.createElement('div');
  stamp.className = 'ms-stamp';
  stamp.textContent = text;
  card.append(stamp);
  edge(card, TOKENS.g2, [1, 0, 1, 0, 1, 1, 0, 1]);
  if (reduced()) {
    window.setTimeout(() => stamp.remove(), 1200);
    return;
  }
  const drop = [-24, 0, -4, 0];
  frames(
    20,
    (i) => {
      stamp.style.translate = `0 ${i < drop.length ? drop[i] : 0}px`;
      stamp.style.visibility = i >= 15 && i % 2 === 0 ? 'hidden' : 'visible';
    },
    () => stamp.remove(),
  );
  const r = card.getBoundingClientRect();
  burst(r.right - 64, r.top + 24, { n: 6, kind: 'star', colors: [TOKENS.g2, TOKENS.k5], speed: 120, gravity: 0, size: 6 });
}

/** 살 수 있게 됐을 때: 카드 테두리 1프레임 + 아이콘 톡 + 사각 입자 */
export function sparkle(card: Element, iconEl: Element): void {
  const c = center(iconEl);
  edge(card, TOKENS.g2, [1]);
  wobble(iconEl);
  burst(c.x, c.y, { n: 5, colors: [TOKENS.g2, TOKENS.g3, TOKENS.k5], speed: 110, gravity: 200, size: 4 });
}

/** 아이콘이 한 번 톡 뛴다(2단) */
export function wobble(el: Element): void {
  if (reduced()) return;
  pxFrames(el, [{ translate: '0 -6px' }, { translate: '0 0' }, { translate: '0 -2px' }, { translate: '0 0' }], 83);
}

function flashNumber(el: Element): void {
  if (reduced() || !gate(el, 400)) return;
  const ink = '2px 0 0 var(--k0), -2px 0 0 var(--k0), 0 2px 0 var(--k0), 0 -2px 0 var(--k0), 2px 2px 0 var(--k0), -2px -2px 0 var(--k0), 2px -2px 0 var(--k0), -2px 2px 0 var(--k0)';
  pxFrames(el, [{ color: 'var(--g2)', textShadow: ink, translate: '0 -2px' }, { color: 'var(--g2)', textShadow: ink, translate: '0 0' }, { textShadow: 'none' }], 83);
}

// ---------- 숫자 ----------
export class Roller {
  shown = 0;
  target = 0;
  private init = false;
  private text = '';
  constructor(
    private el: HTMLElement,
    private format: (v: number) => string,
    private opt: { flashRatio?: number; flashMin?: number } = {},
  ) {}
  set(v: number): void {
    if (!this.init) return this.snap(v);
    if (v === this.target) return;
    const prev = this.target;
    this.target = v;
    const ratio = this.opt.flashRatio;
    if (ratio && prev > 0 && v - prev >= (this.opt.flashMin ?? 0) && v >= prev * ratio) flashNumber(this.el);
    if (!Number.isFinite(v) || !Number.isFinite(this.shown) || reduced()) return this.snap(v);
    rollers.add(this);
    wake();
  }
  snap(v: number): void {
    this.init = true;
    this.target = v;
    this.shown = v;
    rollers.delete(this);
    this.render();
  }
  step(dt: number): void {
    const diff = this.target - this.shown;
    if (Math.abs(diff) <= Math.abs(this.target) * 0.001 + 1e-9) {
      this.shown = this.target;
      rollers.delete(this);
    } else {
      this.shown += diff * (1 - Math.exp(-dt * 11));
    }
    this.render();
  }
  private render(): void {
    const t = this.format(this.shown);
    if (t !== this.text) {
      this.text = t;
      this.el.textContent = t;
    }
  }
}
export function roller(el: HTMLElement, format: (v: number) => string, opt?: { flashRatio?: number; flashMin?: number }): Roller {
  return new Roller(el, format, opt);
}

export function countUp(el: HTMLElement, to: number, ms: number, format: (v: number) => string, from = 0): void {
  if (reduced() || !Number.isFinite(to)) {
    el.textContent = format(to);
    return;
  }
  const t0 = performance.now();
  const stepFn = (now: number): void => {
    const t = Math.min((now - t0) / ms, 1);
    el.textContent = format(from + (to - from) * (1 - (1 - t) ** 3));
    if (t < 1 && el.isConnected) requestAnimationFrame(stepFn);
    else el.textContent = format(to);
  };
  el.textContent = format(from);
  requestAnimationFrame(stepFn);
}

// ---------- 콤보(표시 전용) ----------
const COMBO_GAP = 700;
let comboN = 0;
let comboLast = 0;
let comboEl: HTMLElement | null = null;
let comboTimer = 0;
export const combo = {
  attach(host: HTMLElement): void {
    comboEl = document.createElement('div');
    comboEl.className = 'combo';
    host.append(comboEl);
  },
  hit(): number {
    const now = performance.now();
    comboN = now - comboLast <= COMBO_GAP ? comboN + 1 : 1;
    comboLast = now;
    const el = comboEl;
    if (el) {
      if (comboN >= 3) {
        const tier = comboN >= 40 ? 3 : comboN >= 20 ? 2 : comboN >= 10 ? 1 : 0;
        el.dataset.tier = String(tier);
        el.replaceChildren(Object.assign(document.createElement('div'), { textContent: `${comboN}연타`, className: 'combo-n' }));
        (el.firstChild as HTMLElement).style.fontSize = `${[24, 30, 36][Math.min(tier, 2)]}px`;
        el.classList.add('on');
        if (!reduced()) {
          pxFrames(el, [{ translate: '0 -4px' }, { translate: '0 0' }], 83);
          if (tier >= 1) shake(el, 2 + tier * 2, 200);
        }
      }
      clearTimeout(comboTimer);
      comboTimer = window.setTimeout(() => {
        el.classList.remove('on');
        comboN = 0;
      }, COMBO_GAP + 200);
    }
    return comboN;
  },
};

// ---------- 조합 ----------
export function tapBurst(x: number, y: number, amount: number, comboN_ = 1, pointsEl?: Element): void {
  const tier = comboN_ >= 40 ? 3 : comboN_ >= 20 ? 2 : comboN_ >= 10 ? 1 : 0;
  const colors = [TOKENS.g2, TOKENS.g3, tier >= 2 ? TOKENS.r2 : TOKENS.b3, TOKENS.k5];
  floatText(x, y - 20, `+${formatNumber(amount)}`, { scale: 1 + tier * 0.25, color: tier >= 2 ? TOKENS.pk : undefined });
  burst(x, y, { n: 4 + tier * 2, colors, kind: Math.random() < 0.25 ? 'star' : 'dot', speed: 240 + tier * 60, size: 6 });
  if (pointsEl) absorb({ x, y }, pointsEl, 2 + tier);
  if (tier >= 2) shake(document.getElementById('app')!, tier * 2, 160);
}

// ---------- 이사 연출 ----------
const withJosa = (name: string): string => {
  const c = name.charCodeAt(name.length - 1) - 0xac00;
  if (c < 0 || c > 11171) return `${name}로`;
  const t = c % 28;
  return t === 0 || t === 8 ? `${name}로` : `${name}으로`;
};

export function moveScene(o: { fromName: string; toName: string; theme: string; fromTheme?: string; fromMult: number; toMult: number; onSwap: () => void; onDone: () => void }): void {
  ensure();
  const quick = reduced();
  const big = window.innerWidth >= 900;
  const div = (cls: string, text?: string): HTMLDivElement => {
    const d = document.createElement('div');
    d.className = cls;
    if (text) d.textContent = text;
    return d;
  };
  const el = div('move-scene');
  const label = div('sc-label', '짐 싸는 중');
  const ground = div('sc-ground');
  const clouds = [0, 1, 2].map(() => div('sc-cloud'));
  const road = div('sc-road');
  const dashes = div('sc-dashes');
  for (let i = 0; i < Math.ceil(window.innerWidth / 48) + 2; i++) {
    const d = div('sc-dash');
    d.style.left = `${i * 48}px`;
    dashes.append(d);
  }
  road.append(dashes);
  const groundRows = [0, 1].map((r) => {
    const row = div(`sc-gdots r${r}`);
    for (let i = 0; i < Math.ceil(window.innerWidth / 48) + 2; i++) {
      const d = div('sc-gdot');
      d.style.left = `${i * 48}px`;
      row.append(d);
    }
    ground.append(row);
    return row;
  });
  // 트럭 그림은 48x32 원본의 정수배(모바일 4배, PC 12배)
  const ts = big ? 12 : 4;
  const truck = div('sc-truck');
  truck.style.width = `${48 * ts}px`;
  truck.style.height = `${32 * ts}px`;
  truck.style.transform = `translateX(${-48 * ts - 8}px)`;
  const truckBody = div('sc-bump');
  truckBody.style.width = truck.style.width;
  truckBody.style.height = truck.style.height;
  const truckUrl = (f: string): string => `${import.meta.env.BASE_URL}assets/px/ui/${f}.png`;
  for (const f of ['truck', 'truck-2']) {
    const im = document.createElement('img');
    im.className = `ico sc-truck-f${f === 'truck' ? '' : '2'}`;
    im.width = 48 * ts;
    im.height = 32 * ts;
    im.alt = '';
    im.draggable = false;
    im.src = truckUrl(f);
    truckBody.append(im);
  }
  truck.append(truckBody);
  const white = div('sc-white');
  // 도착: 새 집 아이콘(24px 원본의 정수배) + 집 이름 36px
  const arrive = div('sc-arrive');
  const arriveImg = iconImg(houseIcon(o.theme), { size: 24 * (big ? 12 : 8), alt: '' });
  arrive.append(arriveImg, div('sc-arrive-name', o.toName));
  // 결과 화면
  const result = div('sc-result');
  const houses = div('sc-houses');
  const oldPad = div('sc-pad');
  oldPad.append(iconImg(houseIcon(o.fromTheme ?? o.theme), { size: 96, alt: '' }));
  const arrow = div('sc-arrow', '>>');
  const newPad = div('sc-pad new');
  newPad.append(iconImg(houseIcon(o.theme), { size: 96, alt: '' }));
  houses.append(oldPad, arrow, newPad);
  const from = div('sc-from', `${o.fromName}에서 ${withJosa(o.toName)} 이사했어요`);
  const mult = div('sc-mult');
  const multLabel = div('sc-mult-l', '영구 배율');
  const multNum = div('sc-mult-n', `x${formatNumber(o.fromMult)}`);
  mult.append(multLabel, multNum);
  const go = document.createElement('button');
  go.type = 'button';
  go.className = 'btn primary sc-go';
  go.textContent = '새 집으로';
  result.append(houses, from, mult, go);
  const skip = div('sc-skip', '누르면 건너뛰어요');
  const inner = div('sc-in');
  inner.append(...clouds, ground, label, road, truck, arrive, result, skip);
  el.append(inner, white);
  document.body.append(el);
  hostParticles(el);

  const timers: number[] = [];
  const dustTimers: number[] = [];
  let swapped = false;
  let finished = false;
  const swap = (): void => {
    if (swapped) return;
    swapped = true;
    o.onSwap();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
      e.preventDefault();
      finish();
    }
  };
  const finish = (): void => {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    dustTimers.forEach(clearTimeout);
    document.removeEventListener('keydown', onKey, true);
    swap();
    el.remove();
    o.onDone();
  };
  const at = (ms: number, fn: () => void): void => {
    timers.push(window.setTimeout(fn, quick ? ms * 0.35 : ms));
  };
  const flashWhite = (): void => {
    if (quick) return;
    pxFrames(white, [{ visibility: 'visible' }, { visibility: 'hidden' }], FRAME);
  };
  const hide = (...ns: HTMLElement[]): void => {
    for (const n of ns) n.style.display = 'none';
  };
  const showStage = (n: HTMLElement): void => {
    n.classList.add('on');
  };

  sfx.move();
  vibrate([30, 40, 30]);
  const T_GO = 700;
  const T_PASS = 1300;
  if (!quick) {
    // 이동: 트럭이 덜컹거리며 왼쪽 밖에서 들어와 오른쪽 밖으로 나가고, 도로 점선이 steps()로 흐르며 먼지가 뒤따른다
    at(T_GO, () => {
      label.textContent = '출발';
      label.classList.add('go');
      shake(inner, 4, 800);
      const n = Math.round(T_PASS / FRAME);
      const x0 = -48 * ts - 8;
      const x1 = window.innerWidth + 8;
      pxFrames(truck, Array.from({ length: n }, (_, i) => ({ transform: `translateX(${Math.round(x0 + ((x1 - x0) * (i + 1)) / n)}px)` })), FRAME, { fill: 'forwards' });
      dashes.classList.add('run');
      for (const g of groundRows) g.classList.add('run');
      for (let i = 0; i < 20; i++) {
        dustTimers.push(
          window.setTimeout(() => {
            const r = truck.getBoundingClientRect();
            const rd = road.getBoundingClientRect();
            burst(r.left + 12, r.bottom - 36 - 8, { n: 3, kind: 'dot', colors: [TOKENS.k4, TOKENS.k3], speed: 90, gravity: -30, lift: 0, size: 14, life: 0.7, tag: 'dust', bounds: { left: 0, right: window.innerWidth, top: rd.top, bottom: rd.bottom } });
          }, 60 + i * 60),
        );
      }
    });
  }
  // 도착: 흰 면 한 칸 → 어두운 무대, 새 집이 4칸 계단으로 내려앉고 이름이 뜬다(0.8초)
  const T_ARRIVE = T_GO + T_PASS + 100;
  at(T_ARRIVE, () => {
    swap();
    clearTagged('dust');
    dustTimers.forEach(clearTimeout);
    hide(label, truck, road, ground, skip);
    el.classList.add('dark');
    showStage(arrive);
    flashWhite();
    sfx.slam();
    vibrate(60);
    const r = arriveImg.getBoundingClientRect();
    const c = { x: window.innerWidth / 2, y: r.top + r.height / 2 };
    burst(c.x, c.y, { n: 16, kind: 'star', colors: ['#ffc83d', '#ffeaa0', '#ffffff', '#5b9bff'], speed: 340, size: 8 });
    confetti(c.x, c.y, 40);
    if (!quick) {
      pxFrames(arriveImg, [{ translate: '0 -64px' }, { translate: '0 -40px' }, { translate: '0 -16px' }, { translate: '0 0' }], FRAME);
      shake(document.getElementById('app')!, 8, 350);
      shake(inner, 10, 320);
    }
  });
  // 결과 화면: 옛 배율이 먼저 보이고, 0.3초 뒤 새 값으로 바뀌며 크기가 튄다
  const T_RESULT = T_ARRIVE + 900;
  at(T_RESULT, () => {
    arrive.classList.remove('on');
    hide(arrive);
    showStage(result);
    rain(30);
  });
  at(T_RESULT + 300, () => {
    multNum.textContent = `x${formatNumber(o.toMult)}`;
    sfx.reward();
    flashWhite();
    if (!quick) pxFrames(multNum, [{ scale: '1.5' }, { scale: '1.2' }, { scale: '1' }], FRAME);
    const r = mult.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, { n: 14, kind: 'star', colors: [TOKENS.g2, TOKENS.g3, TOKENS.k5], speed: 280, size: 6 });
    rain(20, [TOKENS.g2, TOKENS.k5, TOKENS.b3]);
  });
  at(T_RESULT + 5000, finish);
  el.addEventListener('pointerdown', finish);
  go.addEventListener('click', finish);
  document.addEventListener('keydown', onKey, true);
  at(T_RESULT, () => go.focus({ preventScroll: true }));
}
