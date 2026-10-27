/*
  Card kit shared by the card games.
  A card is a 2-character string: rank + suit. Ranks 2-9, T (10), J, Q, K, A. Suits S H D C.
*/
import { h } from './util.js';

export const SUITS = ['S', 'H', 'D', 'C'];
export const SUIT_SYM = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const SUIT_NAME = { S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' };
export const RANK_NAME = { T: '10', J: 'J', Q: 'Q', K: 'K', A: 'A' };
export const rankOf = c => c[0];
export const suitOf = c => c[1];
export const isRed = s => s === 'H' || s === 'D';
export const rankLabel = r => RANK_NAME[r] || r;
export const cardName = c => `${({ T: '10', J: 'Jack', Q: 'Queen', K: 'King', A: 'Ace' })[rankOf(c)] || rankOf(c)} of ${SUIT_NAME[suitOf(c)]}`;

export function deck(ranks) {
  const out = [];
  for (const s of SUITS) for (const r of ranks) out.push(r + s);
  return out;
}
export const FULL_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// A face-up card. With onClick it becomes a button.
export function cardEl(c, o = {}) {
  const s = suitOf(c), r = rankLabel(rankOf(c));
  const cls = ['pcard', isRed(s) ? 'red' : 'black'];
  if (o.small) cls.push('small');
  if (o.playable) cls.push('playable');
  if (o.dim) cls.push('dim');
  if (o.selected) cls.push('selected');
  if (o.extra) cls.push(o.extra);
  const kids = [
    h('span', { class: 'pc-corner' }, h('span', {}, r), h('span', {}, SUIT_SYM[s])),
    h('span', { class: 'pc-pip' }, SUIT_SYM[s])
  ];
  if (o.onClick) return h('button', { class: cls.join(' '), 'aria-label': cardName(c), disabled: !!o.disabled, onclick: o.onClick }, ...kids);
  return h('div', { class: cls.join(' '), role: 'img', 'aria-label': cardName(c) }, ...kids);
}
export function backEl(o = {}) {
  return h('div', { class: 'pcard back' + (o.small ? ' small' : ''), 'aria-hidden': 'true' });
}

// A player's hand along the bottom. Wraps into rows when it gets long.
export function handEl(cards, o = {}) {
  const perRow = o.perRow || 9;
  const rows = [];
  for (let i = 0; i < cards.length; i += perRow) rows.push(cards.slice(i, i + perRow));
  return h('div', { class: 'hand' }, ...rows.map(row => {
    const r = h('div', { class: 'hand-row' }, ...row.map(c => {
      const playable = o.playable ? o.playable(c) : false;
      const clickable = !!(o.onPick && playable);
      return cardEl(c, {
        playable: o.highlight && playable, dim: o.highlight && !playable,
        selected: o.selected === c,
        onClick: o.onPick ? () => { if (clickable) o.onPick(c); } : null,
        disabled: o.onPick ? !clickable : false
      });
    }));
    r.style.setProperty('--n', row.length);
    return r;
  }));
}

// Small "N cards" stack for other players.
export function stackEl(n) {
  const s = h('div', { class: 'stack', 'aria-label': `${n} cards` });
  for (let i = 0; i < Math.min(n, 5); i++) s.append(backEl({ small: true }));
  s.append(h('span', { class: 'stack-n' }, String(n)));
  return s;
}

export function suitButton(s, onClick, label) {
  return h('button', { class: 'suit-btn ' + (isRed(s) ? 'red' : 'black'), onclick: onClick, 'aria-label': label || SUIT_NAME[s] },
    h('span', { class: 'sym' }, SUIT_SYM[s]), h('span', {}, SUIT_NAME[s]));
}
