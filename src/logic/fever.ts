import type { FeverState, GameState, ParcelState } from './state';

export const CRIT_CHANCE = 0.05;
export const CRIT_MULT = 6;

export const FEVER_TAPS = 45;
export const FEVER_DECAY_PER_SEC = 1.2;
export const FEVER_SEC = 10;
export const FEVER_COOLDOWN_SEC = 3;
export const FEVER_MULT = 3;

export const PARCEL_INTERVAL_MIN_SEC = 60;
export const PARCEL_INTERVAL_MAX_SEC = 120;
export const PARCEL_STAY_SEC = 8;
export const PARCEL_FREE_BOX_CHANCE = 0.1;
export const PARCEL_MIN_PPS_SEC = 20;
export const PARCEL_MAX_PPS_SEC = 40;
/** 택배 포인트 = tapStable x 이 값 x 초(20~40) */
export const PARCEL_TAPS_PER_SEC = 2.5;

export const initialFever = (): FeverState => ({ gauge: 0, activeSec: 0, cooldownSec: 0 });
export const initialParcel = (): ParcelState => ({ nextInSec: 90, remainSec: 0 });

export function feverMultOf(fever: FeverState): number {
  return fever.activeSec > 0 ? FEVER_MULT : 1;
}

/** 피버 게이지 비율(0~1). 피버 중엔 남은 시간 비율. */
export function feverRatio(state: GameState, feverSec = FEVER_SEC): number {
  const f = state.fever;
  return f.activeSec > 0 ? f.activeSec / feverSec : Math.min(1, f.gauge / FEVER_TAPS);
}

/** 탭 1회 충전. 피버 중·재충전 제한 중엔 충전하지 않는다. */
export function chargeFever(f: FeverState, feverSec = FEVER_SEC, amount = 1): FeverState {
  if (f.activeSec > 0 || f.cooldownSec > 0) return f;
  const gauge = f.gauge + amount;
  if (gauge >= FEVER_TAPS) return { gauge: 0, activeSec: feverSec, cooldownSec: 0 };
  return { ...f, gauge };
}

export function advanceFever(f: FeverState, dt: number): FeverState {
  if (f.activeSec > 0) {
    const activeSec = f.activeSec - dt;
    return activeSec > 0 ? { ...f, activeSec } : { gauge: 0, activeSec: 0, cooldownSec: FEVER_COOLDOWN_SEC };
  }
  if (f.cooldownSec > 0) return { ...f, cooldownSec: Math.max(0, f.cooldownSec - dt) };
  return f.gauge > 0 ? { ...f, gauge: Math.max(0, f.gauge - FEVER_DECAY_PER_SEC * dt) } : f;
}

export function nextParcelDelay(rng?: () => number, scale = 1): number {
  const r = rng ? rng() : 0.5;
  return (PARCEL_INTERVAL_MIN_SEC + r * (PARCEL_INTERVAL_MAX_SEC - PARCEL_INTERVAL_MIN_SEC)) * scale;
}

/** 떠 있으면 remainSec 감소(0이 되면 사라지고 다음 대기), 아니면 대기 감소(0이 되면 등장). */
export function advanceParcel(p: ParcelState, dt: number, rng?: () => number, scale = 1): ParcelState {
  if (p.remainSec > 0) {
    const remainSec = p.remainSec - dt;
    return remainSec > 0 ? { ...p, remainSec } : { nextInSec: nextParcelDelay(rng, scale), remainSec: 0 };
  }
  const nextInSec = p.nextInSec - dt;
  return nextInSec > 0 ? { ...p, nextInSec } : { nextInSec: 0, remainSec: PARCEL_STAY_SEC };
}
