import { useMemo, useState } from 'react';
import { useStore, appOf, invitesFor, isPreassigned, roomOf, appLabel, onWaitlist, yearLabel } from '../lib/store.js';
import { Chip } from '../components/ui.jsx';
import { PageHead } from '../components/Shell.jsx';
import { howShort } from './Allotment.jsx';

export function studentStatus(s, sid) {
  if (isPreassigned(s, sid)) return { key: 'pre', label: 'Pre-assigned', tone: 'muted' };
  const wl = onWaitlist(s, sid);
  if (wl) return { key: 'waitlist', label: `Waitlist #${wl}`, tone: 'bad' };
  const r = roomOf(s, sid);
  if (r) return { key: 'placed', label: 'Has a room', tone: 'ok' };
  const a = appOf(s, sid);
  if (a && a.r2 && ['round2_open'].includes(s.phase)) return { key: 'round2', label: a.r2.status === 'submitted' ? 'Round 2 submitted' : 'Round 2 to do', tone: a.r2.status === 'submitted' ? 'accent' : 'warn' };
  if (invitesFor(s, sid).length && !a) return { key: 'invite', label: 'Invite waiting', tone: 'warn' };
  if (!a) return { key: 'none', label: 'No application', tone: 'muted' };
  if (a.status === 'submitted') return { key: 'submitted', label: 'Submitted', tone: 'accent' };
  return { key: 'draft', label: 'Draft', tone: 'warn' };
}

const FILTERS = [
  ['all', 'All'], ['none', 'No application'], ['invite', 'Invite waiting'], ['draft', 'Draft'], ['submitted', 'Submitted'],
  ['round2', 'Round 2'], ['placed', 'Has a room'], ['pre', 'Pre-assigned'], ['waitlist', 'Waitlist'],
];

export default function Students() {
  const s = useStore();
  const [q, setQ] = useState('');
  const [f, setF] = useState('all');
  const rows = useMemo(() => Object.values(s.students)
    .map((st) => ({ st, status: studentStatus(s, st.id), app: appOf(s, st.id), room: roomOf(s, st.id) }))
    .sort((a, b) => b.st.year - a.st.year || a.st.name.localeCompare(b.st.name)), [s]);
  const counts = rows.reduce((m, r) => { m[r.status.key] = (m[r.status.key] || 0) + 1; return m; }, {});
  const t = q.trim().toLowerCase();
  const shown = rows.filter((r) => (f === 'all' || r.status.key === f) && (!t || r.st.name.toLowerCase().includes(t) || r.st.id.toLowerCase().includes(t)));

  return (
    <>
      <PageHead title="Students" sub={`${rows.length} students · ${rows.filter((r) => r.st.year === 4).length} in the Class of 2028 (final year), ${rows.filter((r) => r.st.year === 3).length} in the Class of 2029 (incoming)`} />
      <div className="content">
        <div className="toolbar">
          <input className="input" type="search" placeholder="Search name or roll number" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search students" />
          <div className="seg" role="group" aria-label="Filter by status">
            {FILTERS.filter(([k]) => k === 'all' || counts[k]).map(([k, l]) => (
              <button type="button" key={k} aria-pressed={f === k} onClick={() => setF(k)}>{l}{k !== 'all' && <span className="seg-n">{counts[k]}</span>}</button>
            ))}
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Name</th><th>Roll number</th><th>Class</th><th>Application</th><th>Status</th><th>Room</th></tr></thead>
            <tbody>
              {shown.map(({ st, status, app, room }) => (
                <tr key={st.id}>
                  <td><a className="link strong" href={`#/gs/students/${st.id}`}>{st.name}</a></td>
                  <td className="mono">{st.id}</td>
                  <td>{yearLabel(st.year)}</td>
                  <td>{app ? <>{appLabel(s, app)}{app.repId === st.id && app.members.length > 1 ? <span className="muted"> · rep</span> : null}</> : <span className="muted">—</span>}</td>
                  <td><Chip tone={status.tone}>{status.label}</Chip></td>
                  <td>{room ? <><span className="mono strong">{room.room}</span> <span className="muted small">{room.how === 'pre' ? '' : howShort(room)}</span></> : <span className="muted">—</span>}</td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={6} className="muted">No students match.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
