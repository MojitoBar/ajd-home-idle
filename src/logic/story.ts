import type { GameState } from './state';

/** 엔딩이 걸리는 이사 횟수(우주 끝 신도시 = 8번째 이사로 도착한 집). 이 집 목표를 채우고 이사를 누르면 엔딩 */
export const ENDING_MOVES = 8;
/** 도착 쪽지가 있는 집 번호(투룸~우주 끝 신도시) */
export const NOTE_STAGES = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export interface StoryState {
  /** 인트로를 봤는가 */
  intro: boolean;
  /** 본 도착 쪽지의 집 번호(오름차순) */
  notes: number[];
  /** 엔딩을 봤는가 */
  ending: boolean;
}

export const initialStory = (): StoryState => ({ intro: false, notes: [], ending: false });

/** 새 게임 첫 화면에서만: 탭한 적 없고 이사 0회, 가이드 시작 전 */
export function introDue(s: Pick<GameState, 'story' | 'moves' | 'stats' | 'guide'>): boolean {
  return !s.story.intro && s.moves === 0 && s.stats.totalTaps === 0 && s.stats.boxesOpened === 0 && s.guide.step === 0;
}

/** 이 집에 처음 도착했고 쪽지가 있으면 그 번호 */
export function noteDue(s: Pick<GameState, 'story' | 'moves'>): number | null {
  const n = s.moves;
  return (NOTE_STAGES as readonly number[]).includes(n) && !s.story.notes.includes(n) ? n : null;
}

/** 엔딩을 아직 안 봤고 이사 횟수가 8 이상일 때, 이사 확인을 누르면 엔딩부터 재생한다 */
export const endingDue = (s: Pick<GameState, 'story' | 'moves'>): boolean => !s.story.ending && s.moves >= ENDING_MOVES;

export const seeIntro = (s: GameState): GameState => (s.story.intro ? s : { ...s, story: { ...s.story, intro: true } });
export const seeNote = (s: GameState, n: number): GameState => (s.story.notes.includes(n) ? s : { ...s, story: { ...s.story, notes: [...s.story.notes, n].sort((a, b) => a - b) } });
export const seeEnding = (s: GameState): GameState => (s.story.ending ? s : { ...s, story: { ...s.story, ending: true } });
