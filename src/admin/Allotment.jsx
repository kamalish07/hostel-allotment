import { useMemo, useState } from 'react';
import { useStore, gs, csvAllotment, appLabel } from '../lib/store.js';
import { ORD } from '../lib/engine.js';
import { Button, Chip, Drawer, Empty, Stat, useAct, fmtTime } from '../components/ui.jsx';
import { PageHead } from '../components/Shell.jsx';
import { go, isEmbedded } from '../App.jsx';

export function howShort(h) {
  if (!h) return '';
  if (h.how === 'pre') return 'Pre-assigned';
  if (h.how === 'choice') return `${ORD[h.rank - 1]} choice${h.round === 2 ? ' · R2' : ''}`;
  if (h.how === 'fallback') return 'Kept together';
  if (h.how === 'split') return 'Split';
  if (h.how === 'random') return 'Random';
  if (h.how === 'override') return 'Override';
  return h.how;
}
export function howTone(h) {
  if (h.how === 'choice') return 'accent';
  if (h.how === 'override') return 'accent';
  if (h.how === 'pre') return 'muted';
  return 'attn';
}
const OUT = {
  placed: ['Placed', 'ok'], lost: ['Taken', 'bad'], round2: ['To Round 2', 'warn'], fallback: ['Kept together', 'warn'],
  split: ['Split', 'warn'], waitlist: ['Waitlist', 'bad'], final: ['To final', 'warn'], random: ['Random', 'warn'], override: ['Override', 'accent'],
};
export function OutcomeChip({ e }) {
  const [l, t] = OUT[e.outcome] || [e.outcome, 'muted'];
  return <Chip tone={t}>{l}</Chip>;
}

const SUB = {
  round1_review: 'Round 1 draft. Students cannot see this yet.',
  round2_open: 'Round 1 is approved and final. Round 2 is open for students left over.',
  round2_review: 'Final draft after Round 2. Students cannot see this yet.',
  published: 'Published. Every student can see their room and the reason.',
};

export default function Allotment() {
  const s = useStore();
  const act = useAct();
  const [tab, setTab] = useState('flags');
  const [ovr, setOvr] = useState(null); // { sid?, sids? }
  const [q, setQ] = useState('');

  const holders = Object.entries(s.holder);
  const flagged = useMemo(() => {
    const m = new Map();
    holders.filter(([, h]) => h.flag).forEach(([r, h]) => {
      const k = h.appId || h.sid;
      if (!m.has(k)) m.set(k, { key: k, label: h.label, rooms: [], sids: [] });
      m.get(k).rooms.push(r); m.get(k).sids.push(h.sid);
    });
    return [...m.values()];
  }, [s.holder]);

  if (s.phase === 'setup' || s.phase === 'round1_open') {
    return (
      <>
        <PageHead title="Allotment" />
        <div className="content">
          <Empty title="No allotment yet">
            <p className="muted measure">The allotment runs when you close Round 1. You will see a draft here first, with every flagged case listed, before any student is told anything.</p>
            <Button kind="secondary" onClick={() => go('/gs/overview')}>Go to Overview</Button>
          </Empty>
        </div>
      </>
    );
  }

  const count = (pred) => holders.filter(([, h]) => pred(h)).length;
  const pre = Object.values(s.rooms).filter((r) => r.status === 'pre').length;
  // CSV export only exists in the local build; the hosted page can't download files, so it's compiled out there.
  const download = import.meta.env.VITE_HOSTED ? null : () => {
    const blob = new Blob([csvAllotment(s)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${s.hostel.name.replace(/\s+/g, '-')}-allotment.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const lastEvent = (key) => [...s.events].reverse().find((e) => e.appId === key || e.sid === key);
  const t = q.trim().toLowerCase();
  const log = s.events.filter((e) => !t || e.label.toLowerCase().includes(t) || e.detail.toLowerCase().includes(t));

  return (
    <>
      <PageHead title="Allotment" sub={SUB[s.phase]}
        actions={download && !isEmbedded && (s.phase === 'round2_review' || s.phase === 'published') && <Button kind="secondary" onClick={download}>Export CSV</Button>} />
      <div className="content">
        <div className="stats">
          <Stat value={count((h) => h.how === 'choice' && h.rank === 1 && h.round === 1)} label="1st choice" tone="ok" />
          <Stat value={count((h) => h.how === 'choice' && h.rank === 2 && h.round === 1)} label="2nd choice" />
          <Stat value={count((h) => h.how === 'choice' && h.rank === 3 && h.round === 1)} label="3rd choice" />
          <Stat value={count((h) => h.how === 'fallback' || h.how === 'split')} label="kept together or split" />
          <Stat value={count((h) => h.round === 2 && h.how === 'choice')} label="Round 2 choice" />
          <Stat value={count((h) => h.how === 'random')} label="random" />
          <Stat value={pre} label="pre-assigned" />
          <Stat value={s.waitlist.length} label="waitlist" tone={s.waitlist.length ? 'bad' : ''} />
        </div>

        <div className="tabs" role="tablist">
          {[['flags', `Flagged (${flagged.length})`], ['rooms', 'All rooms'], ['log', `Decision log (${s.events.length})`],
            ['waitlist', `Waitlist (${s.waitlist.length})`], ['overrides', `Overrides (${s.overrides.length})`]].map(([k, l]) => (
            <button type="button" role="tab" key={k} aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {tab === 'flags' && (flagged.length ? (
          <ul className="flag-list">
            {flagged.map((f) => {
              const e = lastEvent(f.key);
              return (
                <li key={f.key}>
                  <div className="flag-main">
                    <div className="row gap-s wrap"><span className="strong">{f.label}</span><span className="mono">{f.rooms.join(', ')}</span></div>
                    <p className="muted small">{e ? e.detail : ''}</p>
                  </div>
                  <div className="row gap-s">
                    <Button size="sm" onClick={() => setOvr({ sids: f.sids })}>Move or swap</Button>
                    <Button size="sm" kind="ghost" onClick={() => act(() => f.rooms.forEach((r) => gs.clearFlag(r)), 'Marked as reviewed')}>Mark reviewed</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : <Empty title="Nothing flagged">Every placement followed a stated choice.</Empty>)}

        {tab === 'rooms' && (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Room</th><th>Student</th><th>Roll</th><th>Year</th><th>Application</th><th>How</th><th /></tr></thead>
              <tbody>
                {s.wings.flatMap((w) => Array.from({ length: 8 }, (_, i) => `${w.id}${i + 1}`)).map((r) => {
                  const room = s.rooms[r];
                  const h = s.holder[r];
                  if (room.status === 'pre') {
                    const st = s.students[room.preSid];
                    return <tr key={r}><td className="mono strong">{r}</td><td>{st.name}</td><td className="mono">{st.id}</td><td>{st.year === 4 ? '4th' : '3rd'}</td><td className="muted">—</td><td><Chip tone="muted">Pre-assigned</Chip></td><td /></tr>;
                  }
                  if (!h) return <tr key={r} className="dim"><td className="mono">{r}</td><td colSpan={5} className="muted">{room.status === 'blocked' ? `Blocked · ${room.reason}` : 'Empty'}</td><td /></tr>;
                  const st = s.students[h.sid];
                  return (
                    <tr key={r}>
                      <td className="mono strong">{r}</td><td>{st.name}</td><td className="mono">{st.id}</td><td>{st.year === 4 ? '4th' : '3rd'}</td>
                      <td>{h.label !== st.name ? h.label : <span className="muted">Alone</span>}</td>
                      <td><Chip tone={h.flag ? 'warn' : howTone(h)}>{howShort(h)}</Chip></td>
                      <td className="right">{s.phase !== 'round2_open' && <Button size="sm" kind="ghost" onClick={() => setOvr({ sid: h.sid })}>Move</Button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'log' && (
          <>
            <input className="input" type="search" placeholder="Filter by name, room or rule" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter decision log" />
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Round</th><th>Application</th><th>Class</th><th>Choice</th><th>Result</th><th>Detail</th></tr></thead>
                <tbody>
                  {log.map((e, i) => (
                    <tr key={i}>
                      <td className="mono">{e.round === 'final' ? 'Final' : e.round === 'override' ? 'GS' : `R${e.round}`}</td>
                      <td className="strong nowrap">{e.label}</td>
                      <td className="small nowrap">{e.cls || ''}</td>
                      <td>{e.rank >= 1 && e.rank <= 3 ? ORD[e.rank - 1] : '—'}</td>
                      <td><OutcomeChip e={e} /></td>
                      <td className="small">{e.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'waitlist' && (s.waitlist.length ? (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th className="num">#</th><th>Name</th><th>Roll</th><th>Year</th><th>Reason</th><th /></tr></thead>
              <tbody>
                {s.waitlist.map((w, i) => {
                  const st = s.students[w.sid];
                  return (
                    <tr key={w.sid}>
                      <td className="num mono">{i + 1}</td><td>{st.name}</td><td className="mono">{st.id}</td><td>{st.year === 4 ? '4th' : '3rd'}</td>
                      <td className="small">{w.reason}</td>
                      <td className="right"><Button size="sm" kind="ghost" onClick={() => setOvr({ sid: w.sid })}>Assign room</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty title="Waitlist is empty">{s.phase === 'round1_review' || s.phase === 'round2_open' ? 'The waitlist is built after Round 2.' : 'Everyone has a room.'}</Empty>)}

        {tab === 'overrides' && (s.overrides.length ? (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>When</th><th>Student</th><th>From</th><th>To</th><th>Reason</th></tr></thead>
              <tbody>
                {s.overrides.map((o, i) => (
                  <tr key={i}>
                    <td className="small nowrap">{fmtTime(o.at)}</td>
                    <td>{s.students[o.sid].name}{o.swapWith ? <span className="muted"> ↔ {s.students[o.swapWith].name}</span> : null}</td>
                    <td className="mono">{o.from || 'Waitlist'}</td><td className="mono">{o.to}</td><td className="small">{o.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty title="No overrides">Every change you make here needs a written reason and is listed in this tab.</Empty>)}
      </div>
      <OverrideDrawer target={ovr} onClose={() => setOvr(null)} />
    </>
  );
}

export function OverrideDrawer({ target, onClose }) {
  const s = useStore();
  const act = useAct();
  const [sid, setSid] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [key, setKey] = useState(null);
  const k = target ? JSON.stringify(target) : null;
  if (k !== key) {
    setKey(k);
    setSid(target?.sid || target?.sids?.[0] || '');
    setTo(''); setReason('');
  }
  if (!target) return null;
  const allowed = s.phase === 'round1_review' || s.phase === 'round2_review';
  const from = Object.keys(s.holder).find((r) => s.holder[r].sid === sid);
  const rooms = s.wings.flatMap((w) => Array.from({ length: 8 }, (_, i) => `${w.id}${i + 1}`)).filter((r) => s.rooms[r].status === 'available' && r !== from);
  const free = rooms.filter((r) => !s.holder[r]);
  const taken = rooms.filter((r) => s.holder[r]);

  const save = () => { if (act(() => gs.override(sid, to, reason), 'Change saved and logged')) onClose(); };

  return (
    <Drawer open onClose={onClose} title="Move or swap a student"
      footer={allowed ? <><Button kind="primary" onClick={save} disabled={!sid || !to}>Save change</Button><Button kind="ghost" onClick={onClose}>Cancel</Button></> : null}>
      {!allowed && <p className="notice warn">Changes can only be made while a draft is under review (Round 1 review or final review).</p>}
      {target.sids && target.sids.length > 1 && (
        <label className="field">
          <span>Student</span>
          <select className="input" value={sid} onChange={(e) => setSid(e.target.value)}>
            {target.sids.map((x) => <option key={x} value={x}>{s.students[x].name}</option>)}
          </select>
        </label>
      )}
      <dl className="kv">
        <dt>Student</dt><dd>{s.students[sid]?.name} <span className="mono muted">{sid}</span></dd>
        <dt>Current room</dt><dd className="mono">{from || 'None (waitlist)'}</dd>
        {from && s.holder[from].label !== s.students[sid]?.name && <><dt>Application</dt><dd>{s.holder[from].label}</dd></>}
      </dl>
      <label className="field">
        <span>New room</span>
        <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">Choose a room</option>
          <optgroup label={`Free rooms (${free.length})`}>
            {free.map((r) => <option key={r} value={r}>{r}</option>)}
          </optgroup>
          {from && <optgroup label="Swap with">
            {taken.map((r) => <option key={r} value={r}>{r} · swap with {s.students[s.holder[r].sid].name}</option>)}
          </optgroup>}
        </select>
      </label>
      <label className="field">
        <span>Reason (shown in the log and to the student)</span>
        <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Group asked to stay together after the split; rep agreed to B1–B4" />
      </label>
      {to && s.holder[to] && <p className="muted small">{s.students[s.holder[to].sid].name} moves to {from}. Both students see this change and the reason.</p>}
    </Drawer>
  );
}

export { appLabel };
