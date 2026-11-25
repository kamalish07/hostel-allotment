import { useMemo, useState } from 'react';
import { useStore, appOf, invitesFor, isPreassigned, roomOf, resetDemo, yearLabel } from './lib/store.js';
import { Chip, useAct, phaseStatus } from './components/ui.jsx';
import Icon from './components/Icon.jsx';
import { initials } from './components/Profile.jsx';

function statusOf(s, sid) {
  if (isPreassigned(s, sid)) return ['Pre-assigned', 'muted'];
  const r = roomOf(s, sid);
  if (r && s.phase !== 'round1_open') return [`Room ${r.room}`, 'accent'];
  if (invitesFor(s, sid).length) return ['Invite waiting', 'attn'];
  const a = appOf(s, sid);
  if (!a) return ['No application', 'muted'];
  if (a.r2 && a.r2.status === 'open' && s.phase === 'round2_open') return ['Round 2 to do', 'attn'];
  return [a.status === 'submitted' ? 'Submitted' : 'Draft', a.status === 'submitted' ? 'accent' : 'attn'];
}

export default function SignIn() {
  const s = useStore();
  const act = useAct();
  const [q, setQ] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const list = useMemo(() => {
    const all = Object.values(s.students).sort((a, b) => b.year - a.year || a.name.localeCompare(b.name));
    const t = q.trim().toLowerCase();
    return t ? all.filter((x) => x.name.toLowerCase().includes(t) || x.id.toLowerCase().includes(t)) : all;
  }, [s.students, q]);
  const status = phaseStatus(s);

  return (
    <div className="scene">
      <div className="aura" aria-hidden="true"><span className="b b1" /><span className="b b2" /><span className="b b3" /></div>
      <div className="auth-stage">
        <div className="auth-intro">
          <span className="brand-mark lg"><Icon name="building" /></span>
          <h1 className="welcome-word">{s.hostel.name}</h1>
          <p className="welcome-sub">Room allotment {s.hostel.session} · {status.label}</p>
        </div>

        <div className="glass">
          <h2>Sign in</h2>
          <p className="lead">Choose who you are. In this demo anyone can sign in as anyone; the real app uses the college login.</p>

          <a className="gs-entry" href="#/gs">
            <span className="avatar">GS</span>
            <span className="t"><b>General Secretary</b><span>Run each round, review cases, publish</span></span>
            <Icon name="chevR" className="go" />
          </a>

          <div className="divider"><span>or as a student</span></div>

          <label className="searchbox">
            <Icon name="search" />
            <input className="input" type="search" placeholder="Search name or roll number" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search students" />
          </label>
          <ul className="student-pick">
            {list.map((st) => {
              const [label, tone] = statusOf(s, st.id);
              return (
                <li key={st.id}>
                  <a href={`#/s/${st.id}`}>
                    <span className="avatar sm">{initials(st.name)}</span>
                    <span className="t"><b>{st.name}</b><span>{st.id} · {yearLabel(st.year)}</span></span>
                    <Chip tone={tone}>{label}</Chip>
                  </a>
                </li>
              );
            })}
            {!list.length && <li className="muted small none">No one matches.</li>}
          </ul>

          <div className="glass-foot">
            {confirmReset ? (
              <span className="row gap-s wrap">
                <span className="small">Restore the sample data and clear every run?</span>
                <button type="button" className="btn sm danger" onClick={() => { act(resetDemo, 'Demo data reset'); setConfirmReset(false); }}>Reset</button>
                <button type="button" className="btn sm ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
              </span>
            ) : <button type="button" className="link small" onClick={() => setConfirmReset(true)}>Reset demo data</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
