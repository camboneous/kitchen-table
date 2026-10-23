/*
  Game registry. To add a game, create a module in this folder and list it below.

  A game module exports an object with:
    id, name, blurb        text shown in the app
    min, max               player count
    options                [{ key, label, def, choices: [{label, value}] }]
    init(n, opts, round)   -> starting state (plain JSON). round counts rematches,
                              so you can rotate who goes first.
    move(state, move, seat)-> new state, or null if the move is not allowed.
                              Must be pure: never change `state` in place.
    status(state)          -> { over: false } or { over: true, winners: [seats], draw? }
    render(el, state, ctx) -> draw into el. ctx = { players:[{name,color}], canMove, onMove(move),
                              mySeat } where mySeat is -1 for pass-and-play, -2 when watching,
                              or the viewer's seat online (use it to flip the board).
  Optional:
    scores(state) -> [number per seat]     shown on the player chips
    badge(seat)   -> short text like 'X'   shown on the player chips
    note(state)   -> extra hint under the turn line

  The same module runs pass-and-play and online games, so every game gets both for free.
*/
import dots from './dots.js';
import ttt from './tictactoe.js';
import four from './fourrow.js';
import checkers from './checkers.js';
import reversi from './reversi.js';
import mancala from './mancala.js';

export const GAME_LIST = [dots, ttt, four, checkers, reversi, mancala];
export const GAMES = Object.fromEntries(GAME_LIST.map(g => [g.id, g]));

export function defaultOpts(game) {
  const o = {};
  for (const op of game.options || []) o[op.key] = op.def;
  return o;
}
export function optsFor(game, saved) {
  const o = defaultOpts(game);
  for (const op of game.options || []) {
    if (saved && op.choices.some(c => c.value === saved[op.key])) o[op.key] = saved[op.key];
  }
  return o;
}
