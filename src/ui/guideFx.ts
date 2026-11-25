// 가이드 단계 완료 연출: 완료 머리글(방 안 큰 글자 중재기) + 가이드 줄 번쩍임 + 보상 코인·토스트
// + 새로 열린 요소 주황 깜빡임/탭 알림 점 + 선물 상자 결과 장면 + 가이드 끝 머리글. app.ts의 onGuideStep이 부른다.
import type { GuideFeature, GuideResult } from '../logic/guide';
import { formatNumber } from '../logic/format';
import type { BoxResult } from '../logic/gacha';
import { el } from './dom';
import * as fx from './fx';
import { sfx } from './sound';
import { celebrateFlash, celebrateHold } from './guideUi';

export interface GuideFxHost {
  room: HTMLElement;
  /** 포인트가 모이는 표시(코인이 날아가는 곳) */
  pts(): Element;
  toast(msg: string, reward?: boolean): void;
  /** 탭 버튼에 알림 점 */
  tabDot(id: 'tap' | 'box'): void;
  /** 선물 상자 결과 장면. 이미 상자 장면이 떠 있으면 false */
  gifts(results: BoxResult[], title: string, onClose: () => void): boolean;
}

/** 열림 부제 칩에 쓰는 짧은 이름(방 폭 320에서도 한 줄에 든다) */
const OPEN_CHIP: Record<GuideFeature, string> = {
  combo: '콤보 열림',
  charge: '강타 게이지 열림',
  weak: '급소 열림',
  fever: '피버 열림',
  chain: '연쇄·오함마 열림',
  streak: '연속 배수 열림',
  special: '특별 상자 열림',
  gear: '영구 공구 열림',
  perkBox: '특전 상자 열림',
};

/** 열린 요소가 화면에 나타나는 자리. tab이 있으면 그 탭 안에 있어서, 안 보고 있으면 탭 버튼에 알림 점을 찍는다. 자리가 없으면(급소·특별 상자) 방 테두리 */
const OPEN_TARGET: Record<GuideFeature, { sel: string; tab?: 'tap' | 'box' }> = {
  combo: { sel: '.combo' },
  charge: { sel: '.charge' },
  weak: { sel: '.room' },
  fever: { sel: '.fever-gauge' },
  chain: { sel: '.strike-card', tab: 'tap' },
  streak: { sel: '.guard-row' },
  special: { sel: '.room' },
  gear: { sel: '.gear-card', tab: 'tap' },
  perkBox: { sel: '.perkbox-card', tab: 'box' },
};

/** 약 2초 동안 세 번 깜빡이며 나타난다(12fps 프레임) */
const BLINK = [1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1];

const SCENES = '.box-scene, .overlay, .move-scene';

/** 상자 장면·모달·이사 장면이 다 닫히면 실행한다(방 안 연출이 장면 뒤에서 헛돌지 않게). 15초가 넘으면 그냥 실행 */
function afterScenes(f: () => void): void {
  if (!document.querySelector(SCENES)) return f();
  let n = 0;
  const id = window.setInterval(() => {
    if (document.querySelector(SCENES) && ++n < 100) return;
    window.clearInterval(id);
    f();
  }, 150);
}

const roomK = (room: HTMLElement): number => (room.offsetWidth ? room.getBoundingClientRect().width / room.offsetWidth : 1);

/** 방 안 큰 글자 한 줄 + (있으면) 주황 부제 칩. `배율 xN 돌파!`와 같은 모양·같은 중재기 줄을 쓴다 */
function say(h: GuideFxHost, title: string, sub?: string): void {
  fx.headline(
    'notice',
    (end) => {
      const room = h.room;
      const e = el('div', { cls: 'un-home-say' }, el('b', { text: title }), ...(sub ? [el('i', { text: sub })] : []));
      e.style.top = `${fx.headTop(room, roomK(room))}px`;
      room.append(e);
      const fit = fx.fitHead(e, 'un-home-say', ['', 'long', 'xl'], room);
      const rm = (): void => {
        e.remove();
        end();
      };
      if (fx.isReduced()) {
        window.setTimeout(rm, 1400);
        return () => e.remove();
      }
      const f: Keyframe[] = [1.5, 1.35, 1.2, 1.1].map((sc) => ({ scale: String(Math.min(sc, fit)), visibility: 'visible' }));
      for (let i = 0; i < 30; i++) f.push({ scale: '1', visibility: 'visible' });
      for (let i = 0; i < 4; i++) f.push({ scale: '1', visibility: i % 2 ? 'visible' : 'hidden' });
      fx.pxFrames(e, f, 40).onfinish = rm;
      return () => e.remove();
    },
    { maxWait: 20000 },
  );
}

/** 새로 열린 요소: 주황 테두리 깜빡임 + 등장 팝. 이 탭에 안 보이면 탭 버튼에 알림 점 */
function highlight(h: GuideFxHost, f: GuideFeature): void {
  const t = OPEN_TARGET[f];
  const shown = (sel: string): HTMLElement | undefined => Array.from(document.querySelectorAll<HTMLElement>(sel)).find((n) => n.getBoundingClientRect().width > 0);
  // 자리가 지금 안 보이면(다른 탭 안, 콤보가 아직 없음 등) 탭이면 알림 점, 아니면 방 테두리로 대신한다
  const hit = shown(t.sel) ?? (t.tab ? undefined : h.room);
  if (!hit) {
    if (t.tab) h.tabDot(t.tab);
    return;
  }
  if (getComputedStyle(hit).position === 'static') hit.classList.add('g-open-target');
  if (!fx.isReduced()) {
    hit.classList.remove('ux-pop');
    void hit.offsetWidth;
    hit.classList.add('ux-pop');
    window.setTimeout(() => hit.classList.remove('ux-pop'), 300);
  }
  fx.edge(hit, 'or', BLINK);
  window.setTimeout(() => hit.classList.remove('g-open-target'), BLINK.length * 83 + 100);
  if (t.tab) h.tabDot(t.tab);
}

/** 단계 하나 완료(상태는 이미 다음 단계로 넘어감, 화면 갱신 전). update는 요소가 열린 뒤 부르는 화면 갱신 */
export function stepDone(h: GuideFxHost, r: GuideResult, no: number, update: () => void, label = `가이드 ${no}`): void {
  celebrateHold();
  update();
  afterScenes(() => {
    celebrateFlash();
    sfx.milestone();
    say(h, `${label} 완료!`, r.opened ? OPEN_CHIP[r.opened] : undefined);
    if (r.opened) {
      window.setTimeout(() => {
        sfx.newItem();
        highlight(h, r.opened!);
      }, 350);
    }
    if (r.reward > 0) {
      h.toast(`+${formatNumber(r.reward)} P`, true);
      const rr = h.room.getBoundingClientRect();
      fx.coinShower({ x: rr.left + rr.width / 2, y: rr.top + rr.height * 0.6 }, h.pts(), 12);
    } else if (r.rewardBoxes > 0) {
      giftSoon(h, r.boxResults, `선물 상자 ${r.rewardBoxes}개`, 1400, 0);
    }
  });
}

/** 선물 상자 결과 장면: 머리글이 한 번 보인 뒤(1.4초) 연다. 다른 장면이 떠 있으면 0.4초마다 다시 시도(최대 20번). 떠 있는 동안 방 머리글은 붙잡아 두었다가 닫히면 이어서 보여 준다 */
function giftSoon(h: GuideFxHost, results: BoxResult[], title: string, ms: number, tries: number): void {
  window.setTimeout(() => {
    const ok = h.gifts(results, title, () => fx.headHold(false));
    if (ok) fx.headHold(true);
    else if (tries < 20) giftSoon(h, results, title, 400, tries + 1);
  }, ms);
}

/** 가이드 끝(첫 이사 연출이 끝난 뒤): 크게 한 번 */
export function guideEnd(h: GuideFxHost, part2 = false): void {
  sfx.milestone();
  if (part2) say(h, '가이드 끝!', '이제 우주 끝까지 가 보세요');
  else say(h, '가이드 완료!', '이제 전부 열렸어요');
  const rr = h.room.getBoundingClientRect();
  if (!fx.isReduced()) fx.burst(rr.left + rr.width / 2, rr.top + rr.height * 0.4, { n: 14, kind: 'star', colors: ['#ff8a1f', '#ffc83d', '#ffffff'], size: 8, speed: 220, gravity: 0, life: 0.5 });
}
