// 도트 그림 공통: 그림 경로, 자연 크기 캐시. 그림은 항상 자연 크기 x 2로만 띄운다.

/** 도트 1칸 = 화면 2px */
export const DOT = 2;

export const artUrl = (name: string): string => `${import.meta.env.BASE_URL}assets/px/${name}.png`;

/** 그림이 안 떠도 자리가 0이 되지 않게 하는 종류별 기본 도트 크기 */
const ITEM_DIMS: Record<string, [number, number]> = {
  air_purifier: [14, 26],
  coffee_machine: [16, 18],
  fan: [14, 28],
  fridge: [22, 44],
  kettle: [12, 12],
  rice_cooker: [14, 12],
  smart_tv: [32, 24],
  washer: [28, 30],
};
const BOX_DOTS: Record<string, number> = { small: 32, normal: 40, big: 52 };
function fallbackDim(name: string): { w: number; h: number } | null {
  const [dir, base = ''] = name.split('/');
  if (dir === 'room') return { w: 180, h: 130 };
  if (dir === 'tool' || dir === 'icon') return { w: 24, h: 24 };
  if (dir === 'col') return { w: 32, h: 32 };
  if (dir === 'box') return { w: BOX_DOTS[base.split('-')[0]] ?? 32, h: BOX_DOTS[base.split('-')[0]] ?? 32 };
  if (dir === 'item' && ITEM_DIMS[base]) return { w: ITEM_DIMS[base][0], h: ITEM_DIMS[base][1] };
  if (name === 'ui/wall-phone') return { w: 20, h: 20 };
  return null;
}

const dims = new Map<string, { w: number; h: number }>();

export function preload(names: string[]): Promise<void> {
  return Promise.all(
    names.map(
      (n) =>
        new Promise<void>((res) => {
          if (dims.has(n)) return res();
          const im = new Image();
          im.onload = () => {
            dims.set(n, { w: im.naturalWidth, h: im.naturalHeight });
            res();
          };
          im.onerror = () => {
            console.warn(`[art] 그림을 못 불러왔어요: ${n}.png`);
            const f = fallbackDim(n);
            if (f) dims.set(n, f);
            res();
          };
          im.src = artUrl(n);
        }),
    ),
  ).then(() => undefined);
}

/** 자연 크기(도트). preload 전이면 0 */
export const dim = (name: string): { w: number; h: number } => dims.get(name) ?? { w: 0, h: 0 };

/** 자연 크기 x 2 로 바로 세팅되는 img */
export function pxImg(name: string, cls = ''): HTMLImageElement {
  const im = new Image();
  im.className = `px-img ${cls}`.trim();
  im.alt = '';
  im.draggable = false;
  const fit = (): void => {
    im.style.width = `${im.naturalWidth * DOT}px`;
    im.style.height = `${im.naturalHeight * DOT}px`;
  };
  im.onload = fit;
  im.src = artUrl(name);
  if (im.complete && im.naturalWidth) fit();
  return im;
}
