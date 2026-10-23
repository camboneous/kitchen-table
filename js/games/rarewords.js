import { h, col } from './util.js';
import SEEDS from './rarewords-seeds.js';

/*
  Rare Words: everyone gets the same 7 letters and plays at the same time.
  Words only you found score big; words other people also found score little or nothing.
*/

const LEAD_MS = 3000; // "get ready" countdown before each turn

let dict = null, dictPromise = null;
function loadDict() {
  if (!dictPromise) {
    dictPromise = fetch(new URL('../../data/words.txt', import.meta.url))
      .then(r => { if (!r.ok) throw new Error('dict'); return r.text(); })
      .then(t => (dict = new Set(t.split('\n'))))
      .catch(e => { dictPromise = null; throw e; });
  }
  return dictPromise;
}

function fits(word, letters) {
  const pool = letters.split('');
  for (const ch of word) {
    const i = pool.indexOf(ch);
    if (i < 0) return false;
    pool.splice(i, 1);
  }
  return true;
}
function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// Points for one finder of a word.
function points(len, finders) {
  const base = finders === 1 ? 3 * len : finders === 2 ? len : 0;
  return base + (len === 7 ? 10 : 0);
}
function newRound(s, now) {
  let used = s.used.length >= SEEDS.length ? [] : s.used;
  let k;
  do { k = Math.floor(Math.random() * SEEDS.length); } while (used.includes(k));
  const seed = SEEDS[k].toUpperCase();
  let letters;
  do { letters = shuffled(seed.split('')).join(''); } while (letters === seed);
  return { ...s, used: [...used, k], phase: 'play', letters, seed, endsAt: now + LEAD_MS + s.secs * 1000, reveal: null };
}
const fmt = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

export default {
  id: 'rare',
  name: 'Rare Words',
  blurb: 'Everyone gets the same seven letters. Find words nobody else thinks of: rare words score big, common ones score nothing.',
  min: 2, max: 6,
  simultaneous: true,
  options: [
    { key: 'secs', label: 'Time per round', def: 90, choices: [60, 90, 120].map(v => ({ label: v === 60 ? '1 min' : v === 90 ? '1½ min' : '2 min', value: v })) },
    { key: 'rounds', label: 'Rounds', def: 3, choices: [1, 3, 5].map(v => ({ label: String(v), value: v })) }
  ],

  init(n, opts, round, now) {
    return newRound({ n, secs: opts.secs, rounds: opts.rounds, round: 1, totals: Array(n).fill(0), used: [], done: false }, now || Date.now());
  },

  // entries[seat] = { words: [...], done } or null. Returns the state for the reveal.
  collect(s, entries) {
    const found = new Map();
    entries.forEach((e, seat) => {
      if (!e || !Array.isArray(e.words)) return;
      const seen = new Set();
      for (const raw of e.words) {
        const w = String(raw).toUpperCase();
        if (w.length < 3 || w.length > 7 || seen.has(w) || !fits(w, s.letters)) continue;
        seen.add(w);
        if (!found.has(w)) found.set(w, []);
        found.get(w).push(seat);
      }
    });
    const gained = Array(s.n).fill(0);
    const words = [...found].map(([w, by]) => {
      const pts = points(w.length, by.length);
      by.forEach(i => { gained[i] += pts; });
      return { w, by, pts };
    });
    words.sort((a, b) => a.by.length - b.by.length || b.w.length - a.w.length || a.w.localeCompare(b.w));
    return { ...s, phase: 'reveal', reveal: { words, gained, seedFound: found.has(s.seed) }, totals: s.totals.map((t, i) => t + gained[i]) };
  },

  next(s, now) {
    if (s.round >= s.rounds) return { ...s, done: true };
    return newRound({ ...s, round: s.round + 1 }, now || Date.now());
  },

  status(s) {
    if (!s.done) return { over: false };
    const max = Math.max(...s.totals);
    return { over: true, winners: s.totals.map((t, i) => t === max ? i : -1).filter(i => i >= 0) };
  },

  scores(s) { return s.totals; },
  roundLabel(s) { return `Round ${s.round} of ${s.rounds}`; },
  turnMs(s) { return LEAD_MS + s.secs * 1000; },

  render(el, s, ctx) {
    if (s.done) return; // the shell shows final scores
    const key = [s.round, s.phase, ctx.mySeat, ctx.endsAt].join('|');
    const c = el._rw;
    if (c && c.key === key && c.root.isConnected) { c.ctx = ctx; c.s = s; c.refresh(); return; }
    if (s.phase === 'play') renderPlay(el, s, ctx, key);
    else renderReveal(el, s, ctx, key);
  }
};

/* ---------- playing a round ---------- */
function renderPlay(el, s, ctx, key) {
  const seat = ctx.mySeat, playing = seat >= 0;
  const startsAt = ctx.endsAt - s.secs * 1000;
  const c = {
    key, ctx, s, typed: [], order: [0, 1, 2, 3, 4, 5, 6],
    words: (ctx.myEntry && Array.isArray(ctx.myEntry.words)) ? ctx.myEntry.words.slice() : [],
    done: !!(ctx.myEntry && ctx.myEntry.done), ended: false, lastFinish: 0, started: false
  };
  el._rw = c;

  const timer = h('span', { class: 'rw-timer' }, '');
  const word = h('div', { class: 'rw-word', 'aria-live': 'polite' });
  const msg = h('div', { class: 'rw-msg', role: 'status' });
  const tiles = h('div', { class: 'rw-tiles' });
  const count = h('span', {});
  const list = h('div', { class: 'rw-list' });
  const doneBtn = h('button', { class: 'btn ghost wide', onclick: () => finishMine() }, 'I’m done');
  const shuffleBtn = h('button', { class: 'btn ghost small', onclick: () => { c.order = shuffled(c.order); draw(); } }, 'Shuffle');
  const delBtn = h('button', { class: 'btn ghost small', onclick: () => { c.typed.pop(); draw(); } }, 'Delete');
  const enterBtn = h('button', { class: 'btn small', onclick: () => submit() }, 'Enter');
  const tileBtns = c.order.map(() => h('button', { class: 'tile' }));
  tileBtns.forEach(b => tiles.append(b));

  const root = h('div', { class: 'rw' },
    h('div', { class: 'rw-top' }, h('span', { class: 'rw-round' }, `Round ${s.round} of ${s.rounds}`), timer),
    word, msg, tiles,
    playing ? h('div', { class: 'rw-ctrl' }, shuffleBtn, delBtn, enterBtn) : h('p', { class: 'sub rw-watch' }, 'You’re watching this round.'),
    playing ? h('div', { class: 'rw-found' }, h('div', { class: 'rw-found-head' }, 'Your words ', count), list) : null,
    playing ? doneBtn : null);
  c.root = root;
  el.replaceChildren(root);

  let msgTimer;
  function say(text, kind) {
    msg.textContent = text; msg.className = 'rw-msg ' + (kind || '');
    if (kind === 'bad') { word.classList.remove('shake'); void word.offsetWidth; word.classList.add('shake'); }
    clearTimeout(msgTimer); msgTimer = setTimeout(() => { msg.textContent = ''; }, 1800);
  }
  const live = () => c.started && !c.ended && !c.done && playing;

  function draw() {
    const letters = c.s.letters;
    tileBtns.forEach((b, k) => {
      const i = c.order[k];
      b.textContent = c.started ? letters[i] : '';
      b.disabled = !live() || c.typed.includes(i);
      b.onclick = () => { if (live() && !c.typed.includes(i)) { c.typed.push(i); draw(); } };
      b.setAttribute('aria-label', c.started ? `Letter ${letters[i]}` : 'Hidden letter');
    });
    const typedWord = c.typed.map(i => letters[i]).join('');
    word.textContent = typedWord || (c.started ? (live() ? 'Tap letters to make a word' : '') : '');
    word.classList.toggle('empty', !typedWord);
    [shuffleBtn, delBtn, enterBtn].forEach(b => { b.disabled = !live(); });
    count.textContent = `(${c.words.length})`;
    list.replaceChildren(...c.words.map(w => h('span', { class: 'rw-chip' + (w.length === 7 ? ' seven' : '') }, w)));
    if (playing) {
      doneBtn.disabled = !live();
      doneBtn.textContent = c.done ? 'Waiting for everyone else…' : 'I’m done';
    }
  }

  function submit() {
    if (!live()) return;
    const w = c.typed.map(i => c.s.letters[i]).join('');
    c.typed = [];
    if (w.length < 3) say('Words need at least 3 letters', 'bad');
    else if (c.words.includes(w)) say('You already have that one', 'bad');
    else if (!dict) say('Still loading the dictionary…', 'bad');
    else if (!dict.has(w.toLowerCase())) say(`${w} isn’t in the dictionary`, 'bad');
    else {
      c.words.unshift(w);
      c.ctx.setEntry({ words: c.words, done: false });
      say(w.length === 7 ? 'All seven letters!' : w.length >= 5 ? 'Nice one' : 'Got it', 'good');
    }
    draw();
  }
  function finishMine() {
    if (!live()) return;
    c.done = true;
    c.ctx.setEntry({ words: c.words, done: true });
    draw();
    if (c.ctx.local) c.ctx.finishRound();
  }

  function onKey(e) {
    if (el._rw !== c || !root.isConnected) { document.removeEventListener('keydown', onKey); return; }
    if (!live() || e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.activeElement && /input|textarea/i.test(document.activeElement.tagName)) return;
    const k = e.key;
    if (k === 'Enter') { e.preventDefault(); submit(); }
    else if (k === 'Backspace') { e.preventDefault(); c.typed.pop(); draw(); }
    else if (k === 'Escape') { c.typed = []; draw(); }
    else if (k === ' ') { e.preventDefault(); c.order = shuffled(c.order); draw(); }
    else if (/^[a-z]$/i.test(k)) {
      const L = k.toUpperCase();
      const i = c.order.map(o => o).find(o => c.s.letters[o] === L && !c.typed.includes(o));
      if (i != null) { c.typed.push(i); draw(); }
    }
  }
  document.addEventListener('keydown', onKey);

  function tick() {
    if (el._rw !== c || !root.isConnected) { clearInterval(iv); document.removeEventListener('keydown', onKey); return; }
    const now = c.ctx.now();
    if (now < startsAt) {
      timer.textContent = `Get ready… ${Math.ceil((startsAt - now) / 1000)}`;
      timer.classList.remove('urgent');
    } else {
      if (!c.started) { c.started = true; draw(); }
      const rem = c.ctx.endsAt - now;
      timer.textContent = fmt(rem);
      timer.classList.toggle('urgent', rem < 10000);
      if (rem <= 0) {
        if (!c.ended) { c.ended = true; c.typed = []; draw(); say('Time’s up!'); }
        // Keep nudging until the round is scored (the shell swaps the screen when it is).
        if (now - c.lastFinish > 2500) { c.lastFinish = now; c.ctx.finishRound(); }
      }
    }
  }
  const iv = setInterval(tick, 200);
  c.refresh = () => draw();
  loadDict().then(() => draw()).catch(() => say('Couldn’t load the dictionary. Check your connection.', 'bad'));
  draw(); tick();
}

/* ---------- round results ---------- */
function renderReveal(el, s, ctx, key) {
  const r = s.reveal, players = ctx.players;
  const c = { key, ctx, s, pressed: false };
  el._rw = c;
  const order = players.map((p, i) => i).sort((a, b) => r.gained[b] - r.gained[a]);
  const gains = h('div', { class: 'rw-gains' }, ...order.map(i => h('span', { class: 'rw-gain', style: `--c:${col(players[i].color)}` },
    h('span', { class: 'sw', style: `background:${col(players[i].color)}` }), players[i].name, h('b', {}, `+${r.gained[i]}`))));

  const rows = r.words.map((x, k) => {
    const label = x.by.length === 1 ? `+${x.pts}` : x.by.length === 2 ? `+${x.pts} each` : (x.w.length === 7 ? `+${x.pts} each` : 'too common');
    const li = h('li', { class: 'rw-row' + (x.by.length === 1 ? ' solo' : '') + (x.pts === 0 ? ' zero' : '') },
      h('span', { class: 'rw-w' }, x.w),
      h('span', { class: 'rw-by' }, ...x.by.map(i => h('span', { class: 'rw-name', style: `color:${col(players[i].color)}` }, players[i].name))),
      h('span', { class: 'rw-pts' }, label));
    li.style.animationDelay = `${Math.min(k * 70, 2000)}ms`;
    return li;
  });
  const last = s.round >= s.rounds;
  const canAdvance = ctx.local || ctx.mySeat >= 0;
  const nextBtn = h('button', {
    class: 'btn wide', disabled: !canAdvance,
    onclick: () => { if (c.pressed) return; c.pressed = true; nextBtn.disabled = true; c.ctx.nextRound(); }
  }, last ? 'See final scores' : 'Next round');

  const root = h('div', { class: 'rw rw-reveal' },
    h('div', { class: 'rw-top' }, h('span', { class: 'rw-round' }, `Round ${s.round} of ${s.rounds} results`)),
    h('p', { class: 'rw-letters' }, ...s.letters.split('').map(L => h('span', {}, L))),
    gains,
    r.words.length ? h('ul', { class: 'rw-words' }, ...rows) : h('p', { class: 'sub' }, 'Nobody found any words this round.'),
    !r.seedFound ? h('p', { class: 'small rw-seed' }, 'Nobody found the seven-letter word: ', h('b', {}, s.seed)) : null,
    h('p', { class: 'small' }, 'Only you found it: 3 points a letter. Two of you: 1 a letter. Three or more: nothing. Using all seven letters adds 10.'),
    nextBtn);
  c.root = root;
  c.refresh = () => {};
  el.replaceChildren(root);
}
