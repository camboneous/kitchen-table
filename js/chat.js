/*
  Room chat and quick reactions. Online games only; pass-and-play is one device, so it's hidden there.
  Messages: rooms/<CODE>/chat/<id> = { n: name, c: color, x: text, p: player id, t: time }
  Reactions: rooms/<CODE>/react/<player id> = { e: emoji, t: time }
*/
import { h, col } from './games/util.js';
import { GAMES } from './games/index.js';
import * as net from './net.js';
import BAD from './badwords.js';

const EMOJI = ['🎉', '😂', '😮', '😤', '👏', '🔥'];
const PHRASES = ['Nice move!', 'Good game', 'Rematch?', 'Hurry up!', 'No way!', 'Your turn!'];
const MAX_LEN = 200;
const COOLDOWN_MS = 1200;

const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BAD_RE = new RegExp(`\\b(?:${BAD.map(escRe).join('|')})(?:s|es|ed|ing|er|ers|y)?\\b`, 'gi');
export const mask = text => text.replace(BAD_RE, m => m[0] + '*'.repeat(m.length - 1));
const tidy = s => String(s || '').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);

let code = null, data = null, isOpen = false, trayOpen = false;
let lastRead = 0, primed = false, seenMsgs = new Set(), seenReact = {}, lastSend = 0;

/* ---------- DOM ---------- */
const badge = h('span', { class: 'chat-badge', hidden: true });
const chatBtn = h('button', { class: 'fab', 'aria-label': 'Open chat', onclick: () => setOpen(!isOpen) },
  svgIcon('<path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>'), badge);
const reactBtn = h('button', { class: 'fab', 'aria-label': 'Quick reactions', 'aria-expanded': 'false', onclick: () => setTray(!trayOpen) },
  h('span', { class: 'fab-emoji', 'aria-hidden': 'true' }, '😀'));
const fab = h('div', { class: 'chat-fab', hidden: true }, reactBtn, chatBtn);

const tray = h('div', { class: 'react-tray', hidden: true, role: 'menu' },
  h('div', { class: 'react-emoji' }, ...EMOJI.map(e => h('button', { role: 'menuitem', 'aria-label': `React ${e}`, onclick: () => react(e) }, e))),
  h('div', { class: 'react-phrases' }, ...PHRASES.map(p => h('button', { role: 'menuitem', onclick: () => { send(p); setTray(false); } }, p))));

const list = h('div', { class: 'chat-list', 'aria-live': 'polite' });
const input = h('input', { type: 'text', maxlength: MAX_LEN, placeholder: 'Say something…', 'aria-label': 'Chat message', enterkeyhint: 'send' });
const sendBtn = h('button', { class: 'btn small', onclick: () => sendFromInput() }, 'Send');
const pauseNote = h('p', { class: 'chat-paused', hidden: true }, 'Chat is paused while a Rare Words round is on. Reactions still work.');
const title = h('h3', {}, 'Chat');
const quick = h('div', { class: 'chat-quick' },
  ...EMOJI.map(e => h('button', { class: 'q-emoji', 'aria-label': `React ${e}`, onclick: () => react(e) }, e)),
  ...PHRASES.map(p => h('button', { class: 'q-phrase', onclick: () => send(p) }, p)));
const panel = h('div', { class: 'chat-panel', hidden: true, role: 'dialog', 'aria-label': 'Chat' },
  h('div', { class: 'chat-head' }, title, h('button', { class: 'back', 'aria-label': 'Close chat', onclick: () => setOpen(false) }, 'Close')),
  list, pauseNote, quick,
  h('div', { class: 'chat-input' }, input, sendBtn));
input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendFromInput(); } if (e.key === 'Escape') setOpen(false); });

const bubbles = h('div', { class: 'chat-bubbles', 'aria-hidden': 'true' });
const floats = h('div', { class: 'react-floats', 'aria-hidden': 'true' });
document.body.append(floats, bubbles, tray, panel, fab);

function svgIcon(inner) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = inner;
  return s;
}

/* ---------- lifecycle (called from app.js) ---------- */
export function attach(roomCode) {
  if (code === roomCode) return;
  code = roomCode; data = null; primed = false; seenMsgs = new Set(); seenReact = {};
  lastRead = +(net.ls.get('kt-read-' + code) || 0);
  title.textContent = `Chat · ${code}`;
  list.replaceChildren();
  fab.hidden = false;
  document.body.classList.add('in-room');
}
export function detach() {
  code = null; data = null;
  setOpen(false); setTray(false);
  fab.hidden = true; bubbles.replaceChildren(); floats.replaceChildren();
  document.body.classList.remove('in-room');
}

export function update(d) {
  if (!code || !d) return;
  data = d;
  const msgs = Object.entries(d.chat || {}).sort((a, b) => a[0] < b[0] ? -1 : 1).map(([k, m]) => ({ k, ...m }));
  const newest = msgs.length ? msgs[msgs.length - 1].t || 0 : 0;

  if (!primed) {
    // First load: older messages are history, not news.
    if (!lastRead) lastRead = newest;
    msgs.forEach(m => seenMsgs.add(m.k));
    for (const [p, r] of Object.entries(d.react || {})) seenReact[p] = r.t || 0;
    primed = true;
  } else {
    for (const m of msgs) {
      if (seenMsgs.has(m.k)) continue;
      seenMsgs.add(m.k);
      if (m.p !== net.pid && !isOpen) bubble(m);
    }
    for (const [p, r] of Object.entries(d.react || {})) {
      if ((r.t || 0) > (seenReact[p] || 0)) {
        seenReact[p] = r.t;
        if (net.now() - r.t < 8000) floatUp(r.e, d.players?.[p]);
      }
    }
  }

  if (isOpen) markRead(newest);
  const unread = msgs.filter(m => m.p !== net.pid && (m.t || 0) > lastRead).length;
  badge.hidden = unread === 0;
  badge.textContent = unread > 9 ? '9+' : String(unread);
  chatBtn.setAttribute('aria-label', unread ? `Open chat, ${unread} new` : 'Open chat');

  const paused = isPaused(d);
  input.disabled = paused; sendBtn.disabled = paused;
  pauseNote.hidden = !paused;
  tray.querySelector('.react-phrases').hidden = paused;
  quick.querySelectorAll('.q-phrase').forEach(b => { b.hidden = paused; });

  if (isOpen) drawList(msgs);
}

function isPaused(d) {
  if (d.phase !== 'play' || !GAMES[d.game]?.simultaneous) return false;
  try { return JSON.parse(d.state).phase === 'play'; } catch (e) { return false; }
}
function markRead(t) {
  if (t > lastRead) { lastRead = t; net.ls.set('kt-read-' + code, String(t)); }
}

/* ---------- UI ---------- */
function setOpen(v) {
  isOpen = v && !!code;
  panel.hidden = !isOpen;
  chatBtn.classList.toggle('on', isOpen);
  if (isOpen) {
    setTray(false); bubbles.replaceChildren();
    if (data) update(data);
    list.scrollTop = list.scrollHeight;
    if (!input.disabled && matchMedia('(hover: hover)').matches) input.focus();
  }
}
function setTray(v) {
  trayOpen = v && !!code;
  tray.hidden = !trayOpen;
  reactBtn.setAttribute('aria-expanded', String(trayOpen));
  reactBtn.classList.toggle('on', trayOpen);
  if (trayOpen && isOpen) setOpen(false);
}
document.addEventListener('pointerdown', e => {
  if (trayOpen && !tray.contains(e.target) && !reactBtn.contains(e.target)) setTray(false);
});

function drawList(msgs) {
  const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
  if (!msgs.length) {
    list.replaceChildren(h('p', { class: 'chat-empty' }, 'No messages yet. Say hi, or talk a little trash.'));
    return;
  }
  list.replaceChildren(...msgs.map(m => {
    const mine = m.p === net.pid;
    return h('div', { class: 'msg' + (mine ? ' mine' : '') },
      h('span', { class: 'msg-name', style: `color:${col(m.c ?? 0)}` }, mine ? 'You' : (m.n || 'Player')),
      h('span', { class: 'msg-text' }, mask(String(m.x || ''))));
  }));
  if (nearBottom) list.scrollTop = list.scrollHeight;
}

function bubble(m) {
  const b = h('div', { class: 'bubble' },
    h('b', { style: `color:${col(m.c ?? 0)}` }, m.n || 'Player'), ' ', mask(String(m.x || '')));
  b.onclick = () => setOpen(true);
  bubbles.append(b);
  while (bubbles.children.length > 2) bubbles.firstChild.remove();
  setTimeout(() => b.classList.add('out'), 3800);
  setTimeout(() => b.remove(), 4300);
}

function floatUp(e, player) {
  if (!EMOJI.includes(e)) return;
  const f = h('div', { class: 'float' },
    h('span', { class: 'float-e' }, e),
    player ? h('span', { class: 'float-n', style: `color:${col(player.color ?? 0)}` }, player.name) : null);
  f.style.left = `${15 + Math.random() * 70}%`;
  floats.append(f);
  setTimeout(() => f.remove(), 2600);
}

/* ---------- sending ---------- */
function canSend() {
  const t = Date.now();
  if (t - lastSend < COOLDOWN_MS) return false;
  lastSend = t; return true;
}
function me() {
  const p = data?.players?.[net.pid];
  return { n: p?.name || net.ls.get('kt-name') || 'Player', c: p?.color ?? 0 };
}
function send(text) {
  if (!code || !data || isPaused(data)) return false;
  const x = mask(tidy(text));
  if (!x) return false;
  if (!canSend()) { flash('Easy there, one sec…'); return false; }
  net.sendChat(code, { ...me(), x }).catch(() => flash('Message didn’t send. Check your connection.'));
  return true;
}
function sendFromInput() {
  if (send(input.value)) input.value = '';
}
function react(e) {
  if (!code) return;
  setTray(false);
  if (!canSend()) return;
  net.sendReaction(code, e).catch(() => {});
}
function flash(text) {
  const f = h('div', { class: 'bubble note' }, text);
  bubbles.append(f);
  setTimeout(() => f.remove(), 2200);
}
