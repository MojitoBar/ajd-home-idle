// 아이콘 이미지 경로를 한곳에서 관리한다. 도트 그림은 자연 크기의 정수배로만 띄운다(16도트 32px, 24도트 48px). 로드에 실패하면 '?' 글리프로 대체된다.
import { glyphSvg } from './px/glyphs';

const BASE = import.meta.env.BASE_URL;

export type IconName =
  | 'box-closed' | 'box-open' | 'parcel' | 'coin' | 'coin-pile' | 'fever' | 'crit' | 'perk'
  | 'ui-settings' | 'ui-dex' | 'ui-rocket' | 'ui-move' | 'ui-tools'
  | `house-${string}` | `perk-${string}` | `tool/${string}` | `box/${string}` | `card/${string}`;

export const collectibleUrl = (id: string, variant: string): string => `${BASE}assets/px/col/${id}${variant === 'gold' || variant === 'rainbow' ? `-${variant}` : ''}.png`;

export const iconUrl = (name: IconName): string => `${BASE}assets/px/${name.startsWith('tool/') || name.startsWith('box/') || name.startsWith('card/') ? '' : 'icon/'}${name}.png`;

/** 특전 아이콘(데이터의 id 와 같다) */
export const perkIcon = (id: string): IconName => `perk-${id}`;
/** 집 단계 아이콘(24도트, 화면 48px). 집 테마 id 와 파일 이름이 같다 */
export const houseIcon = (theme: string): IconName => `house-${theme}`;

export interface IconOpts {
  size: number;
  alt?: string;
  cls?: string;
}

export function iconImg(name: IconName, o: IconOpts): HTMLImageElement {
  const img = document.createElement('img');
  const px = o.size;
  img.className = `ico${o.cls ? ` ${o.cls}` : ''}`;
  img.width = px;
  img.height = px;
  img.alt = o.alt ?? '';
  img.draggable = false;
  img.decoding = 'async';
  img.src = iconUrl(name);
  img.addEventListener(
    'error',
    () => {
      const fb = glyphSvg('q', o.size);
      fb.classList.add('ico-fb');
      if (o.cls) fb.classList.add(...o.cls.split(' '));
      img.replaceWith(fb);
    },
    { once: true },
  );
  return img;
}

// ---------- canvas 용 ----------
const cache = new Map<IconName, HTMLImageElement>();
export function loadIcon(name: IconName): HTMLImageElement {
  let im = cache.get(name);
  if (!im) {
    im = new Image();
    im.decoding = 'async';
    im.src = iconUrl(name);
    cache.set(name, im);
  }
  return im;
}
/** 이미 불러온 그림만 돌려준다(아직이거나 실패면 null) */
export function readyIcon(name: IconName): HTMLImageElement | null {
  const im = loadIcon(name);
  return im.complete && im.naturalWidth > 0 ? im : null;
}

/** 첫 화면에 필요한 그림을 미리 불러온다. */
export function preloadIcons(): void {
  for (const n of ['coin', 'box-closed', 'box-open', 'parcel', 'fever', 'crit'] as IconName[]) loadIcon(n);
}

// ---------- 아이콘 + 글자 라벨 ----------
const labels = new WeakMap<HTMLElement, HTMLElement>();
/** node 안에 [그림][글자] 구조를 한 번 만들고, 이후에는 글자만 바꾼다. */
export function setLabel(node: HTMLElement, name: IconName, size: number, text: string): void {
  let span = labels.get(node);
  if (!span) {
    span = document.createElement('span');
    span.className = 'lbl';
    node.textContent = '';
    node.prepend(iconImg(name, { size, cls: 'lbl-ico' }));
    node.append(span);
    labels.set(node, span);
  }
  if (span.textContent !== text) span.textContent = text;
}
