// 상자 탭 + 상자 열기 연출. 로직(gacha.ts)은 호출만 한다.
import { BOX_PRICE_GROWTH, boxPrice, collectionProgress, openBox, openBoxes, oddsTable, type BoxResult } from '../logic/gacha';
import { formatNumber } from '../logic/format';
import { collectionMultOf, completedSetCount, setProgress } from '../logic/collection';
import { SETS, VARIANTS, type Rarity } from '../data/collectibles';
import { artUrl } from './px/art';
import { el, setDisabled, setText, toggleClass } from './dom';
import { iconImg } from './icons';
import * as fx from './fx';
import { sfx } from './sound';
import { vibrate } from './prefs';
import { collectibleImg, levelDots, preloadCollectible, markFresh, variantChip, variantMark, PAL, RARITY_COLOR, RARITY_HEX, rarityName, rarityTier, variantName, type UiCtx } from './collectUi';

const rng = (): number => Math.random();
let ctx: UiCtx;
let busy = false;

const refs = {
  price: el('div', { cls: 'box-price' }),
  oneCost: el('span', { cls: 'bx-cost' }),
  tenCost: el('span', { cls: 'bx-cost' }),
  one: el('button', { cls: 'btn primary gold box-open' }),
  ten: el('button', { cls: 'btn box-ten' }),
  hint: el('div', { cls: 'note dim box-hint' }),
  perk: el('div', { cls: 'box-perk' }),
  oddsToggle: el('button', { cls: 'btn sm odds-toggle', text: '확률 보기' }),
  summary: el('div', { cls: 'pf box-dexsum' }),
};

/** 40도트 사은품 상자 그림을 정수 배율로 */
function gift(open: boolean, size: number): HTMLImageElement {
  const im = new Image();
  im.className = 'ico gift-img';
  im.width = size;
  im.height = size;
  im.alt = '';
  im.draggable = false;
  im.src = artUrl(open ? 'ui/gift-open' : 'ui/gift-closed');
  return im;
}
export const panel = el('div', { cls: 'panel-inner box-panel' });

const pct = (v: number): string => `${+(v * 100).toFixed(2)}%`;

function tenCost(): number {
  const s = ctx.get();
  let sum = 0;
  const base = boxPrice(s);
  for (let i = 0; i < 10; i++) sum += base * BOX_PRICE_GROWTH ** i;
  return sum;
}

export function initBox(c: UiCtx): void {
  ctx = c;
  refs.one.append(el('span', { text: '상자 열기' }), refs.oneCost);
  refs.ten.append(el('span', { text: '10개 열기' }), refs.tenCost);
  refs.one.type = 'button';
  refs.ten.type = 'button';
  refs.oddsToggle.type = 'button';
  refs.one.addEventListener('click', () => openOne());
  refs.ten.addEventListener('click', () => openTen());
  refs.oddsToggle.addEventListener('click', () => {
    const odds = oddsTable();
    const rsum = odds.rarities.reduce((a, r) => a + r.prob, 0);
    const vsum = odds.variants.reduce((a, v) => a + v.prob, 0);
    const row = (name: string, percent: string, cls = '', color?: string, mark?: HTMLElement | null): HTMLElement => {
      const label = el('span', { cls: 'odds-name' }, name);
      if (mark) label.prepend(mark);
      const r = el('div', { cls: `pf odds-row ${cls}`.trim() }, label, el('span', { cls: 'odds-pct', text: percent }));
      if (color) r.style.setProperty('--rc', color);
      return r;
    };
    ctx.showModal(
      '상자 확률',
      [
        el('div', { cls: 'odds-title', text: '등급' }),
        ...odds.rarities.map((r) => row(r.name, r.percent, 'rar', RARITY_COLOR[r.id])),
        row('합계', pct(rsum), 'sum'),
        el('div', { cls: 'odds-title', text: '변종' }),
        ...odds.variants.map((v) => row(v.name, v.percent, 'var', undefined, variantMark(v.id) ?? el('i', { cls: 'vmark vm-base', attrs: { 'aria-hidden': 'true' } }))),
        row('합계', pct(vsum), 'sum'),
        el('p', { cls: 'odds-note', text: '등급과 따로 뽑아요.' }),
        el('p', { cls: 'odds-note', text: '등급이 정해지면 그 안의 종은 같은 확률로 나와요.' }),
        el('p', { cls: 'odds-note', text: '10개 열기에서는 레어 이상이 1개 꼭 나와요.' }),
      ],
      [{ label: '닫기', onClick: () => ctx.dismissModal() }],
      { icon: iconImg('box-closed', { size: 32, cls: 'title-ico' }) },
    );
  });
  panel.append(
    el(
      'div',
      { cls: 'pf box-hero' },
      el('div', { cls: 'box-art' }, gift(false, 80)),
      el('div', { cls: 'box-title', text: '사은품 상자' }),
      refs.price,
      refs.perk,
      el('div', { cls: 'row box-btns' }, refs.one, refs.ten),
      refs.hint,
    ),
    refs.summary,
    el('div', { cls: 'pf box-dexsum box-oddsum' }, el('div', { cls: 'dexsum-main' }, el('b', { text: '뽑기 확률' }), el('span', { cls: 'dexsum-mult', text: '등급·변종 확률 공개' })), refs.oddsToggle),
    el('p', { cls: 'note dim box-fine' }, el('span', { text: '사은품은 포인트로만 살 수 있어요.' }), el('span', { text: '모든 사은품과 확률은 게임 속 허구예요.' })),
  );
}

export function canBuyBox(): boolean {
  const s = ctx.get();
  return boxPrice(s) <= s.points;
}

export function updateBox(): void {
  const s = ctx.get();
  const price = boxPrice(s);
  const can1 = price <= s.points;
  const cost10 = tenCost();
  const can10 = cost10 <= s.points;
  setText(refs.price, `가격 ${formatNumber(price)} P`);
  setText(refs.oneCost, `${formatNumber(price)} P`);
  setText(refs.tenCost, `${formatNumber(cost10)} P`);
  setDisabled(refs.one, !can1 || busy);
  setDisabled(refs.ten, !can10 || busy);
  toggleClass(refs.one, 'ready', can1 && !busy);
  setText(refs.hint, can1 ? '누르면 열기 연출을 건너뛸 수 있어요' : `포인트가 ${formatNumber(price - s.points)} P 모자라요`);
  const done = completedSetCount(s.collection);
  const sp = setProgress(s.collection);
  const sk = sp.map((x) => x.have).join(',');
  if (refs.perk.dataset.k !== sk) {
    refs.perk.dataset.k = sk;
    const go = el('button', { cls: 'btn sm', text: '세트 보기', attrs: { type: 'button' } });
    go.addEventListener('click', () => {
      ctx.goto('dex');
      window.setTimeout(() => {
        const t = document.querySelector<HTMLElement>('#dex-sets .dex-sets-toggle');
        if (t?.getAttribute('aria-expanded') === 'false') t.click();
        document.getElementById('dex-sets')?.scrollIntoView({ block: 'start' });
      }, 60);
    });
    refs.perk.replaceChildren(el('span', { text: `세트 ${done}/${SETS.length} 완성` }), go);
  }
  const prog = collectionProgress(s);
  const key = `${prog.registered}|${prog.mult}`;
  if (refs.summary.dataset.k !== key) {
    refs.summary.dataset.k = key;
    refs.summary.replaceChildren(
      el('div', { cls: 'dexsum-main' }, el('b', { text: `도감 ${prog.registered}/${prog.total}` }), el('span', { cls: 'dexsum-mult', text: `도감 배율 x${formatNumber(prog.mult)}` })),
      el('button', { cls: 'btn sm', text: '도감 보기', attrs: { type: 'button' } }),
    );
    refs.summary.querySelector('button')!.addEventListener('click', () => ctx.goto('dex'));
  }
}

// ---------- 열기 ----------
function openOne(): void {
  if (busy) return;
  const out = openBox(ctx.get(), rng);
  if (!out) return;
  ctx.set(out.state);
  ctx.save();
  markFresh(out.result);
  ctx.update();
  busy = true;
  playSingle(out.result);
}

/** 택배 상자 사은품: 이미 반영된 결과를 열기 연출로 보여 준다. */
/** 무료 사은품 결과. 이미 다른 상자 장면이 떠 있으면 false. title은 결과 위 한 줄, onClose는 장면이 닫힐 때 */
export function playFree(result: BoxResult, o: { title?: string; onClose?: () => void } = {}): boolean {
  if (busy) return false;
  busy = true;
  markFresh(result);
  ctx.update();
  playSingle(result, o);
  return true;
}

function openTen(): void {
  if (busy) return;
  const out = openBoxes(ctx.get(), rng, 10);
  if (!out.results.length) return;
  ctx.set(out.state);
  ctx.save();
  out.results.forEach(markFresh);
  ctx.update();
  busy = true;
  playTen(out.results);
}

interface Scene {
  root: HTMLElement;
  timers: number[];
  closed: boolean;
  after(ms: number, fn: () => void): void;
  close(): void;
}

function makeScene(): Scene {
  const root = el('div', { cls: 'box-scene', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': '상자 열기' } });
  document.body.append(root);
  fx.hostParticles(root);
  if (!document.body.classList.contains('reduce-motion') && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const wipe = el('i', { cls: 'bs-wipe' });
    root.append(wipe);
    fx.pxFrames(wipe, [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 0 34%)' }, { clipPath: 'inset(0 0 0 67%)' }], 50).onfinish = () => wipe.remove();
  }
  const sc: Scene = {
    root,
    timers: [],
    closed: false,
    after(ms, fn) {
      this.timers.push(window.setTimeout(() => !this.closed && fn(), ms));
    },
    close() {
      if (this.closed) return;
      this.closed = true;
      this.timers.forEach(clearTimeout);
      root.remove();
      busy = false;
      ctx.update();
    },
  };
  return sc;
}

const center = (e: Element): { x: number; y: number } => {
  const r = e.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

/** 등급별 충전(흔들림) 길이와 흔들림 횟수. 낮은 등급은 짧게, 최고 등급은 길게. */
const CHARGE_MS = [550, 800, 1100, 1550, 1950];
const CHARGE_STEPS = [3, 4, 5, 6, 7];
const SHAKE_PX = [2, 4, 6, 8, 10];
const COLORS: Record<Rarity, string[]> = {
  common: [PAL.k5, PAL.k3, PAL.k4],
  rare: [PAL.k5, PAL.b3, PAL.b4],
  epic: [PAL.k5, PAL.pu, PAL.b4, PAL.g2],
  legend: [PAL.k5, PAL.g2, PAL.g3, PAL.r2],
  myth: [PAL.pk, PAL.g2, PAL.gn, PAL.b3, PAL.pu, PAL.k5],
};
const RAINBOW = [PAL.r2, PAL.or, PAL.g2, PAL.gn, PAL.b3, PAL.pu];
/** 한 번에 떠 있는 입자가 80개 안쪽이 되도록 등급별로 정한 개수(터짐 한 번 기준) */
const DOTS = [10, 14, 18, 22, 24];
const CONFETTI = [0, 0, 14, 26, 36];

/** 결과 화면 아래 버튼 줄: 입자는 이 줄 위로 그리지 않고, 떨어져 닿으면 사라진다. */
function footLimit(): { avoid?: DOMRect; floor?: number } {
  const e = document.querySelector('.sum-foot, .bs-actions');
  if (!e) return {};
  const r = e.getBoundingClientRect();
  const gain = document.querySelector('.sum-gain');
  if (!gain) return { avoid: r, floor: r.top };
  const top = gain.getBoundingClientRect().top;
  return { avoid: new DOMRect(r.left, top, r.width, r.bottom - top), floor: top };
}

function burstFor(rarity: Rarity, at: { x: number; y: number }, scale = 1, life?: number, big = false): void {
  const t = rarityTier(rarity);
  const lim = footLimit();
  const k = big ? 2 : 1;
  for (let i = 0; i < k + (big ? 1 : 0); i++) fx.burst(at.x, at.y, { n: Math.round(DOTS[t] * scale), colors: COLORS[rarity], kind: t >= 1 ? 'star' : 'dot', speed: 220 + t * 70, size: (4 + t) * k, life, ...lim });
  if (CONFETTI[t]) fx.confetti(at.x, at.y, Math.round(CONFETTI[t] * scale), { life, scale: k, ...lim });
}

/** 장면 안 단색 섬광: 켜짐/꺼짐만 있고 투명도는 쓰지 않는다. */
function whiteFlash(white: HTMLElement, ms: number): void {
  white.classList.add('on');
  window.setTimeout(() => white.classList.remove('on'), ms);
}

/** 화면 전체 단색 번쩍: 색마다 켜짐 1프레임 + 꺼짐 1프레임(12fps). 투명도 없이 켜짐/꺼짐만. */
function fullFlash(host: HTMLElement, colors: string[]): void {
  const f = el('i', { cls: 'bs-flash' });
  host.append(f);
  const frames: Keyframe[] = colors.flatMap((c) => [{ background: c, visibility: 'visible' }, { background: c, visibility: 'hidden' }]);
  fx.pxFrames(f, frames, 83).onfinish = () => f.remove();
}

/** 단색 사각 입자(2px 격자)가 중심에서 바깥으로 steps()로 퍼진다. */
function pixBurst(host: HTMLElement, colors: string[], n: number, radius: number, ms: number, size = 6): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = radius * (i % 2 ? 0.7 : 1);
    const dx = Math.round((Math.cos(a) * r) / 2) * 2;
    const dy = Math.round((Math.sin(a) * r) / 2) * 2;
    const q = el('i', { cls: 'bs-px' });
    q.style.background = colors[i % colors.length];
    q.style.width = q.style.height = `${size}px`;
    host.append(q);
    q.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${dx}px,${dy}px)` }], { duration: ms, easing: 'steps(5, end)', fill: 'forwards' }).onfinish = () => q.remove();
  }
}

function newMultOf(item: BoxResult[]): { before: number; after: number } {
  const col = ctx.get().collection;
  const prev: typeof col = {};
  for (const [k, v] of Object.entries(col)) prev[k] = { ...v };
  for (const r of item) {
    const slot = prev[r.item.id];
    if (slot) slot[r.variant] = Math.max(0, slot[r.variant] - 1);
  }
  return { before: collectionMultOf(prev), after: collectionMultOf(col) };
}
/** 변화가 0.01보다 작으면 양쪽 다 3자리, 아니면 2자리 */
function multFmt(before: number, after: number): (v: number) => string {
  const digits = Math.abs(after - before) < 0.01 ? 3 : 2;
  return (v) => (v < 1000 ? `x${+v.toFixed(digits)}` : `x${formatNumber(v)}`);
}
function multPair(before: number, after: number): [string, string] {
  const f = multFmt(before, after);
  return [f(before), f(after)];
}

/** 반짝이는 도트 사각 10개를 수집품 둘레에 띄운다. 무지개·신화는 색이 돈다. */
function twinkles(rainbow: boolean, color: string, gold: boolean): HTMLElement {
  const host = el('div', { cls: 'bs-rays' });
  const spots = [[-88, -52], [92, -60], [-96, 28], [96, 40], [-82, -6], [86, 0], [-72, 64], [74, 70]];
  spots.forEach(([x, y], i) => {
    const q = el('i');
    q.style.left = `calc(50% + ${x}px)`;
    q.style.top = `calc(50% + ${y}px)`;
    q.style.background = rainbow ? RAINBOW[i % 6] : gold ? PAL.g3 : i % 2 ? PAL.k5 : color;
    q.style.animationDelay = `${(i % 5) * 0.16}s`;
    host.append(q);
  });
  return host;
}

function playSingle(res: BoxResult, from: { title?: string; onClose?: () => void } = {}): void {
  const sc = makeScene();
  if (from.onClose) {
    const close = sc.close;
    sc.close = function (this: Scene) {
      const was = this.closed;
      close.call(this);
      if (!was) from.onClose?.();
    };
  }
  const quick = fx.isReduced();
  const rarity = res.item.rarity;
  const tier = rarityTier(rarity);
  const color = RARITY_COLOR[rarity];
  const rainbowish = rarity === 'myth' || res.variant === 'rainbow';
  preloadCollectible(res.item, res.variant);
  const white = el('div', { cls: 'bs-white' });
  const seam = el('i', { cls: 'bs-seam' });
  const box = el('div', { cls: 'bs-box' }, gift(false, 160), seam);
  const stage = el('div', { cls: 'bs-stage' }, box);
  stage.style.setProperty('--glow', color);
  const skip = el('div', { cls: 'bs-skip', text: '누르면 건너뛰어요' });
  sc.root.append(stage, skip, white);
  let phase: 'charge' | 'burst' | 'reveal' = 'charge';
  let armed = false;
  const total = quick ? 350 : CHARGE_MS[tier];
  const steps = quick ? 1 : CHARGE_STEPS[tier];
  const mult = newMultOf([res]);
  const changed = mult.after > mult.before + 1e-9;
  const [mBefore] = multPair(mult.before, mult.after);
  const leveled = !res.isNew && res.level > res.prevLevel;

  // 기대: 흔들림이 점점 세지고 틈새 빛이 커진다. 등급이 높을수록 길고, 빛 색이 등급 색이다.
  for (let i = 0; i < steps; i++) {
    sc.after((total * i) / steps + 100, () => {
      const k = (i + 1) / steps;
      box.style.setProperty('--amp', `${Math.round((2 + k * (2 + tier * 2)) / 2) * 2}px`);
      box.style.setProperty('--dur', `${Math.max(0.12, 0.3 - k * 0.18).toFixed(2)}s`);
      seam.style.setProperty('--sw', `${Math.round((12 + k * 52) / 2) * 2}px`);
      if (i >= 1) seam.classList.add('on');
      if (!quick) box.classList.add('shaking');
      sfx.boxShake(Math.min(4, Math.floor(k * 4)));
      vibrate(8 + i * 3);
      if (tier >= 4 && i >= 2) stage.style.setProperty('--glow', RAINBOW[i % 6]);
      if (i >= 1 && !quick) pixBurst(stage, tier >= 1 ? [RARITY_HEX[rarity], PAL.k5] : [PAL.k5], 3 + i, 90, 420, 4);
    });
  }
  sc.after(total, () => doBurst());
  sc.root.addEventListener('pointerdown', () => {
    if (phase === 'charge') {
      sc.timers.forEach(clearTimeout);
      doBurst();
    }
  });

  // 터짐: 상자가 열린 그림으로 바뀌고 섬광 + 등급 색 사각 입자 + 화면 흔들림
  function doBurst(): void {
    if (phase !== 'charge') return;
    phase = 'burst';
    const at = center(box);
    box.classList.remove('shaking');
    box.classList.add('opened');
    box.replaceChildren(gift(true, 160));
    stage.style.setProperty('--glow', color);
    if (!quick) pixBurst(stage, tier >= 1 ? [RARITY_HEX[rarity], PAL.k5] : [PAL.k5, PAL.k4], 16 + tier * 2, 150 + tier * 30, 560, 8);
    whiteFlash(white, tier >= 2 ? 160 : 100);
    sfx.boxBurst(tier);
    vibrate(tier >= 3 ? [30, 40, 60] : tier >= 2 ? [20, 30] : 15);
    burstFor(rarity, at);
    fx.shake(sc.root, SHAKE_PX[tier], 280 + tier * 80);
    if (tier >= 3 && !quick) fullFlash(sc.root, tier >= 4 ? [PAL.k5, PAL.g3] : [PAL.k5]);
    if (tier >= 4) {
      sc.after(420, () => {
        fx.burst(at.x, at.y, { n: 8, kind: 'star', colors: COLORS.myth, speed: 340, size: 6 });
        fx.shake(sc.root, 8, 300);
      });
    }
    sc.after(tier >= 4 && !quick ? 440 : tier >= 2 ? 360 : 280, () => reveal());
  }

  // 공개: 열린 상자에서 수집품이 튀어나와 등급 색 틀에 놓이고, 등급 칩이 붙고, 숫자가 올라간다.
  function reveal(): void {
    phase = 'reveal';
    box.remove();
    stage.classList.add('done');
    const card = el('div', { cls: `pf bs-card r-${rarity}` });
    card.style.setProperty('--rc', color);
    const gain = el('div', { cls: 'bs-gain' });
    const num = el('b', { text: mBefore });
    if (changed) gain.append('도감 배율 ', mBefore, ' → ', num);
    const rc = el('span', { cls: 'col-chip cc-rar', text: `${rarityName(rarity)} 등급` });
    rc.style.setProperty('--rc', color);
    const chips = el('div', { cls: 'bs-chips' }, rc);
    if (res.isNew) chips.append(el('span', { cls: 'col-chip cc-new', text: '새로 얻음' }));
    else if (leveled) chips.append(el('span', { cls: 'col-chip cc-lv', text: `Lv ${res.level} 달성` }));
    const frame = el('div', { cls: `pf bs-frame cv-${res.variant}` }, collectibleImg(res.item, res.variant, 'big'));
    frame.style.setProperty('--rc', color);
    if (from.title) card.append(el('div', { cls: 'bs-from', text: from.title }));
    card.append(chips, frame, el('div', { cls: 'bs-name', text: res.item.name }));
    const vc = variantChip(res.variant);
    if (vc) card.append(el('div', { cls: 'bs-variant' }, variantMark(res.variant), vc));
    if (changed) card.append(gain);
    if (!res.isNew) {
      const maxed = res.nextNeed === 0;
      const left = maxed ? '' : `다음 레벨까지 ${res.nextNeed}개`;
      card.append(
        el('div', { cls: 'bs-lvtext' }, maxed ? el('b', { text: `Lv ${res.level} MAX` }) : el('span', { cls: 'col-chip cc-lv1', text: `Lv ${res.level}` }), el('span', { text: maxed ? `보유 ${res.count}개` : left })),
        el('div', { cls: 'bs-lvbar' }, levelDots(res.count)),
      );
    }
    for (const r of res.completedSets) {
      const def = SETS.find((x) => x.rarity === r)!;
      card.append(el('div', { cls: 'col-chip cc-set', text: `${def.name.replace(' 세트', '')} 세트 완성 · ${def.desc}` }));
    }
    if (rainbowish || res.variant === 'gold' || tier >= 1) frame.append(twinkles(rainbowish, RARITY_HEX[rarity], res.variant === 'gold'));
    stage.append(card);
    if (tier >= 3 && !quick) {
      const late = [chips, gain, ...card.querySelectorAll<HTMLElement>('.bs-lvtext, .cc-set')].filter((e) => e.isConnected);
      late.forEach((e) => (e.style.visibility = 'hidden'));
      sc.after(500, () => late.forEach((e) => (e.style.visibility = '')));
    }

    const again = el('button', { cls: 'btn primary gold', text: '확인', attrs: { type: 'button' } });
    again.addEventListener('click', (e) => {
      e.stopPropagation();
      sc.close();
    });
    const more = el('button', { cls: 'btn', text: '또 열기', attrs: { type: 'button' } });
    const s = ctx.get();
    more.disabled = boxPrice(s) > s.points;
    more.addEventListener('click', (e) => {
      e.stopPropagation();
      sc.close();
      openOne();
    });
    const actions = el('div', { cls: 'bs-actions lock' }, more, again);
    skip.remove();
    stage.append(actions);
    sc.after(400, () => {
      armed = true;
      actions.classList.remove('lock');
    });
    sc.root.addEventListener('click', (e) => {
      if (!armed || (e.target as Element).closest('.bs-actions')) return;
      sc.close();
    });

    sc.after(250, () => {
      if (tier >= 2) {
        sfx.stamp();
        fx.shake(card, 3 + tier, 240);
      }
    });
    if (changed) sc.after(350, () => fx.countUp(num, mult.after, 700, multFmt(mult.before, mult.after), mult.before));
    if (res.isNew) sc.after(550, () => sfx.newItem());
    else if (leveled || res.completedSets.length) sc.after(450, () => sfx.newItem());
    sc.after(300, () => variantFx(res.variant, center(card), tier));
    if (tier >= 3 && !quick) fx.burst(center(card).x, center(card).y, { n: tier >= 4 ? 28 : 18, kind: 'dot', colors: [RARITY_HEX[rarity], PAL.k5, PAL.g3], speed: 320, size: 6, ...footLimit() });
    if (tier >= 4 && !quick) {
      card.classList.add('myth-edge');
      sc.after(300, () => fx.pxFrames(rc, [{ transform: 'translateY(-12px)' }, { transform: 'translateY(-16px)' }, { transform: 'translateY(-6px)' }, { transform: 'translateY(0)' }], 83));
    }
  }
}

function variantFx(v: string, at: { x: number; y: number }, tier: number): void {
  const lim = footLimit();
  if (v === 'shiny') {
    fx.burst(at.x, at.y, { n: 16, kind: 'star', colors: [PAL.k5, PAL.b4, PAL.g3], speed: 200, gravity: 100, size: 5, ...lim });
  } else if (v === 'gold') {
    fx.burst(at.x, at.y, { n: 20, kind: 'coin', colors: [PAL.g2, PAL.g3], speed: 300, size: 6, ...lim });
    fx.burst(at.x, at.y, { n: 14, kind: 'star', colors: [PAL.g3, PAL.k5], speed: 180, gravity: 60, size: 5, ...lim });
  } else if (v === 'rainbow') {
    fx.burst(at.x, at.y, { n: 24, kind: 'star', colors: RAINBOW, speed: 320, size: 6, ...lim });
    if (tier < 2) fx.confetti(at.x, at.y, 36, lim);
  }
}

function playTen(results: BoxResult[]): void {
  results.forEach((r) => preloadCollectible(r.item, r.variant));
  const sc = makeScene();
  sc.root.classList.add('ten');
  const quick = fx.isReduced();
  const best = results.reduce((a, b) => (rarityScore(b) > rarityScore(a) ? b : a), results[0]);
  const bt = rarityTier(best.item.rarity);
  const newCount = results.filter((r) => r.isNew).length;
  const lvCount = results.filter((r) => !r.isNew && r.level > r.prevLevel).length;
  const mult = newMultOf(results);

  const cells = results.map((r) => {
    const chip = r.isNew
      ? el('span', { cls: 'col-chip cc-new', text: '신규', attrs: { 'aria-label': '새로 얻음' } })
      : r.level > r.prevLevel
        ? el('span', { cls: 'col-chip cc-lv', text: `Lv ${r.level}` })
        : el('span', { cls: 'col-chip cc-own', text: '+1' });
    const cell = el(
      'div',
      { cls: `pf sum-cell fc r-${r.item.rarity} cv-${r.variant}`, attrs: { 'aria-label': `${r.item.name} ${rarityName(r.item.rarity)}${r.variant !== 'base' ? ` ${variantName(r.variant)}` : ''}` } },
      el('div', { cls: 'fc-back', text: '?' }),
      el('div', { cls: 'fc-front' }, collectibleImg(r.item, r.variant, 'mid'), chip),
    );
    cell.style.setProperty('--rc', RARITY_COLOR[r.item.rarity]);
    return cell;
  });
  const grid = el('div', { cls: 'sum-grid' }, ...cells);
  const hero = el(
    'div',
    { cls: `pf sum-hero fc r-${best.item.rarity} cv-${best.variant}`, attrs: { 'aria-label': `최고 등급 ${best.item.name}` } },
    el('div', { cls: 'fc-back', text: '?' }),
    el(
      'div',
      { cls: 'fc-front' },
      collectibleImg(best.item, best.variant, 'big'),
      el('div', { cls: 'sum-hero-name', text: best.item.name }),
      el('span', { cls: 'col-chip cc-rar', text: `${rarityName(best.item.rarity)} 등급` }),
    ),
  );
  hero.style.setProperty('--rc', RARITY_COLOR[best.item.rarity]);
  (hero.querySelector('.cc-rar') as HTMLElement).style.setProperty('--rc', RARITY_COLOR[best.item.rarity]);
  const bestLine = el('div', { cls: 'sum-bestline', text: '' });
  const cnt = el('b', { text: '0' });
  const multEl = el('b', { text: multPair(mult.before, mult.after)[0] });
  const changed = mult.after > mult.before + 1e-9;
  const [mBefore] = multPair(mult.before, mult.after);
  const lvEl = el('b', { text: '0' });
  const gain = el(
    'div',
    { cls: 'sum-gain' },
    bestLine,
    el('div', {}, '새로 얻은 사은품 ', cnt, '종'),
    ...(lvCount > 0 ? [el('div', {}, '레벨업 ', lvEl, '개')] : []),
    changed ? el('div', {}, '도감 배율 ', mBefore, ' → ', multEl) : el('div', { cls: 'dim', text: '도감 배율은 그대로예요' }),
    ...results.flatMap((r) => r.completedSets).map((r) => el('div', { cls: 'sum-setdone', text: `${SETS.find((x) => x.rarity === r)!.name.replace(' 세트', '')} 세트 완성 · ${SETS.find((x) => x.rarity === r)!.desc}` })),
  );
  const skip = el('div', { cls: 'bs-skip', text: '누르면 건너뛰어요' });
  const white = el('div', { cls: 'bs-white' });
  const close = el('button', { cls: 'btn primary gold', text: '확인', attrs: { type: 'button' } });
  close.addEventListener('click', () => sc.close());
  const moreTen = el('button', { cls: 'btn', text: '또 10개', attrs: { type: 'button' } });
  moreTen.addEventListener('click', (e) => {
    e.stopPropagation();
    sc.close();
    openTen();
  });
  const actions = el('div', { cls: 'bs-actions lock' }, moreTen, close);
  sc.root.append(el('div', { cls: 'sum-wrap' }, el('div', { cls: 'sum-body' }, el('div', { cls: 'sum-title', text: `${results.length}개 열기 결과` }), hero, grid, gain), el('div', { cls: 'sum-foot' }, actions)), skip, white);

  let done = false;
  const flip = (i: number, instant = false): void => {
    const cell = cells[i];
    cell.classList.remove('charge');
    cell.classList.add('flip');
    if (instant) return;
    const r = results[i];
    const t = rarityTier(r.item.rarity);
    if (t >= 2) {
      sfx.boxBurst(t);
      burstFor(r.item.rarity, center(cell), 0.5);
      if (t >= 3) {
        fx.shake(sc.root, 4, 260);
        whiteFlash(white, 100);
      }
    } else sfx.perkFlip(i % 5);
    vibrate(t >= 2 ? 25 : 6);
  };

  // 한 장씩 0.08초 간격으로 뒤집힌다. 높은 등급은 뒤집기 전에 잠깐 멈춰 등급 색으로 떨린다.
  let at = 350;
  results.forEach((r, i) => {
    const t = rarityTier(r.item.rarity);
    if (t >= 2 && !quick) {
      sc.after(at, () => {
        cells[i].classList.add('charge');
        sfx.boxShake(t);
      });
      at += [0, 0, 300, 500, 650][t];
    }
    sc.after(at, () => flip(i));
    at += quick ? 40 : 80;
  });
  sc.after(at + 380, () => finish());
  sc.root.addEventListener('pointerdown', () => {
    if (!done) finish(true);
  });

  function finish(instant = false): void {
    if (done) return;
    done = true;
    sc.timers.forEach(clearTimeout);
    if (instant) cells.forEach((_, i) => flip(i, true));
    const bi = results.indexOf(best);
    cells[bi].classList.add('best');
    hero.classList.add('flip');
    fx.pxFrames(hero, [{ transform: 'translateY(-8px)' }, { transform: 'translateY(-12px)' }, { transform: 'translateY(-4px)' }, { transform: 'translateY(0)' }], 83);
    bestLine.replaceChildren(el('span', { cls: 'sum-best', text: `최고 등급 · ${best.item.name} · ${rarityName(best.item.rarity)}${best.variant !== 'base' ? ` · ${variantName(best.variant)}` : ''}` }));
    const p = center(cells[bi]);
    if (bt >= 1) {
      sfx.boxBurst(bt);
      burstFor(best.item.rarity, p, 0.7, 0.9, window.innerWidth >= 900);
      whiteFlash(white, 100);
      fx.shake(sc.root, SHAKE_PX[bt] * 0.6, 280);
    } else sfx.reward();
    sc.after(300, () => variantFx(best.variant, p, bt));
    sc.after(350, () => {
      fx.countUp(cnt, newCount, 600, (v) => String(Math.round(v)));
      fx.countUp(lvEl, lvCount, 600, (v) => String(Math.round(v)));
      if (changed) fx.countUp(multEl, mult.after, 800, multFmt(mult.before, mult.after), mult.before);
      if (newCount > 0 || lvCount > 0) sfx.newItem();
    });

    moreTen.disabled = boxPrice(ctx.get()) > ctx.get().points;
    skip.remove();
    sc.after(400, () => actions.classList.remove('lock'));
  }
}

const rarityScore = (r: BoxResult): number => rarityTier(r.item.rarity) * 10 + VARIANTS.findIndex((v) => v.id === r.variant);
