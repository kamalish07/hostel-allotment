// Stress test: runs the full allotment (Round 1, Round 2, final placement, overrides, publish) on the
// 150-student sample many times with randomised student behaviour, and checks every rule after each run.
// Usage: node scripts/simulate.mjs [runs]
import { getState, resetDemo, student, gs, appOf, memberIds, readiness, freeHolderView, accepted } from '../src/lib/store.js';
import { mulberry32, validBlocks, classInfo, wingOfRoom } from '../src/lib/engine.js';

const RUNS = Number(process.argv[2] || 40);
const failures = [];
const fail = (run, msg) => { failures.push(`run ${run}: ${msg}`); };

function tryAct(fn) { try { fn(); return true; } catch (e) { return e.message; } }

function checkPlacement(run, label) {
  const s = getState();
  const seen = new Map();
  for (const [room, h] of Object.entries(s.holder)) {
    if (!s.rooms[room]) fail(run, `${label}: holder on unknown room ${room}`);
    else if (s.rooms[room].status !== 'available') fail(run, `${label}: ${room} is ${s.rooms[room].status} but has a holder`);
    if (!s.students[h.sid]) fail(run, `${label}: room ${room} held by unknown student ${h.sid}`);
    if (seen.has(h.sid)) fail(run, `${label}: ${h.sid} holds ${seen.get(h.sid)} and ${room}`);
    seen.set(h.sid, room);
  }
  const pre = new Set(Object.values(s.rooms).filter((r) => r.status === 'pre').map((r) => r.preSid));
  for (const sid of pre) if (seen.has(sid)) fail(run, `${label}: pre-assigned ${sid} also holds ${seen.get(sid)}`);
  // a student is in at most one active application
  const inApp = new Map();
  Object.values(s.apps).forEach((a) => {
    if (a.status === 'discarded' || a.splitParent) return;
    a.members.forEach((m) => {
      if (inApp.has(m.sid)) fail(run, `${label}: ${m.sid} in ${inApp.get(m.sid)} and ${a.id}`);
      inApp.set(m.sid, a.id);
    });
  });
  return { seen, pre };
}

function precedes(B, A, rank, s) {
  // B (holder entry) legitimately beats application A's choice at `rank` in Round 1
  if (B.how === 'pre') return true;
  const ca = classInfo(accepted(s.apps[A]), s.students).cls;
  if (B.cls < ca) return true;
  if (B.cls > ca) return false;
  if (B.how !== 'choice') return false;
  if (B.rank < rank) return true;
  if (B.rank > rank) return false;
  const sizeA = accepted(s.apps[A]).length;
  if (B.size !== sizeA) return B.size > sizeA;
  return B.lottery < s.lotteries[A];
}

// ---------------------------------------------------------------- workflow checks (run once)
{
  resetDemo();
  let s = getState();
  // GS blocks a room that a submitted application chose: only that choice goes, the app stays submitted.
  const victim = Object.values(s.apps).find((a) => a.status === 'submitted' && a.choices[1].length);
  const room = victim.choices[1][0];
  gs.setRoom(room, 'blocked', 'Water leak');
  s = getState();
  if (s.apps[victim.id].status !== 'submitted') fail('wf', 'blocking a chosen room un-submitted the application');
  if (s.apps[victim.id].choices[1].length) fail('wf', 'blocked room still in the choice');
  if (!s.apps[victim.id].notice) fail('wf', 'student not told about the blocked room');
  // GS pre-assigns a student who has a solo application: the application is withdrawn.
  const solo = Object.values(s.apps).find((a) => a.members.length === 1 && a.status === 'submitted');
  const freeRoom = Object.keys(s.rooms).find((r) => s.rooms[r].status === 'available');
  gs.setRoom(freeRoom, 'pre', 'Medical need', solo.repId);
  if (appOf(getState(), solo.repId)) fail('wf', 'pre-assigned student still has an application');
  // Run, reopen, run again: same result.
  gs.runRound1();
  const first = JSON.stringify(getState().holder);
  gs.reopenRound1();
  if (getState().phase !== 'round1_open' || Object.keys(getState().holder).length) fail('wf', 'reopen Round 1 did not reset');
  gs.runRound1();
  if (JSON.stringify(getState().holder) !== first) fail('wf', 'rerunning Round 1 gave a different result');
  gs.approveRound1();
  gs.runRound2();
  const fin = JSON.stringify(getState().holder);
  gs.reopenRound2();
  if (getState().phase !== 'round2_open') fail('wf', 'reopen Round 2 failed');
  gs.runRound2();
  if (JSON.stringify(getState().holder) !== fin) fail('wf', 'rerunning Round 2 gave a different result');
  // A member leaves a group: the rep is told.
  resetDemo();
  const grp = Object.values(getState().apps).find((a) => a.members.length >= 3 && a.status === 'submitted');
  student.leave(grp.id, grp.members[1].sid);
  if (!getState().apps[grp.id].notice) fail('wf', 'rep not told that a member left');
  // Picking the same block twice moves it instead of duplicating it.
  const ind = Object.values(getState().apps).find((a) => a.members.length === 1 && a.status === 'submitted');
  student.setChoice(ind.id, 2, ind.choices[0]);
  const after = getState().apps[ind.id];
  if (after.choices[0].length || after.choices[2].join() !== ind.choices[0].join()) fail('wf', 'duplicate block was not moved');
  console.log('Workflow checks done.');
}

for (let run = 1; run <= RUNS; run++) {
  const rnd = mulberry32(run * 7919);
  resetDemo();
  gs.setSettings({ seed: 1000 + run * 37 });
  let s = getState();

  // ---- Round 1: random student behaviour
  const ids = Object.keys(s.students);
  // finish or abandon drafts
  Object.values(s.apps).filter((a) => a.status === 'draft').forEach((a) => {
    if (rnd() < 0.6) {
      const n = memberIds(a).length;
      const blocks = validBlocks(getState().rooms, getState().wings, n);
      for (let i = 0; i < 3; i++) if (!a.choices[i] || !a.choices[i].length) tryAct(() => student.setChoice(a.id, i, blocks[Math.floor(rnd() * blocks.length)]));
      const r = tryAct(() => student.submit(a.id));
      if (r !== true && !/Same as an earlier|Add/.test(r)) fail(run, `draft ${a.id} could not submit: ${r}`);
    }
  });
  // a few students with no application apply alone, one forms a group by adding people directly
  const loners = ids.filter((sid) => !appOf(getState(), sid) && !Object.values(getState().rooms).some((r) => r.preSid === sid));
  loners.slice(0, Math.floor(loners.length / 2)).forEach((sid) => {
    const id = tryAct(() => student.createApplication(sid));
    const app = appOf(getState(), sid);
    if (!app) { fail(run, `createApplication failed for ${sid}: ${id}`); return; }
    const blocks = validBlocks(getState().rooms, getState().wings, 1);
    [0, 1, 2].forEach((i) => tryAct(() => student.setChoice(app.id, i, blocks[Math.floor(rnd() * blocks.length)])));
    tryAct(() => student.submit(app.id));
  });
  // a rep reshuffles who sleeps where, and copies the order to every choice
  const someGroup = Object.values(getState().apps).find((a) => memberIds(a).length >= 3 && a.status === 'submitted');
  if (someGroup) {
    const m = memberIds(someGroup);
    tryAct(() => student.setMapping(someGroup.id, 0, 0, m[2]));
    tryAct(() => student.copyMapping(someGroup.id, 0));
    const r = tryAct(() => student.submit(someGroup.id));
    if (r !== true) fail(run, `resubmit after remapping failed: ${r}`);
    const g = getState().apps[someGroup.id];
    g.mappings.forEach((map, i) => {
      if (g.choices[i].length && new Set(map).size !== map.length) fail(run, `mapping has duplicates after swap: ${map}`);
    });
  }
  // every submitted application must pass validation
  Object.values(getState().apps).filter((a) => a.status === 'submitted').forEach((a) => {
    const c = readiness(getState(), a);
    if (!c.ok) fail(run, `${a.id} submitted but not ready: ${c.blocking[0]}`);
  });

  gs.runRound1();
  s = getState();
  checkPlacement(run, 'after R1');
  // placements match a stated choice, and every member of a placed group has a room
  Object.values(s.apps).forEach((a) => {
    if (a.status === 'discarded' || a.splitParent) return;
    const held = Object.entries(s.holder).filter(([, h]) => h.appId === a.id);
    if (!held.length) return;
    const rooms = held.map(([r]) => r).sort();
    const how = held[0][1].how;
    if (how === 'choice') {
      const rank = held[0][1].rank;
      const want = [...a.choices[rank - 1]].sort();
      if (want.join() !== rooms.join()) fail(run, `${a.id} placed in ${rooms} but its choice ${rank} is ${want}`);
    }
    const sids = new Set(held.map(([, h]) => h.sid));
    if (sids.size !== accepted(a).length) fail(run, `${a.id}: ${accepted(a).length} members but ${sids.size} rooms`);
    accepted(a).forEach((m) => { if (!sids.has(m)) fail(run, `${a.id}: member ${m} has no room`); });
    const wings = new Set(rooms.map((r) => wingOfRoom(s.wings, r)));
    if (how === 'choice' && wings.size > 1) fail(run, `${a.id} choice spans wings`);
  });
  // priority: every lost choice was lost to someone with a better claim
  Object.values(s.apps).forEach((a) => {
    if (a.status !== 'submitted' || !s.lotteries[a.id]) return;
    const got = Object.values(s.holder).find((h) => h.appId === a.id);
    const gotRank = got && got.how === 'choice' ? got.rank : 99;
    a.choices.forEach((c, i) => {
      const rank = i + 1;
      if (!c.length || rank >= gotRank) return;
      const holders = c.map((r) => s.holder[r]).filter(Boolean);
      if (!holders.length) { fail(run, `${a.id} lost choice ${rank} (${c}) but all its rooms are free`); return; }
      if (!holders.some((h) => precedes(h, a.id, rank, s))) fail(run, `${a.id} lost choice ${rank} (${c}) to ${holders.map((h) => h.appId).join(',')} without a better claim`);
    });
  });

  // ---- GS override during review: swap two students
  const placed = Object.entries(s.holder);
  if (placed.length > 2) {
    const [r1, h1] = placed[0];
    const [r2, h2] = placed[placed.length - 1];
    const r = tryAct(() => gs.override(h1.sid, r2, 'Swap requested by both students'));
    if (r !== true) fail(run, `override swap failed: ${r}`);
    const t = getState();
    if (t.holder[r2].sid !== h1.sid || t.holder[r1].sid !== h2.sid) fail(run, 'override did not swap both students');
  }
  gs.approveRound1();

  // ---- Round 2: some reply, some don't; some late forms
  s = getState();
  Object.values(s.apps).filter((a) => a.r2 && a.r2.status === 'open').forEach((a) => {
    if (rnd() < 0.25) return; // no reply
    const n = memberIds(a).length;
    const blocks = validBlocks(getState().rooms, getState().wings, n, freeHolderView(getState()));
    if (!blocks.length) return;
    tryAct(() => student.setChoice(a.id, 0, blocks[Math.floor(rnd() * blocks.length)], 2));
    if (rnd() < 0.5 && blocks.length > 1) tryAct(() => student.setChoice(a.id, 1, blocks[Math.floor(rnd() * blocks.length)], 2));
    const r = tryAct(() => student.submitRound2(a.id));
    if (r !== true) fail(run, `R2 submit failed for ${a.id}: ${r}`);
  });
  const late = ids.filter((sid) => !appOf(getState(), sid) && !Object.values(getState().rooms).some((r) => r.preSid === sid) && !Object.values(getState().holder).some((h) => h.sid === sid));
  late.slice(0, 2).forEach((sid) => {
    const r = tryAct(() => student.createApplication(sid));
    const app = appOf(getState(), sid);
    if (!app) { fail(run, `late form not created for ${sid}: ${r}`); return; }
    if (!app.late) fail(run, `late form for ${sid} not marked late`);
    const blocks = validBlocks(getState().rooms, getState().wings, 1, freeHolderView(getState()));
    if (blocks.length) { tryAct(() => student.setChoice(app.id, 0, blocks[0], 2)); tryAct(() => student.submitRound2(app.id)); }
  });

  gs.runRound2();
  s = getState();
  const { seen, pre } = checkPlacement(run, 'after R2');
  const wl = new Set(s.waitlist.map((w) => w.sid));
  ids.forEach((sid) => {
    const n = (seen.has(sid) ? 1 : 0) + (pre.has(sid) ? 1 : 0) + (wl.has(sid) ? 1 : 0);
    if (n !== 1) fail(run, `${sid} (${s.students[sid].name}) has ${n} outcomes (room/pre/waitlist)`);
  });
  const freeLeft = Object.entries(s.rooms).filter(([r, x]) => x.status === 'available' && !s.holder[r]).length;
  if (s.waitlist.length && freeLeft) fail(run, `${s.waitlist.length} waitlisted while ${freeLeft} rooms are free`);
  if (s.waitlist.length !== new Set(s.waitlist.map((w) => w.sid)).size) fail(run, 'waitlist has duplicates');

  // ---- assign a waitlisted student to a free room? (none free) then publish
  gs.publish();
  if (getState().phase !== 'published') fail(run, 'did not publish');
}

const s = getState();
console.log(`Ran ${RUNS} full allotments on ${Object.keys(s.students).length} students and ${Object.keys(s.rooms).length} rooms.`);
console.log(`Last run: ${Object.keys(s.holder).length} placed, ${s.waitlist.length} waitlisted, ${s.events.length} decisions logged.`);
if (failures.length) {
  console.log(`\n${failures.length} problems:`);
  [...new Set(failures)].slice(0, 40).forEach((f) => console.log(' - ' + f));
  process.exit(1);
}
console.log('All checks passed.');
