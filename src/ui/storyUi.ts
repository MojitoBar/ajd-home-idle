// 이야기 창: 인트로 · 도착 쪽지 · 엔딩. 문구는 data/story.ts, 모양은 m14-story.css.
// 창은 `.overlay`(story-ov)라서 뒤의 탭·강타·Space·가이드 화살표·말풍선이 모두 막힌다.
import { ENDING, INTRO, NEXT, NOTES, NOTE_DONE, NOTE_FROM, NOTE_TAG, SKIP, type StoryPage } from '../data/story';
import { HOUSES } from '../data/houses';
import { formatNumber } from '../logic/format';
import { el } from './dom';
import * as fx from './fx';
import { houseIcon, iconImg, iconUrl } from './icons';
import { vibrate } from './prefs';
import { sfx } from './sound';

const FRAME = 83;

interface Seg {
  on: HTMLElement;
  off: HTMLElement;
  text: string;
  row?: HTMLElement;
}

interface PageView {
  root: HTMLElement;
  segs: Seg[];
  total: number;
  invoice: HTMLElement[];
}

function buildPage(p: StoryPage, mini: boolean): PageView {
  const root = el('div', { cls: 'sn-pg' });
  const segs: Seg[] = [];
  const invoice: HTMLElement[] = [];
  if (p.text) {
    const on = el('span');
    const off = el('span', { cls: 'sn-off', text: p.text });
    root.append(el('p', { cls: 'sn-p' }, on, off));
    segs.push({ on, off, text: p.text });
  }
  for (const line of p.invoice ?? []) {
    const on = el('span');
    const off = el('span', { cls: 'sn-off', text: line });
    const bar = el('span', { cls: 'sn-bar' }, ...[0, 1, 2, 3, 4, 5].map(() => el('i')));
    const row = el('div', { cls: `sn-inv pending${mini ? ' mini' : ''}` }, bar, el('span', {}, on, off));
    root.append(row);
    invoice.push(row);
    segs.push({ on, off, text: line, row });
  }
  return { root, segs, total: segs.reduce((n, s) => n + s.text.length, 0), invoice };
}

/** 앞에서부터 n글자만 보이게 한다. 안 보이는 글자는 자리만 차지해서 줄바꿈이 안 흔들린다 */
function reveal(v: PageView, n: number): void {
  let left = n;
  for (const s of v.segs) {
    const k = Math.max(0, Math.min(s.text.length, left));
    left -= k;
    s.on.textContent = s.text.slice(0, k);
    s.off.textContent = s.text.slice(k);
    s.row?.classList.toggle('pending', k === 0);
  }
}

export interface StoryRun {
  title: string;
  kicker?: string;
  pages: StoryPage[];
  doneLabel: string;
  /** 한 쪽짜리가 아니면 왼쪽 아래에 건너뛰기 */
  skippable?: boolean;
  /** 끝 줄을 작은 송장으로(쪽지) */
  miniInvoice?: boolean;
  /** 이미 떠 있는 겹창(엔딩) 안에 붙인다. 없으면 새로 만든다 */
  overlay?: HTMLElement;
  onPage?: (i: number, phase: 'start' | 'typed', win: HTMLElement) => void;
  onEnd: (skipped: boolean) => void;
}

export interface StoryHandle {
  overlay: HTMLElement;
  win: HTMLElement;
  close: () => void;
}

export function openOverlay(cls = ''): HTMLElement {
  window.dispatchEvent(new Event('modal-open'));
  const ov = el('div', { cls: `overlay story-ov${cls ? ` ${cls}` : ''}`, attrs: { role: 'dialog', 'aria-modal': 'true' } });
  document.getElementById('app')!.append(ov);
  return ov;
}

/** 쪽지 창 하나를 띄우고 문단을 차례로 찍는다. 끝나면 overlay를 지우지 않고 onEnd만 부른다(호출한 쪽이 지운다) */
export function runStory(o: StoryRun): StoryHandle {
  const ov = o.overlay ?? openOverlay();
  const views = o.pages.map((p) => buildPage(p, o.miniInvoice === true));
  const last = views.length - 1;
  const dots = views.length > 1 ? el('div', { cls: 'sn-dots' }, ...views.map(() => el('i'))) : null;
  const next = el('button', { cls: 'btn primary sn-next', attrs: { type: 'button' } });
  const skip = o.skippable !== false && views.length > 1 ? el('button', { cls: 'btn quiet sn-skip', text: SKIP, attrs: { type: 'button' } }) : null;
  const head = el('div', { cls: 'sn-head' }, el('h2', { cls: 'sn-title', text: o.title }));
  if (o.kicker) head.append(el('span', { cls: 'tag sn-kick', text: o.kicker }));
  const win = el('section', { cls: 'sn-note' }, head, el('div', { cls: 'sn-text' }, ...views.map((v) => v.root)));
  if (dots) win.append(dots);
  win.append(el('div', { cls: 'sn-actions' }, ...(skip ? [skip] : []), next));
  ov.append(win);

  let idx = -1;
  let shown = 0;
  let timer = 0;
  let typing = false;
  let ended = false;

  const stopTimer = (): void => {
    window.clearInterval(timer);
    timer = 0;
  };
  const finish = (): void => {
    const v = views[idx];
    stopTimer();
    shown = v.total;
    reveal(v, shown);
    if (typing) {
      typing = false;
      o.onPage?.(idx, 'typed', win);
    }
  };
  const show = (i: number): void => {
    idx = i;
    views.forEach((v, j) => v.root.classList.toggle('cur', j === i));
    dots?.querySelectorAll('i').forEach((d, j) => d.classList.toggle('on', j === i));
    next.textContent = i === last ? o.doneLabel : NEXT;
    shown = 0;
    reveal(views[i], 0);
    o.onPage?.(i, 'start', win);
    const v = views[i];
    typing = true;
    if (fx.isReduced() || v.total === 0) {
      finish();
      return;
    }
    // 문단 하나는 0.5초 안쪽: 최대 30틱, 틱마다 몇 글자씩
    const ticks = Math.min(v.total, 30);
    const step = Math.ceil(v.total / ticks);
    const iv = Math.max(16, Math.round(500 / ticks));
    timer = window.setInterval(() => {
      shown = Math.min(v.total, shown + step);
      reveal(v, shown);
      if (shown >= v.total) finish();
    }, iv);
  };
  const close = (skipped: boolean): void => {
    if (ended) return;
    ended = true;
    stopTimer();
    window.removeEventListener('keydown', onKey, true);
    ov.removeEventListener('modal-close', onEsc);
    win.remove();
    o.onEnd(skipped);
  };
  const advance = (): void => {
    if (ended) return;
    if (typing) finish();
    else if (idx < last) show(idx + 1);
    else close(false);
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key !== ' ' && e.key !== 'Enter') return;
    const t = e.target instanceof Element ? e.target : null;
    if (t && win.contains(t) && t.closest('button')) return; // 버튼은 브라우저가 누른다
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat) return;
    advance();
  };
  const onEsc = (): void => {
    if (skip) close(true);
  };
  window.addEventListener('keydown', onKey, true);
  ov.addEventListener('modal-close', onEsc);
  next.addEventListener('click', advance);
  skip?.addEventListener('click', () => close(true));
  ov.addEventListener('click', (e) => {
    if ((e.target as Element).closest('button')) return;
    if (typing) finish();
    else if (idx < last) show(idx + 1);
  });
  show(0);
  if (matchMedia('(min-width: 900px)').matches) next.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
  return { overlay: ov, win, close: () => close(true) };
}

/** 인트로(새 게임). 닫히면 onDone */
export function playIntro(onDone: () => void): void {
  const h = runStory({
    title: INTRO.title,
    pages: INTRO.pages,
    doneLabel: INTRO.done,
    onEnd: () => {
      h.overlay.remove();
      onDone();
    },
  });
}

/** 도착 쪽지(집 번호 1~8). 닫히면 onDone */
export function playNote(stage: number, houseName: string, onDone: () => void): void {
  const h = runStory({
    title: houseName,
    kicker: NOTE_TAG,
    pages: [{ text: NOTES[stage], invoice: [NOTE_FROM] }],
    doneLabel: NOTE_DONE,
    miniInvoice: true,
    onEnd: () => {
      h.overlay.remove();
      onDone();
    },
  });
  sfx.ready();
}

export interface EndingStats {
  moves: number;
  bestChain: number;
  totalEarned: number;
}

/** 엔딩: 시선 연출 → 문단 4개(송장 뒤 상자가 날아감) → 끝 화면(폭죽). replay면 마지막 버튼이 `닫기` */
export function playEnding(stats: EndingStats, replay: boolean, onDone: () => void): void {
  const quick = fx.isReduced();
  const ov = openOverlay('ending');
  fx.hostParticles(ov);
  const timers: number[] = [];
  const at = (ms: number, f: () => void): void => {
    timers.push(window.setTimeout(f, quick ? ms * 0.3 : ms));
  };
  const band = (c: string): HTMLElement => el('div', { cls: `sn-band ${c}` });
  const top = band('top');
  const bot = band('bot');
  const white = el('div', { cls: 'sn-white' });
  const box = iconImg('box/normal-1', { size: 160, alt: '', cls: 'sn-box' });
  ov.append(top, bot, box, white);
  const flashWhite = (n = 1): void => {
    if (quick) return;
    fx.pxFrames(white, Array.from({ length: n * 2 }, (_, i) => ({ visibility: i % 2 === 0 ? 'visible' : 'hidden' })), FRAME);
  };
  const H = (): number => ov.clientHeight;

  // 0. 시선: 어두운 띠가 위아래에서 닫히고(4칸), 방 가운데 상자가 번쩍
  if (!quick) {
    fx.pxFrames(top, [0.06, 0.12, 0.18, 0.22].map((r) => ({ height: `${Math.round(H() * r)}px` })), FRAME, { fill: 'forwards' });
    fx.pxFrames(bot, [0.15, 0.3, 0.45, 0.52].map((r) => ({ height: `${Math.round(H() * r)}px` })), FRAME, { fill: 'forwards' });
  }
  let finished = false;
  let handle: StoryHandle | null = null;

  const toEnd = (): void => {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    handle?.win.remove();
    showEnd(ov, stats, replay, quick, onDone);
  };

  at(500, () => {
    flashWhite(1);
    sfx.slam();
    vibrate(40);
    const r = box.getBoundingClientRect();
    fx.burst(r.left + r.width / 2, r.top + r.height / 2, { n: 12, kind: 'star', colors: ['g2', 'g3', 'k5'], speed: 300, size: 8 });
    fx.shake(box, 8, 320);
  });
  at(1100, () => {
    if (finished) return;
    handle = runStory({
      title: ENDING.title,
      pages: ENDING.pages,
      doneLabel: ENDING.next,
      overlay: ov,
      onPage: (i, phase, win) => {
        if (i === 2 && phase === 'typed') {
          // 송장이 찍힌다 → 상자가 화면 위로 날아간다
          sfx.stamp();
          vibrate(30);
          win.querySelectorAll('.sn-inv').forEach((r) => r.classList.add('stamp'));
          fx.shake(win, 4, 200);
          at(450, () => flyBox(box));
        }
      },
      onEnd: toEnd,
    });
  });
}

/** 상자가 4프레임 가속하며 화면 위로 날아가 사라진다 */
function flyBox(box: HTMLElement): void {
  if (!box.isConnected) return;
  const r = box.getBoundingClientRect();
  sfx.reward();
  fx.burst(r.left + r.width / 2, r.bottom, { n: 12, kind: 'dot', colors: ['k5', 'g3', 'b4'], speed: 160, gravity: 200, size: 6, up: false });
  if (fx.isReduced()) {
    box.style.visibility = 'hidden';
    return;
  }
  const d = r.bottom + 40;
  const y = [0.04, 0.14, 0.32, 0.6, 1].map((k) => ({ translate: `0 ${-Math.round((d * k) / 4) * 4}px` }));
  fx.pxFrames(box, y, FRAME, { fill: 'forwards' }).onfinish = () => {
    box.style.visibility = 'hidden';
    fx.burst(r.left + r.width / 2, 12, { n: 12, kind: 'star', colors: ['g2', 'g3', 'k5'], speed: 280, size: 8, up: false });
  };
}

/** 끝 화면: 큰 `끝`, 집 9개가 차례로 켜짐, 기록 3줄, 폭죽 5발 */
function showEnd(ov: HTMLElement, stats: EndingStats, replay: boolean, quick: boolean, onDone: () => void): void {
  ov.querySelectorAll('.sn-band, .sn-box, .sn-note, .sn-white').forEach((n) => n.remove());
  ov.classList.remove('ending');
  ov.classList.add('end');
  const white = el('div', { cls: 'sn-white' });
  const fin = el('div', { cls: 'sn-fin', text: ENDING.end });
  const slots = HOUSES.map((h) => {
    const s = el('div', { cls: 'sn-h' }, iconImg(houseIcon(h.theme), { size: 48, alt: '' }));
    s.style.setProperty('--ic', `url(${iconUrl(houseIcon(h.theme))})`);
    return s;
  });
  const houses = el('div', { cls: 'sn-houses' }, ...slots);
  const rows = [
    ['이사 횟수', `${stats.moves}번`],
    ['최고 연쇄', formatNumber(stats.bestChain)],
    ['누적 수익', `${formatNumber(stats.totalEarned)} P`],
  ].map(([k, v]) => el('div', {}, el('span', { text: k }), el('b', { text: v })));
  const rec = el('div', { cls: 'sn-rec' }, ...rows);
  const go = el('button', { cls: 'btn primary sn-go', text: replay ? ENDING.closeReplay : ENDING.keepGoing, attrs: { type: 'button' } });
  const wrap = el('div', { cls: 'sn-end' }, fin, houses, rec, el('div', { cls: 'sn-credit', text: ENDING.credit }), go);
  ov.append(wrap, white);

  const timers: number[] = [];
  const at = (ms: number, f: () => void): void => {
    timers.push(window.setTimeout(f, quick ? 0 : ms));
  };
  let closed = false;
  const bye = (): void => {
    if (closed) return;
    closed = true;
    timers.forEach(clearTimeout);
    window.removeEventListener('keydown', onKey, true);
    ov.remove();
    onDone();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === ' ' || e.key === 'Enter') {
      const t = e.target instanceof Element ? e.target : null;
      if (t === go) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (go.classList.contains('on') && !e.repeat) bye();
    }
  };
  window.addEventListener('keydown', onKey, true);
  go.addEventListener('click', bye);

  // 폭죽은 화면 크기에 비례한 자리에 5발: 가운데 → 왼쪽 → 오른쪽 → 아래 왼쪽 → 아래 오른쪽
  const spots: Array<[number, number, string[]]> = [
    [0.5, 0.22, ['g2', 'g3', 'k5']],
    [0.18, 0.3, ['or', 'g2', 'k5']],
    [0.82, 0.3, ['b3', 'b4', 'k5']],
    [0.3, 0.58, ['pk', 'g3', 'k5']],
    [0.7, 0.52, ['g2', 'or', 'g3']],
  ];
  const shot = (i: number): void => {
    const [fx0, fy0, colors] = spots[i];
    const x = Math.round(ov.clientWidth * fx0);
    const y = Math.round(ov.clientHeight * fy0);
    fx.ring(x, y, [16, 40, 72, 112, 160, 208], colors, 0.06);
    fx.burst(x, y, { n: 16, kind: 'star', colors, speed: 460, gravity: 380, size: 10, ring: true, life: 0.9 });
    fx.burst(x, y, { n: 16, kind: 'star', colors, speed: 280, gravity: 420, size: 8, ring: true, life: 0.8 });
    fx.burst(x, y, { n: 12, kind: 'dot', colors, speed: 360, gravity: 520, size: 6, up: false, life: 0.9 });
    fx.debris(x, y, { n: 22, colors, size: 8, speed: 480, gravity: 650, life: 1, up: false, cap: 240 });
    fx.twinkle(x, y, 'k5', 12, 0.3);
    if (i % 2 === 0) sfx.milestone();
    else sfx.breakthrough();
  };
  const flash = (): void => {
    if (quick) return;
    fx.pxFrames(white, [{ visibility: 'visible' }, { visibility: 'hidden' }], FRAME);
  };

  fx.shake(wrap, 8, 350);
  flash();
  sfx.slam();
  vibrate([40, 30, 60]);
  if (!quick) fx.pxFrames(fin, [{ scale: '2.5' }, { scale: '1.75' }, { scale: '1.25' }, { scale: '1' }], FRAME);
  // 첫 일제 사격(3발)과 두 번째 일제(2발)
  shot(0);
  shot(1);
  shot(2);
  at(120, () => sfx.reward());
  at(420, () => {
    shot(3);
    fx.edge(ov, 'g2', [1, 1, 1]);
  });
  at(760, () => {
    shot(4);
    fx.rain(36, ['g2', 'g3', 'k5', 'or', 'b3']);
    fx.confetti(ov.clientWidth / 2, ov.clientHeight * 0.7, 40, { colors: ['g2', 'g3', 'k5', 'or'] });
  });
  // 집 아이콘이 원룸부터 한 칸씩 켜지고, 기록이 한 줄씩 나오고, 마지막에 버튼
  slots.forEach((s, i) =>
    at(500 + i * 130, () => {
      s.classList.add('lit');
      fx.thump(s);
      const r = s.getBoundingClientRect();
      fx.twinkle(r.left + r.width / 2, r.top + 4, 'g3', 8, 0.3);
    }),
  );
  rows.forEach((r, i) => at(1700 + i * 200, () => { r.classList.add('on'); sfx.coin(); }));
  at(2400, () => go.classList.add('on'));
  if (quick) {
    slots.forEach((s) => s.classList.add('lit'));
    rows.forEach((r) => r.classList.add('on'));
    go.classList.add('on');
  }
  if (matchMedia('(min-width: 900px)').matches) at(2400, () => go.focus({ preventScroll: true, focusVisible: false } as FocusOptions));
}

export const introTitle = INTRO.title;
export const endingTitle = ENDING.title;
