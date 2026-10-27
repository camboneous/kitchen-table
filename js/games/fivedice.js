import { h, col } from './util.js';

/*
  Five Dice: roll up to three times a turn, holding any dice between rolls, then score the
  result in one of 13 boxes. Upper boxes total 63+ earns a 35 bonus. Five of a kind is 50;
  each extra five of a kind earns +100 and works as a wild for Full House and the straights.
*/
const CATS = [
  { id: 'ones', name: 'Ones', upper: 1 }, { id: 'twos', name: 'Twos', upper: 2 }, { id: 'threes', name: 'Threes', upper: 3 },
  { id: 'fours', name: 'Fours', upper: 4 }, { id: 'fives', name: 'Fives', upper: 5 }, { id: 'sixes', name: 'Sixes', upper: 6 },
  { id: 'three', name: '3 of a kind', hint: 'Total of all dice' }, { id: 'four', name: '4 of a kind', hint: 'Total of all dice' },
  { id: 'full', name: 'Full house', hint: '25' }, { id: 'small', name: 'Small straight', hint: '30' },
  { id: 'large', name: 'Large straight', hint: '40' }, { id: 'five', name: 'Five Dice!', hint: '50' },
  { id: 'chance', name: 'Chance', hint: 'Total of all dice' }
];
const IDS = CATS.map(c => c.id);
const sum = d => d.reduce((a, b) => a + b, 0);
const counts = d => { const c = [0, 0, 0, 0, 0, 0, 0]; d.forEach(v => c[v]++); return c; };
const roll1 = () => 1 + Math.floor(Math.random() * 6);

function isFiveKind(d) { return counts(d).some(n => n === 5); }
function points(cat, d, card) {
  const c = counts(d);
  const joker = isFiveKind(d) && card.five === 50; // extra five of a kind is wild
  const def = CATS.find(x => x.id === cat);
  if (def.upper) return c[def.upper] * def.upper;
  switch (cat) {
    case 'three': return c.some(n => n >= 3) ? sum(d) : 0;
    case 'four': return c.some(n => n >= 4) ? sum(d) : 0;
    case 'full': return (joker || (c.includes(3) && c.includes(2))) ? 25 : 0;
    case 'small': {
      const has = v => c[v] > 0;
      return (joker || [1, 2, 3, 4].every(has) || [2, 3, 4, 5].every(has) || [3, 4, 5, 6].every(has)) ? 30 : 0;
    }
    case 'large': {
      const has = v => c[v] > 0;
      return (joker || [1, 2, 3, 4, 5].every(has) || [2, 3, 4, 5, 6].every(has)) ? 40 : 0;
    }
    case 'five': return isFiveKind(d) ? 50 : 0;
    case 'chance': return sum(d);
  }
  return 0;
}
function totals(card, extra) {
  const upper = CATS.filter(c => c.upper).reduce((a, c) => a + (card[c.id] || 0), 0);
  const bonus = upper >= 63 ? 35 : 0;
  const lower = CATS.filter(c => !c.upper).reduce((a, c) => a + (card[c.id] || 0), 0);
  return { upper, bonus, lower, extra: extra * 100, total: upper + bonus + lower + extra * 100 };
}
const emptyCard = () => Object.fromEntries(IDS.map(id => [id, null]));

let ui = null; // { key, held: [bool x5] } holds you've toggled but not rolled yet

export default {
  id: 'dice',
  name: 'Five Dice',
  blurb: 'Roll five dice up to three times, keep the ones you like, and fill your scorecard. Chase the big one: five of a kind.',
  min: 1, max: 6,
  options: [],

  init(n, opts, round) {
    return { n, turn: round % n, starter: round % n, dice: [1, 2, 3, 4, 5], held: [false, false, false, false, false], rolls: 0,
      cards: Array.from({ length: n }, emptyCard), extra: Array(n).fill(0), last: null, done: false, rollId: 0 };
  },

  move(s, mv, seat) {
    if (s.done || seat !== s.turn || !mv || typeof mv !== 'object') return null;
    if (mv.t === 'roll') {
      if (s.rolls >= 3) return null;
      const held = s.rolls === 0 ? [false, false, false, false, false] : (Array.isArray(mv.held) ? mv.held.slice(0, 5).map(Boolean) : s.held);
      if (held.length !== 5 || held.every(Boolean)) return null;
      const dice = s.dice.map((v, i) => held[i] ? v : roll1());
      return { ...s, dice, held, rolls: s.rolls + 1, rollId: s.rollId + 1, last: null };
    }
    if (mv.t === 'score') {
      const card = s.cards[seat];
      if (s.rolls === 0 || !IDS.includes(mv.cat) || card[mv.cat] !== null) return null;
      const pts = points(mv.cat, s.dice, card);
      const bonus = isFiveKind(s.dice) && card.five === 50 ? 1 : 0;
      const cards = s.cards.map((c, i) => i === seat ? { ...c, [mv.cat]: pts } : c);
      const extra = s.extra.map((x, i) => i === seat ? x + bonus : x);
      const done = cards.every(c => IDS.every(id => c[id] !== null));
      const next = (seat + 1) % s.n;
      return { ...s, cards, extra, done, turn: done ? seat : next, rolls: 0, held: [false, false, false, false, false],
        last: { seat, cat: mv.cat, pts, bonus } };
    }
    return null;
  },

  status(s) {
    if (!s.done) return { over: false };
    const t = s.cards.map((c, i) => totals(c, s.extra[i]).total), max = Math.max(...t);
    return { over: true, winners: t.map((v, i) => v === max ? i : -1).filter(i => i >= 0) };
  },
  scores(s) { return s.cards.map((c, i) => totals(c, s.extra[i]).total); },
  resultText(s, players) {
    const t = this.scores(s);
    if (s.n === 1) return `Final score: ${t[0]}`;
    const max = Math.max(...t), w = t.map((v, i) => v === max ? i : -1).filter(i => i >= 0);
    return w.length > 1 ? `Tie at ${max}` : `${players[w[0]].name} wins with ${max}`;
  },
  note(s) {
    const filled = IDS.filter(id => s.cards[s.turn][id] !== null).length;
    return s.rolls === 0 ? `Turn ${filled + 1} of 13` : s.rolls < 3 ? `Roll ${s.rolls} of 3: hold dice or pick a box` : 'Pick a box to score';
  },

  render(el, s, ctx) {
    const mine = ctx.canMove; // pass-and-play or my turn online
    const key = `${s.turn}|${s.rollId}|${s.rolls}`;
    if (!ui || ui.key !== key) ui = { key, held: s.held.slice() };
    const fresh = el.dataset.roll !== String(s.rollId);
    el.dataset.roll = s.rollId;
    const card = s.cards[s.turn];

    // Dice
    const diceRow = h('div', { class: 'dice-row' }, ...s.dice.map((v, i) => {
      const held = ui.held[i];
      const canHold = mine && s.rolls > 0 && s.rolls < 3;
      const d = h('button', {
        class: 'die' + (held ? ' held' : '') + (s.rolls === 0 ? ' blank' : '') + (fresh && !s.held[i] && s.rolls > 0 ? ' rolled' : ''),
        disabled: !canHold, 'aria-pressed': held ? 'true' : 'false',
        'aria-label': s.rolls === 0 ? 'Die, not rolled yet' : `Die showing ${v}${held ? ', held' : ''}`,
        onclick: () => { ui.held[i] = !ui.held[i]; this.render(el, s, ctx); }
      }, pips(v), held ? h('span', { class: 'held-tag' }, 'HOLD') : null);
      return d;
    }));
    const rollsLeft = 3 - s.rolls;
    const rollBtn = h('button', {
      class: 'btn wide roll-btn', disabled: !mine || rollsLeft === 0 || (s.rolls > 0 && ui.held.every(Boolean)),
      onclick: () => ctx.onMove({ t: 'roll', held: ui.held })
    }, s.rolls === 0 ? 'Roll the dice' : rollsLeft ? `Roll again (${rollsLeft} left)` : 'No rolls left: pick a box');

    // Last turn message
    const L = s.last;
    const msg = h('p', { class: 'dice-msg' }, L ? `${ctx.mySeat === L.seat ? 'You' : ctx.players[L.seat].name} scored ${L.pts} in ${CATS.find(c => c.id === L.cat).name}${L.bonus ? ' plus a 100 bonus!' : '.'}` : '');

    // Scorecard: one column per player; the current player's open boxes show what they'd score.
    const n = s.n;
    const head = h('tr', {}, h('th', { scope: 'col' }, ''), ...ctx.players.map((p, i) => h('th', { scope: 'col', class: i === s.turn ? 'cur' : '', style: `color:${col(p.color)}` }, p.name)));
    const rows = [];
    const row = (label, cells, cls) => rows.push(h('tr', { class: cls || '' }, h('th', { scope: 'row' }, ...label), ...cells));
    CATS.forEach((c, ci) => {
      if (ci === 6) {
        row(['Upper bonus', h('small', {}, '63+ gets 35')], s.cards.map((cd, i) => { const t = totals(cd, s.extra[i]); return h('td', { class: 'sub' }, t.bonus ? '35' : `${t.upper}/63`); }), 'subrow');
      }
      row([c.name, c.hint ? h('small', {}, c.hint) : null], s.cards.map((cd, i) => {
        const v = cd[c.id];
        if (v !== null) return h('td', { class: i === s.turn ? 'cur' : '' }, String(v));
        if (i === s.turn && s.rolls > 0) {
          const p = points(c.id, s.dice, cd);
          if (mine) return h('td', { class: 'cur' }, h('button', { class: 'pick' + (p ? '' : ' zero'), 'aria-label': `Score ${p} in ${c.name}`, onclick: () => ctx.onMove({ t: 'score', cat: c.id }) }, String(p)));
          return h('td', { class: 'cur preview' }, String(p));
        }
        return h('td', { class: i === s.turn ? 'cur' : '' }, '');
      }));
    });
    row(['Five Dice bonus', h('small', {}, '+100 each')], s.extra.map((x, i) => h('td', { class: 'sub' + (i === s.turn ? ' cur' : '') }, x ? String(x * 100) : '')), 'subrow');
    row(['Total'], s.cards.map((cd, i) => h('td', { class: 'tot' + (i === s.turn ? ' cur' : '') }, String(totals(cd, s.extra[i]).total))), 'totrow');

    const table = h('div', { class: 'sheet-wrap' }, h('table', { class: 'sheet' + (n > 3 ? ' many' : '') }, h('thead', {}, head), h('tbody', {}, ...rows)));
    el.replaceChildren(h('div', { class: 'dicegame' }, diceRow, rollBtn, msg, table));
  }
};

const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function pips(v) {
  const g = h('span', { class: 'pips', 'aria-hidden': 'true' });
  for (let k = 0; k < 9; k++) g.append(h('i', { class: PIPS[v].includes(k) ? 'on' : '' }));
  return g;
}
