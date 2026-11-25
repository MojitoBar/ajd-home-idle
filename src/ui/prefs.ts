// UI 설정(효과음·진동). 게임 저장(src/logic/save.ts)과 별개의 localStorage 키를 쓴다.
const KEY = 'ajd-home-idle:ui-prefs';

export interface UiPrefs {
  sound: boolean;
  haptics: boolean;
  /** 꾹 눌러 강타를 한 번 성공했는지(안내 말풍선을 더 안 띄운다) */
  chargeDone: boolean;
  /** 급소를 한 번 맞혔는지(안내 말풍선을 더 안 띄운다) */
  weakDone: boolean;
  /** 열기가 찬 강타(파워 x2 이상)를 한 번 성공했는지(안내 말풍선을 더 안 띄운다) */
  heatDone: boolean;
  /** 처음 나타날 때 한 줄 설명을 이미 보여 준 항목 id */
  tips: string[];
}

let prefs: UiPrefs = { sound: true, haptics: true, chargeDone: false, weakDone: false, heatDone: false, tips: [] };

try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const p = JSON.parse(raw) as Partial<UiPrefs>;
    prefs = { sound: p.sound !== false, haptics: p.haptics !== false, chargeDone: p.chargeDone === true, weakDone: p.weakDone === true, heatDone: p.heatDone === true, tips: Array.isArray(p.tips) ? p.tips.filter((x): x is string => typeof x === 'string') : [] };
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
