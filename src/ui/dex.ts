// 도감 탭: 종 x 변종 80칸(한 줄 4칸). 미등록은 k3 실루엣.
import { COLLECTIBLES, RARITIES, VARIANTS, type CollectibleDef, type Variant } from '../data/collectibles';
import { formatNumber } from '../logic/format';
import { collectionProgress } from '../logic/gacha';
import { SLOT_LEVEL_NEED, setProgress, slotLevel, slotNextNeed } from '../logic/collection';
import { el, glyph } from './dom';
import { iconImg } from './icons';
import { fresh, collectibleImg, levelDots, levelRatio, levelText, setRow, variantChip, variantMark, PAL, RARITY_COLOR, rarityName, variantName, type UiCtx } from './collectUi';
import * as fx from './fx';
import { sfx } from './sound';

let ctx: UiCtx;
let sig = '';
export const panel = el('div', { cls: 'panel-inner dex-panel' });
const head = el('div', { cls: 'dex-head' });
const sets = el('div', { cls: 'dex-sets', attrs: { id: 'dex-sets' } });
const grid = el('div', { cls: 'dex-grid' });

export function initDex(c: UiCtx): void {
  ctx = c;
  panel.append(head, sets, grid, el('p', { cls: 'note dim', text: '칸을 누르면 자세히 볼 수 있어요. 등록한 칸마다 수익 배율이 올라요. 같은 칸이 쌓이면 레벨이 올라 더 많이 올라요. 이사해도 도감과 세트 효과는 그대로예요.' }));
}

const count = (id: string, v: Variant): number => ctx.get().collection[id]?.[v] ?? 0;

export function renderDex(playFresh = false): void {
  const s = ctx.get();
  const prog = collectionProgress(s);
  sig = `${s.stats.boxesOpened}|${prog.registered}`;
  head.replaceChildren(
    el(
      'div',
      { cls: 'dex-main' },
      el('b', { cls: 'dex-prog', text: `${prog.registered}/${prog.total}` }),
      el('span', { cls: 'dex-mult', text: `도감 배율 x${formatNumber(prog.mult)}` }),
    ),
    el('div', { cls: 'dex-bar' }, el('div', { cls: 'dex-bar-fill' })),
    el(
      'div',
      { cls: 'dex-rars' },
      ...prog.byRarity.map((r) => {
        const e = el('span', { cls: 'dex-rar', text: `${r.name} ${r.registered}/${r.total}` });
        e.style.setProperty('--rc', RARITY_COLOR[r.rarity]);
        return e;
      }),
    ),
  );
  const sp = setProgress(s.collection);
  const body = el('div', { cls: 'dex-sets-body', attrs: { id: 'dex-sets-body' } }, ...sp.map((x) => setRow(x)), el('p', { cls: 'note dim', text: '한 등급의 모든 종을 변종과 상관없이 하나씩 모으면 켜져요.' }));
  const toggle = el('button', { cls: 'pf dex-sets-toggle', attrs: { type: 'button', 'aria-expanded': 'false', 'aria-controls': 'dex-sets-body' } }, el('b', { text: `세트 효과 ${sp.filter((x) => x.done).length}/${sp.length} 켜짐` }), glyph('chevron'));
  toggle.addEventListener('click', () => {
    const open = sets.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  sets.classList.remove('open');
  sets.replaceChildren(toggle, body);
  (head.querySelector('.dex-bar-fill') as HTMLElement).style.width = `${((prog.registered / prog.total) * 100).toFixed(1)}%`;

  const nodes: Node[] = [el('div', { cls: 'dex-cols' }, ...VARIANTS.map((v) => el('span', { cls: 'vm-lab' }, variantMark(v.id) ?? el('i', { cls: 'vmark vm-base', attrs: { 'aria-hidden': 'true' } }), v.name)))];
  const sparkles: HTMLElement[] = [];
  for (const r of RARITIES) {
    const list = COLLECTIBLES.filter((c) => c.rarity === r.id);
    const have = list.reduce((a, c) => a + VARIANTS.filter((v) => count(c.id, v.id) > 0).length, 0);
    const title = el('div', { cls: 'dex-sec' }, el('span', { text: r.name }), el('span', { cls: 'dex-sec-n', text: `${have}/${list.length * VARIANTS.length}` }));
    title.style.setProperty('--rc', RARITY_COLOR[r.id]);
    nodes.push(title);
    for (const c of list) {
      const owned = VARIANTS.some((v) => count(c.id, v.id) > 0);
      const sp = el('div', { cls: 'dex-sp' }, el('div', { cls: `dex-name${owned ? '' : ' none'}`, text: owned ? c.name : '???' }));
      const row = el('div', { cls: 'dex-row' });
      for (const v of VARIANTS) {
        const n = count(c.id, v.id);
        const cell = el('button', { cls: `pf dex-cell cv-${v.id}${n > 0 ? ' got' : ''}`, attrs: { type: 'button', 'aria-label': n > 0 ? `${c.name} ${variantName(v.id)}, ${levelText(n)}, 보유 ${n}개` : `${owned ? c.name : '???'} ${variantName(v.id)}, 미발견` } });
        cell.style.setProperty('--rc', RARITY_COLOR[c.rarity]);
        cell.append(collectibleImg(c, v.id, 'mid', n === 0));
        const mark = variantMark(v.id);
        if (mark) {
          mark.classList.add('dex-chip');
          cell.append(mark);
        }
        if (n > 0) {
          cell.append(levelDots(n));
          if (playFresh && fresh.has(`${c.id}:${v.id}`)) {
            cell.classList.add('fresh');
            cell.append(el('span', { cls: 'col-chip cc-new', text: '새로 얻음' }));
            sparkles.push(cell);
          }
        } else cell.append(el('span', { cls: 'dex-q', text: '미발견' }));
        cell.addEventListener('click', () => detail(c, v.id));
        row.append(cell);
      }
      sp.append(row);
      nodes.push(sp);
    }
  }
  grid.replaceChildren(...nodes);
  if (playFresh && sparkles.length) {
    fresh.clear();
    sfx.newItem();
    sparkles.slice(0, 6).forEach((cell, i) =>
      window.setTimeout(() => {
        const rc = cell.getBoundingClientRect();
        fx.burst(rc.left + rc.width / 2, rc.top + rc.height / 2, { n: 8, kind: 'star', colors: [PAL.k5, PAL.g3], speed: 110, gravity: 60, size: 4 });
      }, i * 140),
    );
    if (sparkles[0]) sparkles[0].scrollIntoView({ block: 'center', behavior: 'auto' });
  }
}

export function updateDex(): void {
  const s = ctx.get();
  if (sig !== `${s.stats.boxesOpened}|${collectionProgress(s).registered}`) renderDex();
}

function detailState(v: Variant, n: number): HTMLElement[] {
  const lv = slotLevel(n);
  const maxed = slotNextNeed(n) === 0;
  const vchip = variantChip(v) ?? el('span', { cls: 'col-chip cc-base', text: variantName(v) });
  const fill = el('i');
  fill.style.width = `${Math.round(levelRatio(n) * 100)}%`;
  return [
    el('div', { cls: 'det-line' }, vchip, el('span', { text: `보유 ${n}개` })),
    el(
      'div',
      { cls: 'det-line' },
      el('span', { cls: 'col-chip cc-lv', text: maxed ? `Lv ${lv} MAX` : `Lv ${lv}` }),
      maxed ? el('span', { text: '더 올릴 수 없어요' }) : el('span', { text: `다음 레벨까지 ${n}/${SLOT_LEVEL_NEED[lv]}개` }),
      el('span', { cls: `det-bar${maxed ? ' max' : ''}`, attrs: { 'aria-hidden': 'true' } }, fill),
    ),
  ];
}

function detail(c: CollectibleDef, v: Variant): void {
  const n = count(c.id, v);
  const owned = VARIANTS.some((x) => count(c.id, x.id) > 0);
  const big = collectibleImg(c, n > 0 ? v : 'base', 'big', n === 0);
  const frame = el('div', { cls: `pf det-frame cv-${n > 0 ? v : 'base'}` }, big);
  frame.style.setProperty('--rc', RARITY_COLOR[c.rarity]);
  const list = el(
    'div',
    { cls: 'det-variants' },
    ...VARIANTS.map((x) => {
      const k = count(c.id, x.id);
      const pic = collectibleImg(c, x.id, 'mini', k === 0);
      return el(
        'div',
        { cls: `pf det-v${x.id === v ? ' sel' : ''}${k > 0 ? '' : ' off'}` },
        pic,
        el('span', { cls: 'det-vtext' }, el('span', { cls: 'det-vname' }, variantMark(x.id), x.name), k > 0 ? levelDots(k) : el('b', { text: '-' })),
      );
    }),
  );
  const tag = el('span', { cls: 'col-chip cc-rar', text: `${rarityName(c.rarity)} 등급` });
  tag.style.setProperty('--rc', RARITY_COLOR[c.rarity]);
  ctx.showModal(
    owned ? c.name : '???',
    [
      el('div', { cls: 'det-top' }, frame),
      el('div', { cls: 'det-center' }, tag),
      ...(n > 0 ? detailState(v, n) : [el('p', { cls: 'det-state', text: '아직 못 만났어요. 상자에서 찾아봐요' })]),
      list,
    ],
    [{ label: '닫기', onClick: () => ctx.dismissModal() }],
    { icon: iconImg('ui-dex', { size: 32, cls: 'title-ico' }) },
  );
}
