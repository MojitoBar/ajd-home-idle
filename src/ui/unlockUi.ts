// 단계적 공개 화면 쪽: 열림 기록(state.unlocked)을 body 클래스로 옮기고, 새로 열릴 때 연출을 순서대로 재생한다.
// 숨김 자체는 m9-unlock.css가 body.ux-<id>가 없을 때 대상을 접는다(자리도 남지 않는다).
import { isOpen, metIds, pendingUnlocks, UNLOCK_IDS, UNLOCK_NAME, type UnlockId } from '../logic/unlock';
import type { UiCtx } from './collectUi';
import type { IconName } from './icons';
import * as fx from './fx';
import { sfx } from './sound';
import { vibrate } from './prefs';

type DotTab = 'tap' | 'home' | 'box' | 'dex';

interface UnlockHooks {
  ctx: UiCtx;
  toast(msg: string, gold?: boolean, icon?: IconName): void;
  /** 지금 보고 있는 탭인가(보고 있으면 알림 점을 달지 않는다) */
  isActiveTab(id: DotTab): boolean;
}

/** 앞선 토스트에 이름이 묶여 따로 토스트를 띄우지 않을 열림 */
const silent = new Set<UnlockId>();
const GAP_MS = 600;
const POP_MS = 300;

/** 연출 때 튀어나오는 대상(CSS 숨김 규칙과 같은 대상) */
const POP_SELECTOR: Partial<Record<UnlockId, string>> = {
  home: '[data-ux="home"]',
  box: '[data-ux="box"]',
  dex: '[data-ux="dex"]',
  mult: '.speed-wrap .info-btn',
  badge: '.top .badge',
  perk: '.perk-btn',
  deck: '.deck-row',
};
/** 테두리 점멸을 그릴 대상(자리가 잡혀 있는 하나) */
const EDGE_SELECTOR: Partial<Record<UnlockId, string>> = {
  home: '[data-ux="home"]',
  box: '[data-ux="box"]',
  dex: '[data-ux="dex"]',
  mult: '.speed-wrap .info-btn',
  badge: '.top .badge',
  perk: '.perk-btn',
  deck: '.deck-row',
};

/** 토스트에 붙는 열린 대상의 아이콘 */
const ICON: Partial<Record<UnlockId, IconName>> = {
  home: 'perk-home_boost',
  box: 'box-closed',
  dex: 'ui-dex',
  mult: 'fever',
  badge: 'ui-rocket',
  perk: 'perk',
  deck: 'ui-tools',
};

let H: UnlockHooks;
const queue: UnlockId[] = [];
const newTabs = new Set<DotTab>();
let timer = 0;
let lastPlay = -Infinity;
let appliedKey = '';

export function initUnlock(hooks: UnlockHooks): void {
  H = hooks;
}

/** 탭이 열려 있는가(공구 탭은 항상 열림). 조건은 충족했지만 연출 순서를 기다리는 탭도 연다 */
export function tabOpen(id: string): boolean {
  if (id === 'tap') return true;
  if (!(UNLOCK_IDS as readonly string[]).includes(id)) return true;
  const s = H.ctx.get();
  return isOpen(s, id as UnlockId) || queue.includes(id as UnlockId) || pendingUnlocks(s).includes(id as UnlockId);
}

export const hasNewTabDot = (id: string): boolean => newTabs.has(id as DotTab);
/** 탭 버튼에 알림 점을 한 번 찍는다(그 탭을 보고 있으면 찍지 않는다) */
export function markTabDot(id: DotTab): void {
  if (!H.isActiveTab(id)) newTabs.add(id);
}
export function clearNewTabDot(id: string): void {
  newTabs.delete(id as DotTab);
}

function apply(): void {
  const open = H.ctx.get().unlocked ?? [];
  const key = open.join(',');
  if (key === appliedKey) return;
  appliedKey = key;
  for (const id of UNLOCK_IDS) document.body.classList.toggle(`ux-${id}`, open.includes(id));
}

function blocked(): boolean {
  return document.visibilityState !== 'visible' || document.querySelector('.overlay, .box-scene, .move-scene') !== null;
}

function pump(): void {
  if (queue.length === 0) silent.clear();
  if (timer || queue.length === 0) return;
  const wait = Math.max(blocked() ? 300 : 0, GAP_MS - (performance.now() - lastPlay));
  if (wait > 0) {
    timer = window.setTimeout(() => {
      timer = 0;
      pump();
    }, wait);
    return;
  }
  play(queue.shift()!);
  pump();
}

function play(id: UnlockId): void {
  const s = H.ctx.get();
  if (isOpen(s, id)) return;
  lastPlay = performance.now();
  H.ctx.set({ ...s, unlocked: [...(s.unlocked ?? []), id] });
  apply();
  const motion = !fx.isReduced();
  if (motion) {
    for (const n of document.querySelectorAll<HTMLElement>(POP_SELECTOR[id] ?? '.ux-none')) {
      n.classList.remove('ux-pop');
      void n.offsetWidth;
      n.classList.add('ux-pop');
      window.setTimeout(() => n.classList.remove('ux-pop'), POP_MS);
    }
  }
  const target = [...document.querySelectorAll(EDGE_SELECTOR[id] ?? '.ux-none')].find((n) => n.getBoundingClientRect().width > 0);
  if (target) fx.edge(target, 'or', [1, 0, 1, 0, 1, 1]);
  if (id === 'home' || id === 'box' || id === 'dex') markTabDot(id);
  // 같은 순간에 줄 선 것은 토스트 하나로 묶는다(연출은 하나씩 따로)
  if (!silent.delete(id)) {
    const names = [id, ...queue.filter((q) => !isOpen(s, q))].map((q) => UNLOCK_NAME[q]);
    for (const q of queue) silent.add(q);
    H.toast(`새로 열렸어요 · ${names.length <= 2 ? names.join(' · ') : `${names[0]} · ${names[1]} 외 ${names.length - 2}가지`}`, false, ICON[id]);
  }
  sfx.ready();
  vibrate([10, 20, 10]);
  H.ctx.save();
}

/** 매 update 끝에서 호출 */
export function syncUnlock(): void {
  const s = H.ctx.get();
  if (s.unlocked === undefined) {
    // 예전 저장·새 게임·가져오기·초기화: 이미 충족한 것은 연출 없이 열린 채로 시작한다
    queue.length = 0;
    newTabs.clear();
    H.ctx.set({ ...s, unlocked: metIds(s) });
    apply();
    return;
  }
  apply();
  for (const id of pendingUnlocks(s)) if (!queue.includes(id)) queue.push(id);
  pump();
}
