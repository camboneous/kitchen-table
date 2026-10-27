import { h, col, setAt } from './util.js';
import { bestMove } from './ai.js';

const COLS = 7, ROWS = 6;

function findWin(g) {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const v = g[r * COLS + c]; if (v === '.') continue;
    for (const [dr, dc] of dirs) {
      const cells = [];
      for (let k = 0; k < 4; k++) {
        const rr = r + dr * k, cc = c + dc * k;
        if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || g[rr * COLS + cc] !== v) break;
        cells.push(rr * COLS + cc);
      }
      if (cells.length === 4) return { seat: +v, cells };
    }
  }
  return null;
}

// Computer opponent: score every line of four on the board.
const WINDOWS = (() => {
  const w = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
    for (const [dr, dc] of [[0,1],[1,0],[1,1],[1,-1]]) {
      const cells = [];
      for (let k = 0; k < 4; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) break; cells.push(rr * COLS + cc); }
      if (cells.length === 4) w.push(cells);
    }
  return w;
})();
function evaluate(s, seat) {
  const me = String(seat), them = String(1 - seat);
  let score = 0;
  for (let r = 0; r < ROWS; r++) { if (s.g[r * COLS + 3] === me) score += 4; else if (s.g[r * COLS + 3] === them) score -= 4; }
  for (const w of WINDOWS) {
    let m = 0, t = 0;
    for (const i of w) { if (s.g[i] === me) m++; else if (s.g[i] === them) t++; }
    if (m && t) continue;
    if (m === 3) score += 60; else if (m === 2) score += 6;
    if (t === 3) score -= 80; else if (t === 2) score -= 6;
  }
  return score;
}
const ORDER = [3, 2, 4, 1, 5, 0, 6];
const colMoves = s => ORDER.filter(c => s.g[c] === '.');

export default {
  id: 'four',
  name: 'Four in a Row',
  blurb: 'Drop discs into the columns. First to line up four in any direction wins.',
  min: 2, max: 2,
  options: [],

  init(n, opts, round) {
    return { g: '.'.repeat(COLS * ROWS), turn: round % 2, last: -1 };
  },

  move(s, c, seat) {
    if (seat !== s.turn || typeof c !== 'number' || c < 0 || c >= COLS || findWin(s.g)) return null;
    for (let r = ROWS - 1; r >= 0; r--) {
      const i = r * COLS + c;
      if (s.g[i] === '.') return { g: setAt(s.g, i, String(seat)), turn: 1 - s.turn, last: i };
    }
    return null;
  },

  status(s) {
    const w = findWin(s.g);
    if (w) return { over: true, winners: [w.seat] };
    if (!s.g.includes('.')) return { over: true, winners: [], draw: true };
    return { over: false };
  },

  bot: {
    pick(s, seat, level, game) {
      const cfg = { easy: { depth: 2, blunder: 0.3, noise: 40 }, medium: { depth: 4, noise: 10 }, hard: { depth: 7 } }[level];
      return bestMove(game, s, seat, { ...cfg, moves: colMoves, evaluate });
    }
  },

  render(el, s, ctx) {
    const win = findWin(s.g);
    const over = !!win || !s.g.includes('.');
    const prevLast = el.dataset.last != null ? +el.dataset.last : -2;
    el.dataset.last = s.last;
    const board = h('div', { class: 'c4' });
    board.style.setProperty('--cur', col(ctx.players[s.turn].color));
    for (let c = 0; c < COLS; c++) {
      const full = s.g[c] !== '.';
      const colBtn = h('button', {
        class: 'c4col', disabled: !ctx.canMove || over || full,
        'aria-label': `Column ${c + 1}` + (full ? ', full' : ''),
        onclick: () => ctx.onMove(c)
      });
      for (let r = 0; r < ROWS; r++) {
        const i = r * COLS + c, v = s.g[i];
        const slot = h('span', { class: 'slot' });
        if (v !== '.') {
          const d = h('span', { class: 'disc' + (win && win.cells.includes(i) ? ' win' : '') + (i === s.last && i !== prevLast ? ' drop' : '') });
          d.style.background = col(ctx.players[+v].color);
          d.style.setProperty('--d', r + 1);
          slot.append(d);
        }
        colBtn.append(slot);
      }
      board.append(colBtn);
    }
    el.replaceChildren(board);
  }
};
