// WebAudio 합성 효과음(음원 파일 없음). 첫 사용자 입력 뒤에만 AudioContext를 만든다.
// 사용: sfx.tap(combo) / sfx.buy() / sfx.milestone() / sfx.move() / sfx.reward() / sfx.coin() / sfx.slam()
import { getPrefs } from './prefs';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unlocked = false;
let lastTap = 0;
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
  tap(combo: number): void {
    const now = performance.now();
    if (now - lastTap < 35) return;
    lastTap = now;
    const f = noteFreq(392, Math.min(combo, 20)) * pitch;
    tone(f, 0.11, 'triangle', 0.35, 0, f * 0.8);
    tone(f * 2, 0.05, 'sine', 0.12);
    noise(0.03, 0.12, 0, 3000);
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
  bundleUp(): void {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.16, 'triangle', 0.15, i * 0.06));
    tone(1760, 0.45, 'sine', 0.14, 0.34);
    noise(0.15, 0.08, 0.3, 4500);
  },
  perkFlip(i: number): void {
    tone(700 + i * 160, 0.07, 'triangle', 0.13);
    noise(0.04, 0.1, 0, 2500);
  },
  perkPick(): void {
    [659, 880, 1109, 1319].forEach((f, k) => tone(f, 0.2, 'square', 0.13, k * 0.07));
    tone(1760, 0.5, 'sine', 0.15, 0.3);
    noise(0.2, 0.1, 0.25, 5000);
  },
  contractEnd(): void {
    tone(784, 0.14, 'sine', 0.14);
    tone(587, 0.22, 'sine', 0.12, 0.12);
  },
  wrong(): void {
    tone(220, 0.25, 'sawtooth', 0.14, 0, 110);
    tone(165, 0.3, 'sawtooth', 0.12, 0.15, 90);
  },
};
