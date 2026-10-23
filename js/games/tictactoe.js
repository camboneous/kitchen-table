import { h, col, setAt, markSvg } from './util.js';

const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const MARKS = ['X', 'O'];

function lineWin(str) {
  for (const L of LINES) {
    const a = str[L[0]];
    if ((a === 'X' || a === 'O') && a === str[L[1]] && a === str[L[2]]) return { mark: a, line: L };
  }
  return null;
}

export default {
  id: 'ttt',
  name: 'Tic Tac Toe',
  blurb: 'Classic three in a row, or Ultimate: nine boards where your move sends your opponent to the next one.',
  min: 2, max: 2,
  options: [{
    key: 'mode', label: 'Version', def: 'classic',
    choices: [{ label: 'Classic', value: 'classic' }, { label: 'Ultimate', value: 'ultimate' }]
  }],

  init(n, opts, round) {
    const turn = round % 2;
    if (opts.mode === 'ultimate') return { mode: 'ultimate', b: '.'.repeat(81), w: '.'.repeat(9), next: -1, turn, last: -1 };
    return { mode: 'classic', b: '.'.repeat(9), turn, last: -1 };
  },

  move(s, mv, seat) {
    if (seat !== s.turn || typeof mv !== 'number') return null;
    const mark = MARKS[seat];
    if (s.mode === 'classic') {
      if (mv < 0 || mv > 8 || s.b[mv] !== '.' || lineWin(s.b)) return null;
      return { ...s, b: setAt(s.b, mv, mark), turn: 1 - s.turn, last: mv };
    }
    const bi = Math.floor(mv / 9), ci = mv % 9;
    if (mv < 0 || mv > 80 || s.b[mv] !== '.' || s.w[bi] !== '.' || (s.next !== -1 && s.next !== bi) || lineWin(s.w)) return null;
    const n = { ...s, b: setAt(s.b, mv, mark), last: mv, turn: 1 - s.turn };
    const small = n.b.slice(bi * 9, bi * 9 + 9);
    const sw = lineWin(small);
    if (sw) n.w = setAt(n.w, bi, sw.mark);
    else if (!small.includes('.')) n.w = setAt(n.w, bi, '-');
    n.next = n.w[ci] === '.' ? ci : -1;
    return n;
  },

  status(s) {
    const grid = s.mode === 'classic' ? s.b : s.w;
    const win = lineWin(grid);
    if (win) return { over: true, winners: [MARKS.indexOf(win.mark)] };
    if (!grid.includes('.')) return { over: true, winners: [], draw: true };
    return { over: false };
  },

  badge(seat) { return MARKS[seat]; },

  note(s) {
    if (s.mode !== 'ultimate' || s.last < 0) return '';
    return s.next === -1 ? 'Play in any open board' : 'Play in the highlighted board';
  },

  render(el, s, ctx) {
    const color = m => col(ctx.players[MARKS.indexOf(m)].color);
    const over = !!this.status(s).over;
    if (s.mode === 'classic') {
      const win = lineWin(s.b);
      const grid = h('div', { class: 'ttt' });
      for (let i = 0; i < 9; i++) {
        const m = s.b[i];
        grid.append(h('button', {
          class: 'cell' + (win && win.line.includes(i) ? ' win' : '') + (i === s.last ? ' pop' : ''),
          disabled: m !== '.' || !ctx.canMove || over,
          'aria-label': m === '.' ? `Square ${i + 1}, empty` : `Square ${i + 1}, ${m}`,
          onclick: () => ctx.onMove(i)
        }, m !== '.' ? markSvg(m, color(m)) : null));
      }
      el.replaceChildren(grid);
      return;
    }
    const big = lineWin(s.w);
    const grid = h('div', { class: 'ult' });
    for (let b = 0; b < 9; b++) {
      const open = s.w[b] === '.';
      const active = !over && open && (s.next === -1 || s.next === b);
      const mini = h('div', { class: 'mini' + (active ? ' active' : '') + (big && big.line.includes(b) ? ' win' : '') });
      if (active) mini.style.setProperty('--cur', col(ctx.players[s.turn].color));
      for (let c = 0; c < 9; c++) {
        const i = b * 9 + c, m = s.b[i];
        mini.append(h('button', {
          class: 'cell' + (i === s.last ? ' pop' : ''),
          disabled: m !== '.' || !active || !ctx.canMove,
          'aria-label': `Board ${b + 1}, square ${c + 1}` + (m === '.' ? '' : `, ${m}`),
          onclick: () => ctx.onMove(i)
        }, m !== '.' ? markSvg(m, color(m)) : null));
      }
      if (s.w[b] === 'X' || s.w[b] === 'O') mini.append(h('div', { class: 'claim' }, markSvg(s.w[b], color(s.w[b]))));
      if (s.w[b] === '-') mini.classList.add('dead');
      grid.append(mini);
    }
    el.replaceChildren(grid);
  }
};
