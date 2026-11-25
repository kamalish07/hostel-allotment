import { useMemo, useState } from 'react';
import { useStore, appLabel, appClass, memberIds, readiness } from '../lib/store.js';
import { blockLabel, classLabel } from '../lib/engine.js';
import { Chip, Drawer, fmtTime } from '../components/ui.jsx';
import { PageHead } from '../components/Shell.jsx';
import { OutcomeChip } from './Allotment.jsx';

const FALLBACK = { auto: 'Keep together', round2: 'Choose again in Round 2', split: 'Split' };

function statusChip(a) {
  if (a.status === 'discarded') return <Chip tone="muted">Discarded</Chip>;
  if (a.splitParent) return <Chip tone="muted">Split</Chip>;
  if (a.late) return <Chip tone="warn">Late form</Chip>;
  if (a.status === 'submitted') return <Chip tone="accent">Submitted</Chip>;
  return <Chip tone="warn">Draft</Chip>;
}

export default function Applications() {
  const s = useStore();
  const [f, setF] = useState('active');
  const [open, setOpen] = useState(null);
  const all = useMemo(() => Object.values(s.apps).map((a) => ({ a, ci: appClass(s, a) }))
    .sort((x, y) => x.ci.cls - y.ci.cls || x.a.id.localeCompare(y.a.id)), [s]);
  const shown = all.filter(({ a }) => (f === 'active' ? a.status !== 'discarded' && !a.splitParent
    : f === 'round2' ? !!a.r2 : f === 'discarded' ? a.status === 'discarded' || a.splitParent : true));
  const locked = Object.keys(s.lotteries).length > 0;

  return (
    <>
      <PageHead title="Applications" sub="Sorted in priority order: wing groups, then groups, then individuals; 4th years before 3rd years." />
      <div className="content">
        <div className="toolbar">
          <div className="seg" role="group" aria-label="Filter applications">
            {[['active', 'Active'], ['round2', 'In Round 2'], ['discarded', 'Discarded or split'], ['all', 'All']].map(([k, l]) => (
              <button type="button" key={k} aria-pressed={f === k} onClick={() => setF(k)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>ID</th><th>Application</th><th>Class</th><th className="num">Size</th><th>1st</th><th>2nd</th><th>3rd</th><th>If all fail</th><th>Status</th>{locked && <th className="num">Lottery</th>}</tr>
            </thead>
            <tbody>
              {shown.map(({ a, ci }) => {
                const pending = a.members.filter((m) => m.status === 'pending').length;
                return (
                  <tr key={a.id} className="clickable-row" onClick={() => setOpen(a.id)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setOpen(a.id); }}>
                    <td className="mono muted">{a.id}</td>
                    <td className="strong">{appLabel(s, a)}</td>
                    <td>{classLabel(ci)}{ci.mixed && <span className="muted small"> · mixed</span>}</td>
                    <td className="num">{memberIds(a).length}{pending ? <span className="warn-text small"> ({pending} pending)</span> : null}</td>
                    {[0, 1, 2].map((i) => <td key={i} className="mono">{blockLabel(a.choices[i])}</td>)}
                    <td className="small">{memberIds(a).length > 1 ? FALLBACK[a.fallback] : <span className="muted">Round 2</span>}</td>
                    <td>{statusChip(a)}</td>
                    {locked && <td className="num mono">{s.lotteries[a.id] ? `#${s.lotteries[a.id]}` : '—'}</td>}
                  </tr>
                );
              })}
              {!shown.length && <tr><td colSpan={10} className="muted">Nothing here.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <AppDrawer id={open} onClose={() => setOpen(null)} />
    </>
  );
}

function AppDrawer({ id, onClose }) {
  const s = useStore();
  if (!id) return null;
  const a = s.apps[id];
  const ci = appClass(s, a);
  const check = a.status === 'draft' ? readiness(s, a) : null;
  const events = s.events.filter((e) => e.appId === id || (a.splitParent && s.apps[e.appId]?.splitFrom === id));
  const rooms = Object.entries(s.holder).filter(([, h]) => h.appId === id);

  return (
    <Drawer open onClose={onClose} title={appLabel(s, a)} wide>
      <dl className="kv">
        <dt>ID</dt><dd className="mono">{a.id}</dd>
        <dt>Class</dt><dd>{classLabel(ci)}{ci.mixed ? ' (mixed years: ranks as its most junior member)' : ''}</dd>
        <dt>Status</dt><dd>{statusChip(a)} {a.submittedAt && <span className="muted small">· {fmtTime(a.submittedAt)}</span>}</dd>
        {s.lotteries[id] && <><dt>Lottery</dt><dd className="mono">#{s.lotteries[id]}</dd></>}
        {memberIds(a).length > 1 && <><dt>If all fail</dt><dd>{FALLBACK[a.fallback]}</dd></>}
        {a.splitFrom && <><dt>Split from</dt><dd className="mono">{a.splitFrom}</dd></>}
      </dl>

      <h3 className="h-sub">Members</h3>
      <table className="tbl compact">
        <thead><tr><th>Name</th><th>Roll</th><th>Year</th></tr></thead>
        <tbody>
          {a.members.map((m) => (
            <tr key={m.sid}>
              <td>{s.students[m.sid].name}{m.sid === a.repId && a.members.length > 1 ? <span className="muted"> · rep</span> : ''}</td>
              <td className="mono">{m.sid}</td>
              <td>{s.students[m.sid].year === 4 ? '4th' : '3rd'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="h-sub">Choices</h3>
      <ChoiceTable s={s} choices={a.choices} mappings={a.mappings} />
      {a.r2 && <>
        <h3 className="h-sub">Round 2 choices <Chip tone={a.r2.status === 'submitted' ? 'accent' : 'warn'}>{a.r2.status === 'submitted' ? 'Submitted' : 'Not submitted'}</Chip></h3>
        <ChoiceTable s={s} choices={a.r2.choices} mappings={a.r2.mappings} />
      </>}

      {check && !check.ok && <>
        <h3 className="h-sub">Why it isn’t submitted</h3>
        <ul className="issues">{check.blocking.map((b) => <li key={b}>{b}</li>)}</ul>
      </>}

      {rooms.length > 0 && <>
        <h3 className="h-sub">Result</h3>
        <p><span className="mono strong">{rooms.map(([r]) => r).join(', ')}</span></p>
      </>}

      {events.length > 0 && <>
        <h3 className="h-sub">Decision log</h3>
        <ol className="log">
          {events.map((e, i) => (
            <li key={i}><span className="log-round mono">{e.round === 'final' ? 'Final' : e.round === 'override' ? 'GS' : `R${e.round}`}</span><OutcomeChip e={e} /><span>{e.detail}</span></li>
          ))}
        </ol>
      </>}
    </Drawer>
  );
}

export function ChoiceTable({ s, choices, mappings }) {
  return (
    <table className="tbl compact">
      <thead><tr><th>Choice</th><th>Rooms</th><th>Who goes where</th></tr></thead>
      <tbody>
        {[0, 1, 2].map((i) => (
          <tr key={i}>
            <td>{['1st', '2nd', '3rd'][i]}</td>
            <td className="mono">{blockLabel(choices[i])}</td>
            <td className="small">{choices[i] && choices[i].length > 1
              ? choices[i].map((r, k) => `${r} ${mappings[i] && mappings[i][k] ? s.students[mappings[i][k]].name.split(' ')[0] : '?'}`).join(' · ')
              : <span className="muted">—</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
