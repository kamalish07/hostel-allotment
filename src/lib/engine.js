// Allocation engine. Pure functions, no UI.
// Priority: class (type, then seniority) -> choice rank (inside a class) -> size -> lottery.
// Rooms are identified by their room number (e.g. "203"). Each wing lists its rooms in corridor order,
// so rooms next to each other in that list are neighbours.

export const TYPE_RANK = { wing: 0, group: 1, ind: 2 };
export const TYPE_LABEL = { wing: 'Wing group', group: 'Group', ind: 'Individual' };
export const ORD = ['1st', '2nd', '3rd'];

// Seniority is stored as year of study (4 = final year, 3 = incoming) and shown as the graduating class.
export const COHORT = { 4: 2028, 3: 2029 };
export const classOf = (y) => COHORT[y >= 4 ? 4 : 3];
export const yearLabel = (y) => `Class of ${classOf(y)}`;
export const cohortTag = (y) => (y >= 4 ? 'Final year' : 'Incoming');

export const typeForSize = (n) => (n >= 5 ? 'wing' : n >= 2 ? 'group' : 'ind');

// ---------------------------------------------------------------- wing index
const IDX = new WeakMap();
export function indexWings(wings) {
  let ix = IDX.get(wings);
  if (!ix) {
    ix = { wing: {}, pos: {} };
    wings.forEach((w) => w.rooms.forEach((r, i) => { ix.wing[r] = w.id; ix.pos[r] = i; }));
    IDX.set(wings, ix);
  }
  return ix;
}
export const wingOfRoom = (wings, r) => indexWings(wings).wing[r];

export function blockLabel(rooms) {
  if (!rooms || rooms.length === 0) return '—';
  if (rooms.length === 1) return rooms[0];
  return `${rooms[0]}–${rooms[rooms.length - 1]}`;
}

// Lottery: deterministic 4-digit number per application from the published seed.
export function lotteryFor(seed, appId) {
  let h = (2166136261 ^ Number(seed)) >>> 0;
  for (const c of String(appId)) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return 1000 + (h % 9000);
}

export function mulberry32(seed) {
  let a = Number(seed) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function classInfo(memberIds, students) {
  const years = memberIds.map((sid) => students[sid].year);
  const year = Math.min(...years);
  const type = typeForSize(memberIds.length);
  return { type, year, mixed: new Set(years).size > 1, cls: TYPE_RANK[type] * 2 + (year >= 4 ? 0 : 1) };
}
export const classLabel = (ci) => `${TYPE_LABEL[ci.type]}, ${yearLabel(ci.year)}`;

export const isAvailable = (rooms, id) => !!rooms[id] && rooms[id].status === 'available';

// Every valid block of n neighbouring available rooms (optionally also free of holders).
export function validBlocks(rooms, wings, n, holder = null) {
  const out = [];
  for (const w of wings) {
    for (let s = 0; s + n <= w.rooms.length; s++) {
      const b = w.rooms.slice(s, s + n);
      if (b.every((r) => isAvailable(rooms, r) && !(holder && holder[r]))) out.push(b);
    }
  }
  return out;
}

// Checks one application's choices. Returns { perChoice: [msg|null x3], errors: [msg], ok }.
export function checkChoices({ choices, size, rooms, wings, holder = null, minChoices = 3 }) {
  const ix = indexWings(wings);
  const perChoice = [null, null, null];
  const errors = [];
  const seen = new Set();
  const filled = choices.filter((c) => c && c.length);
  choices.forEach((c, i) => {
    if (!c || !c.length) return;
    if (c.length !== size) perChoice[i] = `Needs ${size} room${size > 1 ? 's' : ''}, has ${c.length}. Pick again.`;
    else if (c.some((r) => !ix.wing[r])) perChoice[i] = 'Includes a room that doesn’t exist.';
    else if (new Set(c.map((r) => ix.wing[r])).size > 1) perChoice[i] = 'All rooms must be in one wing.';
    else if (c.some((r) => !isAvailable(rooms, r))) perChoice[i] = 'Includes a room that is no longer available.';
    else if (holder && c.some((r) => holder[r])) perChoice[i] = 'Includes a room that is already taken.';
    else {
      const pos = c.map((r) => ix.pos[r]).sort((a, b) => a - b);
      if (pos.some((p, k) => k > 0 && p !== pos[k - 1] + 1)) perChoice[i] = 'Rooms must be next to each other.';
    }
    const key = [...c].sort().join(',');
    if (seen.has(key)) perChoice[i] = 'Same as an earlier choice.';
    seen.add(key);
  });
  const possible = validBlocks(rooms, wings, size, holder).length;
  const need = Math.min(minChoices, possible);
  if (filled.length < need) errors.push(`Add ${need} choice${need > 1 ? 's' : ''} (${filled.length} so far).`);
  if (possible === 0) errors.push('No block of this size is available.');
  return { perChoice, errors, ok: !errors.length && perChoice.every((p) => !p) };
}

// ---------------------------------------------------------------- keep together
function freeRuns(wing, free) {
  const runs = [];
  let cur = [];
  for (const r of wing.rooms) {
    if (free(r)) cur.push(r);
    else if (cur.length) { runs.push(cur); cur = []; }
  }
  if (cur.length) runs.push(cur);
  return runs;
}

export function keepTogether({ size, firstWing, wings, free }) {
  const ix = indexWings(wings);
  const countFree = (w) => freeRuns(w, free).reduce((s, r) => s + r.length, 0);
  const name = (w) => w.label || w.id;
  const order = [...wings].sort((a, b) => {
    if (a.id === firstWing) return -1;
    if (b.id === firstWing) return 1;
    return countFree(b) - countFree(a) || a.id.localeCompare(b.id);
  });
  for (const w of order) {
    const run = freeRuns(w, free).find((r) => r.length >= size);
    if (run) {
      return { rooms: run.slice(0, size), split: false,
        why: `next ${size} free neighbouring room${size > 1 ? 's' : ''}${w.id === firstWing ? ' in the wing of the 1st choice' : ` in ${name(w)}`}` };
    }
  }
  for (const w of order) {
    const runs = freeRuns(w, free).sort((a, b) => b.length - a.length);
    if (runs.reduce((s, r) => s + r.length, 0) >= size) {
      const pick = [];
      runs.forEach((r) => r.forEach((x) => { if (pick.length < size) pick.push(x); }));
      pick.sort((a, b) => ix.pos[a] - ix.pos[b]);
      return { rooms: pick, split: true, why: `no ${size} neighbouring rooms left; kept in ${name(w)}, split` };
    }
  }
  const all = [];
  wings.forEach((w) => freeRuns(w, free).forEach((r) => all.push(...r)));
  if (all.length >= size) return { rooms: all.slice(0, size), split: true, why: 'split across wings' };
  return null;
}

// ---------------------------------------------------------------- one round
// entrants: [{ id, label, members, choices, mappings, fallback, late, lottery }]
// holder: { roomId: { sid, appId, label, round, rank, cls, type, year, size, lottery, late, how, flag } } (mutated)
export function runRound({ round, entrants, rooms, wings, students, holder }) {
  const events = [];
  const placed = {};
  const unplaced = [];
  const info = {};
  entrants.forEach((e) => { info[e.id] = classInfo(e.members, students); });
  const free = (r) => isAvailable(rooms, r) && !holder[r];
  const effCls = (e) => info[e.id].cls + (round === 2 && e.late ? 6 : 0);
  const clsText = (e) => classLabel(info[e.id]) + (round === 2 && e.late ? ' (late form)' : '');

  const log = (e, rank, outcome, detail, rms = []) =>
    events.push({ round, appId: e.id, label: e.label, cls: clsText(e), rank, outcome, detail, rooms: rms });

  const assign = (e, rms, rank, how, mapping, flag = false) => {
    const ok = mapping && mapping.length === rms.length && mapping.every(Boolean) && new Set(mapping).size === mapping.length
      && mapping.every((m) => e.members.includes(m));
    const order = ok ? mapping : e.members;
    rms.forEach((r, i) => {
      holder[r] = { sid: order[i], appId: e.id, label: e.label, round, rank, cls: effCls(e), type: info[e.id].type,
        year: info[e.id].year, size: e.members.length, lottery: e.lottery, late: !!e.late, how, flag };
    });
    placed[e.id] = { rooms: rms, rank, how, flag };
  };

  const whyLost = (e, rank, rms) => {
    const byHolder = new Map();
    rms.filter((r) => !free(r)).forEach((r) => {
      const h = holder[r];
      const key = h ? h.appId || h.sid : 'blocked';
      if (!byHolder.has(key)) byHolder.set(key, []);
      byHolder.get(key).push(r);
    });
    const mine = effCls(e);
    const parts = [];
    for (const [, rs] of byHolder) {
      const h = holder[rs[0]];
      let rule;
      if (!h) rule = 'not available';
      else if (h.how === 'pre') rule = 'pre-assigned by the GS';
      else if (h.round !== round) rule = `settled in Round ${h.round}`;
      else if (h.how === 'override') rule = 'GS change';
      else if (h.cls < mine) {
        if (e.late && !h.late) rule = 'on-time form beats late form';
        else if (TYPE_RANK[h.type] < TYPE_RANK[info[e.id].type]) rule = `type: ${TYPE_LABEL[h.type].toLowerCase()} beats ${TYPE_LABEL[info[e.id].type].toLowerCase()}`;
        else rule = `seniority: ${yearLabel(4)} goes before ${yearLabel(3)}`;
      } else if (h.rank < rank) rule = `same class: their ${ORD[h.rank - 1]} choice beats your ${ORD[rank - 1]}`;
      else if (h.size > e.members.length) rule = `same class and choice: bigger group (${h.size} vs ${e.members.length})`;
      else rule = `same class, choice and size: lottery #${h.lottery} vs #${e.lottery}`;
      parts.push(`${rs.join(', ')} → ${h ? h.label : 'unavailable'} (${rule})`);
    }
    return parts.join('; ');
  };

  const classes = [...new Set(entrants.map(effCls))].sort((a, b) => a - b);
  for (const c of classes) {
    let pending = entrants.filter((e) => effCls(e) === c);
    for (let rank = 1; rank <= 3; rank++) {
      const live = [];
      for (const e of pending) {
        const rms = e.choices[rank - 1];
        if (!rms || !rms.length) continue;
        if (rms.every(free)) live.push(e);
        else log(e, rank, 'lost', `${ORD[rank - 1]} choice ${blockLabel(rms)} taken: ${whyLost(e, rank, rms)}`);
      }
      live.sort((a, b) => b.members.length - a.members.length || a.lottery - b.lottery || a.id.localeCompare(b.id));
      for (const e of live) {
        const rms = e.choices[rank - 1];
        if (rms.every(free)) {
          assign(e, rms, rank, 'choice', e.mappings && e.mappings[rank - 1]);
          log(e, rank, 'placed', `Gets ${ORD[rank - 1]} choice ${blockLabel(rms)}`, rms);
          pending = pending.filter((p) => p !== e);
        } else {
          log(e, rank, 'lost', `${ORD[rank - 1]} choice ${blockLabel(rms)} lost in this pass: ${whyLost(e, rank, rms)}`);
        }
      }
    }
    const rest = [...pending].sort((a, b) => b.members.length - a.members.length || a.lottery - b.lottery);
    for (const e of rest) {
      const isGroup = e.members.length > 1;
      if (isGroup && (round === 2 || e.fallback === 'auto')) {
        const first = e.choices.find((x) => x && x.length);
        const firstWing = first ? wingOfRoom(wings, first[0]) : null;
        const kt = keepTogether({ size: e.members.length, firstWing, wings, free });
        if (kt) {
          assign(e, kt.rooms, 4, kt.split ? 'split' : 'fallback', null, true);
          log(e, 4, kt.split ? 'split' : 'fallback', `All choices taken. Placed in ${kt.split ? kt.rooms.join(', ') : blockLabel(kt.rooms)}: ${kt.why}. Flagged for the GS.`, kt.rooms);
        } else {
          unplaced.push({ entrant: e, reason: 'no-room' });
          log(e, 4, 'waitlist', 'All choices taken and not enough free rooms. Waitlisted.');
        }
      } else if (round === 1) {
        const reason = isGroup ? e.fallback : 'round2';
        unplaced.push({ entrant: e, reason });
        const msg = !isGroup ? 'All choices taken. Goes to Round 2.'
          : e.fallback === 'split' ? 'All choices taken. Fallback: split, each member chooses alone in Round 2.'
            : 'All choices taken. Fallback: choose again as a group in Round 2.';
        log(e, 4, 'round2', msg);
      } else {
        unplaced.push({ entrant: e, reason: 'final' });
        log(e, 4, 'final', 'All Round 2 choices taken. Goes to final placement.');
      }
    }
  }
  return { events, placed, unplaced };
}

// ---------------------------------------------------------------- final placement
// queue: [{ id, label, members, late, reason, firstWing }] already in priority order
export function finalPlacement({ queue, rooms, wings, holder, seed }) {
  const rnd = mulberry32(Number(seed) + 7919);
  const free = (r) => isAvailable(rooms, r) && !holder[r];
  const events = [];
  const waitlist = [];
  for (const q of queue) {
    if (q.members.length > 1) {
      const kt = keepTogether({ size: q.members.length, firstWing: q.firstWing, wings, free });
      if (kt) {
        kt.rooms.forEach((r, i) => { holder[r] = { sid: q.members[i], appId: q.id, label: q.label, round: 'final', how: 'random', flag: true }; });
        events.push({ round: 'final', appId: q.id, label: q.label, outcome: 'random', detail: `${q.reason}. Kept together in ${kt.split ? kt.rooms.join(', ') : blockLabel(kt.rooms)}. Flagged.`, rooms: kt.rooms });
        continue;
      }
      // Not enough rooms for the whole group: place as many as possible, waitlist the rest.
      const freeNow = [];
      wings.forEach((w) => w.rooms.forEach((r) => { if (free(r)) freeNow.push(r); }));
      const placedHere = [];
      q.members.forEach((sid, i) => {
        if (i < freeNow.length) { holder[freeNow[i]] = { sid, appId: q.id, label: q.label, round: 'final', how: 'random', flag: true }; placedHere.push(freeNow[i]); }
        else waitlist.push({ sid, appId: q.id, reason: q.reason });
      });
      events.push({ round: 'final', appId: q.id, label: q.label, outcome: placedHere.length ? 'random' : 'waitlist',
        detail: `${q.reason}. ${placedHere.length ? `Only ${placedHere.length} room${placedHere.length > 1 ? 's' : ''} left (${placedHere.join(', ')}); the rest waitlisted` : 'No rooms left: waitlisted'}.`, rooms: placedHere });
      continue;
    }
    const all = [];
    wings.forEach((w) => w.rooms.forEach((r) => { if (free(r)) all.push(r); }));
    if (!all.length) {
      waitlist.push({ sid: q.members[0], appId: q.id, reason: q.reason });
      events.push({ round: 'final', appId: q.id, label: q.label, outcome: 'waitlist', detail: `${q.reason}. No rooms left: waitlisted.` });
      continue;
    }
    const r = all[Math.floor(rnd() * all.length)];
    holder[r] = { sid: q.members[0], appId: q.id, label: q.label, round: 'final', how: 'random', flag: true };
    events.push({ round: 'final', appId: q.id, label: q.label, outcome: 'random', detail: `${q.reason}. Random free room ${r}. Flagged.`, rooms: [r] });
  }
  return { events, waitlist };
}
