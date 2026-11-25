import { useSyncExternalStore } from 'react';
import { makeSeed } from './seed.js';
import {
  runRound, finalPlacement, lotteryFor, classInfo, typeForSize, checkChoices, roomWing, blockLabel, TYPE_LABEL,
} from './engine.js';

const KEY = 'hostel-allotment-demo';
let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.version === 5) return s;
    }
  } catch { /* ignore */ }
  return makeSeed();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

// Keep every open tab in step: a change saved in one tab (for example the GS console)
// shows up immediately in the others (for example a student's view).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    try {
      state = e.newValue ? JSON.parse(e.newValue) : makeSeed();
      if (!state || state.version !== 5) state = makeSeed();
    } catch { state = makeSeed(); }
    listeners.forEach((l) => l());
  });
}

export const getState = () => state;
export function useStore(selector = (s) => s) {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => selector(state));
}

// Runs fn on a copy. fn may throw a UserError; the message is shown to the user.
export class UserError extends Error {}
function update(fn) {
  const draft = structuredClone(state);
  const result = fn(draft);
  state = draft;
  save();
  listeners.forEach((l) => l());
  return result;
}

export function resetDemo() {
  state = makeSeed();
  save();
  listeners.forEach((l) => l());
}

// ---------------------------------------------------------------- phases
export const PHASES = [
  { id: 'setup', label: 'Setup', short: 'Setup' },
  { id: 'round1_open', label: 'Round 1 open', short: 'Round 1' },
  { id: 'round1_review', label: 'Round 1 review', short: 'Review 1' },
  { id: 'round2_open', label: 'Round 2 open', short: 'Round 2' },
  { id: 'round2_review', label: 'Final review', short: 'Review 2' },
  { id: 'published', label: 'Published', short: 'Published' },
];
export const phaseIndex = (p) => PHASES.findIndex((x) => x.id === p);

// ---------------------------------------------------------------- selectors
export const accepted = (app) => app.members.filter((m) => m.status === 'accepted').map((m) => m.sid);
export const memberIds = (app) => app.members.filter((m) => m.status !== 'declined').map((m) => m.sid);

export function appOf(s, sid) {
  return Object.values(s.apps).find((a) => a.status !== 'discarded' && !a.splitParent &&
    a.members.some((m) => m.sid === sid && m.status === 'accepted')) || null;
}
export function invitesFor(s, sid) {
  return Object.values(s.apps).filter((a) => a.status !== 'discarded' && a.members.some((m) => m.sid === sid && m.status === 'pending'));
}
export function appLabel(s, app) {
  if (!app) return '—';
  const rep = s.students[app.repId];
  const n = memberIds(app).length;
  if (n <= 1) return rep.name;
  return `${rep.name.split(' ')[0]}'s ${n >= 5 ? 'wing group' : 'group'}`;
}
export function appClass(s, app) {
  const ids = memberIds(app);
  return classInfo(ids.length ? ids : [app.repId], s.students);
}
export function roomOf(s, sid) {
  for (const [room, h] of Object.entries(s.holder)) if (h.sid === sid) return { room, ...h };
  for (const [room, r] of Object.entries(s.rooms)) if (r.status === 'pre' && r.preSid === sid) return { room, how: 'pre', round: 'setup' };
  return null;
}
export function isPreassigned(s, sid) {
  return Object.values(s.rooms).some((r) => r.status === 'pre' && r.preSid === sid);
}
export function onWaitlist(s, sid) {
  const i = s.waitlist.findIndex((w) => w.sid === sid);
  return i >= 0 ? i + 1 : 0;
}
export function freeHolderView(s) {
  // rooms taken so far (for Round 2 pickers): holder + pre-assigned
  const taken = { ...s.holder };
  Object.entries(s.rooms).forEach(([r, x]) => { if (x.status === 'pre') taken[r] = { sid: x.preSid, how: 'pre' }; });
  return taken;
}
export function eventsFor(s, sid) {
  const app = appOf(s, sid);
  const ids = new Set();
  Object.values(s.apps).forEach((a) => { if (a.members.some((m) => m.sid === sid && m.status === 'accepted')) ids.add(a.id); });
  if (app && app.splitFrom) ids.add(app.splitFrom);
  return s.events.filter((e) => ids.has(e.appId) || e.sid === sid);
}
export function demandMap(s, sid) {
  // how many other applications in the same class picked each room as a 1st choice
  const me = appOf(s, sid);
  const myCls = me ? appClass(s, me).cls : classInfo([sid], s.students).cls;
  const out = {};
  Object.values(s.apps).forEach((a) => {
    if (a.status !== 'submitted' || (me && a.id === me.id)) return;
    if (appClass(s, a).cls !== myCls) return;
    (a.choices[0] || []).forEach((r) => { out[r] = (out[r] || 0) + 1; });
  });
  return out;
}

const deadlinePassed = () => false; // deadlines are informational in the demo; the GS closes rounds

function newId(d) {
  const id = `APP-${d.nextId}`;
  d.nextId += 1;
  return id;
}
function resetChoices(app) {
  app.choices = [[], [], []];
  app.mappings = [[], [], []];
  if (app.status === 'submitted') app.status = 'draft';
}
function assertPhase(d, ...phases) {
  if (!phases.includes(d.phase)) throw new UserError('This can’t be changed at the current stage of allotment.');
}

// ---------------------------------------------------------------- student actions
export const student = {
  createApplication(sid) {
    return update((d) => {
      assertPhase(d, 'round1_open', 'round2_open');
      if (appOf(d, sid)) throw new UserError('You already have an application.');
      if (isPreassigned(d, sid)) throw new UserError('You have been pre-assigned a room by the GS.');
      if (d.phase === 'round2_open' && roomOf(d, sid)) throw new UserError('You already have a room.');
      const id = newId(d);
      const late = d.phase === 'round2_open';
      d.apps[id] = { id, repId: sid, members: [{ sid, status: 'accepted' }], choices: [[], [], []], mappings: [[], [], []],
        fallback: 'auto', status: 'draft', submittedAt: null, late, splitFrom: null,
        r2: late ? { choices: [[], [], []], mappings: [[], [], []], status: 'open' } : null };
      // starting your own application declines any pending invites
      Object.values(d.apps).forEach((a) => { if (a.id !== id) a.members = a.members.filter((m) => !(m.sid === sid && m.status === 'pending')); });
      return id;
    });
  },
  // The rep adds people directly; there is no invite for them to accept.
  addMember(appId, sid) {
    return update((d) => {
      assertPhase(d, 'round1_open');
      const app = d.apps[appId];
      if (memberIds(app).length >= 8) throw new UserError('A wing group can have at most 8 members.');
      if (app.members.some((m) => m.sid === sid)) throw new UserError('Already in this group.');
      if (appOf(d, sid)) throw new UserError(`${d.students[sid].name} is already in another application.`);
      if (isPreassigned(d, sid)) throw new UserError(`${d.students[sid].name} has a pre-assigned room.`);
      app.members.push({ sid, status: 'accepted' });
      resetChoices(app);
    });
  },
  removeMember(appId, sid) {
    return update((d) => {
      assertPhase(d, 'round1_open');
      const app = d.apps[appId];
      app.members = app.members.filter((m) => m.sid !== sid);
      resetChoices(app);
    });
  },
  accept(appId, sid) {
    return update((d) => {
      assertPhase(d, 'round1_open');
      const mine = appOf(d, sid);
      if (mine) {
        if (memberIds(mine).length > 1) throw new UserError('Leave your current group before accepting another invite.');
        delete d.apps[mine.id]; // a solo draft or application is replaced by the group
      }
      const app = d.apps[appId];
      const m = app.members.find((x) => x.sid === sid);
      m.status = 'accepted';
      Object.values(d.apps).forEach((a) => { if (a.id !== appId) a.members = a.members.filter((x) => !(x.sid === sid && x.status === 'pending')); });
    });
  },
  decline(appId, sid) {
    return update((d) => {
      const app = d.apps[appId];
      app.members = app.members.filter((m) => m.sid !== sid);
      resetChoices(app);
    });
  },
  leave(appId, sid) {
    return update((d) => {
      assertPhase(d, 'round1_open');
      const app = d.apps[appId];
      app.members = app.members.filter((m) => m.sid !== sid);
      if (!app.members.length) { delete d.apps[appId]; return; }
      if (app.repId === sid) {
        const next = app.members.find((m) => m.status === 'accepted') || app.members[0];
        app.repId = next.sid;
        next.status = 'accepted';
      }
      resetChoices(app);
    });
  },
  withdraw(appId) {
    return update((d) => {
      assertPhase(d, 'round1_open', 'round2_open');
      delete d.apps[appId];
    });
  },
  setChoice(appId, idx, rooms, round = 1) {
    return update((d) => {
      assertPhase(d, round === 1 ? 'round1_open' : 'round2_open');
      const app = d.apps[appId];
      const target = round === 1 ? app : app.r2;
      target.choices[idx] = rooms;
      // Reuse the order the rep already set in another choice, so they only assign people once.
      const members = memberIds(app);
      const earlier = target.mappings.find((m, i) => i !== idx && m && m.length === rooms.length && members.every((x) => m.includes(x)));
      target.mappings[idx] = rooms.length > 1 ? [...(earlier || members.slice(0, rooms.length))] : [];
      if (round === 1 && app.status === 'submitted') app.status = 'draft';
      if (round === 2 && app.r2.status === 'submitted') app.r2.status = 'open';
    });
  },
  setMapping(appId, idx, roomIdx, sid, round = 1) {
    return update((d) => {
      const app = d.apps[appId];
      const target = round === 1 ? app : app.r2;
      const map = target.mappings[idx];
      const prev = map.indexOf(sid);
      if (prev >= 0) map[prev] = map[roomIdx];
      map[roomIdx] = sid;
      if (round === 1 && app.status === 'submitted') app.status = 'draft';
      if (round === 2 && app.r2.status === 'submitted') app.r2.status = 'open';
    });
  },
  // Apply one choice's "who gets which room" order to every other choice.
  copyMapping(appId, fromIdx, round = 1) {
    return update((d) => {
      const app = d.apps[appId];
      const target = round === 1 ? app : app.r2;
      const from = target.mappings[fromIdx];
      target.choices.forEach((c, i) => { if (i !== fromIdx && c && c.length === from.length) target.mappings[i] = [...from]; });
      if (round === 1 && app.status === 'submitted') app.status = 'draft';
      if (round === 2 && app.r2.status === 'submitted') app.r2.status = 'open';
    });
  },
  setFallback(appId, fallback) {
    return update((d) => {
      assertPhase(d, 'round1_open');
      d.apps[appId].fallback = fallback;
      if (d.apps[appId].status === 'submitted') d.apps[appId].status = 'draft';
    });
  },
  submit(appId) {
    return update((d) => {
      assertPhase(d, 'round1_open');
      const app = d.apps[appId];
      const check = readiness(d, app);
      if (!check.ok) throw new UserError(check.blocking[0]);
      app.status = 'submitted';
      app.submittedAt = new Date().toISOString();
    });
  },
  submitRound2(appId) {
    return update((d) => {
      assertPhase(d, 'round2_open');
      const app = d.apps[appId];
      const check = readiness(d, app, 2);
      if (!check.ok) throw new UserError(check.blocking[0]);
      app.r2.status = 'submitted';
      app.r2.submittedAt = new Date().toISOString();
      if (app.late) { app.status = 'submitted'; app.submittedAt = app.r2.submittedAt; }
    });
  },
};

// What still blocks submission.
export function readiness(s, app, round = 1) {
  const size = memberIds(app).length;
  const blocking = [];
  const pending = app.members.filter((m) => m.status === 'pending');
  if (round === 1 && pending.length) blocking.push(`Waiting for ${pending.map((m) => s.students[m.sid].name.split(' ')[0]).join(', ')} to accept.`);
  if (size > 8) blocking.push('At most 8 members.');
  const choices = round === 1 ? app.choices : app.r2.choices;
  const holder = round === 2 ? freeHolderView(s) : null;
  const res = checkChoices({ choices, size, rooms: s.rooms, wings: s.wings, holder, minChoices: round === 1 ? 3 : 1 });
  res.perChoice.forEach((p, i) => { if (p) blocking.push(`${['1st', '2nd', '3rd'][i]} choice: ${p}`); });
  blocking.push(...res.errors);
  return { ok: !blocking.length, blocking, perChoice: res.perChoice, size };
}

// ---------------------------------------------------------------- GS actions
function entrantFrom(d, app, round) {
  const members = accepted(app);
  const src = round === 1 ? app : app.r2;
  return { id: app.id, label: appLabel(d, app), members, choices: src.choices.filter((c) => c && c.length),
    mappings: src.mappings, fallback: app.fallback, late: !!app.late, lottery: d.lotteries[app.id] };
}
function preHolder(d) {
  const h = {};
  Object.entries(d.rooms).forEach(([r, x]) => { if (x.status === 'pre') h[r] = { sid: x.preSid, appId: null, label: d.students[x.preSid].name, how: 'pre', round: 'setup' }; });
  return h;
}

export const gs = {
  setRoom(roomId, status, reason = '', preSid = null) {
    return update((d) => {
      assertPhase(d, 'setup', 'round1_open');
      if (status === 'pre') {
        if (!preSid) throw new UserError('Choose the student for this room.');
        const a = appOf(d, preSid);
        if (a && memberIds(a).length > 1) throw new UserError(`${d.students[preSid].name} is in a group. Remove them from it first.`);
        if (a) delete d.apps[a.id];
        Object.values(d.apps).forEach((x) => { x.members = x.members.filter((m) => m.sid !== preSid); });
        Object.values(d.rooms).forEach((r) => { if (r.preSid === preSid) { r.status = 'available'; r.preSid = null; r.reason = ''; } });
      }
      if (status !== 'available' && !reason.trim()) throw new UserError('Add a reason. Students see it as “unavailable”; the reason stays in the log.');
      d.rooms[roomId] = { status, reason: status === 'available' ? '' : reason.trim(), preSid: status === 'pre' ? preSid : null };
      // drop this room from any choice that used it
      Object.values(d.apps).forEach((a) => {
        a.choices.forEach((c, i) => { if (status !== 'available' && c.includes(roomId)) { a.choices[i] = []; a.mappings[i] = []; if (a.status === 'submitted') a.status = 'draft'; } });
      });
    });
  },
  setSettings(patch) {
    return update((d) => { Object.assign(d.settings, patch); });
  },
  openRound1() {
    return update((d) => { assertPhase(d, 'setup'); d.phase = 'round1_open'; });
  },
  runRound1() {
    return update((d) => {
      assertPhase(d, 'round1_open');
      d.snapshots.r1 = structuredClone({ apps: d.apps, nextId: d.nextId });
      Object.values(d.apps).forEach((a) => { if (a.status !== 'submitted') a.status = 'discarded'; });
      const live = Object.values(d.apps).filter((a) => a.status === 'submitted');
      d.lotteries = {};
      live.forEach((a) => { d.lotteries[a.id] = lotteryFor(d.settings.seed, a.id); });
      d.holder = preHolder(d);
      const res = runRound({ round: 1, entrants: live.map((a) => entrantFrom(d, a, 1)), rooms: d.rooms, wings: d.wings, students: d.students, holder: d.holder });
      d.events = res.events;
      d.waitlist = [];
      d.overrides = [];
      for (const u of res.unplaced) {
        const app = d.apps[u.entrant.id];
        if (u.reason === 'split') {
          app.splitParent = true;
          accepted(app).forEach((sid) => {
            const id = newId(d);
            d.apps[id] = { id, repId: sid, members: [{ sid, status: 'accepted' }], choices: [[], [], []], mappings: [[], [], []], fallback: 'auto',
              status: 'submitted', submittedAt: app.submittedAt, late: false, splitFrom: app.id,
              r2: { choices: [[], [], []], mappings: [[], [], []], status: 'open' } };
            d.lotteries[id] = lotteryFor(d.settings.seed, id);
          });
        } else if (u.reason === 'no-room') {
          accepted(app).forEach((sid) => d.waitlist.push({ sid, appId: app.id, reason: 'Group could not be kept together' }));
        } else {
          app.r2 = { choices: [[], [], []], mappings: [[], [], []], status: 'open' };
        }
      }
      // remove holder entries for pre-assigned rooms (they live in rooms)
      Object.keys(d.holder).forEach((r) => { if (d.holder[r].how === 'pre') delete d.holder[r]; });
      d.ranAt = { ...(d.ranAt || {}), r1: new Date().toISOString() };
      d.phase = 'round1_review';
    });
  },
  reopenRound1() {
    return update((d) => {
      assertPhase(d, 'round1_review');
      d.apps = d.snapshots.r1.apps;
      d.nextId = d.snapshots.r1.nextId;
      d.holder = {}; d.events = []; d.lotteries = {}; d.waitlist = []; d.overrides = [];
      d.phase = 'round1_open';
    });
  },
  approveRound1() {
    return update((d) => { assertPhase(d, 'round1_review'); d.phase = 'round2_open'; });
  },
  runRound2() {
    return update((d) => {
      assertPhase(d, 'round2_open');
      d.snapshots.r2 = structuredClone({ apps: d.apps, holder: d.holder, events: d.events, waitlist: d.waitlist, lotteries: d.lotteries, nextId: d.nextId });
      const r2apps = Object.values(d.apps).filter((a) => a.r2 && a.status !== 'discarded');
      r2apps.forEach((a) => { if (d.lotteries[a.id] == null) d.lotteries[a.id] = lotteryFor(d.settings.seed, a.id); });
      const submitted = r2apps.filter((a) => a.r2.status === 'submitted');
      const holder = { ...d.holder, ...preHolder(d) };
      const res = runRound({ round: 2, entrants: submitted.map((a) => entrantFrom(d, a, 2)), rooms: d.rooms, wings: d.wings, students: d.students, holder });
      d.events.push(...res.events);
      // final placement queue: on-time first (failed or no reply), then late, then no form
      const order = (a) => [a.late ? 1 : 0, appClass(d, a).cls, d.lotteries[a.id] || 9999];
      const cmp = (x, y) => { const a = order(x), b = order(y); for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
      const failed = res.unplaced.map((u) => d.apps[u.entrant.id]);
      const noReply = r2apps.filter((a) => a.r2.status !== 'submitted' && !a.late);
      const queue = [...failed.map((a) => ({ a, reason: 'All Round 2 choices taken' })), ...noReply.map((a) => ({ a, reason: 'No Round 2 choices submitted' }))]
        .sort((x, y) => cmp(x.a, y.a))
        .map(({ a, reason }) => ({ id: a.id, label: appLabel(d, a), members: accepted(a), late: a.late, reason,
          firstWing: a.choices[0] && a.choices[0][0] ? roomWing(a.choices[0][0]) : null }));
      // students with nothing at all
      const placedSids = new Set(Object.values(holder).map((h) => h.sid));
      const inQueue = new Set(queue.flatMap((q) => q.members));
      const waiting = new Set(d.waitlist.map((w) => w.sid));
      Object.values(d.students).forEach((st) => {
        if (placedSids.has(st.id) || inQueue.has(st.id) || waiting.has(st.id)) return;
        queue.push({ id: `NOFORM-${st.id}`, label: st.name, members: [st.id], reason: 'No form submitted' });
      });
      const fin = finalPlacement({ queue, rooms: d.rooms, wings: d.wings, holder, seed: d.settings.seed });
      d.events.push(...fin.events.map((e) => (e.appId && e.appId.startsWith('NOFORM-') ? { ...e, sid: e.appId.slice(7) } : e)));
      d.waitlist.push(...fin.waitlist);
      Object.keys(holder).forEach((r) => { if (holder[r].how === 'pre') delete holder[r]; });
      d.holder = holder;
      d.ranAt = { ...(d.ranAt || {}), r2: new Date().toISOString() };
      d.phase = 'round2_review';
    });
  },
  reopenRound2() {
    return update((d) => {
      assertPhase(d, 'round2_review');
      Object.assign(d, structuredClone(d.snapshots.r2));
      d.phase = 'round2_open';
    });
  },
  override(sid, toRoom, reason) {
    return update((d) => {
      assertPhase(d, 'round1_review', 'round2_review');
      if (!reason || reason.trim().length < 8) throw new UserError('Write a reason of at least a few words. It is kept in the log.');
      if (d.rooms[toRoom].status !== 'available') throw new UserError(`${toRoom} is blocked or pre-assigned.`);
      const from = Object.keys(d.holder).find((r) => d.holder[r].sid === sid) || null;
      if (from === toRoom) throw new UserError('That is already their room.');
      const other = d.holder[toRoom];
      const name = d.students[sid].name;
      const mine = from ? d.holder[from] : { appId: appOf(d, sid)?.id || null, label: name };
      if (other && !from) throw new UserError(`${toRoom} is taken and ${name} has no room to swap. Pick a free room.`);
      d.holder[toRoom] = { ...mine, sid, how: 'override', flag: false, round: mine.round || 'override', reason: reason.trim() };
      if (from) {
        if (other) d.holder[from] = { ...other, how: 'override', flag: false, reason: reason.trim() };
        else delete d.holder[from];
      }
      d.waitlist = d.waitlist.filter((w) => w.sid !== sid);
      const text = other ? `GS swapped ${name} (${from}) with ${d.students[other.sid].name} (${toRoom}). Reason: ${reason.trim()}`
        : `GS moved ${name} from ${from || 'the waitlist'} to ${toRoom}. Reason: ${reason.trim()}`;
      d.events.push({ round: 'override', sid, appId: null, label: name, outcome: 'override', detail: text, rooms: [toRoom] });
      if (other) d.events.push({ round: 'override', sid: other.sid, appId: null, label: d.students[other.sid].name, outcome: 'override', detail: text, rooms: [from] });
      d.overrides.push({ sid, from, to: toRoom, swapWith: other ? other.sid : null, reason: reason.trim(), at: new Date().toISOString() });
    });
  },
  clearFlag(room) {
    return update((d) => { if (d.holder[room]) d.holder[room].flag = false; });
  },
  publish() {
    return update((d) => { assertPhase(d, 'round2_review'); d.phase = 'published'; d.publishedAt = new Date().toISOString(); });
  },
};

export function csvAllotment(s) {
  const rows = [['Room', 'Wing', 'Roll number', 'Name', 'Year', 'Application', 'How decided', 'Round']];
  const how = (h) => (h.how === 'choice' ? `${['1st', '2nd', '3rd'][h.rank - 1]} choice` : h.how);
  s.wings.forEach((w) => {
    for (let n = 1; n <= 8; n++) {
      const r = `${w.id}${n}`;
      const room = s.rooms[r];
      if (room.status === 'pre') { const st = s.students[room.preSid]; rows.push([r, w.id, st.id, st.name, st.year, '', 'Pre-assigned', '']); continue; }
      const h = s.holder[r];
      if (!h) { rows.push([r, w.id, '', '', '', '', room.status === 'blocked' ? 'Blocked' : 'Empty', '']); continue; }
      const st = s.students[h.sid];
      rows.push([r, w.id, st.id, st.name, st.year, h.label || '', how(h), h.round]);
    }
  });
  s.waitlist.forEach((wl, i) => { const st = s.students[wl.sid]; rows.push([`Waitlist ${i + 1}`, '', st.id, st.name, st.year, '', wl.reason, '']); });
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}

export { TYPE_LABEL, blockLabel, typeForSize };

// ---------------------------------------------------------------- display helpers
import { FLOOR_NAMES, BRANCH_NAMES } from './seed.js';
export const wingPlace = (w) => `${FLOOR_NAMES[w.floor]}, ${w.side} side`;
export const branchName = (st) => BRANCH_NAMES[st.branch] || st.branch;
export { FLOOR_NAMES };
