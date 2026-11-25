import { useState } from 'react';
import { useStore, appOf, eventsFor } from '../lib/store.js';
import { ORD } from '../lib/engine.js';
import { Button } from '../components/ui.jsx';
import { PageHead } from '../components/Shell.jsx';
import ProfileView from '../components/Profile.jsx';
import { ChoiceTable } from './Applications.jsx';
import { OutcomeChip, OverrideDrawer } from './Allotment.jsx';

export default function Candidate({ sid }) {
  const s = useStore();
  const [ovr, setOvr] = useState(null);
  const st = s.students[sid];
  const app = appOf(s, sid);
  const events = eventsFor(s, sid);
  const canMove = s.phase === 'round1_review' || s.phase === 'round2_review';

  return (
    <>
      <PageHead back={{ href: '#/gs/students', label: 'Students' }} title={st.name} sub={`Candidate profile · ${st.id}`}
        actions={<>
          {canMove && <Button onClick={() => setOvr({ sid })}>Move or swap</Button>}
          <a className="btn secondary" href={`#/s/${sid}`}>Open student view</a>
        </>} />
      <div className="content">
        <ProfileView s={s} sid={sid} admin />

        {app && (
          <section>
            <h3 className="h-sec">Choices</h3>
            <ChoiceTable s={s} choices={app.choices} mappings={app.mappings} />
            {app.r2 && <>
              <h3 className="h-sec mt-l">Round 2 choices</h3>
              <ChoiceTable s={s} choices={app.r2.choices} mappings={app.r2.mappings} />
            </>}
          </section>
        )}

        <section>
          <h3 className="h-sec">Decision log</h3>
          {events.length ? (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Round</th><th>Choice</th><th>Result</th><th>Detail</th></tr></thead>
                <tbody>
                  {events.map((e, i) => (
                    <tr key={i}>
                      <td className="mono nowrap">{e.round === 'final' ? 'Final' : e.round === 'override' ? 'GS' : `R${e.round}`}</td>
                      <td>{e.rank >= 1 && e.rank <= 3 ? ORD[e.rank - 1] : '—'}</td>
                      <td><OutcomeChip e={e} /></td>
                      <td className="small">{e.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="muted">Nothing yet. Decisions appear here once Round 1 has run.</p>}
        </section>
      </div>
      <OverrideDrawer target={ovr} onClose={() => setOvr(null)} />
    </>
  );
}
