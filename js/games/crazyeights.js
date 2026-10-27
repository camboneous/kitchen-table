import { h, col } from './util.js';
import { deck, FULL_RANKS, shuffle, rankOf, suitOf, SUITS, SUIT_SYM, SUIT_NAME, isRed, cardEl, backEl, handEl, stackEl, suitButton, rankLabel } from './cards.js';

const SUIT_ORDER = { S: 0, H: 1, C: 2, D: 3 };
const RANK_ORDER = Object.fromEntries(FULL_RANKS.map((r, i) => [r, i]));
const sortHand = cards => cards.slice().sort((a, b) => SUIT_ORDER[suitOf(a)] - SUIT_ORDER[suitOf(b)] || RANK_ORDER[rankOf(a)] - RANK_ORDER[rankOf(b)]);

function canPlay(s, c) {
  const top = s.pile[s.pile.length - 1];
  return rankOf(c) === '8' || suitOf(c) === s.suit || rankOf(c) === rankOf(top);
}
function refill(s) {
  if (s.stock.length || s.pile.length < 2) return s;
  const top = s.pile[s.pile.length - 1];
  return { ...s, stock: shuffle(s.pile.slice(0, -1)), pile: [top] };
}

let pick8 = null; // { key, card } an 8 waiting for its suit

export default {
  id: 'eights',
  name: 'Crazy Eights',
  blurb: 'Match the suit or the number. Eights are wild and let you change the suit. First to empty their hand wins.',
  min: 2, max: 6,
  hiddenHands: true,
  options: [],

  init(n, opts, round) {
    let cards = shuffle(deck(FULL_RANKS));
    const size = n === 2 ? 7 : 5;
    const hands = [];
    for (let i = 0; i < n; i++) hands.push(cards.splice(0, size));
    // The starting card can't be an 8.
    let k = cards.findIndex(c => rankOf(c) !== '8');
    const start = cards.splice(k, 1)[0];
    return { n, hands, stock: cards, pile: [start], suit: suitOf(start), turn: round % n, drew: false, last: null, winner: -1 };
  },

  move(s, mv, seat) {
    if (s.winner >= 0 || seat !== s.turn || !mv || typeof mv !== 'object') return null;
    const hand = s.hands[seat];
    if (mv.t === 'play') {
      if (!hand.includes(mv.c) || !canPlay(s, mv.c)) return null;
      const eight = rankOf(mv.c) === '8';
      if (eight && !SUITS.includes(mv.s)) return null;
      const hands = s.hands.map((hd, i) => i === seat ? hd.filter(c => c !== mv.c) : hd);
      const won = hands[seat].length === 0;
      return { ...s, hands, pile: [...s.pile, mv.c], suit: eight ? mv.s : suitOf(mv.c),
        turn: won ? seat : (seat + 1) % s.n, drew: false, last: { seat, t: 'play', c: mv.c, s: eight ? mv.s : null }, winner: won ? seat : -1 };
    }
    if (mv.t === 'draw') {
      if (s.drew) return null;
      let n2 = refill(s);
      if (!n2.stock.length) return null;
      const [c, ...stock] = n2.stock;
      const hands = n2.hands.map((hd, i) => i === seat ? [...hd, c] : hd);
      return { ...n2, hands, stock, drew: true, last: { seat, t: 'draw' } };
    }
    if (mv.t === 'pass') {
      const stuck = !refill(s).stock.length;
      if (!s.drew && !stuck) return null;
      return { ...s, turn: (seat + 1) % s.n, drew: false, last: { seat, t: 'pass' } };
    }
    return null;
  },

  status(s) { return s.winner >= 0 ? { over: true, winners: [s.winner] } : { over: false }; },
  note(s) { return s.drew ? 'Drew a card: play one or pass' : ''; },

  render(el, s, ctx) {
    const me = ctx.mySeat >= 0 ? ctx.mySeat : -1;
    const myTurn = me >= 0 && ctx.canMove && s.turn === me;
    const key = JSON.stringify([s.pile.length, s.turn, s.drew, me]);
    if (!pick8 || pick8.key !== key) pick8 = { key, card: null };
    const top = s.pile[s.pile.length - 1];
    const stockCount = s.stock.length + Math.max(0, s.pile.length - 1);

    const opps = h('div', { class: 'opps' }, ...ctx.players.map((p, i) => i === me ? null :
      h('div', { class: 'opp' + (s.turn === i ? ' turn' : ''), style: `--c:${col(p.color)}` },
        h('span', { class: 'opp-name' }, p.name), stackEl(s.hands[i].length))));

    const drawBtn = h('button', { class: 'pile-btn', disabled: !(myTurn && !s.drew && stockCount > 0), 'aria-label': 'Draw a card',
      onclick: () => ctx.onMove({ t: 'draw' }) }, backEl(), h('span', { class: 'pile-label' }, `Draw (${s.stock.length})`));
    const suitTag = h('div', { class: 'suit-tag ' + (isRed(s.suit) ? 'red' : 'black') }, 'Suit: ', h('b', {}, SUIT_SYM[s.suit] + ' ' + SUIT_NAME[s.suit]));
    const table = h('div', { class: 'felt' },
      h('div', { class: 'felt-row' }, drawBtn, h('div', { class: 'pile-top' }, cardEl(top, { extra: s.last && s.last.t === 'play' ? 'land' : '' }))),
      suitTag, h('p', { class: 'felt-msg' }, lastText(s, ctx)));

    const mine = me >= 0 ? sortHand(s.hands[me]) : [];
    const handBox = me >= 0 ? handEl(mine, {
      highlight: myTurn, playable: c => myTurn && canPlay(s, c), selected: pick8.card,
      onPick: c => {
        if (rankOf(c) === '8') { pick8.card = c; this.render(el, s, ctx); return; }
        ctx.onMove({ t: 'play', c });
      }
    }) : h('p', { class: 'sub' }, 'You’re watching.');

    const stuck = !stockCount;
    const actions = myTurn ? h('div', { class: 'card-actions' },
      (s.drew || stuck) ? h('button', { class: 'btn ghost small', onclick: () => ctx.onMove({ t: 'pass' }) }, stuck && !s.drew ? 'No cards left, pass' : 'Pass') : null) : null;

    const picker = pick8.card ? h('div', { class: 'picker' },
      h('p', {}, 'Wild eight! Pick the new suit:'),
      h('div', { class: 'suit-row' }, ...SUITS.map(su => suitButton(su, () => { const c = pick8.card; pick8.card = null; ctx.onMove({ t: 'play', c, s: su }); }))),
      h('button', { class: 'back', onclick: () => { pick8.card = null; this.render(el, s, ctx); } }, 'Cancel')) : null;

    el.replaceChildren(h('div', { class: 'cardgame' }, opps, table, picker, actions, handBox));
  }
};

function lastText(s, ctx) {
  const L = s.last; if (!L) return `${ctx.players[s.turn].name} goes first.`;
  const who = ctx.mySeat === L.seat ? 'You' : ctx.players[L.seat].name;
  if (L.t === 'play') return L.s ? `${who} played a wild eight: ${SUIT_NAME[L.s]} now.` : `${who} played ${rankLabel(rankOf(L.c))}${SUIT_SYM[suitOf(L.c)]}.`;
  if (L.t === 'draw') return `${who} drew a card.`;
  return `${who} passed.`;
}
