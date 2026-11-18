// 가이드 줄: 새 게임에서 "지금 할 일"을 보여 주는 한 칸(방 아래 띠와 이사 줄 사이). 가이드가 끝나면 사라진다. 상태는 읽기만 한다.
import { guideView, type GuideFeature } from '../logic/guide';
import { formatNumber } from '../logic/format';
import type { GameState } from '../logic/state';
import { el, setText, toggleClass } from './dom';
import * as fx from './fx';

const chip = el('span', { cls: 'gd-chip' });
const count = el('span', { cls: 'gd-n' });
const reward = el('span', { cls: 'gd-reward' });
const text = el('div', { cls: 'gd-text' });
const fill = el('i', { cls: 'gd-fill' });
const head = el('div', { cls: 'gd-head' }, chip, count, reward);

/** 방 아래 띠와 이사 줄 사이에 붙는 줄 */
export const row = el(
  'section',
  { cls: 'guide-row', attrs: { hidden: '', 'aria-label': '가이드', 'aria-live': 'off' } },
  head,
  text,
  el('div', { cls: 'gd-bar' }, fill),
);

/** 열린 요소 이름(완료 알림용). 모두 받침 없는 말이라 "가"가 붙는다 */
export const FEATURE_NAME: Record<GuideFeature, string> = {
  combo: '콤보',
  charge: '강타와 열기 게이지',
  weak: '급소',
  fever: '피버',
  chain: '연쇄와 오함마',
  streak: '연속 퍼펙트 배수',
  special: '특별 상자',
  gear: '영구 공구',
};

interface Fit {
  text: string;
  size: 12 | 15;
  /** 낮은 화면의 한 줄 가이드에서 진행 숫자까지 숨겨 자리를 더 준다(guide.css) */
  tight?: boolean;
}
let fits: Fit[] = [];
let key = '';

/** 위 줄이 넘치면 보상 글자부터 숨기고, 문구가 넘치면 15px -> 12px -> 짧은 문구로 줄인다 */
function fit(): void {
  reward.hidden = !reward.textContent;
  if (!reward.hidden && head.scrollWidth > head.clientWidth) reward.hidden = true;
  for (const f of fits) {
    text.textContent = f.text;
    text.dataset.size = String(f.size);
    row.dataset.tight = f.tight ? '1' : '';
    if (text.scrollWidth <= text.clientWidth) return;
  }
}
new ResizeObserver(fit).observe(text);

// 단계 완료 연출 동안 줄은 "가득 찬 막대 + 완료!"를 붙잡고 있다가, 번쩍임이 끝나면 다음 단계 문구로 바꾼다
let holds = 0;
let lastState: GameState | null = null;
let holdTimer = 0;

/** 단계를 끝낸 순간(상태가 다음 단계로 넘어가기 전)에 불러 줄을 가득 찬 막대로 붙잡는다. 풀어 주는 것은 celebrateFlash가 한다(8초 안에 안 불리면 스스로 푼다) */
export function celebrateHold(): void {
  if (row.hidden) return;
  holds++;
  setText(count, '완료');
  fits = [{ text: '완료! 다음 단계가 와요', size: 15 }, { text: '완료!', size: 15 }];
  fit();
  row.classList.add('done');
  fill.style.width = '100%';
  window.clearTimeout(holdTimer);
  holdTimer = window.setTimeout(release, 8000);
}

function release(): void {
  window.clearTimeout(holdTimer);
  if (!holds) return;
  holds = 0;
  row.classList.remove('done');
  key = '';
  if (lastState) syncGuide(lastState);
  if (!fx.isReduced()) fx.pxFrames(text, [{ visibility: 'hidden' }, { visibility: 'visible' }, { visibility: 'hidden' }, { visibility: 'visible' }], 83);
}

/** 줄이 노랑·주황으로 세 번 번쩍이고(steps) 0.9초 뒤 다음 단계 문구로 바뀐다 */
export function celebrateFlash(): void {
  if (!holds) return;
  if (fx.isReduced()) {
    window.setTimeout(release, 600);
    return;
  }
  const c = ['var(--g2)', 'var(--p1)', 'var(--or)', 'var(--p1)', 'var(--g2)', 'var(--p1)'].map((background) => ({ background }));
  fx.pxFrames(row, c, 83);
  window.clearTimeout(holdTimer);
  holdTimer = window.setTimeout(release, 1000);
}

/** 지금 단계를 줄에 그린다. 가이드가 끝났으면 줄을 접는다 */
export function syncGuide(state: GameState): void {
  lastState = state;
  if (holds) return;
  const v = guideView(state);
  if (!v) {
    if (!row.hidden) row.hidden = true;
    return;
  }
  const waiting = v.n >= v.goal && !v.gateMet;
  const earned = formatNumber(v.gate);
  const pct = v.gate > 0 ? Math.min(1, state.earned / v.gate) : 1;
  const ratio = waiting ? pct : v.n / v.goal;
  const rewardText = v.rewardBoxes > 0 ? `선물 상자 ${v.rewardBoxes}개` : v.rewardPoints > 0 ? `+${formatNumber(v.rewardPoints)} P` : '';
  const goalText = waiting ? `누적 ${earned} P까지 모으면 다음 단계가 열려요` : v.text;
  const k = [v.no, v.text, waiting, rewardText, waiting ? '' : v.n, earned, Math.floor(ratio * 50)].join('|');
  if (k === key) return;
  key = k;
  row.hidden = false;
  setText(chip, `가이드 ${v.no}/${v.total}`);
  setText(count, waiting ? `${Math.floor(pct * 100)}%` : `${formatNumber(v.n)}/${formatNumber(v.goal)}`);
  setText(reward, rewardText);
  toggleClass(row, 'waiting', waiting);
  fill.style.width = `${(ratio * 100).toFixed(1)}%`;
  fits = waiting
    ? [
        { text: goalText, size: 15 },
        { text: goalText, size: 12 },
        { text: `누적 ${earned} P까지 모으면 열려요`, size: 12 },
        { text: `누적 ${earned} P를 모아요`, size: 12 },
        { text: `누적 ${earned} P를 모아요`, size: 12, tight: true },
      ]
    : [
        { text: goalText, size: 15 },
        { text: goalText, size: 12 },
        { text: goalText, size: 12, tight: true },
      ];
  fit();
}
