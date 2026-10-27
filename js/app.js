import { GAMES, GAME_LIST, defaultOpts, optsFor } from './games/index.js';
import { h, col } from './games/util.js';
import { LEVELS } from './games/ai.js';
import * as net from './net.js';
import * as chat from './chat.js';

const $ = id => document.getElementById(id);
const clean = s => String(s || '').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, '').trim().slice(0, 14);
const NOT_SET_UP = 'Online play isn’t set up yet. Add your Firebase settings to js/firebase-config.js (see the README).';

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === 's-' + id));
  $('over').classList.remove('on');
  window.scrollTo(0, 0);
}
let toastTimer;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 2600);
}
function seg(el, items, currentIndex, onPick) {
  el.replaceChildren(...items.map((it, i) => h('button', {
    type: 'button', 'aria-pressed': i === currentIndex ? 'true' : 'false', onclick: () => onPick(i)
  }, it)));
}
function optionControls(el, game, opts, onChange, readOnly) {
  el.replaceChildren();
  for (const op of game.options || []) {
    const idx = op.choices.findIndex(c => c.value === opts[op.key]);
    const wrap = h('div', { class: 'seg' });
    el.append(h('span', { class: 'lbl' }, op.label), wrap);
    if (readOnly) { wrap.append(h('span', { class: 'sub' }, op.choices[idx]?.label || '')); continue; }
    seg(wrap, op.choices.map(c => c.label), idx, i => onChange({ ...opts, [op.key]: op.choices[i].value }));
  }
}

/* ---------- home ---------- */
const ART = {
  cribbage: `<svg viewBox="0 0 120 120"><rect x="10" y="38" width="100" height="44" rx="10" fill="color-mix(in srgb,var(--c3) 45%,var(--card))" stroke="var(--ink)" stroke-width="2.5"/>${[0,1,2].map(r=>Array.from({length:10},(_,c)=>`<circle cx="${20+c*9}" cy="${50+r*10}" r="1.8" fill="var(--ink)" opacity=".55"/>`).join('')).join('')}<rect x="45" y="40" width="4" height="13" rx="2" fill="var(--c0)" transform="rotate(-8 47 47)"/><rect x="72" y="49" width="4" height="13" rx="2" fill="var(--c1)" transform="rotate(6 74 55)"/><g transform="translate(66 6) rotate(12 15 20)"><rect width="28" height="38" rx="4" fill="var(--card)" stroke="var(--ink)" stroke-width="2"/><text x="14" y="26" font-size="16" font-weight="800" text-anchor="middle" fill="var(--c1)" font-family="system-ui,sans-serif">5</text></g><g transform="translate(22 82) rotate(-10 15 20)"><rect width="28" height="38" rx="4" fill="var(--card)" stroke="var(--ink)" stroke-width="2"/><text x="14" y="26" font-size="15" font-weight="800" text-anchor="middle" fill="var(--ink)" font-family="system-ui,sans-serif">J</text></g></svg>`,
  dice: `<svg viewBox="0 0 120 120">${[[14,40,-12,[0,4,8],'var(--card)','var(--ink)'],[46,26,6,[0,2,4,6,8],'var(--c1)','var(--paper)'],[74,50,14,[0,2,6,8],'var(--card)','var(--ink)']].map(([x,y,r,on,bg,pc])=>`<g transform="translate(${x} ${y}) rotate(${r} 17 17)"><rect width="34" height="34" rx="7" fill="${bg}" stroke="var(--ink)" stroke-width="2.5"/>${on.map(k=>`<circle cx="${8+(k%3)*9}" cy="${8+Math.floor(k/3)*9}" r="3" fill="${pc}"/>`).join('')}</g>`).join('')}</svg>`,
  euchre: `<svg viewBox="0 0 120 120">${[[-14,30,'J','♠','var(--ink)'],[0,44,'J','♣','var(--ink)'],[14,58,'A','♥','var(--c1)']].map(([rot,x,r,su,c])=>`<g transform="translate(${x} 22) rotate(${rot} 18 70)"><rect width="38" height="54" rx="5" fill="var(--card)" stroke="var(--ink)" stroke-width="2.5"/><text x="6" y="15" font-size="12" font-weight="800" fill="${c}" font-family="system-ui,sans-serif">${r}</text><text x="19" y="40" font-size="20" text-anchor="middle" fill="${c}">${su}</text></g>`).join('')}</svg>`,
  eights: `<svg viewBox="0 0 120 120"><g transform="translate(22 30) rotate(-8 19 27)"><rect width="38" height="54" rx="5" fill="var(--c0)" stroke="var(--ink)" stroke-width="2.5"/><path d="M6 6h26v42H6z" fill="none" stroke="var(--paper)" stroke-width="1.5" opacity=".6"/></g><g transform="translate(56 26) rotate(9 19 27)"><rect width="38" height="54" rx="5" fill="var(--card)" stroke="var(--ink)" stroke-width="2.5"/><text x="19" y="38" font-size="28" font-weight="800" text-anchor="middle" fill="var(--c1)" font-family="system-ui,sans-serif">8</text><text x="6" y="14" font-size="10" fill="var(--c1)">♦</text></g><g font-size="14"><text x="20" y="104" fill="var(--ink)">♠</text><text x="42" y="104" fill="var(--c1)">♥</text><text x="64" y="104" fill="var(--ink)">♣</text><text x="86" y="104" fill="var(--c1)">♦</text></g></svg>`,
  rare: `<svg viewBox="0 0 120 120">${['R','A','R','E'].map((L,k)=>`<g transform="translate(${14+k*24} ${k%2?46:34}) rotate(${[-8,5,-4,9][k]} 11 11)"><rect width="22" height="24" rx="5" fill="var(--card)" stroke="var(--ink)" stroke-width="2.5"/><text x="11" y="17.5" text-anchor="middle" font-size="15" font-weight="800" font-family="Bricolage Grotesque,system-ui,sans-serif" fill="${['var(--c0)','var(--c1)','var(--c2)','var(--c3)'][k]}">${L}</text></g>`).join('')}<g transform="translate(38 76)">${['W','O','R','D','S'].map((L,k)=>`<g transform="translate(${k*9} 0)"><rect width="8" height="10" rx="2" fill="var(--ink)"/></g>`).join('')}</g><circle cx="98" cy="88" r="10" fill="none" stroke="var(--c3)" stroke-width="3"/><path d="M98 82v6l4 3" stroke="var(--c3)" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`,
  dots: `<svg viewBox="0 0 120 120"><rect x="20" y="20" width="40" height="40" rx="3" fill="var(--c0)" opacity=".25"/><g stroke-width="7" stroke-linecap="round"><line x1="20" y1="20" x2="60" y2="20" stroke="var(--c0)"/><line x1="60" y1="20" x2="60" y2="60" stroke="var(--c1)"/><line x1="20" y1="60" x2="60" y2="60" stroke="var(--c0)"/><line x1="20" y1="20" x2="20" y2="60" stroke="var(--c0)"/><line x1="100" y1="60" x2="100" y2="100" stroke="var(--c1)"/></g><g fill="var(--dot)"><circle cx="20" cy="20" r="6"/><circle cx="60" cy="20" r="6"/><circle cx="100" cy="20" r="6"/><circle cx="20" cy="60" r="6"/><circle cx="60" cy="60" r="6"/><circle cx="100" cy="60" r="6"/><circle cx="20" cy="100" r="6"/><circle cx="60" cy="100" r="6"/><circle cx="100" cy="100" r="6"/></g></svg>`,
  ttt: `<svg viewBox="0 0 120 120" fill="none" stroke-linecap="round"><g stroke="var(--line)" stroke-width="5"><line x1="45" y1="10" x2="45" y2="110"/><line x1="75" y1="10" x2="75" y2="110"/><line x1="10" y1="45" x2="110" y2="45"/><line x1="10" y1="75" x2="110" y2="75"/></g><g stroke="var(--c0)" stroke-width="8"><line x1="17" y1="17" x2="37" y2="37"/><line x1="37" y1="17" x2="17" y2="37"/><line x1="83" y1="83" x2="103" y2="103"/><line x1="103" y1="83" x2="83" y2="103"/></g><circle cx="60" cy="60" r="11" stroke="var(--c1)" stroke-width="8"/><circle cx="93" cy="27" r="11" stroke="var(--c1)" stroke-width="8"/></svg>`,
  four: `<svg viewBox="0 0 120 120"><rect x="8" y="22" width="104" height="90" rx="12" fill="var(--ink)"/><g fill="var(--paper)">${[0,1,2,3].map(r => [0,1,2,3].map(c => `<circle cx="${26 + c * 23}" cy="${40 + r * 21}" r="8"/>`).join('')).join('')}</g><circle cx="26" cy="103" r="8" fill="var(--c1)"/><circle cx="49" cy="103" r="8" fill="var(--c0)"/><circle cx="49" cy="82" r="8" fill="var(--c1)"/><circle cx="72" cy="103" r="8" fill="var(--c1)"/><circle cx="72" cy="82" r="8" fill="var(--c0)"/><circle cx="60" cy="10" r="8" fill="var(--c0)"/></svg>`,
  checkers: `<svg viewBox="0 0 120 120"><rect x="10" y="10" width="100" height="100" rx="6" fill="var(--card)" stroke="var(--ink)" stroke-width="3"/>${[0,1,2,3].map(r=>[0,1,2,3].map(c=>(r+c)%2?`<rect x="${10+c*25}" y="${10+r*25}" width="25" height="25" fill="var(--ink)" opacity=".85"/>`:'').join('')).join('')}<circle cx="47.5" cy="22.5" r="9" fill="var(--c1)"/><circle cx="97.5" cy="22.5" r="9" fill="var(--c1)"/><circle cx="22.5" cy="72.5" r="9" fill="var(--c0)"/><circle cx="72.5" cy="97.5" r="9" fill="var(--c0)"/><circle cx="72.5" cy="47.5" r="9" fill="var(--c0)"/><path d="M66.5 50.5 66 44l3 2.5 3.5-4 3.5 4 3-2.5-.5 6.5z" fill="var(--paper)"/></svg>`,
  reversi: `<svg viewBox="0 0 120 120"><g stroke="var(--line)" stroke-width="2.5">${[0,1,2,3,4].map(k=>`<line x1="${20+k*20}" y1="20" x2="${20+k*20}" y2="100"/><line x1="20" y1="${20+k*20}" x2="100" y2="${20+k*20}"/>`).join('')}</g><circle cx="50" cy="50" r="8" fill="var(--c1)"/><circle cx="70" cy="50" r="8" fill="var(--c0)"/><circle cx="50" cy="70" r="8" fill="var(--c0)"/><circle cx="70" cy="70" r="8" fill="var(--c0)"/><circle cx="90" cy="90" r="8" fill="var(--c0)"/><circle cx="30" cy="30" r="8" fill="var(--c1)"/></svg>`,
  mancala: `<svg viewBox="0 0 120 120"><rect x="6" y="30" width="108" height="60" rx="30" fill="var(--card)" stroke="var(--ink)" stroke-width="3"/><ellipse cx="22" cy="60" rx="9" ry="20" fill="var(--paper)" stroke="var(--line)" stroke-width="2"/><ellipse cx="98" cy="60" rx="9" ry="20" fill="var(--paper)" stroke="var(--line)" stroke-width="2"/>${[0,1,2].map(c=>[0,1].map(r=>`<circle cx="${45+c*15}" cy="${48+r*24}" r="6" fill="var(--paper)" stroke="var(--line)" stroke-width="2"/>`).join('')).join('')}<g fill="var(--c3)"><circle cx="43" cy="47" r="2.4"/><circle cx="47" cy="50" r="2.4"/><circle cx="60" cy="72" r="2.4"/><circle cx="95" cy="56" r="2.4"/><circle cx="100" cy="63" r="2.4"/><circle cx="97" cy="69" r="2.4"/></g></svg>`
};
function playersText(g) { return (g.min === g.max ? `${g.min} players` : `${g.min}–${g.max} players`) + (g.simultaneous ? ' · everyone at once' : ''); }

function drawHome() {
  $('cards').replaceChildren(...GAME_LIST.map(g => {
    const art = h('div', { class: 'art', 'aria-hidden': 'true' });
    art.innerHTML = ART[g.id] || '';
    return h('button', { class: 'card', onclick: () => openSetup(g.id) },
      art, h('div', { class: 'txt' }, h('b', {}, g.name), h('span', { class: 'meta' }, playersText(g))));
  }));
  const last = net.ls.get('kt-room');
  $('rejoin').hidden = !(last && net.enabled);
  if (last) $('rejoin-text').textContent = `You were in game ${last}`;
}
$('rejoin-go').onclick = async () => {
  const code = net.ls.get('kt-room'), name = net.ls.get('kt-name') || 'Player';
  try {
    if (await net.joinRoom(code, name)) enterRoom(code);
    else { net.ls.del('kt-room'); drawHome(); toast(`Game ${code} has ended.`); }
  } catch (e) { toast('Couldn’t reconnect. Check your connection.'); }
};
$('home-join').onclick = () => openJoin('');
document.querySelectorAll('[data-home]').forEach(b => b.onclick = () => { drawHome(); show('home'); });

/* ---------- setup (pass-and-play or host) ---------- */
const setup = { game: null, mode: 0, n: 2, names: ['', '', '', '', '', ''], bots: [false, false, false, false, false, false], level: 'medium', opts: {} };
const DEFAULT_NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4', 'Player 5', 'Player 6'];

function openSetup(id) {
  const g = GAMES[id];
  setup.game = g; setup.n = Math.max(g.min, Math.min(setup.n, g.max)); setup.opts = defaultOpts(g);
  $('setup-title').textContent = g.name;
  $('setup-blurb').textContent = g.blurb;
  $('host-name').value = net.ls.get('kt-name') || '';
  $('host-note').textContent = '';
  drawSetup(); show('setup');
}
function drawSetup() {
  const g = setup.game;
  seg($('setup-mode'), ['Pass and play', 'Play online'], setup.mode, i => { setup.mode = i; drawSetup(); });
  $('setup-local').hidden = setup.mode !== 0;
  $('setup-online').hidden = setup.mode !== 1;
  const counts = []; for (let n = g.min; n <= g.max; n++) counts.push(n);
  $('local-count').parentElement.querySelector('label').hidden = counts.length < 2;
  $('local-count').hidden = counts.length < 2;
  seg($('local-count'), counts.map(n => n === 1 ? 'Just me' : `${n} players`), counts.indexOf(setup.n), i => { setup.n = counts[i]; drawSetup(); });
  const canBot = !!g.bot;
  const anyBot = canBot && setup.bots.slice(0, setup.n).some(Boolean);
  $('local-names').replaceChildren(...Array.from({ length: setup.n }, (_, i) => {
    const isBot = canBot && setup.bots[i];
    const inp = h('input', { type: 'text', maxlength: 14, placeholder: isBot ? botName(i) : DEFAULT_NAMES[i], 'aria-label': `Player ${i + 1} name` });
    inp.value = setup.names[i];
    inp.oninput = () => { setup.names[i] = inp.value; };
    const toggle = canBot ? h('button', {
      type: 'button', class: 'bot-toggle', 'aria-pressed': isBot ? 'true' : 'false', title: 'Make this a computer player',
      onclick: () => { setup.bots[i] = !setup.bots[i]; setup.names[i] = ''; drawSetup(); }
    }, isBot ? '🤖 Computer' : 'Person') : null;
    return h('div', { class: 'pl-row' }, h('span', { class: 'sw', style: `background:${col(i)}` }), inp, toggle);
  }));
  $('local-level').hidden = !anyBot;
  if (anyBot) seg($('local-level-seg'), LEVELS.map(l => l.label), LEVELS.findIndex(l => l.value === setup.level), k => { setup.level = LEVELS[k].value; drawSetup(); });
  $('local-bot-hint').hidden = !canBot || anyBot;
  const allBots = canBot && setup.bots.slice(0, setup.n).every(Boolean);
  $('local-start').disabled = allBots;
  $('local-start').textContent = allBots ? 'At least one person has to play' : 'Start game';
  optionControls($('local-opts'), g, setup.opts, o => { setup.opts = o; drawSetup(); });
}
function botName(i) {
  const before = setup.bots.slice(0, i).filter(Boolean).length;
  return before ? `Computer ${before + 1}` : 'Computer';
}

/* ---------- shared play view ---------- */
// view = { game, state, players:[{name,color,away}], mySeat (-1 = everyone, -2 = watching, n = seat),
//          online, busy, onMove, actions:[{label, fn, ghost, disabled}] }
function drawPlay(view) {
  const { game, state, players } = view;
  const st = game.status(state);
  const scores = game.scores ? game.scores(state) : null;
  $('chips').replaceChildren(...players.map((p, i) => {
    const isTurn = !game.simultaneous && !st.over && state.turn === i;
    const chip = h('div', { class: 'chip' + (isTurn ? ' turn' : '') + (p.away ? ' away' : '') + (view.done && view.done[i] ? ' done' : '') },
      h('span', { class: 'sw', style: `background:${col(p.color)}` }),
      game.badge ? h('span', { class: 'bd', style: `color:${col(p.color)}` }, game.badge(i)) : null,
      h('span', { class: 'nm' }, p.name + (view.online && i === view.mySeat ? ' (you)' : '')),
      scores ? h('span', { class: 'sc' }, String(scores[i])) : null);
    chip.style.setProperty('--c', col(p.color));
    return chip;
  }));

  const status = $('status'); status.replaceChildren();
  status.hidden = !!game.simultaneous;
  if (!st.over && !game.simultaneous && game.isPublic && game.isPublic(state)) {
    status.append(h('span', {}, game.note ? game.note(state) : ''));
  } else if (!st.over && !game.simultaneous) {
    const cur = players[state.turn];
    let text = cur.name + '’s turn';
    if (view.online && view.mySeat === state.turn) text = 'Your turn';
    if (!view.online && view.soloHuman === state.turn) text = 'Your turn';
    status.append(h('span', { style: `color:${col(cur.color)}` }, text));
    let extra = game.note ? game.note(state) : '';
    if (view.online && cur.away && view.mySeat !== state.turn) extra = 'Waiting for them to come back';
    if (view.mySeat === -2) extra = 'You’re watching';
    if (view.lock) extra = 'Thinking…';
    if (extra) status.append(h('small', {}, extra));
  }

  if (view.handoff) view.handoff($('board'));
  else if (game.simultaneous) {
    game.render($('board'), state, { players, mySeat: view.mySeat, ...view.sim });
  } else {
    const acts = seat => game.canAct ? game.canAct(state, seat) : seat === state.turn;
    const canMove = !st.over && !view.busy && !view.lock && (view.mySeat === -1 || acts(view.mySeat));
    game.render($('board'), state, { players, canMove, onMove: view.onMove, mySeat: view.mySeat });
  }

  if (st.over) showOver(view, st, scores); else $('over').classList.remove('on');
}

function showOver(view, st, scores) {
  const { players } = view, res = $('result');
  res.replaceChildren();
  if (view.game.resultText) res.textContent = view.game.resultText(view.state, players);
  else if (st.draw || st.winners.length !== 1) res.textContent = st.draw || !scores ? 'It’s a draw' : `Tie at ${scores[st.winners[0]]}`;
  else {
    const w = st.winners[0];
    res.append(h('span', { style: `color:${col(players[w].color)}` }, view.online && view.mySeat === w ? 'You win!' : players[w].name + ' wins'));
  }
  const rows = players.map((p, i) => ({ p, i, n: scores ? scores[i] : null }));
  if (scores) rows.sort((a, b) => b.n - a.n);
  $('final').replaceChildren(...rows.map(({ p, n }) => h('li', {},
    h('span', { class: 'sw', style: `background:${col(p.color)}` }), h('span', {}, p.name), n != null ? h('b', {}, String(n)) : null)));
  $('final').hidden = !scores;
  $('ov-actions').replaceChildren(...view.actions.map(a =>
    h('button', { class: 'btn' + (a.ghost ? ' ghost' : ''), disabled: !!a.disabled, onclick: a.fn }, a.label)));
  $('over').classList.add('on');
}

/* ---------- pass and play ---------- */
let local = null;
$('local-start').onclick = () => {
  const g = setup.game;
  const players = Array.from({ length: setup.n }, (_, i) => {
    const bot = g.bot && setup.bots[i] ? setup.level : null;
    return { name: clean(setup.names[i]) || (bot ? botName(i) : DEFAULT_NAMES[i]), color: i, bot };
  });
  local = { game: g, players, opts: { ...setup.opts }, round: 0, viewer: -1 };
  local.state = g.init(players.length, local.opts, 0, Date.now());
  resetLocalSim();
  $('board').removeAttribute('data-last');
  $('play-tag').textContent = g.name;
  $('play-leave').onclick = () => { if (local) clearTimeout(local.botTimer); local = null; drawHome(); show('home'); };
  show('play'); drawLocal();
};
// Everyone-at-once games on one device: each player gets a private turn, then everyone sees the reveal.
function resetLocalSim() { local.sim = { active: 0, entries: [], endsAt: null, token: 0 }; }
function drawLocal() {
  const g = local.game, sim = local.sim;
  const view = {
    game: g, state: local.state, players: local.players, mySeat: -1, online: false,
    onMove: mv => { const n = g.move(local.state, mv, local.state.turn); if (n) { local.state = n; drawLocal(); } },
    actions: [
      { label: 'Play again', fn: () => { local.round++; local.state = g.init(local.players.length, local.opts, local.round, Date.now()); if (g.simultaneous) resetLocalSim(); local.viewer = -1; $('board').removeAttribute('data-last'); drawLocal(); } },
      { label: 'Change setup', ghost: true, fn: () => { local = null; openSetup(setup.game.id); } }
    ]
  };
  const humans = local.players.map((p, i) => p.bot ? -1 : i).filter(i => i >= 0);
  if (humans.length === 1 && local.players.length > 1) {
    view.soloHuman = humans[0];
    if (!g.simultaneous) view.mySeat = humans[0]; // e.g. flips the checkers board to your side
  }
  const humanCanAct = !!g.canAct && humans.some(i => g.canAct(local.state, i));
  const botTurn = !g.simultaneous && !g.status(local.state).over && !!local.players[local.state.turn].bot && !humanCanAct;
  const isPublic = !!(g.isPublic && g.isPublic(local.state));
  if (botTurn) view.lock = true;
  if (g.hiddenHands && !g.status(local.state).over && humans.length === 1) {
    // One person against the computer: always show their hand, never a hand-off screen.
    view.mySeat = humans[0];
    if (botTurn) view.lock = true;
  } else if (g.hiddenHands && !g.status(local.state).over && isPublic) {
    view.mySeat = local.viewer >= 0 ? local.viewer : local.state.turn; // everything is face up: no hand-off needed
  } else if (g.hiddenHands && !g.status(local.state).over && botTurn) {
    view.mySeat = -2; // several people sharing the device: hide every hand while the computer plays
  } else if (g.hiddenHands && !g.status(local.state).over) {
    // Card games on one device: hand it to whoever acts next, so nobody sees another hand.
    const st = local.state;
    if (local.players.length > 1 && local.viewer !== st.turn) {
      const p = local.players[st.turn];
      view.handoff = el => el.replaceChildren(h('div', { class: 'handoff' },
        h('div', { class: 'handoff-name', style: `color:${col(p.color)}` }, `Pass to ${p.name}`),
        h('p', { class: 'sub' }, 'Everyone else, look away.'),
        h('button', { class: 'btn', onclick: () => { local.viewer = st.turn; drawLocal(); } }, `I’m ${p.name}`)));
    } else {
      local.viewer = st.turn;
      view.mySeat = st.turn;
    }
  }
  if (g.simultaneous) {
    const st = local.state;
    // People take private turns one after another; computer players fill in their answers at the end.
    const seatNow = humans[sim.active];
    view.done = local.players.map((p, i) => st.phase === 'play' && (!!p.bot || humans.indexOf(i) < sim.active));
    if (st.phase === 'play' && sim.endsAt == null) {
      const p = local.players[seatNow];
      const alone = humans.length === 1;
      view.handoff = el => el.replaceChildren(h('div', { class: 'handoff' },
        h('p', { class: 'sub' }, g.roundLabel ? g.roundLabel(st) : ''),
        h('div', { class: 'handoff-name', style: `color:${col(p.color)}` }, alone ? `Ready, ${p.name}?` : `Pass to ${p.name}`),
        h('p', { class: 'sub' }, alone ? (local.players.length > 1 ? 'The computer players are ready when you are.' : '') : 'Everyone else, no peeking.'),
        h('button', { class: 'btn', onclick: () => { sim.endsAt = Date.now() + g.turnMs(st); drawLocal(); } }, 'I’m ready')));
    } else {
      const token = sim.token;
      view.mySeat = st.phase === 'play' ? seatNow : -1;
      view.sim = {
        local: true, now: () => Date.now(), endsAt: sim.endsAt,
        myEntry: sim.entries[seatNow] || null,
        setEntry: e => { if (sim.token === token) sim.entries[seatNow] = e; },
        finishRound: () => {
          if (sim.token !== token || local.state.phase !== 'play') return;
          sim.token++; sim.active++; sim.endsAt = null;
          if (sim.active >= humans.length) {
            const entries = local.players.map((p, i) => p.bot ? g.bot.entry(local.state, p.bot) : (sim.entries[i] || null));
            local.state = g.collect(local.state, entries, Date.now());
            resetLocalSim();
          }
          drawLocal();
        },
        nextRound: () => { if (local.state.phase !== 'reveal') return; local.state = g.next(local.state, Date.now()); resetLocalSim(); drawLocal(); }
      };
    }
  }
  drawPlay(view);
  if (botTurn) scheduleBot();
}

// Let the computer take its turn after a short pause, so it feels like someone thinking.
function scheduleBot() {
  const L = local, token = (L.botToken = (L.botToken || 0) + 1);
  clearTimeout(L.botTimer);
  L.botTimer = setTimeout(() => {
    if (local !== L || L.botToken !== token) return;
    const g = L.game, st = L.state, seat = st.turn, level = L.players[seat].bot;
    if (!level || g.status(st).over) return;
    let next = null;
    try { const mv = g.bot.pick(st, seat, level, g); next = mv != null ? g.move(st, mv, seat) : null; } catch (e) { console.error(e); }
    if (next) { L.state = next; drawLocal(); }
    else console.warn('Computer player could not find a move');
  }, 650 + Math.random() * 500);
}

/* ---------- online: host and join ---------- */
$('host-go').onclick = async () => {
  const name = clean($('host-name').value), note = $('host-note');
  if (!net.enabled) { note.textContent = NOT_SET_UP; return; }
  if (!name) { note.textContent = 'Enter your name to host.'; $('host-name').focus(); return; }
  net.ls.set('kt-name', name);
  const btn = $('host-go'); btn.disabled = true; btn.textContent = 'Creating…'; note.textContent = '';
  try { enterRoom(await net.createRoom(name, setup.game.id)); }
  catch (e) { note.textContent = 'Couldn’t create a game. Check your connection and try again.'; console.error(e); }
  finally { btn.disabled = false; btn.textContent = 'Create game'; }
};

function openJoin(code) {
  $('join-code').value = code; $('join-name').value = net.ls.get('kt-name') || '';
  $('join-note').textContent = net.enabled ? '' : NOT_SET_UP;
  show('join');
  (code ? $('join-name') : $('join-code')).focus();
}
$('join-code').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); });
$('join-go').onclick = async () => {
  const code = $('join-code').value.trim().toUpperCase(), name = clean($('join-name').value), note = $('join-note');
  if (!net.enabled) { note.textContent = NOT_SET_UP; return; }
  if (code.length !== 4) { note.textContent = 'Enter the 4-letter code from your host.'; $('join-code').focus(); return; }
  if (!name) { note.textContent = 'Enter your name so others know who you are.'; $('join-name').focus(); return; }
  net.ls.set('kt-name', name);
  const btn = $('join-go'); btn.disabled = true; btn.textContent = 'Joining…'; note.textContent = '';
  try {
    if (await net.joinRoom(code, name)) enterRoom(code);
    else note.textContent = `No game found with code ${code}. Check the code with your host.`;
  } catch (e) { note.textContent = 'Couldn’t join. Check your connection and try again.'; console.error(e); }
  finally { btn.disabled = false; btn.textContent = 'Join game'; }
};

/* ---------- online: in a room ---------- */
let room = null; // { code, data, unwatch, busy, lastRev }

async function enterRoom(code) {
  leaveRoomQuietly();
  room = { code, data: null, busy: false };
  net.ls.set('kt-room', code);
  history.replaceState(null, '', '#' + code);
  $('lobby-code').textContent = code;
  chat.attach(code);
  try {
    room.unwatch = await net.watch(code, data => {
      if (!room || room.code !== code) return;
      room.data = data;
      chat.update(data);
      // Chat and reactions don't change the game, so skip redrawing the board for them.
      const sig = data ? JSON.stringify({ ...data, chat: null, react: null }) : '';
      if (sig !== room.sig || !data) { room.sig = sig; drawRoom(); }
    });
  }
  catch (e) { toast('Couldn’t connect to the game.'); }
}
function leaveRoomQuietly() {
  chat.detach();
  if (!room) return;
  try { room.unwatch && room.unwatch(); } catch (e) {}
  room = null;
}
async function leaveRoom() {
  const code = room && room.code;
  leaveRoomQuietly();
  net.ls.del('kt-room');
  history.replaceState(null, '', location.pathname);
  drawHome(); show('home');
  if (code) net.leave(code);
}
document.querySelectorAll('[data-leave]').forEach(b => b.onclick = leaveRoom);

function roomPlayers(d) {
  const online = d.online || {};
  return Object.entries(d.players || {})
    .map(([id, p]) => ({ id, ...p, here: !!online[id] }))
    .sort((a, b) => a.t - b.t);
}
function controllerOf(d, players) {
  if (d.online && d.online[d.host]) return d.host;
  const first = players.find(p => p.here);
  return first ? first.id : d.host;
}

function drawRoom() {
  const d = room.data;
  if (!d) { toast('This game has ended.'); leaveRoom(); return; }
  const players = roomPlayers(d);
  if (d.phase === 'lobby') drawLobby(d, players);
  else drawOnlinePlay(d, players);
}

function drawLobby(d, players) {
  if (!$('s-lobby').classList.contains('on')) show('lobby');
  const game = GAMES[d.game], me = net.pid, ctrl = controllerOf(d, players), isCtrl = ctrl === me;
  const ctrlName = (players.find(p => p.id === ctrl) || {}).name || 'the host';
  $('lobby-hint').textContent = 'Friends open this site, tap Join with a code, and enter it.';
  $('lobby-roster').replaceChildren(...players.map(p => h('li', { class: p.here ? '' : 'away' },
    h('span', { class: 'sw', style: `background:${col(p.color)}` }), h('span', {}, p.name),
    h('em', {}, [p.id === ctrl ? 'host' : '', p.id === me ? 'you' : '', p.here ? '' : 'away'].filter(Boolean).join(', ')))));

  $('lobby-game-title').textContent = game.name;
  $('lobby-ctl').hidden = !isCtrl;
  const here = players.filter(p => p.here).length;
  const opts = optsFor(game, d.opts);
  if (isCtrl) {
    seg($('lobby-games'), GAME_LIST.map(g => g.name), GAME_LIST.indexOf(game), i => net.setLobby(room.code, GAME_LIST[i].id, {}));
    optionControls($('lobby-opts'), game, opts, o => net.setLobby(room.code, game.id, o));
    $('lobby-start').disabled = here < game.min;
  }
  let msg;
  if (here < game.min) msg = `${game.name} needs at least ${game.min} players. Waiting for more to join.`;
  else if (here > game.max) msg = `${game.name} is for up to ${game.max} players. The first ${game.max} to join will play and the rest can watch.`;
  else msg = isCtrl ? 'Everyone in? Start when you’re ready.' : `Waiting for ${ctrlName} to start.`;
  if (!isCtrl && (game.options || []).length) msg = (game.options.map(op => op.choices.find(c => c.value === opts[op.key])?.label).join(', ')) + '. ' + msg;
  $('lobby-msg').textContent = msg;
}
$('lobby-start').onclick = () => net.start(room.code).then(ok => { if (!ok) toast('Couldn’t start. Make sure enough players are here.'); });
$('lobby-share').onclick = async () => {
  const url = location.origin + location.pathname + '#' + room.code;
  const text = `Join my game on Parker Kitchen Table. Code: ${room.code}`;
  try {
    if (navigator.share) await navigator.share({ title: 'Parker Kitchen Table', text, url });
    else { await navigator.clipboard.writeText(url); toast('Link copied'); }
  } catch (e) { /* share sheet dismissed */ }
};

function drawOnlinePlay(d, playersAll) {
  const game = GAMES[d.game];
  let seats, state;
  try { seats = JSON.parse(d.seats); state = JSON.parse(d.state); } catch (e) { return; }
  if (!$('s-play').classList.contains('on')) {
    $('board').removeAttribute('data-last');
    $('play-tag').textContent = `${game.name} · ${room.code}`;
    $('play-leave').onclick = leaveRoom;
    show('play');
  }
  const byId = Object.fromEntries(playersAll.map(p => [p.id, p]));
  const players = seats.map(id => ({ name: byId[id]?.name || 'Player', color: byId[id]?.color ?? 0, away: !byId[id]?.here }));
  const mySeat = seats.indexOf(net.pid);
  const rev = d.rev;
  const view = {
    game, state, players, mySeat: mySeat >= 0 ? mySeat : -2, online: true, busy: room.busy,
    onMove: async mv => {
      if (room.busy) return;
      const r = room;
      r.busy = true; drawRoom();
      // If a weak connection keeps the move from confirming, don't leave the player locked out.
      const release = setTimeout(() => {
        if (room === r && r.busy) { r.busy = false; drawRoom(); toast('Slow connection. If your move didn’t show up, try again.'); }
      }, 10000);
      try { await net.move(r.code, mv); } catch (e) { toast('That move didn’t go through. Try again.'); }
      clearTimeout(release);
      if (room === r) { r.busy = false; drawRoom(); }
    },
    actions: [
      { label: 'Play again', fn: () => net.rematch(room.code, rev) },
      { label: 'Back to lobby', ghost: true, fn: () => net.toLobby(room.code) },
      { label: 'Leave game', ghost: true, fn: leaveRoom }
    ]
  };
  if (game.simultaneous) {
    // Each player's words for this round live in entries/r<round>/<pid> until the round is scored.
    const bucket = (d.entries || {})['r' + state.round] || {};
    const entries = seats.map(id => { try { return bucket[id] ? JSON.parse(bucket[id]) : null; } catch (e) { return null; } });
    view.done = entries.map(e => !!(e && e.done) && state.phase === 'play');
    const code = room.code, round = state.round;
    view.sim = {
      local: false, now: net.now, endsAt: state.endsAt,
      myEntry: mySeat >= 0 ? entries[mySeat] : null,
      setEntry: e => net.setEntry(code, round, e).catch(() => toast('Couldn’t save that word. Check your connection.')),
      finishRound: () => net.finishRound(code, round).catch(() => {}),
      nextRound: () => net.nextRound(code, rev).catch(() => {})
    };
    // Everyone still here pressed Done: wrap the round up early.
    const herePlayers = seats.map((id, i) => ({ i, here: !!byId[id]?.here }));
    if (state.phase === 'play' && herePlayers.every(p => !p.here || view.done[p.i]) && herePlayers.some(p => p.here)) view.sim.finishRound();
  }
  drawPlay(view);
}

/* ---------- start ---------- */
drawHome();
const hashCode = (location.hash || '').slice(1).toUpperCase();
if (/^[A-Z]{4}$/.test(hashCode)) {
  if (net.ls.get('kt-room') === hashCode && net.enabled) $('rejoin-go').click();
  else openJoin(hashCode);
}
