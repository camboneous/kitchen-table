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

  Card games with private hands set hiddenHands: true. Online, each player is shown only their own
  hand (render gets mySeat); in pass-and-play the app shows a "Pass to …" screen before each turn.
  resultText(state, players) can replace the default "X wins" line (e.g. for teams).

  Everyone-at-once games (like Rare Words) set simultaneous: true and add:
    init(n, opts, round, now)       now is a shared clock time, for round timers
    collect(state, entries, now)    entries[seat] = that player's private answers ({..., done}) or null;
                                    returns the state with the round scored
    next(state, now)                start the next round, or finish the game
    turnMs(state)                   how long one player's turn lasts (used for pass-and-play)
    roundLabel(state)               e.g. 'Round 2 of 3'
  and render gets ctx = { players, mySeat, local, now(), endsAt, myEntry, setEntry(entry),
                          finishRound(), nextRound() }.
  Online, answers are saved per player and only combined when the round is scored. In
  pass-and-play, the app hands the device to each player in turn, then shows the results.
*/
import dots from './dots.js';
import ttt from './tictactoe.js';
import four from './fourrow.js';
import checkers from './checkers.js';
import reversi from './reversi.js';
import mancala from './mancala.js';
import rare from './rarewords.js';
import euchre from './euchre.js';
import eights from './crazyeights.js';
import dice from './fivedice.js';

export const GAME_LIST = [rare, euchre, eights, dice, dots, ttt, four, checkers, reversi, mancala];
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
