// 상자·도감 화면이 함께 쓰는 표시 도우미(등급 색, 도트 수집품 그림, 레벨 눈금, 세트 줄).
import { RARITIES, VARIANTS, type CollectibleDef, type Rarity, type Variant } from '../data/collectibles';
import type { GameState } from '../logic/state';
import type { BoxResult } from '../logic/gacha';
import { SLOT_LEVEL_NEED, SLOT_MAX_LEVEL, slotLevel, slotNextNeed } from '../logic/collection';
import { el, openModal } from './dom';
import { collectibleUrl } from './icons';

/** 등급 색: 팔레트 토큰(일반 k3, 레어 b3, 에픽 pu, 전설 g2, 신화 pk) */
export const RARITY_COLOR: Record<Rarity, string> = {
  common: 'var(--k3)',
  rare: 'var(--b3)',
  epic: 'var(--pu)',
  legend: 'var(--g2)',
  myth: 'var(--pk)',
};
/** 입자용 팔레트 값(palette.css 와 같은 값) */
export const PAL = { k0: '#0d1430', k3: '#8a96b8', k4: '#d6dcec', k5: '#ffffff', b3: '#5b9bff', b4: '#bcd6ff', g1: '#c98a00', g2: '#ffc83d', g3: '#ffeaa0', r2: '#e9304b', or: '#ff8a1f', gn: '#2fb36b', pu: '#8d5cf6', pk: '#ff6fb0' };
export const RARITY_HEX: Record<Rarity, string> = { common: PAL.k3, rare: PAL.b3, epic: PAL.pu, legend: PAL.g2, myth: PAL.pk };
export const rarityTier = (r: Rarity): number => RARITIES.findIndex((x) => x.id === r);
export const rarityName = (r: Rarity): string => RARITIES.find((x) => x.id === r)!.name;
export const variantName = (v: Variant): string => VARIANTS.find((x) => x.id === v)!.name;
/** 변종 이름 앞 네모 표식(반짝·황금·무지개). 기본은 없다. */
export function variantMark(v: Variant): HTMLElement | null {
  return v === 'base' ? null : el('i', { cls: `vmark vm-${v}`, attrs: { 'aria-hidden': 'true' } });
}
/** 변종 칩: 반짝 b3 · 황금 g1 · 무지개 pk 선. 기본은 칩이 없다. */
export function variantChip(v: Variant): HTMLElement | null {
  return v === 'base' ? null : el('span', { cls: `col-chip cc-${v}`, text: variantName(v) });
}

/** 그림을 미리 불러온다(상자 결과 연출 전에 쓴다). */
export function preloadCollectible(item: CollectibleDef, variant: Variant): void {
  new Image().src = collectibleUrl(item.id, variant);
}

/** 수집품 도트 그림(32도트). 반짝은 기본 그림을 쓰고 틀 색·칩으로만 구분한다. 못 얻은 칸은 k3 단색 실루엣. */
export function collectibleImg(item: CollectibleDef, variant: Variant, cls = '', silhouette = false): HTMLElement {
  const url = collectibleUrl(item.id, silhouette ? 'base' : variant);
  const wrap = el('span', { cls: `col-item v-${variant} ${cls}${silhouette ? ' sil' : ''}`.trim() });
  if (silhouette) {
    wrap.style.setProperty('--img', `url("${url}")`);
    wrap.append(el('i', { cls: 'col-sil' }));
    return wrap;
  }
  const img = document.createElement('img');
  img.alt = '';
  img.draggable = false;
  img.decoding = 'async';
  img.src = url;
  wrap.append(img);
  return wrap;
}

/** 레벨 눈금: 5칸 중 레벨만큼 채운다(최대면 금색). */
export function levelDots(count: number): HTMLElement {
  const lv = slotLevel(count);
  const box = el('span', { cls: `lv-dots${lv >= SLOT_MAX_LEVEL ? ' max' : ''}`, attrs: { 'aria-hidden': 'true' } });
  for (let i = 0; i < SLOT_MAX_LEVEL; i++) box.append(el('i', { cls: i < lv ? 'on' : '' }));
  return box;
}

/** 세트 효과 한 줄(상자 탭·도감 탭 공용): 이름 · 진행 · 효과 · 칩 */
export function setRow(x: { rarity: Rarity; name: string; have: number; total: number; desc: string; done: boolean }): HTMLElement {
  const row = el(
    'div',
    { cls: `pf dex-set${x.done ? ' on' : ''}` },
    el('span', { cls: 'dex-set-name', text: x.name }),
    el('span', { cls: 'dex-set-prog', text: `${x.have}/${x.total}` }),
    el('span', { cls: 'dex-set-desc', text: x.desc }),
    el('span', { cls: 'dex-set-state', text: x.done ? '켜짐' : '잠김' }),
  );
  row.style.setProperty('--rc', RARITY_COLOR[x.rarity]);
  return row;
}

export interface UiCtx {
  get(): GameState;
  set(s: GameState): void;
  update(): void;
  save(): void;
  goto(tab: 'tap' | 'home' | 'box' | 'dex'): void;
  showModal(title: string, body: Node[], actions: Parameters<typeof openModal>[2], opts?: Parameters<typeof openModal>[3]): void;
  dismissModal(): void;
}

/** 새로 등록된 칸(도감 탭에 들어왔을 때 한 번 반짝임). 저장하지 않는다. */
export const fresh = new Set<string>();
export function markFresh(r: BoxResult): void {
  if (r.isNew) fresh.add(`${r.item.id}:${r.variant}`);
}

/** 칸 레벨 표기: `Lv 2 · 3/7`, 최대면 `Lv 5 MAX`. */
export function levelText(count: number): string {
  const lv = slotLevel(count);
  if (lv <= 0) return '';
  const need = slotNextNeed(count);
  return need === 0 ? `Lv ${lv} MAX` : `Lv ${lv} · 다음 레벨까지 ${count}/${SLOT_LEVEL_NEED[lv]}개`;
}

/** 글자 `n/필요개수`와 같은 값의 진행(0~1). 최대면 1. */
export function levelRatio(count: number): number {
  const lv = slotLevel(count);
  if (lv <= 0) return 0;
  if (lv >= SLOT_MAX_LEVEL) return 1;
  return count / SLOT_LEVEL_NEED[lv];
}
