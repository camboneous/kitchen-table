import { svgEl, col, setAt } from './util.js';

const counts = (R, C) => ({ H: (R + 1) * C, V: R * (C + 1) });

function boxesOfLine(s, i) {
  const { R, C } = s, { H } = counts(R, C), out = [];
  if (i < H) { const r = Math.floor(i / C), c = i % C; if (r > 0) out.push([r - 1, c]); if (r < R) out.push([r, c]); }
  else { const j = i - H, r = Math.floor(j / (C + 1)), c = j % (C + 1); if (c > 0) out.push([r, c - 1]); if (c < C) out.push([r, c]); }
  return out;
}
function boxLines(s, r, c) {
  const { C } = s, { H } = counts(s.R, C);
  return [r * C + c, (r + 1) * C + c, H + r * (C + 1) + c, H + r * (C + 1) + c + 1];
}
function scores(s) {
  const sc = Array(s.n).fill(0);
  for (const ch of s.boxes) if (ch !== '0') sc[+ch - 1]++;
  return sc;
}

export default {
  id: 'dots',
  name: 'Dots & Boxes',
  blurb: 'Draw lines between dots. Close a box to claim it and go again.',
  min: 2, max: 4,
  options: [{
    key: 'size', label: 'Board size', def: 4,
    choices: [3, 4, 5, 6].map(v => ({ label: `${v} × ${v}`, value: v }))
  }],

  init(n, opts, round) {
    const R = opts.size, C = opts.size, { H, V } = counts(R, C);
    return { n, R, C, turn: round % n, lines: '0'.repeat(H + V), boxes: '0'.repeat(R * C), last: -1, closed: 0 };
  },

  move(s, i, seat) {
    if (seat !== s.turn || typeof i !== 'number' || i < 0 || i >= s.lines.length || s.lines[i] !== '0') return null;
    const n = { ...s }, mark = String(seat + 1);
    n.lines = setAt(s.lines, i, mark);
    let closed = 0;
    for (const [r, c] of boxesOfLine(n, i)) {
      const b = r * n.C + c;
      if (n.boxes[b] === '0' && boxLines(n, r, c).every(L => n.lines[L] !== '0')) { n.boxes = setAt(n.boxes, b, mark); closed++; }
    }
    n.last = i; n.closed = closed;
    if (!closed) n.turn = (s.turn + 1) % s.n;
    return n;
  },

  status(s) {
    const over = !s.boxes.includes('0');
    if (!over) return { over: false };
    const sc = scores(s), max = Math.max(...sc);
    return { over: true, winners: sc.map((v, i) => v === max ? i : -1).filter(i => i >= 0) };
  },

  scores,

  note(s) { return s.closed ? (s.closed > 1 ? 'Two boxes, go again' : 'Box closed, go again') : ''; },

  render(el, s, ctx) {
    const { R, C } = s, { H } = counts(R, C), S = 100, M = 36;
    const prevLast = el.dataset.last != null ? +el.dataset.last : -2;
    el.dataset.last = s.last;
    const svg = svgEl('svg', { viewBox: `0 0 ${C * S + 2 * M} ${R * S + 2 * M}`, class: 'dots-board' + (ctx.canMove ? '' : ' locked'), role: 'img', 'aria-label': `Dots and boxes board, ${R} by ${C}` });
    svg.style.setProperty('--cur', col(ctx.players[s.turn].color));

    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const o = s.boxes[r * C + c]; if (o === '0') continue;
      const p = ctx.players[+o - 1];
      svg.append(
        svgEl('rect', { x: M + c * S + 5, y: M + r * S + 5, width: S - 10, height: S - 10, rx: 6, fill: col(p.color), class: 'boxfill' }),
        Object.assign(svgEl('text', { x: M + c * S + S / 2, y: M + r * S + S / 2 + 2, fill: col(p.color), class: 'boxtxt' }), { textContent: (p.name[0] || '?').toUpperCase() })
      );
    }
    for (let i = 0; i < s.lines.length; i++) {
      let x1, y1, x2, y2;
      if (i < H) { const r = Math.floor(i / C), c = i % C; x1 = M + c * S; y1 = M + r * S; x2 = x1 + S; y2 = y1; }
      else { const j = i - H, r = Math.floor(j / (C + 1)), c = j % (C + 1); x1 = M + c * S; y1 = M + r * S; x2 = x1; y2 = y1 + S; }
      const o = s.lines[i];
      if (o !== '0') {
        svg.append(svgEl('line', { x1, y1, x2, y2, stroke: col(ctx.players[+o - 1].color), class: 'drawn' + (i === s.last && i !== prevLast ? ' fresh' : '') }));
      } else {
        const ins = 14, dx = x2 > x1 ? ins : 0, dy = y2 > y1 ? ins : 0;
        const pts = { x1: x1 + dx, y1: y1 + dy, x2: x2 - dx, y2: y2 - dy };
        const g = svgEl('g', { class: 'edge', 'data-i': i });
        g.append(svgEl('line', { ...pts, class: 'ghost' }), svgEl('line', { ...pts, class: 'hit' }));
        svg.append(g);
      }
    }
    for (let r = 0; r <= R; r++) for (let c = 0; c <= C; c++)
      svg.append(svgEl('circle', { cx: M + c * S, cy: M + r * S, r: 7, class: 'dot' }));

    svg.addEventListener('click', e => {
      if (!ctx.canMove) return;
      const g = e.target.closest('.edge'); if (g) ctx.onMove(+g.dataset.i);
    });
    el.replaceChildren(svg);
  }
};
