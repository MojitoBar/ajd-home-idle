// UI 글리프 8x8 15종. 문자 지도 → crispEdges SVG 사각형, 색은 currentColor. 화면 크기는 도트 1칸 = 2px(16px)가 기본.
const MAPS = {
  x: ['#......#', '.#....#.', '..#..#..', '...##...', '...##...', '..#..#..', '.#....#.', '#......#'],
  check: ['........', '.......#', '......##', '#....##.', '##..##..', '.####...', '..##....', '........'],
  lock: ['..####..', '.##..##.', '.#....#.', '########', '########', '###..###', '###..###', '########'],
  chevron: ['........', '........', '##....##', '.##..##.', '..####..', '...##...', '........', '........'],
  i: ['..####..', '..####..', '........', '..###...', '...##...', '...##...', '...##...', '..####..'],
  q: ['..####..', '.##..##.', '......##', '.....##.', '....##..', '...##...', '........', '...##...'],
  coin: ['..####..', '.######.', '###..###', '###..###', '###..###', '###..###', '.######.', '..####..'],
  ring: ['..####..', '.#....#.', '#......#', '#......#', '#......#', '#......#', '.#....#.', '..####..'],
  scroll: ['.######.', '#.####.#', '.######.', '..#..#..', '..#..#..', '.######.', '#.####.#', '.######.'],
  clock: ['..####..', '.#....#.', '#...#..#', '#...#..#', '#...##.#', '#......#', '.#....#.', '..####..'],
  star: ['...##...', '...##...', '########', '.######.', '..####..', '.##..##.', '.#....#.', '........'],
  plus: ['........', '...##...', '...##...', '.######.', '.######.', '...##...', '...##...', '........'],
  minus: ['........', '........', '........', '.######.', '.######.', '........', '........', '........'],
  soundOn: ['...#....', '..##..#.', '####...#', '####.#.#', '####.#.#', '####...#', '..##..#.', '...#....'],
  soundOff: ['...#....', '..##....', '####.#.#', '####..#.', '####.#.#', '####....', '..##....', '...#....'],
} as const;

export type GlyphName = keyof typeof MAPS;
export const GLYPH_NAMES = Object.keys(MAPS) as GlyphName[];

const NS = 'http://www.w3.org/2000/svg';

/** 같은 줄에서 이어진 칸은 사각형 하나로 합친다 */
function rects(name: GlyphName): string[][] {
  const out: string[][] = [];
  MAPS[name].forEach((row, y) => {
    let x = 0;
    while (x < 8) {
      if (row[x] !== '#') {
        x++;
        continue;
      }
      let w = 1;
      while (x + w < 8 && row[x + w] === '#') w++;
      out.push([String(x), String(y), String(w)]);
      x += w;
    }
  });
  return out;
}

export function glyphSvg(name: GlyphName, size = 16): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 8 8');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', `glyph glyph-${name}`);
  for (const [x, y, w] of rects(name)) {
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', x);
    r.setAttribute('y', y);
    r.setAttribute('width', w);
    r.setAttribute('height', '1');
    svg.append(r);
  }
  return svg;
}
