// WebAudio 합성 효과음(음원 파일 없음). 첫 사용자 입력 뒤에만 AudioContext를 만든다.
// 사용: sfx.tap(combo) / sfx.buy() / sfx.milestone() / sfx.move() / sfx.reward() / sfx.coin() / sfx.slam()
import { getPrefs } from './prefs';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unlocked = false;
let lastTap = 0;
let lastRush = 0;
let lastCoin = 0;
let pitch = 1;

function create(): void {
  if (ctx) return;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.45;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
}

function unlock(): void {
  unlocked = true;
  create();
  if (ctx && ctx.state === 'suspended') void ctx.resume();
}
for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
  window.addEventListener(ev, unlock, { capture: true, passive: true });
}

function ready(): AudioContext | null {
  if (!unlocked || !getPrefs().sound) return null;
  create();
  if (ctx && ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, slideTo?: number): void {
  const c = ready();
  if (!c || !master) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, delay = 0, freq = 1800): void {
  const c = ready();
  if (!c || !master) return;
  const t = c.currentTime + delay;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource();
  s.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = vol;
  s.connect(f).connect(g).connect(master);
  s.start(t);
}

const PENTA = [0, 2, 4, 7, 9];
function noteFreq(base: number, step: number): number {
  const oct = Math.floor(step / 5);
  return base * 2 ** (oct + PENTA[((step % 5) + 5) % 5] / 12);
}

export const sfx = {
  /** 피버 중 탭 음높이 배율(1이면 평소) */
  setPitch(v: number): void {
    pitch = v;
  },
  crit(): void {
    tone(110, 0.32, 'sawtooth', 0.4, 0, 40);
    tone(330, 0.16, 'square', 0.2, 0, 660);
    tone(990, 0.3, 'sine', 0.16, 0.05);
    noise(0.14, 0.3, 0, 1200);
  },
  feverStart(): void {
    tone(120, 0.4, 'sine', 0.45, 0, 50);
    [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, 'square', 0.14, 0.05 + i * 0.06));
    tone(1568, 0.6, 'sine', 0.16, 0.42);
    noise(0.3, 0.14, 0.3, 5000);
  },
  feverEnd(): void {
    tone(660, 0.25, 'triangle', 0.14, 0, 330);
    tone(440, 0.35, 'triangle', 0.12, 0.12, 220);
  },
  parcelAppear(): void {
    tone(1047, 0.1, 'sine', 0.14);
    tone(1319, 0.16, 'sine', 0.14, 0.1);
  },
  parcelCatch(): void {
    noise(0.12, 0.22, 0, 2500);
    tone(180, 0.15, 'sine', 0.3, 0, 70);
  },
  /** step: 콤보가 정한 음 계단(0~14). 피버 음정(pitch)과 곱해진다 */
  tap(step: number): void {
    const now = performance.now();
    if (now - lastTap < 35) return;
    lastTap = now;
    const f = noteFreq(392, Math.min(step, 14)) * pitch;
    tone(f, 0.11, 'triangle', 0.35, 0, f * 0.8);
    tone(f * 2, 0.05, 'sine', 0.12);
    noise(0.03, 0.12, 0, 3000);
  },
  /** 모으는 동안 표시 위치(0~1)가 높을수록 음이 올라간다. 퍼펙트 구간이면 한 옥타브 위 */
  chargeTick(pos: number, inPerfect: boolean): void {
    const f = 260 + pos * 520;
    tone(inPerfect ? f * 2 : f, 0.06, 'square', inPerfect ? 0.1 : 0.07);
  },
  /** 강타 판정: 퍼펙트는 묵직한 쾅 + 올라가는 화음, 굿은 중간, 빗나감은 낮은 툭 */
  strike(grade: 'perfect' | 'good' | 'miss', streak: number): void {
    if (grade === 'miss') {
      tone(140, 0.14, 'sine', 0.3, 0, 70);
      noise(0.06, 0.12, 0, 700);
      return;
    }
    if (grade === 'good') {
      tone(120, 0.24, 'sawtooth', 0.34, 0, 50);
      noise(0.12, 0.24, 0, 1500);
      [523, 659, 784].forEach((f, i) => tone(f, 0.14, 'square', 0.14, 0.04 + i * 0.05));
      return;
    }
    const up = 2 ** (Math.min(streak, 18) / 12);
    tone(80, 0.5, 'sawtooth', 0.5, 0, 32);
    tone(150, 0.3, 'sine', 0.5, 0, 50);
    noise(0.26, 0.36, 0, 1100);
    noise(0.2, 0.2, 0.05, 5000);
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f * up, 0.2, 'square', 0.15, 0.06 + i * 0.05));
    tone(2093 * up, 0.5, 'sine', 0.14, 0.34);
  },
  /** 배수 칩이 깨짐: 낮은 툭 + 부서지는 소리 */
  streakBreak(): void {
    tone(110, 0.2, 'square', 0.22, 0, 55);
    noise(0.12, 0.18, 0, 1200);
  },
  /** 안전모가 연속을 막음: 아주 낮은 쿵 + 깨지는 소리 + 쇳소리 두 음 */
  shieldSave(): void {
    tone(70, 0.5, 'sawtooth', 0.55, 0, 28);
    tone(190, 0.22, 'square', 0.3, 0, 60);
    noise(0.3, 0.4, 0, 2600);
    noise(0.16, 0.22, 0.06, 6000);
    tone(880, 0.16, 'square', 0.16, 0.08);
    tone(1320, 0.3, 'square', 0.14, 0.15);
  },
  /** 배율 돌파: 짧은 팡 (올라가는 세 음 + 짧은 바람 소리) */
  breakthrough(): void {
    tone(392, 0.08, 'square', 0.16);
    tone(784, 0.1, 'square', 0.16, 0.06);
    tone(1568, 0.22, 'square', 0.14, 0.12);
    noise(0.12, 0.18, 0, 5200);
  },
  /** 안전모 칸이 참 / 새로 얻음: 짧은 두 음 */
  shieldGain(): void {
    tone(880, 0.07, 'square', 0.13);
    tone(1760, 0.14, 'square', 0.13, 0.07);
  },
  /** 열기가 달아오름에 들어섬: 올라가는 세 음 */
  heatUp(): void {
    [523, 659, 880].forEach((f, i) => tone(f, 0.09, 'square', 0.12, i * 0.05));
  },
  /** 과열 임박 경고: 짧은 두 음 */
  heatWarn(): void {
    tone(880, 0.04, 'square', 0.1);
    tone(660, 0.04, 'square', 0.1, 0.05);
  },
  /** 과열 시작: 김 빠지는 쉬익 + 내려가는 음 */
  heatOver(): void {
    noise(0.5, 0.3, 0, 3200);
    tone(330, 0.4, 'sawtooth', 0.18, 0, 90);
  },
  /** 과열이 끝남: 딩 */
  heatBack(): void {
    tone(1319, 0.14, 'sine', 0.14);
    tone(1760, 0.26, 'sine', 0.12, 0.08);
  },
  /** 급소가 뜸: 짧고 밝은 두 음 */
  weakAppear(): void {
    tone(1568, 0.05, 'square', 0.1);
    tone(2093, 0.07, 'square', 0.1, 0.05);
  },
  /** 급소 명중: 날카로운 쨍 + 묵직한 쾅 */
  weakHit(): void {
    tone(90, 0.3, 'sawtooth', 0.45, 0, 40);
    noise(0.14, 0.3, 0, 4500);
    [1047, 1568, 2093].forEach((f, i) => tone(f, 0.12, 'square', 0.16, i * 0.035));
    tone(2637, 0.3, 'sine', 0.14, 0.12);
  },
  /** 연쇄 j번째(0부터) 터짐: 한 단계씩 올라가는 짧은 음(12단계에서 상한) */
  chainStep(j: number): void {
    const f = noteFreq(440, Math.min(j, 12)) * pitch;
    tone(f, 0.07, 'square', 0.14);
    noise(0.03, 0.1, 0, 2800);
  },
  /** 연쇄 마무리: 쾅 + 올라가는 화음. tier 0~3(상금이 클수록 길고 높다) */
  chainEnd(tier: number): void {
    const t = Math.max(0, Math.min(tier, 3));
    tone(130, 0.22 + t * 0.05, 'sawtooth', 0.3, 0, 45);
    noise(0.14 + t * 0.04, 0.2, 0, 1800 + t * 800);
    [523, 659, 784, 1047].slice(0, 2 + t).forEach((f, i) => tone(f * pitch, 0.2 + t * 0.04, 'square', 0.15, 0.04 + i * 0.06));
    if (t >= 2) tone(1568 * pitch, 0.5, 'sine', 0.16, 0.35);
  },
  /** 콤보 단계 오름: 단계가 높을수록 음이 높고 길다 */
  comboUp(tier: number): void {
    const t = Math.max(1, Math.min(tier, 5));
    const base = 523 * pitch;
    const n = 2 + t;
    for (let i = 0; i < n; i++) tone(noteFreq(base, i + t), 0.1 + t * 0.02, 'square', 0.16, i * 0.055);
    if (t >= 2) {
      tone(110 + t * 20, 0.2 + t * 0.05, 'sawtooth', 0.28, 0, 50);
      noise(0.1 + t * 0.03, 0.18, 0, 1500 + t * 500);
    }
    if (t >= 4) tone(noteFreq(base, n + t) * 2, 0.5, 'sine', 0.16, n * 0.055);
  },
  /** 콤보 정산: 쾅 내려앉는 소리 */
  comboEnd(tier: number): void {
    tone(130, 0.22, 'sawtooth', 0.34, 0, 45);
    noise(0.12, 0.22, 0, 900);
    tone(784 + tier * 60, 0.14, 'square', 0.14, 0.12);
  },
  coin(): void {
    const now = performance.now();
    if (now - lastCoin < 70) return;
    lastCoin = now;
    tone(1568, 0.09, 'sine', 0.12);
    tone(2093, 0.12, 'sine', 0.09, 0.04);
  },
  buy(): void {
    tone(660, 0.1, 'square', 0.14);
    tone(990, 0.18, 'square', 0.14, 0.08);
    tone(1980, 0.25, 'sine', 0.1, 0.1);
  },
  milestone(): void {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'square', 0.14, i * 0.08));
    tone(1568, 0.5, 'sine', 0.16, 0.34);
    noise(0.25, 0.1, 0.3, 5000);
  },
  slam(): void {
    tone(140, 0.28, 'sine', 0.5, 0, 45);
    noise(0.12, 0.25, 0, 900);
  },
  move(): void {
    tone(70, 0.9, 'sawtooth', 0.12, 0.1, 110);
    tone(300, 0.18, 'square', 0.1, 0.55);
    tone(400, 0.28, 'square', 0.1, 0.72);
    [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.16, 1.5 + i * 0.07));
  },
  reward(): void {
    [523, 659, 784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.2, 'triangle', 0.15, i * 0.07));
  },
  ready(): void {
    tone(880, 0.12, 'sine', 0.2);
    tone(1320, 0.2, 'sine', 0.2, 0.1);
  },
  title(): void {
    tone(330, 0.5, 'sawtooth', 0.1, 0, 990);
    tone(1320, 0.4, 'sine', 0.14, 0.3);
  },
  boxShake(level: number): void {
    tone(90 + level * 35, 0.09, 'square', 0.12);
    noise(0.05, 0.1 + level * 0.03, 0, 600 + level * 400);
  },
  boxBurst(tier: number): void {
    noise(0.18 + tier * 0.05, 0.25, 0, 3000 + tier * 1500);
    tone(220, 0.2, 'sine', 0.35, 0, 70);
    const notes = [[784], [659, 988], [523, 659, 784, 1047], [523, 659, 784, 1047, 1319], [523, 659, 784, 1047, 1319, 1568, 2093]][Math.min(tier, 4)];
    notes.forEach((f, i) => tone(f, 0.22 + tier * 0.05, tier >= 3 ? 'square' : 'triangle', 0.14, 0.05 + i * 0.07));
    if (tier >= 3) tone(1568, 0.7, 'sine', 0.16, 0.45);
    if (tier >= 4) noise(0.5, 0.12, 0.4, 6000);
  },
  /** 황금 상자 터짐: 밝게 올라가는 네 음 + 반짝 꼬리 */
  goldBurst(): void {
    tone(260, 0.16, 'sine', 0.3, 0, 90);
    [784, 1047, 1319, 1568].forEach((f, i) => tone(f * pitch, 0.18, 'square', 0.14, 0.03 + i * 0.06));
    tone(2093 * pitch, 0.5, 'sine', 0.14, 0.28);
    noise(0.12, 0.14, 0.02, 6000);
  },
  /** 시계 상자 터짐: 째깍-째깍-딩 */
  clockBurst(): void {
    tone(1568 * pitch, 0.05, 'square', 0.16, 0);
    tone(1175 * pitch, 0.05, 'square', 0.16, 0.1);
    tone(1568 * pitch, 0.05, 'square', 0.16, 0.2);
    tone(2349 * pitch, 0.45, 'sine', 0.2, 0.3);
    noise(0.04, 0.1, 0, 5000);
  },
  /** 러시 탭 한 번(초당 10번): 아주 짧고 작은 틱. 기존 탭 소리보다 작다 */
  rushTick(): void {
    const now = performance.now();
    if (now - lastRush < 70) return;
    lastRush = now;
    tone(1760 * pitch, 0.02, 'square', 0.05, 0);
  },
  /** 폭탄 상자 터짐: 낮은 쿵 + 거친 잡음 */
  bombBlast(): void {
    tone(70, 0.4, 'sawtooth', 0.5, 0, 28);
    tone(140, 0.2, 'square', 0.22, 0, 50);
    noise(0.35, 0.4, 0, 1400);
    noise(0.15, 0.2, 0.05, 4000);
  },
  newItem(): void {
    tone(988, 0.1, 'sine', 0.16);
    tone(1480, 0.2, 'sine', 0.16, 0.08);
  },
  eventAlert(): void {
    tone(880, 0.12, 'square', 0.12);
    tone(1175, 0.12, 'square', 0.12, 0.13);
    tone(880, 0.12, 'square', 0.12, 0.26);
  },
  stamp(): void {
    tone(95, 0.22, 'sine', 0.5, 0, 45);
    noise(0.1, 0.3, 0, 1500);
    tone(660, 0.1, 'square', 0.1, 0.06);
    tone(880, 0.16, 'square', 0.1, 0.14);
  },
  perkFlip(i: number): void {
    tone(700 + i * 160, 0.07, 'triangle', 0.13);
    noise(0.04, 0.1, 0, 2500);
  },
  /** 카드 착지(고르기 창 등장) */
  cardDeal(i: number): void {
    tone(200 + i * 30, 0.07, 'triangle', 0.12, 0, 120);
    noise(0.04, 0.08, 0, 1200);
  },
  /** 카드 뒤집힘(앞면이 나오는 순간). 희귀도가 높을수록 길고 높다 */
  cardReveal(rarity: 'common' | 'rare' | 'legend', i: number): void {
    if (rarity === 'legend') {
      [784, 988, 1175, 1568].forEach((f, k) => tone(f, 0.16, 'square', 0.13, k * 0.06));
      tone(2093, 0.45, 'sine', 0.14, 0.24);
      noise(0.2, 0.1, 0.1, 5000);
    } else if (rarity === 'rare') {
      [988, 1319].forEach((f, k) => tone(f, 0.12, 'square', 0.12, k * 0.05));
      tone(1976, 0.22, 'sine', 0.1, 0.1);
      noise(0.08, 0.08, 0, 4500);
    } else {
      tone(880 + i * 110, 0.08, 'square', 0.1);
      noise(0.05, 0.08, 0, 4000);
    }
  },
  /** 고른 카드가 칸에 꽂힘 */
  cardSlot(): void {
    tone(220, 0.1, 'square', 0.14, 0, 110);
    noise(0.06, 0.12, 0, 2500);
    tone(1319, 0.14, 'square', 0.1, 0.06);
  },
  perkPick(): void {
    [659, 880, 1109, 1319].forEach((f, k) => tone(f, 0.2, 'square', 0.13, k * 0.07));
    tone(1760, 0.5, 'sine', 0.15, 0.3);
    noise(0.2, 0.1, 0.25, 5000);
  },
  wrong(): void {
    tone(220, 0.25, 'sawtooth', 0.14, 0, 110);
    tone(165, 0.3, 'sawtooth', 0.12, 0.15, 90);
  },
};
