export interface BundleDef {
  id: string;
  name: string;
  emoji: string;
  /** SERVICES 인덱스 (모든 서비스가 1~2개 결합에 속한다) */
  services: readonly number[];
}

/** 결합 단계: 속한 서비스들의 최소 레벨이 levels[i] 이상이면 mults[i]배 (단계 값, 누적 곱 아님) */
export const BUNDLE_LEVELS = [10, 25, 50, 100] as const;
export const BUNDLE_MULTS = [1.5, 2, 3, 4] as const;

// 서비스 인덱스: 0 인터넷, 1 정수기, 2 공기청정기, 3 휴대폰, 4 청소, 5 인테리어, 6 로봇청소기, 7 내 집 마련 상담
export const BUNDLES: readonly BundleDef[] = [
  { id: 'comm', name: '통신 결합', emoji: '', services: [0, 3] },
  { id: 'thrifty', name: '알뜰 입문 결합', emoji: '', services: [0, 1, 2] },
  { id: 'rental', name: '렌탈 결합', emoji: '', services: [1, 2, 6] },
  { id: 'chores', name: '살림 결합', emoji: '', services: [4, 5, 6] },
  { id: 'newhome', name: '새집 결합', emoji: '', services: [5, 7] },
];
