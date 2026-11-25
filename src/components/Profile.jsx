import {
  appOf, roomOf, appLabel, appClass, memberIds, isPreassigned, onWaitlist, wingPlace, branchName,
} from '../lib/store.js';
import { classLabel } from '../lib/engine.js';
import { studentStatus } from '../admin/Students.jsx';
import { Chip } from './ui.jsx';

export const initials = (name) => name.split(' ').map((p) => p[0]).slice(0, 2).join('');

// Is the student's room visible to them yet?
export function roomVisible(s, sid) {
  const r = roomOf(s, sid);
  if (!r) return false;
  return s.phase === 'published' || isPreassigned(s, sid) || (s.phase === 'round2_open' || s.phase === 'round2_review') && r.round === 1;
}

export default function ProfileView({ s, sid, admin }) {
  const st = s.students[sid];
  const app = appOf(s, sid);
  const room = roomOf(s, sid);
  const showRoom = admin ? !!room : roomVisible(s, sid);
  const wing = room ? s.wings.find((w) => w.id === room.room[0]) : null;
  const status = studentStatus(s, sid);
  const wl = onWaitlist(s, sid);
  const link = (id) => (admin ? <a className="link" href={`#/gs/students/${id}`}>{s.students[id].name}</a> : s.students[id].name);

  return (
    <div className="profile">
      <div className="profile-head">
        <div className="avatar" aria-hidden="true">{initials(st.name)}</div>
        <div className="profile-id">
          <h2>{st.name}</h2>
          <p className="mono muted">{st.id}</p>
          <p className="muted">{st.programme} · {branchName(st)} · {st.year === 4 ? '4th' : '3rd'} year</p>
        </div>
        <div className="profile-status"><Chip tone={status.tone}>{status.label}</Chip></div>
      </div>

      <div className="profile-grid">
        <section className="profile-sec">
          <h3 className="h-sec">Basic information</h3>
          <dl className="kv">
            <dt>Roll number</dt><dd className="mono">{st.id}</dd>
            <dt>Programme</dt><dd>{st.programme}</dd>
            <dt>Branch</dt><dd>{branchName(st)}</dd>
            <dt>Year</dt><dd>{st.year === 4 ? '4th year' : '3rd year'}</dd>
            <dt>Batch</dt><dd>{st.batch}</dd>
            <dt>Date of birth</dt><dd>{st.dob}</dd>
            <dt>Blood group</dt><dd>{st.blood}</dd>
            <dt>Hometown</dt><dd>{st.hometown}</dd>
          </dl>
        </section>

        <section className="profile-sec">
          <h3 className="h-sec">Contact</h3>
          <dl className="kv">
            <dt>College email</dt><dd className="mono small">{st.email}</dd>
            <dt>Phone</dt><dd className="mono">{st.phone}</dd>
          </dl>

          <h3 className="h-sec mt-l">Hostel</h3>
          <dl className="kv">
            <dt>Hostel</dt><dd>{s.hostel.name} · {s.hostel.session}</dd>
            <dt>Room</dt>
            <dd>{showRoom ? <><span className="mono strong">{room.room}</span> <span className="muted">· {wing.name}, {wingPlace(wing)}</span></>
              : wl && (admin || s.phase === 'published') ? `Waitlist #${wl}` : <span className="muted">Not allotted yet</span>}</dd>
            {isPreassigned(s, sid) ? <><dt>Application</dt><dd>Pre-assigned by the GS</dd></> : app ? <>
              <dt>Application</dt><dd>{appLabel(s, app)} <span className="mono muted small">{app.id}</span></dd>
              <dt>Priority class</dt><dd>{classLabel(appClass(s, app))}</dd>
              {memberIds(app).length > 1 && <><dt>Group</dt><dd className="member-list">
                {app.members.map((m) => (
                  <span key={m.sid}>{m.sid === sid ? (admin ? st.name : 'You') : link(m.sid)}{m.sid === app.repId ? ' (rep)' : ''}{m.status === 'pending' ? ' (invited)' : ''}</span>
                ))}
              </dd></>}
            </> : <><dt>Application</dt><dd className="muted">None</dd></>}
          </dl>
        </section>
      </div>
    </div>
  );
}
