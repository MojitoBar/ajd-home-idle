// "모르면 손해" 이벤트 화면: 상담 요청 배너, 두 요금제 카드 모달, 결과 해설, 배율 배지.
import { eventMult } from '../logic/economy';
import { clearEventResult, EVENT_MULT, EVENT_QUESTION_SEC, startQuestion, answerQuestion } from '../logic/event';
import { formatDuration } from '../logic/format';
import type { CardId, EventQuestion, EventResult } from '../logic/state';
import { el } from './dom';
import { iconImg } from './icons';
import * as fx from './fx';
import { sfx } from './sound';
import { vibrate } from './prefs';
import type { UiCtx } from './collectUi';

let ctx: UiCtx;
let prevBanner = false;
let timerFill: HTMLElement | null = null;
let timerText: HTMLElement | null = null;

export const badgeEl = el('span', { cls: 'badge event-badge', attrs: { hidden: '' } });
export const callBtn = el('button', { cls: 'event-call', attrs: { type: 'button', hidden: '' } });
const callText = el('span', { cls: 'event-call-text' });
callBtn.append(iconImg('ui-event', { size: 32, cls: 'event-call-ico' }), callText, el('i', { cls: 'dot' }));

export function initEvent(c: UiCtx): void {
  ctx = c;
  callBtn.addEventListener('click', onCall);
}

function onCall(): void {
  const next = startQuestion(ctx.get(), () => Math.random());
  if (!next?.event.question) return;
  ctx.set(next);
  showQuestion(next.event.question);
  ctx.update();
}

const cardKind = (id: CardId): string => (id === 'A' ? '고정형' : '할인형');

function cardBody(q: EventQuestion, id: CardId): Node[] {
  if (id === 'A') return [el('div', { cls: 'plan-line big', text: `월 ${q.fixedMonthly}콩` })];
  return [
    el('div', { cls: 'plan-line', text: `처음 ${q.promoMonths}개월` }),
    el('div', { cls: 'plan-line big', text: `월 ${q.promoFirst}콩` }),
    el('div', { cls: 'plan-line', text: '그 뒤로는' }),
    el('div', { cls: 'plan-line big', text: `월 ${q.promoAfter}콩` }),
  ];
}

function showQuestion(q: EventQuestion): void {
  timerFill = el('div', { cls: 'q-fill' });
  timerText = el('span', { cls: 'q-time', text: `${EVENT_QUESTION_SEC}초` });
  const cards = q.order.map((id) => {
    const b = el('button', { cls: `plan-card plan-${id}`, attrs: { type: 'button' } }, el('div', { cls: 'plan-title fb', text: `요금제 ${id}` }), el('div', { cls: 'plan-kind', text: cardKind(id) }), ...cardBody(q, id));
    b.addEventListener('click', () => choose(id, b));
    return b;
  });
  ctx.showModal(
    '모르면 손해!',
    [
      el('p', { cls: 'q-ask' }, el('b', { text: `${q.months}개월` }), ' 쓴다면 ', el('b', { text: '총액이 더 싼' }), ' 쪽은?'),
      el('div', { cls: 'q-timer' }, el('div', { cls: 'q-bar' }, timerFill), timerText),
      el('div', { cls: 'plan-row' }, ...cards),
      el('p', { cls: 'note dim', text: '콩은 게임 속 가상 단위예요. 머리로 계산해 봐요.' }),
    ],
    [],
    { noClose: true, cls: 'quiz', icon: iconImg('ui-event', { size: 32, cls: 'title-ico' }) },
  );
  sfx.ready();
}

function choose(id: CardId, btn: HTMLElement): void {
  const next = answerQuestion(ctx.get(), id, () => Math.random());
  if (!next) return;
  btn.classList.add('picked');
  ctx.set(next);
  syncEvent();
  ctx.update();
}

function showResult(r: EventResult, streak: number): void {
  timerFill = null;
  timerText = null;
  const verdict = r.correct ? '정답' : r.timedOut ? '시간 초과' : '아쉬워요';
  const ansName = r.answer === 'A' ? 'A(고정형)' : 'B(할인형)';
  const body: Node[] = [];
  if (r.correct) {
    body.push(
      el('p', { cls: 'res-big win', text: `수익 x${EVENT_MULT}!` }),
      el('p', { text: `${formatDuration(r.rewardSec)} 동안 모든 수익 x${EVENT_MULT}` }),
    );
    if (streak > 1) body.push(el('p', { cls: 'res-streak', text: `연속 정답 ${streak}회 · 지속 시간이 늘었어요` }));
  } else {
    body.push(el('p', { text: r.timedOut ? `시간이 지났어요. 정답은 ${ansName}예요.` : `정답은 ${ansName}예요.` }));
  }
  const resCard = (id: CardId): HTMLElement =>
    el('div', { cls: `plan-card static${r.choice === id ? ' mine' : ''}${r.answer === id ? ' right' : ''}` }, el('div', { cls: 'plan-title fb', text: `요금제 ${id}` }), el('div', { cls: 'plan-kind', text: cardKind(id) }), el('div', { cls: 'plan-line', text: '총액' }), el('div', { cls: 'plan-line big', text: `${id === 'A' ? r.totalA : r.totalB}콩` }));
  body.push(
    el('div', { cls: 'plan-row' }, resCard('A'), resCard('B')),
    el('p', { cls: 'dim small', text: '첫 달 가격만 보면 헷갈려요. 총액으로 비교해요.' }),
  );
  ctx.showModal(verdict, body, [{ label: '확인', ...(r.correct ? { reward: true } : { primary: true }), onClick: () => { ctx.dismissModal(); } }], { chip: r.correct ? '보상' : undefined, cls: 'quiz', icon: iconImg(r.correct ? 'fever' : 'ui-event', { size: 32, cls: 'title-ico' }) });
  const modal = document.querySelector('.modal') as HTMLElement | null;
  if (r.correct) {
    const big = modal?.querySelector('.res-big');
    if (big) fx.pxFrames(big, [{ transform: 'translateY(-16px)' }, { transform: 'translateY(-24px)' }, { transform: 'translateY(-8px)' }, { transform: 'translateY(0)' }, { transform: 'translateY(-4px)' }, { transform: 'translateY(0)' }], 83);
    fx.flash('#ffc83d', 500);
    fx.confetti(window.innerWidth / 2, window.innerHeight * 0.55, 40);
    fx.burst(window.innerWidth / 2, window.innerHeight * 0.5, { n: 10, kind: 'star', colors: ['g2', 'g3', 'k5'], speed: 280, size: 8, gravity: 200 });
    sfx.reward();
    vibrate([20, 30, 40]);
  } else {
    fx.flash('#e9304b', 300);
    if (modal) fx.shake(modal, 4, 420);
    sfx.wrong();
    vibrate(40);
  }
}

/** 매 프레임 호출. 배너/배지/모달 타이머/결과를 상태에서 읽어 표시한다. */
export function syncEvent(): void {
  const s = ctx.get();
  const ev = s.event;
  const mult = eventMult(s);
  const on = mult > 1 && ev.remainSec > 0;
  if (badgeEl.hidden === on) badgeEl.hidden = !on;
  if (on) {
    const t = `수익 x${mult} ${formatClock(ev.remainSec)}`;
    if (badgeEl.textContent !== t) badgeEl.textContent = t;
    badgeEl.classList.toggle('ending', ev.remainSec <= 10);
  }

  const showCall = ev.bannerSec > 0 && !ev.question;
  if (callBtn.hidden === showCall) callBtn.hidden = !showCall;
  if (showCall) {
    const t = `상담 요청이 왔어요 ${Math.ceil(ev.bannerSec)}초`;
    if (callText.textContent !== t) callText.textContent = t;
    callBtn.classList.toggle('urgent', ev.bannerSec <= 6);
  }
  if (showCall && !prevBanner) {
    sfx.eventAlert();
    vibrate([15, 40, 15]);
    fx.bounce(callBtn, 0.8);
  }
  prevBanner = showCall;

  if (ev.question && timerFill && timerText) {
    const left = Math.max(0, ev.questionSec);
    const barW = timerFill.parentElement?.clientWidth ?? 0;
    timerFill.style.width = `${Math.floor((barW * left) / EVENT_QUESTION_SEC / 2) * 2}px`;
    timerFill.classList.toggle('low', left <= 5);
    const t = `${Math.ceil(left)}초`;
    if (timerText.textContent !== t) timerText.textContent = t;
  }
  if (ev.result) {
    const r = ev.result;
    ctx.set(clearEventResult(s));
    showResult(r, ev.streak);
  }
}

function formatClock(sec: number): string {
  const t = Math.max(0, Math.ceil(sec));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}
