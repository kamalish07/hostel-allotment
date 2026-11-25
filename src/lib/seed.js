// Demo data: Hostel H4, three floors of six 8-room wings around a central courtyard (144 single rooms),
// about 150 students graduating in 2028 (final years) or 2029 (incoming), and a realistic spread of applications.
import { mulberry32, validBlocks } from './engine.js';

export const FLOOR_NAMES = { 1: 'First floor', 2: 'Second floor', 3: 'Third floor' };
const ORDINAL = { 1: '1st', 2: '2nd', 3: '3rd' };
// Wings go clockwise from the north-west, as on the floor plan.
export const WING_DIRS = [['A', 'North-west'], ['B', 'West'], ['C', 'South-west'], ['D', 'South-east'], ['E', 'East'], ['F', 'North-east']];

export const BRANCH_NAMES = {
  CS: 'Computer Science and Engineering', EE: 'Electrical Engineering', ME: 'Mechanical Engineering',
  CE: 'Civil Engineering', EC: 'Electronics and Communication Engineering',
};
const BRANCHES = Object.keys(BRANCH_NAMES);
const HOMETOWNS = ['Pune, Maharashtra', 'Kochi, Kerala', 'Jaipur, Rajasthan', 'Lucknow, Uttar Pradesh', 'Bhopal, Madhya Pradesh',
  'Guwahati, Assam', 'Mysuru, Karnataka', 'Nagpur, Maharashtra', 'Patna, Bihar', 'Vadodara, Gujarat', 'Coimbatore, Tamil Nadu',
  'Dehradun, Uttarakhand', 'Bhubaneswar, Odisha', 'Indore, Madhya Pradesh', 'Vizag, Andhra Pradesh', 'Ranchi, Jharkhand'];
const BLOOD = ['B+', 'O+', 'A+', 'O+', 'AB+', 'B+', 'A-', 'O-'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const FIRST = ['Aarav', 'Vihaan', 'Aditya', 'Sai', 'Reyansh', 'Krishna', 'Ayaan', 'Atharv', 'Rohan', 'Varun', 'Manav', 'Yuvraj',
  'Ananya', 'Diya', 'Saanvi', 'Aadhya', 'Kavya', 'Myra', 'Riya', 'Tanvi', 'Sneha', 'Pooja', 'Nandini', 'Shreya',
  'Harsh', 'Siddharth', 'Pranav', 'Rahul', 'Akash', 'Abhinav', 'Kunal', 'Mohit', 'Tushar', 'Gaurav', 'Vivek', 'Ankit',
  'Ishita', 'Mehak', 'Nisha', 'Priya', 'Radhika', 'Sakshi', 'Simran', 'Tara', 'Uma', 'Vaishnavi', 'Zara', 'Bhavya',
  'Dhruv', 'Eshan', 'Faiz', 'Hrithik', 'Imran', 'Jay', 'Laksh', 'Omkar', 'Parth', 'Qasim', 'Ritesh', 'Samar'];
const LAST = ['Sharma', 'Verma', 'Iyer', 'Nair', 'Reddy', 'Patel', 'Gupta', 'Mehta', 'Joshi', 'Kulkarni', 'Desai', 'Rao',
  'Pillai', 'Menon', 'Bose', 'Das', 'Ghosh', 'Khan', 'Shaikh', 'Ali', 'Singh', 'Chopra', 'Malhotra', 'Kapoor', 'Bhatt',
  'Saxena', 'Mishra', 'Pandey', 'Yadav', 'Hegde', 'Shetty', 'Agarwal', 'Jain', 'Banerjee', 'Mukherjee', 'Fernandes'];

// Named students used in the walkthrough in the README.
const NAMED = [
  ['Farhan Qureshi', 4], ['Isha Menon', 4], ['Rahul Verma', 4], ['Aditi Kulkarni', 4], ['Meera Pillai', 4],
  ['Ishaan Chopra', 3], ['Kiran Hegde', 3], ['Neel Banerjee', 3], ['Nikhil Reddy', 3], ['Zoya Siddiqui', 3],
  ['Arjun Nair', 3], ['Kabir Singh', 3],
];
const TOTAL = 150;
const FINAL_YEARS = 60;

function makeBuilding() {
  const wings = [];
  const rooms = {};
  for (const f of [1, 2, 3]) {
    WING_DIRS.forEach(([L, dir], wi) => {
      const nums = Array.from({ length: 8 }, (_, k) => `${f}${String(wi * 8 + k + 1).padStart(2, '0')}`);
      wings.push({ id: `${f}${L}`, letter: L, name: `Wing ${L}`, floor: f, dir, label: `Wing ${L}, ${ORDINAL[f]} floor`, rooms: nums });
      nums.forEach((r) => { rooms[r] = { status: 'available', reason: '', preSid: null }; });
    });
  }
  return { wings, rooms };
}

function makeStudents(rnd) {
  const students = {};
  const byName = {};
  const counters = {};
  const used = new Set(NAMED.map(([n]) => n));
  const list = [...NAMED];
  let finals = NAMED.filter(([, y]) => y === 4).length;
  while (list.length < TOTAL) {
    const name = `${FIRST[Math.floor(rnd() * FIRST.length)]} ${LAST[Math.floor(rnd() * LAST.length)]}`;
    if (used.has(name)) continue;
    used.add(name);
    const year = finals < FINAL_YEARS && rnd() < 0.45 ? 4 : 3;
    if (year === 4) finals += 1;
    list.push([name, year]);
  }
  list.forEach(([name, year], i) => {
    const batch = year === 4 ? '24' : '25';
    const branch = BRANCHES[(i * 7 + name.length) % BRANCHES.length];
    const key = batch + branch;
    counters[key] = (counters[key] || 10) + 1 + (i % 3);
    const id = `${key}${String(counters[key]).padStart(3, '0')}`;
    const digits = String(4012357 + i * 104729).padStart(8, '0').slice(-8);
    students[id] = {
      id, name, year, branch, programme: 'B.Tech',
      batch: year === 4 ? '2024–28' : '2025–29',
      email: `${id.toLowerCase()}@students.example.edu`,
      phone: `+91 98${digits.slice(0, 3)} ${digits.slice(3)}`,
      hometown: HOMETOWNS[(i * 5) % HOMETOWNS.length],
      dob: `${1 + ((i * 11) % 28)} ${MONTHS[(i * 7) % 12]} ${year === 4 ? 2006 : 2007}`,
      blood: BLOOD[i % BLOOD.length],
    };
    byName[name] = id;
  });
  return { students, byName };
}

export function makeSeed() {
  const rnd = mulberry32(20261126);
  const { wings, rooms } = makeBuilding();
  const { students, byName: N } = makeStudents(rnd);

  // GS setup: two pre-assigned rooms, two blocked rooms.
  const officeBearer = Object.values(students).find((x) => x.year === 4 && !NAMED.some(([n]) => n === x.name));
  rooms['101'] = { status: 'pre', reason: 'Medical need: ground-floor-adjacent room near the lift', preSid: N['Rahul Verma'] };
  rooms['125'] = { status: 'pre', reason: 'Mess secretary: room next to the common room', preSid: officeBearer.id };
  rooms['238'] = { status: 'blocked', reason: 'Ceiling repair until January', preSid: null };
  rooms['339'] = { status: 'blocked', reason: 'Plumbing work in progress', preSid: null };

  // Popularity: lower floors and the wings by the entrance are wanted most.
  const wingWeight = (w) => ({ 1: 3, 2: 2, 3: 1.2 }[w.floor]) * ({ C: 1.7, D: 1.7, A: 1.2, F: 1.2, B: 1, E: 1 }[w.letter]);
  const wingById = Object.fromEntries(wings.map((w) => [w.id, w]));
  const wingIdOf = {};
  wings.forEach((w) => w.rooms.forEach((r) => { wingIdOf[r] = w.id; }));
  const pickBlocks = (n, bias = 1) => {
    const all = validBlocks(rooms, wings, n);
    const chosen = [];
    for (let k = 0; k < 3 && all.length; k++) {
      const weights = all.map((b) => Math.pow(wingWeight(wingById[wingIdOf[b[0]]]), bias) * (0.6 + rnd()));
      const total = weights.reduce((a, b) => a + b, 0);
      let x = rnd() * total;
      let idx = 0;
      while (x > weights[idx]) { x -= weights[idx]; idx += 1; }
      chosen.push(all[idx]);
      all.splice(idx, 1);
    }
    return chosen;
  };

  const apps = {};
  let nextId = 101;
  let t = Date.parse('2026-11-20T09:12:00+05:30');
  const taken = new Set([N['Rahul Verma'], officeBearer.id]);
  const addApp = (memberIds, opts = {}) => {
    const id = `APP-${nextId++}`;
    memberIds.forEach((m) => taken.add(m));
    const choices = opts.choices || pickBlocks(memberIds.length, opts.bias || 1);
    while (choices.length < 3) choices.push([]);
    t += 1000 * 60 * (7 + Math.floor(rnd() * 50));
    const status = opts.status || 'submitted';
    apps[id] = {
      id, repId: memberIds[0], members: memberIds.map((sid) => ({ sid, status: 'accepted' })),
      choices, mappings: choices.map((c) => (c.length > 1 ? memberIds.slice(0, c.length) : [])),
      fallback: opts.fallback || 'auto', status, submittedAt: status === 'submitted' ? new Date(t).toISOString() : null,
      late: false, r2: null, splitFrom: null,
    };
    return id;
  };
  const pool = () => Object.values(students).filter((x) => !taken.has(x.id) && !NAMED.some(([n]) => n === x.name));
  const take = (k, year) => {
    let p = pool();
    if (year) p = p.filter((x) => x.year === year);
    const out = [];
    while (out.length < k && p.length) out.push(p.splice(Math.floor(rnd() * p.length), 1)[0].id);
    return out;
  };

  // Walkthrough characters.
  addApp([N['Ishaan Chopra'], N['Kiran Hegde']], { status: 'draft', choices: [[], [], []] });
  taken.add(N['Neel Banerjee']); taken.add(N['Aditi Kulkarni']); taken.add(N['Zoya Siddiqui']); // no application yet
  addApp([N['Farhan Qureshi']], { bias: 2 });
  addApp([N['Isha Menon']], { bias: 2 });
  addApp([N['Nikhil Reddy'], ...take(3, 3)], { fallback: 'round2', bias: 3 });
  addApp([N['Arjun Nair'], ...take(7, 3)], { bias: 2 });
  addApp([N['Kabir Singh'], ...take(1, 4), ...take(4, 3)], { bias: 2 });
  addApp([N['Meera Pillai'], ...take(2, 4)], { fallback: 'split', bias: 2 });

  // Everyone else.
  [7, 5, 5].forEach((n) => addApp(take(n), { bias: 1.5 }));
  for (let g = 0; g < 15; g++) {
    const n = 2 + Math.floor(rnd() * 3);
    const r = rnd();
    addApp(take(n), { fallback: r < 0.7 ? 'auto' : r < 0.9 ? 'round2' : 'split', bias: 1 + rnd() });
  }
  // Two unfinished forms and a few students who never apply.
  const d1 = take(1);
  addApp(d1, { status: 'draft', choices: pickBlocks(1).slice(0, 2) });
  const d2 = take(3);
  addApp(d2, { status: 'draft', choices: pickBlocks(3).slice(0, 1) });
  take(4).forEach((sid) => taken.add(sid));
  pool().forEach((st) => addApp([st.id], { bias: 1 + rnd() }));

  return {
    version: 6,
    hostel: { name: 'Hostel H4', session: '2027–28' },
    phase: 'round1_open',
    settings: { seed: 2026, r1Deadline: '2026-12-03T18:00', r2Deadline: '2026-12-06T18:00' },
    wings,
    rooms,
    students,
    apps,
    holder: {},
    events: [],
    lotteries: {},
    waitlist: [],
    overrides: [],
    snapshots: {},
    nextId,
  };
}
