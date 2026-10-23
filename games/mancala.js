import { h, col } from './util.js';

// a[0..5] seat 0 pits, a[6] seat 0 store, a[7..12] seat 1 pits, a[13] seat 1 store.
// Seeds move counterclockwise and skip the opponent's store.
const STORE = [6, 13];
const pitsOf = seat => seat === 0 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12];
const sideEmpty = (a, seat) => pitsOf(seat).every(i => a[i] === 0);

export default {
  id: 'mancala',
  name: 'Mancala',
  blurb: 'Scoop up a pit and sow the seeds around the board. Land in your store to go again, or in an empty pit to capture.',
  min: 2, max: 2,
  options: [{
    key: 'seeds', label: 'Seeds per pit', def: 4,
    choices: [3, 4, 5, 6].map(v => ({ label: String(v), value: v }))
  }],

  init(n, opts, round) {
    const a = Array(14).fill(opts.seeds); a[6] = 0; a[13] = 0;
    return { a, turn: round % 2, last: -1, end: -1, extra: false, capture: false, over: false };
  },

  move(s, pit, seat) {
    if (s.over || seat !== s.turn || !pitsOf(seat).includes(pit) || s.a[pit] === 0) return null;
    const a = s.a.slice();
    let n = a[pit], i = pit;
    a[pit] = 0;
    while (n > 0) {
      i = (i + 1) % 14;
      if (i === STORE[1 - seat]) continue;
      a[i]++; n--;
    }
    let extra = i === STORE[seat], capture = false;
    if (!extra && pitsOf(seat).includes(i) && a[i] === 1 && a[12 - i] > 0) {
      a[STORE[seat]] += a[12 - i] + 1;
      a[i] = 0; a[12 - i] = 0;
      capture = true;
    }
    let over = false;
    if (sideEmpty(a, 0) || sideEmpty(a, 1)) {
      for (const sd of [0, 1]) for (const p of pitsOf(sd)) { a[STORE[sd]] += a[p]; a[p] = 0; }
      over = true;
    }
    return { a, turn: extra || over ? seat : 1 - seat, last: pit, end: i, extra, capture, over };
  },

  status(s) {
    if (!s.over) return { over: false };
    const [x, y] = [s.a[6], s.a[13]];
    if (x === y) return { over: true, winners: [0, 1] };
    return { over: true, winners: [x > y ? 0 : 1] };
  },

  scores(s) { return [s.a[6], s.a[13]]; },

  note(s) {
    if (s.capture) return 'Last move captured seeds';
    if (s.extra) return 'Landed in the store, go again';
    return '';
  },

  render(el, s, ctx) {
    const bottom = ctx.mySeat === 1 ? 1 : 0, top = 1 - bottom;
    const canPick = i => ctx.canMove && !s.over && pitsOf(s.turn).includes(i) && s.a[i] > 0;

    const pit = (i, seat) => {
      const btn = h('button', {
        class: 'pit' + (i === s.last ? ' last' : '') + (i === s.end ? ' end' : ''),
        disabled: !canPick(i),
        'aria-label': `${ctx.players[seat].name}’s pit, ${s.a[i]} seeds`,
        onclick: () => ctx.onMove(i)
      }, pebbles(s.a[i], ctx.players[seat].color), h('span', { class: 'cnt' }, String(s.a[i])));
      btn.style.setProperty('--own', col(ctx.players[seat].color));
      return btn;
    };
    const store = seat => {
      const d = h('div', { class: 'store' + (STORE[seat] === s.end ? ' end' : ''), 'aria-label': `${ctx.players[seat].name}’s store, ${s.a[STORE[seat]]} seeds` },
        h('span', { class: 'cnt' }, String(s.a[STORE[seat]])),
        h('span', { class: 'who' }, ctx.players[seat].name));
      d.style.setProperty('--own', col(ctx.players[seat].color));
      return d;
    };

    const board = h('div', { class: 'mc' });
    board.style.setProperty('--cur', col(ctx.players[s.turn].color));
    // Left store belongs to the top player, right store to the bottom player.
    const left = store(top); left.style.gridArea = 'ls';
    const right = store(bottom); right.style.gridArea = 'rs';
    const topRow = h('div', { class: 'row top' }, ...pitsOf(top).slice().reverse().map(i => pit(i, top)));
    const botRow = h('div', { class: 'row bot' }, ...pitsOf(bottom).map(i => pit(i, bottom)));
    board.append(left, topRow, botRow, right);
    el.replaceChildren(board);
  }
};

// A few seeds drawn in the pit so it reads like a real board; the number carries the exact count.
function pebbles(n, color) {
  const box = h('span', { class: 'peb', 'aria-hidden': 'true' });
  const shown = Math.min(n, 12);
  for (let k = 0; k < shown; k++) {
    const a = k * 2.4, r = 24 + (k % 3) * 8;
    const s = h('i');
    s.style.left = `${50 + Math.cos(a) * r}%`;
    s.style.top = `${50 + Math.sin(a) * r}%`;
    box.append(s);
  }
  return box;
}
