import { useMemo, useState } from 'react';
import {
  useStore, student, appOf, isPreassigned, appClass, memberIds, readiness, freeHolderView, demandMap,
} from '../lib/store.js';
import { classLabel, typeForSize, yearLabel, classOf } from '../lib/engine.js';
import { Button, Chip, ConfirmButton, useAct, fmtDeadline } from '../components/ui.jsx';
import ChoicePlanner, { Checklist, ini, short } from '../components/ChoicePlanner.jsx';
import Icon from '../components/Icon.jsx';
import { PageHead } from '../components/Shell.jsx';
import { go } from '../App.jsx';

const FALLBACKS = [
  ['auto', 'Keep us together', 'Next free rooms side by side, starting in the wing of our 1st choice.'],
  ['round2', 'Let us choose again', 'We stay a group and pick again in Round 2 from rooms still free.'],
  ['split', 'Split us', 'Each of us picks alone in Round 2 with our own year’s priority.'],
];

// ---------------------------------------------------------------- Round 1 application
export function Apply({ sid }) {
  const s = useStore();
  const act = useAct();
  const app = appOf(s, sid);

  if (!app) {
    return (
      <>
        <PageHead title="Application" />
        <div className="content">
          {s.phase === 'round1_open' && !isPreassigned(s, sid) ? (
            <div className="start-options wide">
              <button type="button" className="option" onClick={() => act(() => student.createApplication(sid))}>
                <span className="option-t">Apply alone</span><span className="option-d">Pick three single rooms on the building plan, in order.</span>
              </button>
              <button type="button" className="option" onClick={() => { if (act(() => student.createApplication(sid))) go(`/s/${sid}/apply?invite`); }}>
                <span className="option-t">Apply with friends</span><span className="option-d">Add 1–7 friends, pick blocks of rooms side by side, and decide who sleeps where.</span>
              </button>
            </div>
          ) : <p className="muted">You don’t have an application.</p>}
        </div>
      </>
    );
  }

  const isRep = app.repId === sid;
  const editable = isRep && s.phase === 'round1_open';
  const size = memberIds(app).length;
  const ci = appClass(s, app);
  const check = readiness(s, app);
  const submitted = app.status === 'submitted';
  const filled = app.choices.filter((c) => c && c.length).length;

  const side = (
    <>
      {size > 1 && (
        <section className="side-card">
          <div className="side-card-head"><h3>If all three are taken</h3></div>
          <div className="fallbacks" role="radiogroup" aria-label="If all three choices are taken">
            {FALLBACKS.map(([v, t, d]) => (
              <label key={v} className={`fb ${app.fallback === v ? 'on' : ''} ${editable ? '' : 'ro'}`}>
                <input type="radio" name="fallback" value={v} checked={app.fallback === v} disabled={!editable}
                  onChange={() => act(() => student.setFallback(app.id, v))} />
                <span className="fb-dot" />
                <span className="fb-text"><b>{t}</b><span>{d}</span></span>
              </label>
            ))}
          </div>
        </section>
      )}
      {s.phase === 'round1_open' && (
        <section className="side-card submit-card">
          {isRep ? <>
            <Checklist items={[
              [true, size > 1 ? `${size} people · ranks as ${classLabel(ci)}` : `Applying alone · ${classLabel(ci)}`],
              [filled >= 3 || check.ok, `${filled} of 3 choices placed`],
              [filled > 0 && check.perChoice.every((p) => !p), 'Every choice is valid'],
            ]} />
            <Button kind="primary" className="block" disabled={!check.ok || submitted} onClick={() => act(() => student.submit(app.id), 'Application submitted')}>
              {submitted ? 'Submitted' : 'Submit application'}
            </Button>
            <p className="muted small center">{submitted ? `You can still change it until ${fmtDeadline(s.settings.r1Deadline)}; changes need submitting again.` : check.ok ? 'Ready to submit.' : check.blocking[0]}</p>
            <ConfirmButton label="Withdraw application" kind="ghost" danger confirmLabel="Withdraw" onConfirm={() => act(() => { student.withdraw(app.id); go(`/s/${sid}`); }, 'Application withdrawn')}>
              {size > 1 ? 'The whole group loses this application.' : 'Your application is deleted.'}
            </ConfirmButton>
          </> : <>
            <p className="small">Only <b>{s.students[app.repId].name}</b> (the rep) can change or submit this form. {submitted ? 'It has been submitted.' : 'It hasn’t been submitted yet.'}</p>
            <ConfirmButton label="Leave group" kind="light" danger confirmLabel="Leave group" onConfirm={() => act(() => { student.leave(app.id, sid); go(`/s/${sid}`); }, 'You left the group')}>
              The group’s choices are cleared and the rep must submit again.
            </ConfirmButton>
          </>}
        </section>
      )}
    </>
  );

  return (
    <>
      <PageHead title={size > 1 ? (size >= 5 ? 'Wing group application' : 'Group application') : 'Your application'}
        sub={s.phase === 'round1_open' ? `Round 1 closes ${fmtDeadline(s.settings.r1Deadline)}` : 'Round 1 is closed; this form can no longer be changed.'}
        actions={<Chip tone={submitted ? 'accent' : 'attn'}>{submitted ? 'Submitted' : 'Draft'}</Chip>} />
      <div className="content">
        {app.notice && (
          <div className="notice attn row between gap-s wrap" role="status">
            <span>{app.notice}</span>
            <Button size="xs" kind="ghost" onClick={() => act(() => student.dismissNotice(app.id))}>Dismiss</Button>
          </div>
        )}
        <MembersBar s={s} app={app} sid={sid} editable={editable} />
        <ChoicePlanner s={s} app={app} round={1} editable={editable} demand={editable ? demandMap(s, sid) : null} side={side}
          readOnlyNote={isRep ? 'Round 1 is closed.' : `Only ${s.students[app.repId].name.split(' ')[0]} (the rep) can change the choices.`} />
      </div>
    </>
  );
}

// ---------------------------------------------------------------- members
function MembersBar({ s, app, sid, editable }) {
  const act = useAct();
  const [q, setQ] = useState(window.location.hash.includes('invite') ? '' : null);
  const members = memberIds(app);
  const size = members.length;
  const ci = appClass(s, app);
  const me = s.students[sid];
  const candidates = useMemo(() => {
    if (q === null) return [];
    const t = q.trim().toLowerCase();
    return Object.values(s.students).filter((x) => x.id !== sid && !appOf(s, x.id) && !isPreassigned(s, x.id) &&
      !app.members.some((m) => m.sid === x.id) && (!t || x.name.toLowerCase().includes(t) || x.id.toLowerCase().includes(t))).slice(0, 6);
  }, [q, s, app, sid]);
  const nextType = typeForSize(size + 1);

  return (
    <section className="members-bar">
      <div className="mb-main">
        <div className="mb-label">
          <b>{size > 1 ? `${size >= 5 ? 'Wing group' : 'Group'} · ${size} of 8` : 'Applying alone'}</b>
          <span>Ranks as {classLabel(ci)}{ci.mixed ? ' (a mixed group counts as its most junior member)' : ''}</span>
        </div>
        <div className="member-chips">
          {members.map((m) => (
            <span key={m} className={`mchip ${m === app.repId ? 'rep' : ''}`}>
              <span className="avatar xs">{ini(s, m)}</span>
              <span>{m === sid ? 'You' : short(s, m)}</span>
              <span className="mchip-yr">{`’${String(classOf(s.students[m].year)).slice(2)}`}</span>
              {m === app.repId && <span className="mchip-tag">Rep</span>}
              {editable && m !== sid && (
                <button type="button" className="mchip-x" aria-label={`Remove ${s.students[m].name}`}
                  onClick={() => act(() => student.removeMember(app.id, m), `${short(s, m)} removed`)}><Icon name="x" /></button>
              )}
            </span>
          ))}
          {editable && size < 8 && q === null && (
            <button type="button" className="mchip add" onClick={() => setQ('')}><Icon name="users" />Add people</button>
          )}
        </div>
      </div>
      {ci.year === 3 && me.year === 4 && size > 1 && <p className="mb-note">This group counts as the Class of 2029 because it includes incoming students. Staying in it means giving up final-year priority.</p>}
      {q !== null && editable && (
        <div className="add-pop">
          <label className="searchbox">
            <Icon name="search" />
            <input className="input" type="search" autoFocus placeholder="Search by name or roll number" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search students to add" />
          </label>
          <ul className="pick-list">
            {candidates.map((x) => (
              <li key={x.id}>
                <span className="avatar xs">{x.name.split(' ').map((p) => p[0]).join('')}</span>
                <span className="t"><b>{x.name}</b><span>{x.id} · {yearLabel(x.year)}</span></span>
                <Button size="xs" kind="light" onClick={() => act(() => student.addMember(app.id, x.id), `${x.name.split(' ')[0]} added`)}>Add</Button>
              </li>
            ))}
            {!candidates.length && <li className="muted small">No one matches. Students already in an application can’t be added.</li>}
          </ul>
          <div className="row between wrap gap-s">
            <span className="muted small">Adding someone{nextType === 'wing' && size + 1 === 5 ? ' makes this a wing group (placed before all groups), and' : ''} clears your choices, since the block size changes.</span>
            <Button size="sm" kind="ghost" onClick={() => setQ(null)}>Done</Button>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Round 2 / late form
export function Round2({ sid }) {
  const s = useStore();
  const act = useAct();
  const app = appOf(s, sid);
  if (!app || !app.r2 || s.phase !== 'round2_open') {
    return <><PageHead title="Round 2" /><div className="content"><p className="muted">Round 2 isn’t open for you.</p></div></>;
  }
  const isRep = app.repId === sid;
  const check = readiness(s, app, 2);
  const done = app.r2.status === 'submitted';
  const filled = app.r2.choices.filter((c) => c && c.length).length;

  const side = (
    <section className="side-card submit-card">
      {isRep ? <>
        <Checklist items={[[filled >= 1, `${filled} of 3 choices placed (at least 1)`], [filled > 0 && check.perChoice.every((p) => !p), 'Every choice is free']]} />
        <Button kind="primary" className="block" disabled={!check.ok || done} onClick={() => act(() => student.submitRound2(app.id), 'Round 2 choices submitted')}>
          {done ? 'Submitted' : 'Submit choices'}
        </Button>
        <p className="muted small center">{done ? 'Submitted. Any change needs submitting again.' : check.ok ? 'Ready to submit.' : check.blocking[0]}</p>
      </> : <p className="small">Your rep submits for the group.</p>}
    </section>
  );

  return (
    <>
      <PageHead title={app.late ? 'Late form' : 'Round 2'}
        sub={`${app.late ? 'Late forms are handled after everyone who applied on time. ' : 'Your Round 1 choices were taken. '}Only free rooms can be chosen. Closes ${fmtDeadline(s.settings.r2Deadline)}.`}
        actions={<Chip tone={done ? 'accent' : 'attn'}>{done ? 'Submitted' : 'Not submitted'}</Chip>} />
      <div className="content">
        {app.splitFrom && <p className="notice">Your group chose to split, so you’re choosing alone with your own year’s priority.</p>}
        <ChoicePlanner s={s} app={app} round={2} editable={isRep} taken={freeHolderView(s)} side={side} readOnlyNote="Your rep picks the rooms for the group." />
      </div>
    </>
  );
}
