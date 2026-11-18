/** 시험용 상태: 가이드를 마친 새 게임(요소가 전부 열려 있다). 가이드 자체를 시험하는 파일만 `defaultState`를 직접 쓴다 */
import { finishedGuide } from './guide';
import { defaultState as newGame, type GameState } from './state';

export function defaultState(savedAt = 0, salt = 0): GameState {
  return { ...newGame(savedAt, salt), guide: finishedGuide() };
}
