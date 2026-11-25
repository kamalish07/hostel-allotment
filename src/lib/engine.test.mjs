// Reproduces the worked example from the design PDF and checks every room.
import { runRound, finalPlacement, blockLabel } from './engine.js';

const wings = ['A', 'B', 'C', 'D'].map((id) => ({ id }));
const rooms = {};
wings.forEach((w) => { for (let n = 1; n <= 8; n++) rooms[`${w.id}${n}`] = { status: 'available' }; });
rooms.C8 = { status: 'pre' };
const R = (w, a, b) => Array.from({ length: b - a + 1 }, (_, i) => `${w}${a + i}`);
const students = {};
const M = (p, n, y) => Array.from({ length: n }, (_, i) => { const id = `${p}${i + 1}`; students[id] = { year: y }; return id; });
const one = (id, y) => { students[id] = { year: y }; return [id]; };

const w2 = M('w2-', 4, 3); students['w2-5'] = { year: 4 }; w2.push('w2-5');
const apps = [
  { id: 'W1', members: M('w1-', 6, 3), choices: [R('A', 1, 6), R('B', 1, 6), R('C', 1, 6)], lottery: 5098, fallback: 'auto' },
  { id: 'W2', members: w2, choices: [R('A', 1, 5), R('A', 4, 8), R('C', 1, 5)], lottery: 3776, fallback: 'auto' },
  { id: 'G1', members: M('g1-', 3, 4), choices: [R('C', 3, 5), R('C', 5, 7), R('B', 6, 8)], lottery: 2370, fallback: 'auto' },
  { id: 'G2', members: M('g2-', 4, 3), choices: [R('B', 5, 8), R('D', 1, 4), R('D', 3, 6)], lottery: 6566, fallback: 'round2' },
  { id: 'G3', members: M('g3-', 4, 3), choices: [R('D', 1, 4), R('D', 5, 8), R('B', 1, 4)], lottery: 4120, fallback: 'auto' },
  { id: 'G4', members: M('g4-', 2, 3), choices: [R('C', 6, 7), R('A', 7, 8), R('D', 7, 8)], lottery: 6210, fallback: 'auto' },
  { id: 'G5', members: M('g5-', 2, 3), choices: [R('C', 6, 7), R('D', 5, 6), R('A', 7, 8)], lottery: 1840, fallback: 'auto' },
  { id: 'Farhan', members: one('farhan', 4), choices: [['A3'], ['D5'], ['B5']], lottery: 2996 },
  { id: 'Isha', members: one('isha', 4), choices: [['D5'], ['D6'], ['B5']], lottery: 7145 },
  { id: 'Dev', members: one('dev', 3), choices: [['D6'], ['D7'], ['D8']], lottery: 4875 },
  { id: 'Sam', members: one('sam', 3), choices: [['D6'], ['D8'], ['D7']], lottery: 2210 },
  { id: 'Tara', members: one('tara', 3), choices: [['B5'], ['D5'], ['A8']], lottery: 8212 },
].map((a) => ({ ...a, label: a.id }));

const holder = { C8: { sid: 'rahul', appId: null, label: 'Rahul', how: 'pre' } };
const r1 = runRound({ round: 1, entrants: apps, rooms, wings, students, holder });
const g2 = apps.find((a) => a.id === 'G2');
const tara = apps.find((a) => a.id === 'Tara');
const kiran = { id: 'Kiran', label: 'Kiran', members: one('kiran', 3), choices: [['D8'], ['B1']], lottery: 3301, late: true };
const r2 = runRound({ round: 2, rooms, wings, students, holder, entrants: [
  { ...g2, choices: [R('B', 1, 4)] }, { ...tara, choices: [['B3'], ['D8']] }, kiran] });
const fin = finalPlacement({ queue: [...r2.unplaced.map((u) => ({ ...u.entrant, reason: 'Round 2 choices taken' })),
  { id: 'zoya', label: 'Zoya', members: ['zoya'], reason: 'No form' }], rooms, wings, holder, seed: 2026 });

const expected = {
  A1: 'W1', A2: 'W1', A3: 'W1', A4: 'W1', A5: 'W1', A6: 'W1', A7: 'G4', A8: 'G4',
  B1: 'G2', B2: 'G2', B3: 'G2', B4: 'G2', B5: 'Farhan', B6: 'G1', B7: 'G1', B8: 'G1',
  C1: 'W2', C2: 'W2', C3: 'W2', C4: 'W2', C5: 'W2', C6: 'G5', C7: 'G5', C8: 'Rahul',
  D1: 'G3', D2: 'G3', D3: 'G3', D4: 'G3', D5: 'Isha', D6: 'Sam', D7: 'Dev', D8: 'Tara',
};
let fails = 0;
for (const [room, who] of Object.entries(expected)) {
  const got = holder[room] && holder[room].label;
  if (got !== who) { fails++; console.log(`FAIL ${room}: expected ${who}, got ${got}`); }
}
const wl = fin.waitlist.map((w) => w.appId).join(',');
if (wl !== 'Kiran,zoya') { fails++; console.log('FAIL waitlist', wl); }
[...r1.events, ...r2.events].slice(0, 6).forEach((e) => console.log(`  R${e.round} ${e.label}: ${e.detail}`));
console.log(fails ? `${fails} failures` : `All ${Object.keys(expected).length} rooms and the waitlist match the design document.`);
process.exit(fails ? 1 : 0);
