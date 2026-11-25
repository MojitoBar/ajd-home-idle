/** 이야기 문구. 보낸 사람 칸이 빈 상자가 이사 가는 집마다 먼저 와 있고, 우주 끝에서 마지막 상자를 열면 보낸 사람은 우주 끝의 나였다. */

export interface StoryPage {
  /** 한 문단. 한 글자씩 찍힌다 */
  text?: string;
  /** 문단 아래 송장 모양 줄(문단 뒤 한 줄씩 찍힌다) */
  invoice?: string[];
}

export const INTRO = {
  title: '이삿날',
  pages: [{ text: '오늘 원룸으로 이사 왔어요.' }, { text: '그런데 방 한가운데에 상자가 쌓여 있어요. 보낸 사람 칸은 비어 있고요.' }, { text: '일단 까 볼까요?' }] satisfies StoryPage[],
  done: '까 보기',
};

/** 도착 쪽지. 키는 집 번호(state.moves). 원룸(0)은 인트로가 맡는다 */
export const NOTES: Readonly<Record<number, string>> = {
  1: '이사 축하해요. 상자는 먼저 보내 뒀어요.',
  2: '엘리베이터가 있으니 더 많이 보낼게요.',
  3: '꼭대기까지 왔네요. 위로는 아직 남았어요.',
  4: '택배는 로켓으로 보냈어요. 깨질 물건은 없어요. 아마도요.',
  5: '먼지가 좀 묻었을 거예요. 상자는 멀쩡해요.',
  6: '위성이 많아서 주소를 세 번 고쳐 썼어요.',
  7: '여기까지 따라온 건 당신이 처음이에요.',
  8: '더 보낼 곳이 없어요. 마지막 상자는 맨 뒤에 있어요.',
};

export const NOTE_TAG = '상자에 붙은 쪽지';
export const NOTE_FROM = '보낸 사람: (빈칸)';
export const NOTE_DONE = '상자 까러 가기';

export const ENDING = {
  title: '마지막 상자',
  pages: [
    { text: '마지막 상자를 열었어요. 안에는 빈 송장 한 묶음과 펜이 들어 있어요.' },
    { text: '보낸 사람 칸이 늘 비어 있던 이유를 이제 알겠어요. 아직 안 썼던 거예요.' },
    { invoice: ['받는 사람: 원룸의 나', '보낸 사람: 우주 끝의 나'] },
    { text: '첫 상자를 부쳤어요. 저쪽의 나도 일단 까 보겠죠.' },
  ] satisfies StoryPage[],
  next: '다음',
  end: '끝',
  credit: '우리 집 키우기',
  keepGoing: '계속 까기',
  closeReplay: '닫기',
};

export const SKIP = '건너뛰기';
export const NEXT = '다음';
