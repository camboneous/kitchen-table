/*
  Online rooms, stored in Firebase Realtime Database at rooms/<CODE>.
  Every change goes through a transaction, so two people tapping at once can't
  corrupt a game, and the game lives in the database, not in anyone's browser.

  Room shape:
    game, opts, phase ('lobby' | 'play'), host, created, rev, round
    players: { <pid>: { name, color, t } }   everyone who joined
    online:  { <pid>: true }                 who has the page open right now
    seats:   JSON string of pids in seat order (while playing)
    state:   JSON string of the game state (while playing)
*/
import { firebaseConfig } from './firebase-config.js';
import { GAMES, defaultOpts, optsFor } from './games/index.js';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
export const enabled = !!(firebaseConfig && firebaseConfig.databaseURL);

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
export { ls };

// A stable id for this browser, so a refresh puts you back in your seat.
export const pid = (() => {
  let id = ls.get('kt-pid');
  if (!id) { id = 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); ls.set('kt-pid', id); }
  return id;
})();

let fb = null;
async function load() {
  if (fb) return fb;
  if (!enabled) throw new Error('not_configured');
  const appMod = await import(FB + 'firebase-app.js');
  const dbMod = await import(FB + 'firebase-database.js');
  const app = appMod.initializeApp(firebaseConfig);
  fb = { ...dbMod, db: dbMod.getDatabase(app) };
  // Firebase tells us how far this device's clock is from the server's, so round timers match on every phone.
  dbMod.onValue(dbMod.ref(fb.db, '.info/serverTimeOffset'), s => { clockOffset = s.val() || 0; });
  return fb;
}
let clockOffset = 0;
export const now = () => Date.now() + clockOffset;

const roomPath = code => 'rooms/' + code;
const STALE = 24 * 60 * 60 * 1000;

// Run fn(room) inside a transaction. fn mutates and returns the room, or returns undefined to cancel.
async function tx(code, fn) {
  const { db, ref, runTransaction } = await load();
  const res = await runTransaction(ref(db, roomPath(code)), room => {
    if (room === null) return null; // first pass may be an empty cache; Firebase retries with the real value
    return fn(room);
  });
  return res.committed && res.snapshot.exists();
}

function randCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let s = ''; for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}

export async function createRoom(name, gameId) {
  const { db, ref, runTransaction } = await load();
  const game = GAMES[gameId];
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randCode();
    const res = await runTransaction(ref(db, roomPath(code)), cur => {
      if (cur && Date.now() - (cur.created || 0) < STALE) return; // code in use
      return {
        game: gameId, opts: defaultOpts(game), phase: 'lobby', host: pid,
        created: Date.now(), rev: 0, round: 0,
        players: { [pid]: { name, color: 0, t: Date.now() } }
      };
    });
    if (res.committed) return code;
  }
  throw new Error('no_code');
}

export async function joinRoom(code, name) {
  const { db, ref, get } = await load();
  const snap = await get(ref(db, roomPath(code)));
  if (!snap.exists() || Date.now() - (snap.val().created || 0) > STALE) return false;
  return tx(code, room => {
    room.players = room.players || {};
    const me = room.players[pid];
    if (me) me.name = name;
    else {
      const used = new Set(Object.values(room.players).map(p => p.color));
      let color = 0; while (used.has(color) && color < 5) color++;
      room.players[pid] = { name, color, t: Date.now() };
    }
    return room;
  });
}

// Live updates for a room, plus "I'm here" presence that clears itself when the tab closes.
export async function watch(code, onRoom) {
  const { db, ref, onValue, onDisconnect, set, remove } = await load();
  const meRef = ref(db, `${roomPath(code)}/online/${pid}`);
  const offConn = onValue(ref(db, '.info/connected'), s => {
    if (s.val() === true) onDisconnect(meRef).remove().then(() => set(meRef, true)).catch(() => {});
  });
  const offRoom = onValue(ref(db, roomPath(code)), s => onRoom(s.val()));
  return () => { offConn(); offRoom(); remove(meRef).catch(() => {}); };
}

export const setLobby = (code, gameId, opts) => tx(code, room => {
  if (room.phase !== 'lobby' || !GAMES[gameId]) return;
  room.game = gameId; room.opts = optsFor(GAMES[gameId], opts); return room;
});

function seatOnline(room, game) {
  const online = room.online || {};
  return Object.entries(room.players || {})
    .filter(([id]) => online[id])
    .sort((a, b) => a[1].t - b[1].t)
    .map(([id]) => id)
    .slice(0, game.max);
}

export const start = code => tx(code, room => {
  if (room.phase !== 'lobby') return;
  const game = GAMES[room.game];
  const seats = seatOnline(room, game);
  if (seats.length < game.min) return;
  room.seats = JSON.stringify(seats);
  room.round = 0;
  room.state = JSON.stringify(game.init(seats.length, optsFor(game, room.opts), 0, now()));
  room.entries = null;
  room.phase = 'play'; room.rev = (room.rev || 0) + 1;
  return room;
});

export const move = (code, mv) => tx(code, room => {
  if (room.phase !== 'play') return;
  const game = GAMES[room.game];
  const seat = JSON.parse(room.seats).indexOf(pid);
  if (seat < 0) return;
  const st = JSON.parse(room.state);
  if (game.status(st).over) return;
  const next = game.move(st, mv, seat);
  if (!next) return;
  room.state = JSON.stringify(next); room.rev = (room.rev || 0) + 1;
  return room;
});

// rev guards against two people pressing "Play again" at the same moment.
export const rematch = (code, rev) => tx(code, room => {
  if (room.phase !== 'play' || room.rev !== rev) return;
  const game = GAMES[room.game];
  const seats = JSON.parse(room.seats);
  room.round = (room.round || 0) + 1;
  room.state = JSON.stringify(game.init(seats.length, optsFor(game, room.opts), room.round, now()));
  room.entries = null;
  room.rev += 1;
  return room;
});

export const toLobby = code => tx(code, room => {
  if (room.phase !== 'play') return;
  room.phase = 'lobby'; room.state = null; room.seats = null; room.entries = null; room.rev = (room.rev || 0) + 1;
  return room;
});

export async function leave(code) {
  await tx(code, room => {
    if (room.online) delete room.online[pid];
    if (room.phase === 'lobby' && room.players) delete room.players[pid];
    return room;
  }).catch(() => {});
}

/* ---------- everyone-at-once games ---------- */

// Save my answers for this round (only the scoring step reads other people's).
export async function setEntry(code, round, entry) {
  const { db, ref, set } = await load();
  await set(ref(db, `${roomPath(code)}/entries/r${round}/${pid}`), JSON.stringify(entry));
}

// Score the round once time is up or everyone still here is done. Safe for every phone to call; only one wins.
export const finishRound = (code, round) => tx(code, room => {
  if (room.phase !== 'play') return;
  const game = GAMES[room.game];
  if (!game.simultaneous) return;
  const st = JSON.parse(room.state);
  if (st.phase !== 'play' || st.round !== round) return;
  const seats = JSON.parse(room.seats);
  const bucket = (room.entries || {})['r' + round] || {};
  const entries = seats.map(id => { try { return bucket[id] ? JSON.parse(bucket[id]) : null; } catch (e) { return null; } });
  const online = room.online || {};
  const allDone = seats.every((id, i) => !online[id] || (entries[i] && entries[i].done));
  if (now() < st.endsAt - 1500 && !allDone) return;
  room.state = JSON.stringify(game.collect(st, entries, now()));
  room.entries = null;
  room.rev = (room.rev || 0) + 1;
  return room;
});

export const nextRound = (code, rev) => tx(code, room => {
  if (room.phase !== 'play' || room.rev !== rev) return;
  const game = GAMES[room.game];
  const st = JSON.parse(room.state);
  if (st.phase !== 'reveal') return;
  room.state = JSON.stringify(game.next(st, now()));
  room.rev += 1;
  return room;
});
