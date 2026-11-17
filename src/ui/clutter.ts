// 디버그(?debug): 지금 화면에 보이는 방 안 글자 상자 목록. 겹침 자동 판정(tools/clutter-shots.cjs)이 쓴다.
export interface TextBox {
  kind: 'head' | 'chain' | 'toast' | 'tip' | 'gauge' | 'streak' | 'combo' | 'fever' | 'rush' | 'gain' | 'float';
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const SOURCES: Array<{ kind: TextBox['kind']; sel: string; tight: boolean }> = [
  { kind: 'head', sel: '.charge-say, .weak-say, .fx-banner.in-room, .un-chain-prize, .un-gold-head, .un-home-say', tight: true },
  { kind: 'chain', sel: '.un-chain > *', tight: true },
  { kind: 'toast', sel: '.toast', tight: false },
  { kind: 'tip', sel: '.first-tip', tight: false },
  { kind: 'gauge', sel: '.charge', tight: false },
  { kind: 'streak', sel: '.streak-chip, .shield', tight: false },
  { kind: 'combo', sel: '.combo.on > *', tight: true },
  { kind: 'fever', sel: '.fever-tag:not(.blank)', tight: false },
  { kind: 'rush', sel: '.rush-tag', tight: false },
  { kind: 'gain', sel: '.un-gain', tight: true },
  { kind: 'float', sel: '.fx-float', tight: true },
];

function visible(e: HTMLElement): boolean {
  for (let n: HTMLElement | null = e; n; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
  }
  return e.getClientRects().length > 0;
}

export function textBoxes(): TextBox[] {
  const out: TextBox[] = [];
  for (const s of SOURCES) {
    for (const e of Array.from(document.querySelectorAll<HTMLElement>(s.sel))) {
      if (!visible(e)) continue;
      let r: DOMRect;
      let y = 0;
      let h = 0;
      if (s.tight) {
        const range = document.createRange();
        range.selectNodeContents(e);
        r = range.getBoundingClientRect();
        // 글꼴 상자는 줄 높이보다 커서, 줄 높이만큼만(가운데 기준) 본다
        const lh = parseFloat(getComputedStyle(e).lineHeight);
        const scale = e.offsetHeight ? e.getBoundingClientRect().height / e.offsetHeight : 1;
        h = lh > 0 && r.height > lh * scale ? lh * scale : r.height;
        y = r.top + (r.height - h) / 2;
      } else {
        r = e.getBoundingClientRect();
        y = r.top;
        h = r.height;
      }
      if (r.width <= 0 || h <= 0) continue;
      out.push({ kind: s.kind, text: (e.textContent ?? '').trim(), x: Math.round(r.left), y: Math.round(y), w: Math.round(r.width), h: Math.round(h) });
    }
  }
  return out;
}
