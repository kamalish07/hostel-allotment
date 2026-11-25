// Demo data: Hostel H4, four wings of 8 single rooms, 3rd and 4th year students.
// Mirrors the worked example in the design document, plus a few students still applying.

const BRANCHES = ['CS', 'EE', 'ME', 'CE', 'EC'];

const FOURTH = ['Farhan Qureshi', 'Isha Menon', 'Meera Pillai', 'Kunal Bhatt', 'Lalit Rao', 'Jatin Saxena', 'Rahul Verma', 'Aditi Kulkarni'];
const THIRD = ['Arjun Nair', 'Bala Krishnan', 'Chetan Joshi', 'Deepak Yadav', 'Eshan Gupta', 'Faiz Ahmed', 'Kabir Singh',
  'Gautam Das', 'Harsh Mehta', 'Imran Shaikh', 'Nikhil Reddy', 'Pranav Iyer', 'Rohit Sharma', 'Sahil Khan', 'Omkar Patil',
  'Parth Desai', 'Qasim Ali', 'Ritesh Kumar', 'Uday Shetty', 'Vivek Mishra', 'Yash Agarwal', 'Zubin Mistry', 'Dev Malhotra',
  'Sam Fernandes', 'Tara Bose', 'Ishaan Chopra', 'Kiran Hegde', 'Zoya Siddiqui', 'Neel Banerjee'];

export const BRANCH_NAMES = {
  CS: 'Computer Science and Engineering', EE: 'Electrical Engineering', ME: 'Mechanical Engineering',
  CE: 'Civil Engineering', EC: 'Electronics and Communication Engineering',
};
export const FLOOR_NAMES = ['Ground floor', 'First floor'];
const HOMETOWNS = ['Pune, Maharashtra', 'Kochi, Kerala', 'Jaipur, Rajasthan', 'Lucknow, Uttar Pradesh', 'Bhopal, Madhya Pradesh',
  'Guwahati, Assam', 'Mysuru, Karnataka', 'Nagpur, Maharashtra', 'Patna, Bihar', 'Vadodara, Gujarat', 'Coimbatore, Tamil Nadu',
  'Dehradun, Uttarakhand', 'Bhubaneswar, Odisha'];
const BLOOD = ['B+', 'O+', 'A+', 'O+', 'AB+', 'B+', 'A-', 'O-'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function makeStudents() {
  const students = {};
  const byFirst = {};
  const add = (name, year, i) => {
    const batch = year === 4 ? '23' : '24';
    const branch = BRANCHES[i % BRANCHES.length];
    const id = `${batch}${branch}${String(11 + i * 7).padStart(3, '0')}`;
    const digits = String(4012357 + i * 104729).padStart(8, '0').slice(-8);
    students[id] = {
      id, name, year, branch,
      programme: 'B.Tech',
      batch: year === 4 ? '2023–27' : '2024–28',
      email: `${id.toLowerCase()}@students.example.edu`,
      phone: `+91 98${digits.slice(0, 3)} ${digits.slice(3)}`,
      hometown: HOMETOWNS[(i * 5) % HOMETOWNS.length],
      dob: `${1 + ((i * 11) % 28)} ${MONTHS[(i * 7) % 12]} ${year === 4 ? 2005 : 2006}`,
      blood: BLOOD[i % BLOOD.length],
    };
    byFirst[name.split(' ')[0]] = id;
  };
  FOURTH.forEach((n, i) => add(n, 4, i));
  THIRD.forEach((n, i) => add(n, 3, i + 8));
  return { students, byFirst };
}

const R = (w, a, b) => Array.from({ length: b - a + 1 }, (_, i) => `${w}${a + i}`);

export function makeSeed() {
  const { students, byFirst: S } = makeStudents();
  const wings = [
    { id: 'A', name: 'Wing A', floor: 0, side: 'east' },
    { id: 'B', name: 'Wing B', floor: 0, side: 'west' },
    { id: 'C', name: 'Wing C', floor: 1, side: 'east' },
    { id: 'D', name: 'Wing D', floor: 1, side: 'west' },
  ];
  const rooms = {};
  wings.forEach((w) => { for (let n = 1; n <= 8; n++) rooms[`${w.id}${n}`] = { status: 'available', reason: '', preSid: null }; });
  rooms.C8 = { status: 'pre', reason: 'Medical need: ground-floor access to washroom', preSid: S.Rahul };

  let t = Date.parse('2026-11-30T09:12:00+05:30');
  const app = (id, rep, others, choices, fallback = 'auto', status = 'submitted') => {
    const members = [rep, ...others].map((n) => ({ sid: S[n], status: 'accepted' }));
    t += 1000 * 60 * 37;
    return [id, {
      id, repId: S[rep], members, choices, mappings: choices.map((c) => (c.length > 1 ? members.map((m) => m.sid).slice(0, c.length) : [])),
      fallback, status, submittedAt: status === 'submitted' ? new Date(t).toISOString() : null, late: false, r2: null, splitFrom: null,
    }];
  };
  const apps = Object.fromEntries([
    app('APP-101', 'Arjun', ['Bala', 'Chetan', 'Deepak', 'Eshan', 'Faiz'], [R('A', 1, 6), R('B', 1, 6), R('C', 1, 6)]),
    app('APP-102', 'Kabir', ['Gautam', 'Harsh', 'Imran', 'Jatin'], [R('A', 1, 5), R('A', 4, 8), R('C', 1, 5)]),
    app('APP-103', 'Meera', ['Kunal', 'Lalit'], [R('C', 3, 5), R('C', 5, 7), R('B', 6, 8)]),
    app('APP-104', 'Nikhil', ['Pranav', 'Rohit', 'Sahil'], [R('B', 5, 8), R('D', 1, 4), R('D', 3, 6)], 'round2'),
    app('APP-105', 'Omkar', ['Parth', 'Qasim', 'Ritesh'], [R('D', 1, 4), R('D', 5, 8), R('B', 1, 4)]),
    app('APP-106', 'Uday', ['Vivek'], [R('C', 6, 7), R('A', 7, 8), R('D', 7, 8)]),
    app('APP-107', 'Yash', ['Zubin'], [R('C', 6, 7), R('D', 5, 6), R('A', 7, 8)]),
    app('APP-108', 'Farhan', [], [['A3'], ['D5'], ['B5']]),
    app('APP-109', 'Isha', [], [['D5'], ['D6'], ['B5']]),
    app('APP-110', 'Dev', [], [['D6'], ['D7'], ['D8']]),
    app('APP-111', 'Sam', [], [['D6'], ['D8'], ['D7']]),
    app('APP-112', 'Tara', [], [['B5'], ['D5'], ['A8']]),
  ]);
  // A group still forming: Ishaan has added Kiran but hasn't picked rooms or submitted yet.
  apps['APP-113'] = {
    id: 'APP-113', repId: S.Ishaan, members: [{ sid: S.Ishaan, status: 'accepted' }, { sid: S.Kiran, status: 'accepted' }],
    choices: [[], [], []], mappings: [[], [], []], fallback: 'auto', status: 'draft', submittedAt: null, late: false, r2: null, splitFrom: null,
  };

  return {
    version: 5,
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
    nextId: 114,
  };
}
