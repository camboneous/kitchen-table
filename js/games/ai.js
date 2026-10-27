/*
  Look-ahead search shared by computer opponents in two-player board games.
  Works with any game module: it only uses game.move() and game.status().
  It handles games where one player moves several times in a row (like a checkers jump chain)
  by checking whose turn it is at every step instead of assuming turns alternate.
*/
const WIN = 1e6;

export function bestMove(game, s, seat, { depth, moves, evaluate, noise = 0, blunder = 0 }) {
  const root = moves(s);
  if (!root.length) return null;
  if (blunder && Math.random() < blunder) return root[Math.floor(Math.random() * root.length)];

  function rec(st, d, a, b) {
    const status = game.status(st);
    if (status.over) {
      if (status.draw || status.winners.length !== 1) return 0;
      return status.winners[0] === seat ? WIN + d : -WIN - d; // prefer quicker wins, slower losses
    }
    if (d === 0) return evaluate(st, seat);
    const list = moves(st);
    if (!list.length) return evaluate(st, seat);
    const maxing = st.turn === seat;
    let best = maxing ? -Infinity : Infinity;
    for (const m of list) {
      const n = game.move(st, m, st.turn);
      if (!n) continue;
      const v = rec(n, d - 1, a, b);
      if (maxing) { if (v > best) best = v; if (v > a) a = v; }
      else { if (v < best) best = v; if (v < b) b = v; }
      if (b <= a) break;
    }
    return best;
  }

  let best = -Infinity, picks = [];
  for (const m of root) {
    const n = game.move(s, m, s.turn);
    if (!n) continue;
    let v = rec(n, depth - 1, -Infinity, Infinity);
    if (noise && Math.abs(v) < WIN / 2) v += (Math.random() - 0.5) * noise;
    if (v > best) { best = v; picks = [m]; }
    else if (v === best) picks.push(m);
  }
  return picks[Math.floor(Math.random() * picks.length)];
}

export const LEVELS = [
  { label: 'Easy', value: 'easy' },
  { label: 'Medium', value: 'medium' },
  { label: 'Hard', value: 'hard' }
];
