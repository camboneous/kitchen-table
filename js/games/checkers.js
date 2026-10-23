import { h, col, setAt } from './util.js';

// Board: 64 chars. '.' empty, 'a' seat 0 piece, 'A' seat 0 king, 'b' seat 1 piece, 'B' seat 1 king.
// Seat 0 starts at the bottom (rows 5-7) and moves up.
const OWN = ['aA', 'bB'];
const DRAW_PLIES = 80; // 40 moves each with no capture is a draw

function startBoard() {
  let b = '';
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const dark = (r + c) % 2 === 1;
    b += !dark ? '.' : r < 3 ? 'b' : r > 4 ? 'a' : '.';
  }
  return b;
}
function dirsFor(p) {
  if (p === 'a') return [[-1, -1], [-1, 1]];
  if (p === 'b') return [[1, -1], [1, 1]];
  return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
}
const inb = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

function jumpsFrom(b, i, seat) {
  const p = b[i], r = i >> 3, c = i & 7, out = [];
  for (const [dr, dc] of dirsFor(p)) {
    const r1 = r + dr, c1 = c + dc, r2 = r + 2 * dr, c2 = c + 2 * dc;
    if (!inb(r2, c2)) continue;
    const mid = b[r1 * 8 + c1];
    if (OWN[1 - seat].includes(mid) && b[r2 * 8 + c2] === '.') out.push({ from: i, to: r2 * 8 + c2, cap: r1 * 8 + c1 });
  }
  return out;
}
function stepsFrom(b, i) {
  const r = i >> 3, c = i & 7, out = [];
  for (const [dr, dc] of dirsFor(b[i])) {
    const r1 = r + dr, c1 = c + dc;
    if (inb(r1, c1) && b[r1 * 8 + c1] === '.') out.push({ from: i, to: r1 * 8 + c1, cap: -1 });
  }
  return out;
}
function legal(s) {
  if (s.chain >= 0) return jumpsFrom(s.b, s.chain, s.turn);
  let jumps = [], steps = [];
  for (let i = 0; i < 64; i++) {
    if (!OWN[s.turn].includes(s.b[i])) continue;
    jumps = jumps.concat(jumpsFrom(s.b, i, s.turn));
    if (!jumps.length) steps = steps.concat(stepsFrom(s.b, i));
  }
  return jumps.length ? jumps : steps;
}
const CROWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17 3 7l5 4 4-6 4 6 5-4-1 10z" fill="currentColor"/></svg>';

let sel = null; // { key, from } selected piece, kept between renders

export default {
  id: 'checkers',
  name: 'Checkers',
  blurb: 'Jump your opponent’s pieces. Jumps are required, chains keep going, and reaching the far side makes a king.',
  min: 2, max: 2,
  options: [],

  init(n, opts, round) {
    return { b: startBoard(), turn: round % 2, chain: -1, last: [], quiet: 0 };
  },

  move(s, mv, seat) {
    if (seat !== s.turn || typeof mv !== 'number') return null;
    const m = legal(s).find(x => x.from * 64 + x.to === mv);
    if (!m) return null;
    const n = { ...s };
    let p = s.b[m.from];
    n.b = setAt(setAt(s.b, m.from, '.'), m.to, p);
    const row = m.to >> 3;
    const crowned = (p === 'a' && row === 0) || (p === 'b' && row === 7);
    if (crowned) { p = p.toUpperCase(); n.b = setAt(n.b, m.to, p); }
    n.last = s.chain >= 0 ? [...s.last, m.to] : [m.from, m.to];
    if (m.cap >= 0) {
      n.b = setAt(n.b, m.cap, '.');
      n.quiet = 0;
      if (!crowned && jumpsFrom(n.b, m.to, seat).length) { n.chain = m.to; return n; }
    } else n.quiet = s.quiet + 1;
    n.chain = -1;
    n.turn = 1 - s.turn;
    return n;
  },

  status(s) {
    if (!legal(s).length) return { over: true, winners: [1 - s.turn] };
    if (s.quiet >= DRAW_PLIES) return { over: true, winners: [], draw: true };
    return { over: false };
  },

  scores(s) { return [0, 1].map(seat => [...s.b].filter(ch => OWN[seat].includes(ch)).length); },

  note(s) {
    if (s.chain >= 0) return 'Keep jumping';
    const L = legal(s);
    return L.length && L[0].cap >= 0 ? 'A jump is required' : '';
  },

  render(el, s, ctx) {
    const key = s.b + s.turn + s.chain;
    if (!sel || sel.key !== key) sel = { key, from: s.chain >= 0 ? s.chain : -1 };
    const moves = ctx.canMove ? legal(s) : [];
    const movable = new Set(moves.map(m => m.from));
    const targets = new Map(moves.filter(m => m.from === sel.from).map(m => [m.to, m]));
    const flip = ctx.mySeat === 1;

    const board = h('div', { class: 'ck' });
    board.style.setProperty('--cur', col(ctx.players[s.turn].color));
    for (let k = 0; k < 64; k++) {
      const i = flip ? 63 - k : k, r = i >> 3, c = i & 7, dark = (r + c) % 2 === 1;
      if (!dark) { board.append(h('span', { class: 'sq light' })); continue; }
      const p = s.b[i];
      const cls = ['sq', 'dark'];
      if (s.last.includes(i)) cls.push('last');
      if (targets.has(i)) cls.push('target');
      if (movable.has(i)) cls.push('movable');
      if (sel.from === i) cls.push('sel');
      const btn = h('button', {
        class: cls.join(' '),
        disabled: !(targets.has(i) || movable.has(i)),
        'aria-label': `Row ${8 - r}, column ${c + 1}` + (p === '.' ? '' : `, ${ctx.players[OWN[0].includes(p) ? 0 : 1].name}${p === p.toUpperCase() ? ' king' : ''}`),
        onclick: () => {
          if (targets.has(i)) { ctx.onMove(sel.from * 64 + i); return; }
          if (movable.has(i) && s.chain < 0) { sel.from = sel.from === i ? -1 : i; this.render(el, s, ctx); }
        }
      });
      if (p !== '.') {
        const seat = OWN[0].includes(p) ? 0 : 1;
        const piece = h('span', { class: 'piece' + (p === p.toUpperCase() ? ' king' : '') });
        piece.style.background = col(ctx.players[seat].color);
        if (p === p.toUpperCase()) piece.innerHTML = CROWN;
        btn.append(piece);
      }
      board.append(btn);
    }
    el.replaceChildren(board);
  }
};
