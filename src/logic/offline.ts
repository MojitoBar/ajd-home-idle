import { RETURN_RUSH_AWAY_SEC, RUSH_MAX_SEC } from '../data/unpack';
import type { GameState } from './state';

export interface OfflineResult {
  state: GameState;
  /** 오래 비웠다 돌아와 러시를 받았는가 */
  rush: boolean;
  awaySec: number;
}

/**
 * 돌아오면 러시. 오프라인 수익은 없고, 저장 시각을 갱신하며
 * 30분 넘게 비웠다 오면 시계 상자 러시(자동 연타)를 가득 채워 준다.
 */
export function applyOffline(state: GameState, now: number): OfflineResult {
  const savedAt = Math.min(state.savedAt, now);
  const awaySec = Math.max(0, (now - savedAt) / 1000);
  const rush = awaySec > RETURN_RUSH_AWAY_SEC;
  const next: GameState = { ...state, savedAt };
  if (rush) next.unpack = { ...state.unpack, rushSec: RUSH_MAX_SEC };
  return { state: next, rush, awaySec };
}
