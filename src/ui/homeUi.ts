// 살림 탭: 살림 배율 요약 카드 + 살림 8칸 카드. 살림은 상자에서 나오므로 구매 버튼은 없다.
// 값이 바뀔 때만 DOM을 고친다(매 update 호출에서 키만 비교).
import { HOME_MULT_PER_LV } from '../data/tap';
import { ROOM_ITEMS, TIER_BASE, TIER_STEP } from '../data/unpack';
import { homeMult } from '../logic/economy';
import { formatNumber } from '../logic/format';
import type { GameState } from '../logic/state';
import { tierOf, toNextTier } from '../logic/unpack';
import { el, setText, toggleClass } from './dom';
import * as fx from './fx';
import { iconImg } from './icons';
import { artUrl, dim, preload } from './px/art';
import { tierArt } from './unpackUi';

/** 단계 이름(0~4). 5단계부터는 이름이 없어 "n단계"로 쓴다 */
const TIER_NAME = ['기본', '은빛', '금빛', '무지갯빛', '반짝'];
const tierName = (t: number): string => TIER_NAME[t] ?? `${t}단계`;

/** 칸 하나가 주는 배율 기여 = 0.05 x Lv x 2^단계 */
const contrib = (lv: number): number => HOME_MULT_PER_LV * lv * 2 ** tierOf(lv);

/** 기여는 작은 값(0.05)부터 나오므로 소수 둘째 자리까지 보인다 */
function fmtContrib(c: number): string {
  if (c >= 10) return formatNumber(c);
  return c.toFixed(2).replace(/\.?0+$/, '');
}

interface HomeCard {
  card: HTMLElement;
  icon: HTMLElement;
  name: HTMLElement;
  lv: HTMLElement;
  tag: HTMLElement;
  info: HTMLElement;
  fill: HTMLElement;
  label: HTMLElement;
  key: string;
  tier: number;
}

const cards: HomeCard[] = [];
const sumNum = el('div', { cls: 'home-sum-num' });
let sumKey = '';
let lastMult = 0;

export const homePanel = el('div', { cls: 'panel-inner home-panel' });

function build(): void {
  const sum = el(
    'div',
    { cls: 'card home-sum' },
    el('div', { cls: 'card-icon' }, iconImg('perk-home_boost', { size: 48 })),
    el('div', { cls: 'card-main' }, el('div', { cls: 'home-sum-lbl', text: '살림 배율' }), sumNum, el('div', { cls: 'card-info', text: '살림이 클수록 한 번 칠 때 수익이 커져요' })),
  );
  homePanel.append(sum);
  for (const it of ROOM_ITEMS) {
    const icon = el('div', { cls: 'card-icon home-ico' });
    const name = el('span', { cls: 'card-name', text: it.name });
    const lv = el('div', { cls: 'card-lv' });
    const tag = el('span', { cls: 'tag' });
    const info = el('div', { cls: 'card-info key' });
    const fill = el('div', { cls: 'ms-fill' });
    const label = el('span', { cls: 'ms-label' });
    const card = el(
      'div',
      { cls: 'card home-card' },
      icon,
      el('div', { cls: 'card-main' }, el('div', { cls: 'card-title' }, name, lv, tag), info, el('div', { cls: 'ms-bar' }, fill), label),
    );
    cards.push({ card, icon, name, lv, tag, info, fill, label, key: '', tier: -1 });
    homePanel.append(card);
  }
  homePanel.append(el('p', { cls: 'note dim tool-note home-note', text: '상자를 까면 살림이 커져요.' }));
  void preload(ROOM_ITEMS.map((it) => it.image)).then(() => {
    for (const c of cards) c.key = '';
  });
}
build();

/** 작은 그림은 칸을 꽉 채우도록 정수 배(도트당 4px)로 키운다. 아이콘 칸은 72px 폭 */
const dotPx = (w: number, h: number): number => (w * 4 <= 72 && h * 4 <= 72 ? 4 : 2);

/** 살림 그림(얻은 칸) 또는 점선 빈 칸의 흐린 그림자(mask) */
function setArt(c: HomeCard, i: number, lv: number): void {
  const name = lv > 0 ? tierArt(i, lv) : ROOM_ITEMS[i].image;
  const d = dim(ROOM_ITEMS[i].image);
  const node = c.icon.firstElementChild as HTMLElement | null;
  if (lv > 0) {
    let img = node instanceof HTMLImageElement ? node : null;
    if (!img) {
      img = new Image();
      img.className = 'px-img';
      img.alt = '';
      img.draggable = false;
      img.onload = () => {
        const k = dotPx(img!.naturalWidth, img!.naturalHeight);
        img!.style.width = `${img!.naturalWidth * k}px`;
        img!.style.height = `${img!.naturalHeight * k}px`;
      };
      c.icon.replaceChildren(img);
    }
    const url = artUrl(name);
    if (img.getAttribute('src') !== url) img.src = url;
    return;
  }
  const g = el('span', { cls: 'home-ghost' });
  const gk = dotPx(d.w, d.h);
  g.style.width = `${d.w * gk}px`;
  g.style.height = `${d.h * gk}px`;
  g.style.setProperty('--ic', `url(${artUrl(name)})`);
  c.icon.replaceChildren(g);
}

/** 살림 탭이 열려 있을 때 update마다 호출 */
export function syncHome(state: GameState): void {
  const mult = homeMult(state);
  const key = formatNumber(mult);
  if (key !== sumKey) {
    sumKey = key;
    setText(sumNum, `x${key}`);
    if (lastMult && mult > lastMult) fx.pop(sumNum, 1.5);
    lastMult = mult;
  }
  cards.forEach((c, i) => {
    const lv = state.homeLv[i] ?? 0;
    const t = tierOf(lv);
    const k = `${lv}`;
    if (c.key === k) return;
    const had = c.key !== '';
    c.key = k;
    const owned = lv > 0;
    toggleClass(c.card, 'empty', !owned);
    setArt(c, i, lv);
    if (!owned) {
      setText(c.lv, '');
      c.tag.hidden = true;
      setText(c.info, '상자에서 나와요');
      c.fill.style.transform = 'scaleX(0)';
      setText(c.label, '');
      c.tier = t;
      return;
    }
    setText(c.lv, `Lv ${formatNumber(lv)}`);
    c.tag.hidden = false;
    setText(c.tag, tierName(t));
    toggleClass(c.tag, 'gold', t >= 1);
    c.info.replaceChildren(el('span', { cls: 'v-u', text: '기여 ' }), el('span', { cls: 'v-n', text: `+${fmtContrib(contrib(lv))}` }));
    const lo = t === 0 ? 0 : TIER_BASE * TIER_STEP ** (t - 1);
    const hi = TIER_BASE * TIER_STEP ** t;
    c.fill.style.transform = `scaleX(${Math.min(1, (lv - lo) / (hi - lo)).toFixed(3)})`;
    setText(c.label, `다음 단계까지 ${formatNumber(toNextTier(lv))}레벨 · 기여 x2`);
    if (had && t > c.tier) fx.bounce(c.card, 0.95);
    c.tier = t;
  });
}
