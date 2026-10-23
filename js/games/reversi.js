import { h, col } from './util.js';

// Board: 64 chars, '.' empty, '0' seat 0, '1' seat 1.
const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

function flipsFor(b, i, seat) {
  if (b[i] !== '.') return [];
  const me = String(seat), them = String(1 - seat), r = i >> 3, c = i & 7, out = [];
  for (const [dr, dc] of DIRS) {
    const run = [];
    let rr = r + dr, cc = c + dc;
    while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === them) { run.push(rr * 8 + cc); rr += dr; cc += dc; }
    if (run.length && rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === me) out.push(...run);
  }
  return out;
}
function movesFor(b, seat) {
  const out = [];
  for (let i = 0; i < 64; i++) if (flipsFor(b, i, seat).length) out.push(i);
  return out;
}

export default {
  id: 'reversi',
  name: 'Reversi',
  blurb: 'Place a disc to trap a line of your opponent’s discs and flip them to your color. Most discs at the end wins.',
  min: 2, max: 2,
  options: [],

  init(n, opts, round) {
    const b = Array(64).fill('.');
    b[27] = '1'; b[28] = '0'; b[35] = '0'; b[36] = '1';
    return { b: b.join(''), turn: round % 2, last: -1, flipped: [], passed: false };
  },

  move(s, i, seat) {
    if (seat !== s.turn || typeof i !== 'number' || i < 0 || i > 63) return null;
    const flips = flipsFor(s.b, i, seat);
    if (!flips.length) return null;
    const arr = s.b.split('');
    arr[i] = String(seat);
    for (const f of flips) arr[f] = String(seat);
    const b = arr.join('');
    const other = 1 - seat;
    // If the other player has no move, the turn comes back.
    const otherCan = movesFor(b, other).length > 0;
    const passed = !otherCan && movesFor(b, seat).length > 0;
    return { b, turn: passed ? seat : other, last: i, flipped: flips, passed };
  },

  status(s) {
    if (movesFor(s.b, 0).length || movesFor(s.b, 1).length) return { over: false };
    const sc = this.scores(s);
    if (sc[0] === sc[1]) return { over: true, winners: [0, 1] };
    return { over: true, winners: [sc[0] > sc[1] ? 0 : 1] };
  },

  scores(s) { return [[...s.b].filter(x => x === '0').length, [...s.b].filter(x => x === '1').length]; },

  note(s) { return s.passed ? 'The other player had no move, so it’s this player again' : ''; },

  render(el, s, ctx) {
    const hints = new Set(ctx.canMove ? movesFor(s.b, s.turn) : []);
    const flipped = new Set(s.flipped);
    const prevLast = el.dataset.last != null ? +el.dataset.last : -2;
    const animate = s.last !== prevLast;
    el.dataset.last = s.last;
    const board = h('div', { class: 'rv' });
    board.style.setProperty('--cur', col(ctx.players[s.turn].color));
    for (let i = 0; i < 64; i++) {
      const v = s.b[i];
      const btn = h('button', {
        class: 'rvsq' + (hints.has(i) ? ' hint' : ''),
        disabled: !hints.has(i),
        'aria-label': `Row ${(i >> 3) + 1}, column ${(i & 7) + 1}` + (v === '.' ? (hints.has(i) ? ', playable' : '') : `, ${ctx.players[+v].name}`),
        onclick: () => ctx.onMove(i)
      });
      if (v !== '.') {
        const d = h('span', { class: 'disc' + (animate && i === s.last ? ' place' : '') + (animate && flipped.has(i) ? ' flip' : '') + (i === s.last ? ' last' : '') });
        d.style.background = col(ctx.players[+v].color);
        btn.append(d);
      }
      board.append(btn);
    }
    el.replaceChildren(board);
  }
};
