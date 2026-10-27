import { h, col } from './util.js';
import { deck, shuffle, rankOf, suitOf, SUITS, SUIT_SYM, SUIT_NAME, isRed, cardEl, backEl, handEl, stackEl, suitButton, cardName } from './cards.js';

/*
  Four players, partners sit across. Positions 0-3 go clockwise around the table; teams are
  positions 0 & 2 and 1 & 3. state.order maps positions to seats (seat = order of joining).
  American rules by default: dealer's partner can order up and still play together, no
  "stick the dealer", game to 10. All three are lobby options.
*/
const RANKS = ['9', 'T', 'J', 'Q', 'K', 'A'];
const MATE = { S: 'C', C: 'S', H: 'D', D: 'H' };
const team = p => p % 2;
const nextPos = p => (p + 1) % 4;
const partner = p => (p + 2) % 4;

const effSuit = (c, trump) => (trump && rankOf(c) === 'J' && suitOf(c) === MATE[trump]) ? trump : suitOf(c);
function power(c, trump, led) {
  const r = RANKS.indexOf(rankOf(c));
  if (trump) {
    if (rankOf(c) === 'J' && suitOf(c) === trump) return 100;
    if (rankOf(c) === 'J' && suitOf(c) === MATE[trump]) return 99;
    if (suitOf(c) === trump) return 50 + r;
  }
  return effSuit(c, trump) === led ? 10 + r : 0;
}
const sittingOut = s => s.alone >= 0 ? partner(s.alone) : -1;
function nextActive(s, p) { let q = nextPos(p); if (q === sittingOut(s)) q = nextPos(q); return q; }
const withActor = (s, p) => ({ ...s, actor: p, turn: s.order[p] });

function deal(s, dealer, banner) {
  const cards = shuffle(deck(RANKS));
  const hands = [[], [], [], []];
  for (let k = 0; k < 4; k++) hands[(dealer + 1 + k) % 4] = cards.slice(k * 5, k * 5 + 5);
  const up = cards[20];
  return withActor({
    ...s, dealer, hands, up, upSuit: suitOf(up), phase: 'bid1', passes: 0, trump: null, maker: -1, alone: -1,
    trick: [], lastTrick: null, tricks: [0, 0], banner: banner || null, handNo: (s.handNo || 0) + 1
  }, nextPos(dealer));
}
function startPlay(s) {
  const lead = nextActive(s, s.dealer);
  return withActor({ ...s, phase: 'play', trick: [], leader: lead }, lead);
}
function legalPlays(s, p) {
  const hand = s.hands[p];
  if (!s.trick.length) return hand.slice();
  const led = effSuit(s.trick[0].c, s.trump);
  const follow = hand.filter(c => effSuit(c, s.trump) === led);
  return follow.length ? follow : hand.slice();
}
function scoreHand(s) {
  const mt = team(s.maker), m = s.tricks[mt];
  const score = s.score.slice();
  let banner;
  if (m >= 3) {
    const pts = m === 5 ? (s.alone >= 0 ? 4 : 2) : 1;
    score[mt] += pts;
    banner = { team: mt, pts, kind: m === 5 ? 'march' : 'made', alone: s.alone >= 0 };
  } else {
    score[1 - mt] += 2;
    banner = { team: 1 - mt, pts: 2, kind: 'euchre', alone: s.alone >= 0 };
  }
  const n = { ...s, score, banner };
  if (score[0] >= s.target || score[1] >= s.target) return { ...n, phase: 'over', trick: [] };
  return deal(n, nextPos(s.dealer), banner);
}

export default {
  id: 'euchre',
  name: 'Euchre',
  blurb: 'Four players, two teams, partners across. Call trump, take three tricks, and watch out for the left bower.',
  min: 4, max: 4,
  hiddenHands: true,
  options: [
    { key: 'target', label: 'Play to', def: 10, choices: [5, 7, 10, 11].map(v => ({ label: `${v} points`, value: v })) },
    { key: 'assist', label: 'Dealer’s partner orders it up', def: 'together', choices: [{ label: 'Plays with partner', value: 'together' }, { label: 'Must go alone', value: 'alone' }] },
    { key: 'stick', label: 'Stick the dealer', def: 'off', choices: [{ label: 'Off', value: 'off' }, { label: 'On', value: 'on' }] },
    { key: 'teams', label: 'Teams', def: 'order', choices: [{ label: '1st & 3rd vs 2nd & 4th', value: 'order' }, { label: 'Random', value: 'random' }] }
  ],

  init(n, opts, round) {
    const order = opts.teams === 'random' ? shuffle([0, 1, 2, 3]) : [0, 1, 2, 3];
    const base = { order, target: opts.target, stick: opts.stick === 'on', assist: opts.assist, score: [0, 0], handNo: 0 };
    return deal(base, (3 + round) % 4);
  },

  move(s, mv, seat) {
    if (s.phase === 'over' || seat !== s.turn || !mv || typeof mv !== 'object') return null;
    const p = s.actor;
    if (s.phase === 'bid1') {
      if (mv.t === 'pass') {
        if (s.passes + 1 >= 4) return withActor({ ...s, phase: 'bid2', passes: 0 }, nextPos(s.dealer));
        return withActor({ ...s, passes: s.passes + 1 }, nextPos(p));
      }
      if (mv.t === 'order') {
        const forced = s.assist === 'alone' && p === partner(s.dealer);
        const alone = (mv.alone || forced) ? p : -1;
        let n = { ...s, trump: s.upSuit, maker: p, alone, banner: null };
        if (sittingOut(n) === s.dealer) return startPlay(n); // dealer sits out: nobody picks up
        n.hands = s.hands.map((hd, i) => i === s.dealer ? [...hd, s.up] : hd);
        return withActor({ ...n, phase: 'discard' }, s.dealer);
      }
      return null;
    }
    if (s.phase === 'bid2') {
      if (mv.t === 'pass') {
        if (p === s.dealer) {
          if (s.stick) return null;
          return deal(s, nextPos(s.dealer), { kind: 'redeal' });
        }
        return withActor({ ...s, passes: s.passes + 1 }, nextPos(p));
      }
      if (mv.t === 'call') {
        if (!SUITS.includes(mv.suit) || mv.suit === s.upSuit) return null;
        return startPlay({ ...s, trump: mv.suit, maker: p, alone: mv.alone ? p : -1, banner: null });
      }
      return null;
    }
    if (s.phase === 'discard') {
      if (mv.t !== 'discard' || !s.hands[p].includes(mv.c)) return null;
      return startPlay({ ...s, hands: s.hands.map((hd, i) => i === p ? hd.filter(c => c !== mv.c) : hd) });
    }
    if (s.phase === 'play') {
      if (mv.t !== 'play' || !legalPlays(s, p).includes(mv.c)) return null;
      const hands = s.hands.map((hd, i) => i === p ? hd.filter(c => c !== mv.c) : hd);
      const trick = [...s.trick, { p, c: mv.c }];
      const need = s.alone >= 0 ? 3 : 4;
      if (trick.length < need) return withActor({ ...s, hands, trick, banner: null }, nextActive(s, p));
      const led = effSuit(trick[0].c, s.trump);
      const win = trick.reduce((a, b) => power(b.c, s.trump, led) > power(a.c, s.trump, led) ? b : a).p;
      const tricks = s.tricks.slice(); tricks[team(win)]++;
      const n = { ...s, hands, trick: [], tricks, lastTrick: { cards: trick, winner: win } };
      if (tricks[0] + tricks[1] === 5) return scoreHand(n);
      return withActor(n, win);
    }
    return null;
  },

  status(s) {
    if (s.phase !== 'over') return { over: false };
    const t = s.score[0] >= s.target ? 0 : 1;
    return { over: true, winners: s.order.filter((seat, pos) => team(pos) === t) };
  },
  resultText(s, players) {
    const t = s.score[0] >= s.target ? 0 : 1;
    const names = s.order.filter((seat, pos) => team(pos) === t).map(i => players[i].name).join(' & ');
    return `${names} win ${s.score[t]}–${s.score[1 - t]}`;
  },
  scores(s) { return [0, 1, 2, 3].map(seat => s.score[team(s.order.indexOf(seat))]); },
  note(s) {
    if (s.phase === 'bid1') return 'Order it up or pass';
    if (s.phase === 'bid2') return 'Name trump or pass';
    if (s.phase === 'discard') return 'Dealer is discarding';
    if (s.phase === 'play') return `${SUIT_NAME[s.trump]} are trump`;
    return '';
  },

  render(el, s, ctx) {
    const mySeat = ctx.mySeat >= 0 ? ctx.mySeat : -1;
    const vp = mySeat >= 0 ? s.order.indexOf(mySeat) : 0; // my position, or a neutral view
    const watching = mySeat < 0;
    const nameAt = p => ctx.players[s.order[p]].name;
    const colorAt = p => col(ctx.players[s.order[p]].color);
    const myAction = !watching && ctx.canMove && s.actor === vp && s.phase !== 'over';
    const out = sittingOut(s);

    // Scoreboard
    const teamNames = t => [0, 1, 2, 3].filter(p => team(p) === t).map(p => nameAt(p)).join(' & ');
    const myTeam = watching ? 0 : team(vp);
    const board = h('div', { class: 'eu-score' },
      ...[myTeam, 1 - myTeam].map(t => h('div', { class: 'eu-team' + (s.phase === 'play' && s.maker >= 0 && team(s.maker) === t ? ' makers' : '') },
        h('span', { class: 'eu-tn' }, (watching ? '' : (t === myTeam ? 'Us · ' : 'Them · ')) + teamNames(t)),
        h('b', {}, `${s.score[t]}`), h('span', { class: 'eu-tricks' }, s.phase === 'play' || s.phase === 'over' ? `${s.tricks[t]} tricks` : ''))),
      s.trump ? h('div', { class: 'eu-trump ' + (isRed(s.trump) ? 'red' : 'black') }, h('span', {}, 'Trump'), h('b', {}, SUIT_SYM[s.trump])) : null);

    // Banner from the last hand
    let banner = null;
    if (s.banner && s.phase !== 'play' || (s.banner && s.phase === 'play' && s.tricks[0] + s.tricks[1] === 0 && !s.trick.length)) {
      const b = s.banner;
      const who = b.kind === 'redeal' ? '' : teamNames(b.team);
      const text = b.kind === 'redeal' ? 'Everyone passed, so it’s a new deal.'
        : b.kind === 'euchre' ? `Euchred! ${who} get 2.`
        : b.kind === 'march' ? `${who} took all five${b.alone ? ' alone' : ''}: +${b.pts}.`
        : `${who} made it: +${b.pts}.`;
      banner = h('div', { class: 'eu-banner' }, text);
    }

    // Table: me at the bottom, then clockwise left, top, right.
    const seatBox = (p, where) => {
      const isTurn = s.actor === p && s.phase !== 'over';
      return h('div', { class: `eu-seat ${where}` + (isTurn ? ' turn' : '') + (p === out ? ' out' : ''), style: `--c:${colorAt(p)}` },
        h('span', { class: 'eu-name' }, nameAt(p) + (p === s.dealer ? ' · dealer' : '')),
        p === out ? h('span', { class: 'eu-out' }, 'sitting out') : stackEl(s.hands[p].length),
        p === s.maker && s.phase === 'play' ? h('span', { class: 'eu-tag' }, s.alone === p ? 'called alone' : 'called it') : null);
    };
    const showTrick = s.trick.length ? s.trick : (s.lastTrick && s.phase === 'play' ? s.lastTrick.cards : []);
    const center = h('div', { class: 'eu-center' });
    const spot = p => ['b', 'l', 't', 'r'][(p - vp + 4) % 4];
    if (s.phase === 'bid1' || s.phase === 'discard') {
      center.append(h('div', { class: 'eu-up' }, cardEl(s.up), h('span', {}, s.phase === 'bid1' ? 'Up card' : 'Picked up')));
    } else if (s.phase === 'bid2') {
      center.append(h('div', { class: 'eu-up' }, cardEl(s.up, { dim: true }), h('span', {}, `Turned down: not ${SUIT_NAME[s.upSuit]}`)));
    } else {
      for (const t of showTrick) center.append(h('div', { class: `eu-play ${spot(t.p)}` + (!s.trick.length ? ' old' : '') }, cardEl(t.c, { small: true })));
      if (!s.trick.length && s.lastTrick && s.phase === 'play') center.append(h('span', { class: 'eu-took' }, `${nameAt(s.lastTrick.winner)} took it`));
    }
    const table = h('div', { class: 'eu-table' },
      seatBox(partner(vp), 't'), seatBox(nextPos(vp), 'l'), center, seatBox((vp + 3) % 4, 'r'),
      watching ? seatBox(vp, 'b') : null);

    // Actions
    let actions = null;
    if (myAction && s.phase === 'bid1') {
      const forced = s.assist === 'alone' && vp === partner(s.dealer);
      const alone = h('label', { class: 'eu-alone' }, h('input', { type: 'checkbox', checked: forced, disabled: forced }), forced ? 'You must go alone' : 'Go alone');
      const isAlone = () => alone.querySelector('input').checked;
      actions = h('div', { class: 'eu-actions' },
        h('div', { class: 'eu-btns' },
          h('button', { class: 'btn ghost', onclick: () => ctx.onMove({ t: 'pass' }) }, 'Pass'),
          h('button', { class: 'btn', onclick: () => ctx.onMove({ t: 'order', alone: isAlone() }) }, vp === s.dealer ? 'Pick it up' : 'Order it up')),
        alone);
    } else if (myAction && s.phase === 'bid2') {
      const alone = h('label', { class: 'eu-alone' }, h('input', { type: 'checkbox' }), 'Go alone');
      const isAlone = () => alone.querySelector('input').checked;
      const stuck = s.stick && vp === s.dealer;
      actions = h('div', { class: 'eu-actions' },
        h('p', { class: 'sub' }, stuck ? 'Stick the dealer: you have to name trump.' : 'Name trump, or pass:'),
        h('div', { class: 'suit-row' }, ...SUITS.filter(su => su !== s.upSuit).map(su => suitButton(su, () => ctx.onMove({ t: 'call', suit: su, alone: isAlone() })))),
        h('div', { class: 'eu-btns' }, stuck ? null : h('button', { class: 'btn ghost', onclick: () => ctx.onMove({ t: 'pass' }) }, 'Pass'), alone));
    } else if (myAction && s.phase === 'discard') {
      actions = h('p', { class: 'eu-hint' }, 'Tap a card to discard it.');
    } else if (myAction && s.phase === 'play') {
      actions = h('p', { class: 'eu-hint' }, s.trick.length ? 'Your play. Follow suit if you can.' : 'Your lead.');
    }

    // My hand
    let handBox = null;
    if (!watching) {
      const mine = s.hands[vp].slice().sort((a, b) => {
        const sa = effSuit(a, s.trump), sb = effSuit(b, s.trump);
        const oa = sa === s.trump ? -1 : SUITS.indexOf(sa), ob = sb === s.trump ? -1 : SUITS.indexOf(sb);
        return oa - ob || power(b, s.trump, sb) - power(a, s.trump, sa);
      });
      const legal = s.phase === 'play' && myAction ? legalPlays(s, vp) : s.phase === 'discard' && myAction ? mine : [];
      handBox = vp === out ? h('p', { class: 'sub eu-hint' }, 'Your partner is going alone. Sit back and cheer.')
        : handEl(mine, {
          highlight: myAction && (s.phase === 'play' || s.phase === 'discard'),
          playable: c => legal.includes(c),
          onPick: c => ctx.onMove({ t: s.phase === 'discard' ? 'discard' : 'play', c })
        });
    }

    el.replaceChildren(h('div', { class: 'cardgame euchre' }, board, banner, table, actions, handBox));
  }
};
