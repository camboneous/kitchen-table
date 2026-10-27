import { h, col } from './util.js';
import { deck, FULL_RANKS, shuffle, rankOf, suitOf, SUIT_SYM, cardEl, handEl, stackEl, rankLabel } from './cards.js';

/*
  Two-player cribbage. Each hand: deal 6, each player sends 2 to the dealer's crib, cut the
  starter (a jack is "his heels", 2 for the dealer), peg to 31, then count hands and crib.
  First to 121 (or 61 for a short game) wins. "Go" is automatic: if you can't play, the
  other player keeps going, and whoever plays the last card gets a point.
*/
const RNK = c => { const r = rankOf(c); return r === 'A' ? 1 : r === 'T' ? 10 : r === 'J' ? 11 : r === 'Q' ? 12 : r === 'K' ? 13 : +r; };
const VAL = c => Math.min(10, RNK(c));
const other = p => 1 - p;

/* ---------- counting a hand ---------- */
export function scoreHand(hand, starter, isCrib) {
  const cards = starter ? [...hand, starter] : hand.slice();
  const items = [];
  // Fifteens
  let fifteens = 0;
  for (let m = 1; m < (1 << cards.length); m++) {
    let t = 0;
    for (let i = 0; i < cards.length; i++) if (m & (1 << i)) t += VAL(cards[i]);
    if (t === 15) fifteens++;
  }
  if (fifteens) items.push({ label: fifteens === 1 ? 'Fifteen' : `${fifteens} fifteens`, pts: fifteens * 2 });
  // Pairs
  let pairs = 0;
  for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) if (rankOf(cards[i]) === rankOf(cards[j])) pairs++;
  if (pairs) items.push({ label: pairs === 1 ? 'Pair' : pairs === 3 ? 'Three of a kind' : pairs === 6 ? 'Four of a kind' : `${pairs} pairs`, pts: pairs * 2 });
  // Runs: longest length wins; count every combination of that length
  for (let len = cards.length; len >= 3; len--) {
    let count = 0;
    for (let m = 1; m < (1 << cards.length); m++) {
      if (popcount(m) !== len) continue;
      const r = cards.filter((_, i) => m & (1 << i)).map(RNK).sort((a, b) => a - b);
      if (r.every((v, i) => i === 0 || v === r[i - 1] + 1)) count++;
    }
    if (count) { items.push({ label: count === 1 ? `Run of ${len}` : `${count} runs of ${len}`, pts: count * len }); break; }
  }
  // Flush
  if (hand.length === 4 && hand.every(c => suitOf(c) === suitOf(hand[0]))) {
    if (starter && suitOf(starter) === suitOf(hand[0])) items.push({ label: 'Flush of 5', pts: 5 });
    else if (!isCrib) items.push({ label: 'Flush', pts: 4 });
  }
  // Nobs
  if (starter && hand.some(c => rankOf(c) === 'J' && suitOf(c) === suitOf(starter))) items.push({ label: 'Nobs', pts: 1 });
  return { total: items.reduce((a, x) => a + x.pts, 0), items };
}
function popcount(m) { let n = 0; while (m) { n += m & 1; m >>= 1; } return n; }

/* ---------- pegging points for the card just played ---------- */
function pegPoints(seq, count) {
  const items = [];
  if (count === 15) items.push({ label: 'Fifteen', pts: 2 });
  if (count === 31) items.push({ label: 'Thirty-one', pts: 2 });
  const ranks = seq.map(x => rankOf(x.c));
  let same = 1;
  for (let i = ranks.length - 2; i >= 0 && ranks[i] === ranks[ranks.length - 1]; i--) same++;
  if (same >= 2) items.push({ label: same === 2 ? 'Pair' : same === 3 ? 'Three of a kind' : 'Four of a kind', pts: [0, 0, 2, 6, 12][same] });
  for (let k = seq.length; k >= 3; k--) {
    const r = seq.slice(-k).map(x => RNK(x.c)).sort((a, b) => a - b);
    if (r.every((v, i) => i === 0 || v === r[i - 1] + 1)) { items.push({ label: `Run of ${k}`, pts: k }); break; }
  }
  return items;
}

/* ---------- game flow ---------- */
function award(s, p, pts) {
  if (!pts) return s;
  const score = s.score.slice(), back = s.back.slice();
  back[p] = score[p]; score[p] = Math.min(s.target, score[p] + pts);
  const n = { ...s, score, back };
  if (score[p] >= s.target) return { ...n, phase: 'over', winner: p };
  return n;
}
function deal(s, dealer) {
  const cards = shuffle(deck(FULL_RANKS));
  return {
    ...s, dealer, phase: 'discard', turn: other(dealer),
    hands: [cards.slice(0, 6), cards.slice(6, 12)], cut: cards[12], starter: null,
    kept: [null, null], crib: [], peg: { count: 0, seq: [], last: -1, played: [[], []] },
    show: null, msg: null, handNo: (s.handNo || 0) + 1
  };
}
const canPlayAny = (s, p) => s.hands[p].some(c => s.peg.count + VAL(c) <= 31);

function startShow(s) {
  const nd = other(s.dealer);
  const parts = [
    { who: nd, kind: 'hand', cards: s.kept[nd], ...scoreHand(s.kept[nd], s.starter, false) },
    { who: s.dealer, kind: 'hand', cards: s.kept[s.dealer], ...scoreHand(s.kept[s.dealer], s.starter, false) },
    { who: s.dealer, kind: 'crib', cards: s.crib, ...scoreHand(s.crib, s.starter, true) }
  ];
  let n = { ...s, phase: 'show', turn: nd, show: parts };
  for (const part of parts) { // counted in order; the game can end partway through
    n = award(n, part.who, part.total);
    if (n.phase === 'over') return { ...n, show: parts };
  }
  return n;
}

export default {
  id: 'cribbage',
  name: 'Cribbage',
  blurb: 'Two players, a crib, and the race to 121. Peg for fifteens, pairs, and runs, then count your hand.',
  min: 2, max: 2,
  hiddenHands: true,
  options: [{ key: 'target', label: 'Play to', def: 121, choices: [{ label: '121 (full game)', value: 121 }, { label: '61 (short game)', value: 61 }] }],

  init(n, opts, round) {
    return deal({ target: opts.target, score: [0, 0], back: [0, 0], winner: -1, handNo: 0 }, round % 2);
  },

  // Anyone can tap "next hand" on the show screen; otherwise it's whoever's turn it is.
  canAct(s, seat) { return s.phase === 'show' ? seat === 0 || seat === 1 : seat === s.turn; },
  isPublic(s) { return s.phase === 'show'; },

  move(s, mv, seat) {
    if (!mv || typeof mv !== 'object' || s.phase === 'over') return null;
    if (s.phase === 'show') {
      if (mv.t !== 'next' || (seat !== 0 && seat !== 1)) return null;
      return deal(s, other(s.dealer));
    }
    if (seat !== s.turn) return null;
    const p = seat;

    if (s.phase === 'discard') {
      if (mv.t !== 'discard' || !Array.isArray(mv.cards) || mv.cards.length !== 2) return null;
      const [a, b] = mv.cards;
      if (a === b || !s.hands[p].includes(a) || !s.hands[p].includes(b)) return null;
      const keep = s.hands[p].filter(c => c !== a && c !== b);
      let n = { ...s, hands: s.hands.map((hd, i) => i === p ? keep : hd), kept: s.kept.map((k, i) => i === p ? keep : k), crib: [...s.crib, a, b] };
      if (!n.kept[other(p)]) return { ...n, turn: other(p), msg: null };
      // Both discarded: cut the starter.
      n = { ...n, starter: s.cut, phase: 'peg', turn: other(s.dealer), msg: null };
      if (rankOf(s.cut) === 'J') { n = award(n, s.dealer, 2); n.msg = { who: s.dealer, text: 'His heels: a jack on the cut', pts: 2 }; }
      return n;
    }

    if (s.phase === 'peg') {
      if (mv.t !== 'play' || !s.hands[p].includes(mv.c) || s.peg.count + VAL(mv.c) > 31) return null;
      const seq = [...s.peg.seq, { p, c: mv.c }];
      const count = s.peg.count + VAL(mv.c);
      const items = pegPoints(seq, count);
      const pts = items.reduce((a, x) => a + x.pts, 0);
      let n = {
        ...s, hands: s.hands.map((hd, i) => i === p ? hd.filter(c => c !== mv.c) : hd),
        peg: { ...s.peg, seq, count, last: p, played: s.peg.played.map((pl, i) => i === p ? [...pl, mv.c] : pl) },
        msg: { who: p, card: mv.c, count, text: items.map(x => x.label).join(', '), pts }
      };
      n = award(n, p, pts);
      if (n.phase === 'over') return n;
      const o = other(p);
      if (count === 31) n = { ...n, peg: { ...n.peg, count: 0, seq: [] } };
      if (canPlayAny(n, o)) return { ...n, turn: o };
      if (canPlayAny(n, p)) return { ...n, turn: p, msg: { ...n.msg, go: o } };
      // Nobody can play: last card scores 1 (unless it made 31), then start a new count.
      if (n.peg.count > 0) {
        n = award(n, p, 1);
        n = { ...n, msg: { ...n.msg, text: [n.msg.text, n.hands[0].length + n.hands[1].length ? 'Go' : 'Last card'].filter(Boolean).join(', '), pts: n.msg.pts + 1 } };
        if (n.phase === 'over') return n;
      }
      n = { ...n, peg: { ...n.peg, count: 0, seq: [] } };
      if (!n.hands[0].length && !n.hands[1].length) return startShow(n);
      return { ...n, turn: n.hands[o].length ? o : p };
    }
    return null;
  },

  status(s) { return s.phase === 'over' ? { over: true, winners: [s.winner] } : { over: false }; },
  scores(s) { return s.score; },
  resultText(s, players) {
    const w = s.winner, l = other(w);
    const skunk = s.target === 121 && s.score[l] < 91 ? (s.score[l] < 61 ? ' Double skunk!' : ' Skunk!') : '';
    return `${players[w].name} wins ${s.score[w]}–${s.score[l]}.${skunk}`;
  },
  note(s) {
    if (s.phase === 'discard') return 'Choose 2 cards for the crib';
    if (s.phase === 'peg') return `Count is ${s.peg.count}`;
    if (s.phase === 'show') return 'Counting hands';
    return '';
  },

  bot: { pick: (s, seat, level) => botPick(s, seat, level) },

  render(el, s, ctx) { renderCribbage(el, s, ctx, this); }
};

/* ---------- computer opponent ---------- */
function botPick(s, seat, level) {
  if (s.phase === 'show') return { t: 'next' };
  if (s.phase === 'discard') return { t: 'discard', cards: botDiscard(s, seat, level) };
  if (s.phase === 'peg') return { t: 'play', c: botPeg(s, seat, level) };
  return null;
}
// Average hand value over every possible starter, plus a nudge for what goes in the crib.
function botDiscard(s, seat, level) {
  const hand = s.hands[seat];
  const unseen = deck(FULL_RANKS).filter(c => !hand.includes(c));
  const myCrib = s.dealer === seat;
  const options = [];
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) {
    const keep = hand.filter((_, k) => k !== i && k !== j), toss = [hand[i], hand[j]];
    let ev = 0;
    for (const st of unseen) ev += scoreHand(keep, st, false).total;
    ev /= unseen.length;
    const cribGuess = scoreHand(toss, null, true).total + toss.filter(c => rankOf(c) === '5').length * 1.5;
    const weight = level === 'hard' ? 1 : level === 'medium' ? 0.6 : 0;
    options.push({ toss, v: ev + (myCrib ? 1 : -1) * cribGuess * weight });
  }
  options.sort((a, b) => b.v - a.v);
  if (level === 'easy') return options[Math.floor(Math.random() * Math.min(5, options.length))].toss;
  return options[0].toss;
}
function botPeg(s, seat, level) {
  const legal = s.hands[seat].filter(c => s.peg.count + VAL(c) <= 31);
  if (level === 'easy' && Math.random() < 0.5) return legal[Math.floor(Math.random() * legal.length)];
  const seen = new Set([...s.hands[seat], ...s.peg.played[0], ...s.peg.played[1], ...(s.starter ? [s.starter] : [])]);
  const unseen = deck(FULL_RANKS).filter(c => !seen.has(c));
  const scored = legal.map(c => {
    const seq = [...s.peg.seq, { p: seat, c }], count = s.peg.count + VAL(c);
    let v = pegPoints(seq, count).reduce((a, x) => a + x.pts, 0) * 10;
    if (count === 5 || count === 21) v -= 6;               // easy fifteen / thirty-one for them
    if (s.peg.seq.length === 0 && VAL(c) === 5) v -= 5;    // don't lead a five
    if (s.peg.seq.length === 0 && VAL(c) < 5) v += 2;      // small leads are safe
    if (level === 'hard') {
      // What could the other player score right back? Average over cards we haven't seen.
      let reply = 0, n = 0;
      for (const u of unseen) {
        if (count === 31 || count + VAL(u) > 31) continue;
        reply += pegPoints([...seq, { p: other(seat), c: u }], count + VAL(u)).reduce((a, x) => a + x.pts, 0); n++;
      }
      if (n) v -= (reply / n) * 8;
      v += VAL(c) * 0.3; // shed high cards while it's safe
    }
    return { c, v };
  });
  scored.sort((a, b) => b.v - a.v);
  return scored[0].c;
}

/* ---------- screen ---------- */
let pickState = null; // cards selected for the crib before sending

function renderCribbage(el, s, ctx, game) {
  const me = ctx.mySeat >= 0 ? ctx.mySeat : -1;
  const viewer = me >= 0 ? me : 0;
  const opp = other(viewer);
  const name = p => (me === p ? 'You' : ctx.players[p].name);
  const myAction = me >= 0 && ctx.canMove;
  const key = `${s.handNo}|${s.phase}|${s.turn}|${me}`;
  if (!pickState || pickState.key !== key) pickState = { key, sel: [] };

  // Peg track
  const track = h('div', { class: 'cb-track' }, ...[viewer, opp].map(p => {
    const lane = h('div', { class: 'cb-lane', style: `--c:${col(ctx.players[p].color)}` },
      h('div', { class: 'cb-lane-head' }, h('span', {}, name(p) + (s.dealer === p ? ' · dealer' : '')), h('b', {}, `${s.score[p]}`)),
      h('div', { class: 'cb-bar' }, h('span', { class: 'cb-back', style: `left:${(s.back[p] / s.target) * 100}%` }), h('span', { class: 'cb-front', style: `left:${(s.score[p] / s.target) * 100}%` })));
    return lane;
  }));

  // Middle of the table
  const starter = s.starter ? cardEl(s.starter, { small: true }) : h('div', { class: 'pcard small back' });
  const info = h('div', { class: 'cb-info' },
    h('div', { class: 'cb-starter' }, starter, h('span', {}, 'Starter')),
    h('div', { class: 'cb-crib' }, h('div', { class: 'stack' }, ...Array.from({ length: Math.max(1, Math.min(4, s.crib.length)) }, () => h('div', { class: 'pcard back' }))), h('span', {}, `${s.dealer === viewer && me >= 0 ? 'Your' : ctx.players[s.dealer].name + '’s'} crib`)));

  const oppBox = h('div', { class: 'opp' + (s.turn === opp && s.phase !== 'show' ? ' turn' : ''), style: `--c:${col(ctx.players[opp].color)}` },
    h('span', { class: 'opp-name' }, ctx.players[opp].name), stackEl(s.hands[opp].length));

  let middle;
  if (s.phase === 'show' || (s.phase === 'over' && s.show)) {
    middle = h('div', { class: 'cb-show' }, ...s.show.map(part => h('div', { class: 'cb-part' },
      h('div', { class: 'cb-part-head', style: `color:${col(ctx.players[part.who].color)}` }, `${part.kind === 'crib' ? (me === part.who ? 'Your crib' : ctx.players[part.who].name + '’s crib') : (me === part.who ? 'Your hand' : ctx.players[part.who].name + '’s hand')}`, h('b', {}, `${part.total}`)),
      h('div', { class: 'cb-part-cards' }, ...part.cards.map(c => cardEl(c, { small: true })), h('span', { class: 'cb-plus' }, '+'), cardEl(s.starter, { small: true, extra: 'starter' })),
      h('p', { class: 'cb-items' }, part.items.length ? part.items.map(x => `${x.label} ${x.pts}`).join(' · ') : 'Nineteen! (nothing)'))));
  } else if (s.phase === 'peg' || (s.phase === 'over' && !s.show && s.starter)) {
    middle = h('div', { class: 'cb-peg' },
      h('div', { class: 'cb-count' }, h('span', {}, 'Count'), h('b', {}, String(s.peg.count))),
      h('div', { class: 'cb-seq' }, ...s.peg.seq.map(x => h('div', { class: 'cb-seq-card', style: `--c:${col(ctx.players[x.p].color)}` }, cardEl(x.c, { small: true })))));
  } else {
    middle = h('p', { class: 'cb-hint' }, s.phase === 'discard'
      ? (s.turn === viewer && me >= 0 ? `Pick 2 cards for ${s.dealer === viewer ? 'your' : ctx.players[s.dealer].name + '’s'} crib.` : `${ctx.players[s.turn].name} is choosing cards for the crib.`)
      : '');
  }

  // What just happened
  let msg = null;
  if (s.msg) {
    const m = s.msg;
    const parts = [];
    if (m.card) parts.push(`${name(m.who)} played ${rankLabel(rankOf(m.card))}${SUIT_SYM[suitOf(m.card)]} for ${m.count}`);
    if (m.text) parts.push(`${m.card ? '' : name(m.who) + ': '}${m.text}${m.pts ? ` (+${m.pts})` : ''}`);
    if (m.go !== undefined) parts.push(`${name(m.go)} can’t play: go`);
    msg = h('p', { class: 'cb-msg' + (m.pts ? ' scored' : '') }, parts.join(' · '));
  }

  // My hand and actions
  let handBox = null, actions = null;
  if (me >= 0 && s.phase !== 'show' && s.phase !== 'over') {
    const mine = s.hands[me].slice().sort((a, b) => RNK(a) - RNK(b));
    if (s.phase === 'discard') {
      const picking = myAction && s.turn === me && !s.kept[me];
      handBox = handEl(mine, {
        highlight: false, selected: null,
        playable: () => picking,
        onPick: c => { const i = pickState.sel.indexOf(c); if (i >= 0) pickState.sel.splice(i, 1); else if (pickState.sel.length < 2) pickState.sel.push(c); renderCribbage(el, s, ctx, game); }
      });
      handBox.querySelectorAll('.pcard').forEach((b, i) => { if (pickState.sel.includes(mine[i])) b.classList.add('selected'); });
      if (picking) actions = h('button', { class: 'btn wide', disabled: pickState.sel.length !== 2, onclick: () => ctx.onMove({ t: 'discard', cards: pickState.sel.slice() }) },
        pickState.sel.length === 2 ? `Send to ${s.dealer === me ? 'your' : ctx.players[s.dealer].name + '’s'} crib` : `Pick ${2 - pickState.sel.length} more`);
    } else {
      handBox = handEl(mine, {
        highlight: myAction && s.turn === me, playable: c => myAction && s.turn === me && s.peg.count + VAL(c) <= 31,
        onPick: c => ctx.onMove({ t: 'play', c })
      });
    }
  }
  if (s.phase === 'show' && (me >= 0 || ctx.mySeat === -1)) {
    actions = h('button', { class: 'btn wide', onclick: () => ctx.onMove({ t: 'next' }) }, 'Next hand');
  }

  el.replaceChildren(h('div', { class: 'cardgame cribbage' }, track, h('div', { class: 'cb-table' }, oppBox, info, middle), msg, actions, handBox));
}
