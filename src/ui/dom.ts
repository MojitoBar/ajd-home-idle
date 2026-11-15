import { glyphSvg, type GlyphName } from './px/glyphs';

/** PC 두 단 배치(폭 900 이상) 여부. m6-desktop.css의 중단점과 같아야 한다 */
export const desktopMq = window.matchMedia('(min-width: 900px)');

type Child = Node | string | null | undefined;

/** 8x8 도트 글리프(색은 글자색). 기본 16px */
export function glyph(name: GlyphName, size = 16): SVGSVGElement {
  return glyphSvg(name, size);
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { cls?: string; text?: string; attrs?: Record<string, string> } = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.cls) node.className = props.cls;
  if (props.text !== undefined) node.textContent = props.text;
  if (props.attrs) for (const [k, v] of Object.entries(props.attrs)) node.setAttribute(k, v);
  for (const c of children) if (c != null) node.append(c);
  return node;
}

export function setText(node: Node, value: string): void {
  if (node.textContent !== value) node.textContent = value;
}

export function setDisabled(btn: HTMLButtonElement, disabled: boolean): void {
  if (btn.disabled !== disabled) btn.disabled = disabled;
}

export function toggleClass(node: Element, cls: string, on: boolean): void {
  if (node.classList.contains(cls) !== on) node.classList.toggle(cls, on);
}

export interface ModalAction {
  label: string;
  primary?: boolean;
  /** 보상을 받는 버튼(노랑) */
  reward?: boolean;
  quiet?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export interface ModalOpts {
  /** 제목 왼쪽 노랑 칩(보상·특전 등 한 낱말) */
  chip?: string;
  /** 모달 틀에 더할 클래스 */
  cls?: string;
  icon?: Node;
  /** 닫기(X) 버튼을 숨긴다 — 꼭 눌러야 하는 보상 창 */
  noClose?: boolean;
}

export function openModal(title: string, body: Node[], actions: ModalAction[], opts: ModalOpts = {}): () => void {
  window.dispatchEvent(new Event('modal-open'));
  const overlay = el('div', { cls: 'overlay', attrs: { role: 'dialog', 'aria-modal': 'true' } });
  const head = el('div', { cls: 'modal-head' });
  if (opts.icon) head.append(opts.icon);
  if (opts.chip) head.append(el('span', { cls: 'head-chip', text: opts.chip }));
  head.append(el('h2', { text: title }));
  const bodyEl = el('div', { cls: 'modal-body' }, ...body);
  const box = el('div', { cls: `modal${opts.cls ? ` ${opts.cls}` : ''}` }, head, bodyEl);
  const row = el('div', { cls: 'modal-actions' });
  const close = () => overlay.remove();
  if (!opts.noClose) {
    overlay.addEventListener('modal-close', close);
  }
  for (const a of actions) {
    const b = el('button', { cls: a.quiet ? 'btn quiet' : a.danger ? 'btn danger' : a.reward ? 'btn primary gold' : a.primary ? 'btn primary' : 'btn', text: a.label });
    b.type = 'button';
    b.disabled = a.disabled === true;
    b.addEventListener('click', () => a.onClick());
    row.append(b);
  }
  if (actions.length > 0) box.append(row);
  if (!opts.noClose) {
    let downOnScrim = false;
    overlay.addEventListener('pointerdown', (e) => {
      downOnScrim = e.target === overlay;
    });
    overlay.addEventListener('click', (e) => {
      if (downOnScrim && e.target === overlay) close();
      downOnScrim = false;
    });
  }
  overlay.append(box);
  document.getElementById('app')!.append(overlay);
  // 바닥 시트 윗변이 피버 게이지 줄을 반으로 자르면 줄 전체를 숨긴다
  const gauge = document.querySelector<HTMLElement>('.fever-gauge');
  if (gauge && window.matchMedia('(max-width: 599px)').matches) {
    const top = overlay.clientHeight - box.offsetHeight;
    const g = gauge.getBoundingClientRect();
    if (top > g.top && top < g.bottom) overlay.classList.add('cut-gauge');
  }
  if (desktopMq.matches) {
    const focusable = (): HTMLElement[] => [...box.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, select, a[href]')];
    (row.querySelector<HTMLElement>('button:not(:disabled)') ?? focusable()[0])?.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
    overlay.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const f = focusable();
      if (f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }
  const syncFade = (): void => {
    const more = bodyEl.scrollHeight - bodyEl.clientHeight - bodyEl.scrollTop > 4;
    box.classList.toggle('scrolls', more);
  };
  bodyEl.addEventListener('scroll', syncFade, { passive: true });
  syncFade();
  return close;
}
