// UI 설정(효과음·진동). 게임 저장(src/logic/save.ts)과 별개의 localStorage 키를 쓴다.
const KEY = 'ajd-home-idle:ui-prefs';

export interface UiPrefs {
  sound: boolean;
  haptics: boolean;
}

let prefs: UiPrefs = { sound: true, haptics: true };

try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const p = JSON.parse(raw) as Partial<UiPrefs>;
    prefs = { sound: p.sound !== false, haptics: p.haptics !== false };
  }
} catch {
  /* 저장소가 막힌 환경은 기본값(켜짐) */
}

export function getPrefs(): UiPrefs {
  return prefs;
}

export function setPrefs(patch: Partial<UiPrefs>): void {
  prefs = { ...prefs, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* 무시 */
  }
}

export const hapticsSupported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export function vibrate(pattern: number | number[]): void {
  if (!prefs.haptics || !hapticsSupported) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* 무시 */
  }
}
