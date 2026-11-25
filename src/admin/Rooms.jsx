import { useMemo, useState } from 'react';
import { useStore, gs, appOf, wingPlace } from '../lib/store.js';
import { Button, Drawer, useAct, Chip } from '../components/ui.jsx';
import BuildingMap, { MapLegend } from '../components/BuildingMap.jsx';
import { PageHead } from '../components/Shell.jsx';
import { howShort, howTone } from './Allotment.jsx';

export default function Rooms() {
  const s = useStore();
  const [open, setOpen] = useState(null);
  const editable = s.phase === 'setup' || s.phase === 'round1_open';
  const allotted = Object.keys(s.holder).length > 0;

  const picks = useMemo(() => {
    const m = {};
    Object.values(s.apps).forEach((a) => { if (a.status === 'submitted') (a.choices[0] || []).forEach((r) => { m[r] = (m[r] || 0) + 1; }); });
    return m;
  }, [s.apps]);

  const cellInfo = (r) => {
    const room = s.rooms[r];
    if (room.status === 'blocked') return { state: 'blocked', label: 'Blocked', title: room.reason };
    if (room.status === 'pre') return { state: 'pre', label: s.students[room.preSid].name.split(' ')[0], sub: 'Pre-assigned', title: room.reason };
    const h = s.holder[r];
    if (h) return { state: 'held', label: s.students[h.sid].name.split(' ')[0], sub: howShort(h), tone: h.flag ? 'attn' : howTone(h) };
    return { state: 'free', sub: !allotted && picks[r] ? `${picks[r]} first pick${picks[r] > 1 ? 's' : ''}` : '' };
  };
  const counts = Object.values(s.rooms).reduce((m, r) => { m[r.status] = (m[r.status] || 0) + 1; return m; }, {});
  const wingNote = (w) => {
    const rooms = Array.from({ length: 8 }, (_, i) => `${w.id}${i + 1}`);
    if (allotted) return `${rooms.filter((r) => s.holder[r] || s.rooms[r].status === 'pre').length}/8 filled`;
    return `${rooms.filter((r) => s.rooms[r].status === 'available').length}/8 open`;
  };

  return (
    <>
      <PageHead title="Building" sub={`${s.hostel.name} · 2 floors · 4 wings · ${counts.available || 0} open, ${counts.blocked || 0} blocked, ${counts.pre || 0} pre-assigned`} />
      <div className="content">
        <p className="muted measure">
          {editable ? 'Select a room to block it or pre-assign it. Students never see blocked or pre-assigned rooms as choices.' : 'Select a room to see who has it and how it was decided.'}
          {!allotted && ' The number under an open room is how many submitted applications picked it 1st.'}
        </p>
        <BuildingMap wings={s.wings} mode="select" cellInfo={cellInfo} onRoom={setOpen} focus={open} wingNote={wingNote} />
        <MapLegend items={allotted
          ? [['free', 'Empty'], ['held', 'Allotted'], ['attn', 'Needs review'], ['pre', 'Pre-assigned'], ['blocked', 'Blocked']]
          : [['free', 'Open'], ['pre', 'Pre-assigned'], ['blocked', 'Blocked']]} />
      </div>
      <RoomDrawer room={open} onClose={() => setOpen(null)} editable={editable} />
    </>
  );
}

function RoomDrawer({ room, onClose, editable }) {
  const s = useStore();
  const act = useAct();
  const [status, setStatus] = useState('available');
  const [reason, setReason] = useState('');
  const [pre, setPre] = useState('');
  const [last, setLast] = useState(null);
  if (room && last !== room) {
    const r0 = s.rooms[room];
    setLast(room); setStatus(r0.status); setReason(r0.reason || ''); setPre(r0.preSid || '');
  }
  if (!room) return null;
  const r = s.rooms[room];
  const h = s.holder[room];
  const wing = s.wings.find((w) => w.id === room[0]);
  const who = h ? s.students[h.sid] : r.status === 'pre' ? s.students[r.preSid] : null;
  const candidates = Object.values(s.students).filter((x) => { const a = appOf(s, x.id); return !a || a.members.length === 1; })
    .sort((a, b) => a.name.localeCompare(b.name));
  const save = () => { if (act(() => gs.setRoom(room, status, reason, pre || null), `${room} updated`)) onClose(); };

  return (
    <Drawer open onClose={onClose} title={`Room ${room}`}
      footer={editable ? <><Button kind="primary" onClick={save}>Save</Button><Button kind="ghost" onClick={onClose}>Cancel</Button></> : null}>
      <dl className="kv">
        <dt>Wing</dt><dd>{wing.name} · {wingPlace(wing)}</dd>
        <dt>Status</dt><dd>{r.status === 'available' ? (h ? 'Allotted' : 'Open') : r.status === 'blocked' ? 'Blocked' : 'Pre-assigned'}</dd>
        {r.reason && <><dt>Reason</dt><dd>{r.reason}</dd></>}
        {who && <><dt>Student</dt><dd><a className="link" href={`#/gs/students/${who.id}`}>{who.name}</a> <span className="mono muted">{who.id}</span></dd></>}
        {h && <><dt>How</dt><dd><Chip tone={h.flag ? 'attn' : howTone(h)}>{howShort(h)}</Chip>{h.label && h.label !== who.name ? ` · ${h.label}` : ''}</dd></>}
      </dl>
      {editable && (
        <fieldset className="field">
          <legend>Change status</legend>
          <div className="radio-row">
            {[['available', 'Open'], ['blocked', 'Blocked'], ['pre', 'Pre-assigned']].map(([v, l]) => (
              <label key={v} className={`radio-pill ${status === v ? 'on' : ''}`}>
                <input type="radio" name="room-status" value={v} checked={status === v} onChange={() => setStatus(v)} />{l}
              </label>
            ))}
          </div>
          {status === 'pre' && (
            <label className="field">
              <span>Student</span>
              <select className="input" value={pre} onChange={(e) => setPre(e.target.value)}>
                <option value="">Choose a student</option>
                {candidates.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.id}</option>)}
              </select>
              <small className="muted">Students in a group must leave it first. A solo application is withdrawn.</small>
            </label>
          )}
          {status !== 'available' && (
            <label className="field">
              <span>Reason (kept in the log)</span>
              <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder={status === 'blocked' ? 'e.g. Ceiling repair until January' : 'e.g. Medical need: ground-floor access'} />
            </label>
          )}
          {status !== 'available' && <p className="muted small">Any choice that includes this room is cleared, and that application goes back to draft.</p>}
        </fieldset>
      )}
    </Drawer>
  );
}
