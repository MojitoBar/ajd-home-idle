interface KeyHandlers {
  tap: () => void;
  /** Space·Enter를 뗐을 때(누르고 있기 = 모으기) */
  release: () => void;
  tab: (index: number) => void;
}

const FIELD = 'input, textarea, select, [contenteditable="true"]';

function modalOpen(): boolean {
  return document.querySelector('.overlay, .box-scene, .move-scene') !== null;
}

/** PC 키보드 단축키. 입력란·모달이 떠 있을 때는 Space·숫자를 건드리지 않는다. */
export function initKeys(h: KeyHandlers): void {
  let tapKeyDown = false;
  let kbNav = false;
  window.addEventListener('pointerdown', () => {
    kbNav = false;
  }, { capture: true, passive: true });
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target instanceof Element ? e.target : null;
    if (e.key === 'Tab') kbNav = true;
    if (e.key === 'Escape') {
      const overlays = document.querySelectorAll('.overlay');
      const top = overlays[overlays.length - 1];
      if (top) {
        e.preventDefault();
        top.dispatchEvent(new Event('modal-close'));
      }
      return;
    }
    if (target?.closest(FIELD) || modalOpen()) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === ' ' || key === 'Enter') {
      // Tab으로 포커스한 버튼은 그 버튼만 눌린다(마우스로 눌러 포커스가 남은 버튼에서는 전화를 누른다)
      if (kbNav && target && target.closest('button, a, [role="button"]') && !target.classList.contains('phone')) return;
      e.preventDefault();
      if (e.repeat) return;
      tapKeyDown = true;
      h.tap();
      return;
    }
    if (key >= '1' && key <= '4') {
      e.preventDefault();
      h.tab(Number(key) - 1);
    }
  });
  window.addEventListener('keyup', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && tapKeyDown) {
      tapKeyDown = false;
      e.preventDefault();
      h.release();
    }
  });
}
