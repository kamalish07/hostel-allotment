import { useState } from 'react';
import {
  useStore, student, appOf, invitesFor, roomOf, isPreassigned, onWaitlist, appLabel, appClass, memberIds, readiness, eventsFor, wingPlace,
} from '../lib/store.js';
import { blockLabel, classLabel, ORD } from '../lib/engine.js';
import { Button, Chip, useAct, fmtDeadline, phaseStatus } from '../components/ui.jsx';
import { initials } from '../components/Profile.jsx';
import Shell, { PageHead } from '../components/Shell.jsx';
import BuildingMap, { MapLegend } from '../components/BuildingMap.jsx';
import ProfileView, { roomVisible } from '../components/Profile.jsx';
import { Apply, Round2 } from './Apply.jsx';
import { go } from '../App.jsx';

export default function StudentApp({ sid, page }) {
  const s = useStore();
  const me = s.students[sid];
  const app = appOf(s, sid);
  const r2open = app && app.r2 && s.phase === 'round2_open';
  const showResult = roomVisible(s, sid) || (s.phase === 'published' && onWaitlist(s, sid));
  const nav = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'building', label: 'Building', icon: 'building' },
    ...((app && !app.late && !app.splitFrom) || s.phase === 'round1_open' ? [{ id: 'apply', label: 'Application', icon: 'file' }] : []),
    ...(r2open ? [{ id: 'round2', label: app.late ? 'Late form' : 'Round 2', icon: 'refresh', count: app.r2.status === 'submitted' ? null : '1', attn: true }] : []),
    ...(showResult ? [{ id: 'result', label: 'My room', icon: 'key' }] : []),
  ].map((n) => ({ ...n, href: `#/s/${sid}${n.id === 'home' ? '' : `/${n.id}`}` }));
  const invites = s.phase === 'round1_open' ? invitesFor(s, sid).length : 0;
  if (invites) nav[0].count = invites;
  if (invites) nav[0].attn = true;

  const Page = { home: Home, building: Building, apply: Apply, round2: Round2, result: Result, profile: Profile }[page] || Home;
  return (
    <Shell title={s.hostel.name} subtitle={`Allotment ${s.hostel.session}`} nav={nav} active={page} status={phaseStatus(s)}
      me={{ id: 'profile', href: `#/s/${sid}/profile`, initials: initials(me.name), name: me.name, sub: `${me.id} · ${me.year === 4 ? '4th' : '3rd'} year` }}>
      <Page sid={sid} />
    </Shell>
  );
}

export function RoomHero({ room, caption, wing }) {
  return (
    <div className="room-hero">
      <div className="key-tag" aria-hidden="true"><span className="mono">{room}</span></div>
      <div>
        <span className="eyebrow">Your room</span>
        <p className="room-hero-no mono">{room}</p>
        <p className="muted">{wing.name} · {wingPlace(wing)}</p>
        {caption && <p className="room-hero-cap">{caption}</p>}
      </div>
    </div>
  );
}

function howText(h) {
  if (!h) return '';
  if (h.how === 'pre') return 'Pre-assigned by the GS.';
  if (h.how === 'choice') return `Your ${ORD[h.rank - 1]} choice${h.round === 2 ? ' in Round 2' : ''}.`;
  if (h.how === 'fallback') return 'Your choices were taken, so your group was kept together in the next free rooms.';
  if (h.how === 'split') return 'Your choices were taken and no block was free, so your group was placed as close together as possible.';
  if (h.how === 'random') return 'Placed in a free room after Round 2.';
  if (h.how === 'override') return `Changed by the GS: ${h.reason}`;
  return '';
}

function Panel({ title, tone = 'plain', children }) {
  return (
    <section className={`panel tone-${tone}`}>
      <h2>{title}</h2>
      <div className="panel-b">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------- Home
function Home({ sid }) {
  const s = useStore();
  const act = useAct();
  const me = s.students[sid];
  const app = appOf(s, sid);
  const invites = invitesFor(s, sid);
  const room = roomOf(s, sid);
  const wl = onWaitlist(s, sid);
  const wingOf = (r) => s.wings.find((w) => w.id === r[0]);
  const create = (withFriends) => {
    const id = act(() => student.createApplication(sid));
    if (id) go(s.phase === 'round2_open' ? `/s/${sid}/round2` : `/s/${sid}/apply${withFriends ? '?invite' : ''}`);
  };

  let main;
  if (isPreassigned(s, sid)) {
    main = <RoomHero room={room.room} wing={wingOf(room.room)} caption="Pre-assigned by the GS. You don’t need to apply." />;
  } else if (s.phase === 'published') {
    main = room ? (
      <>
        <RoomHero room={room.room} wing={wingOf(room.room)} caption={howText(room)} />
        <div><a className="btn secondary" href={`#/s/${sid}/result`}>See how this was decided</a></div>
      </>
    ) : wl ? (
      <Panel title={`You are #${wl} on the waitlist`} tone="attn">
        <p>Every room is taken. If a room frees up, it is offered down the waitlist in order.</p>
        <a className="btn secondary" href={`#/s/${sid}/result`}>See why</a>
      </Panel>
    ) : <Panel title="No room">Contact the GS.</Panel>;
  } else if (s.phase === 'round2_review') {
    main = (
      <Panel title="Final list is being checked">
        <p>The GS is reviewing the final allotment. You’ll see your room here when it is published.</p>
        {room && room.round === 1 ? <p>Your Round 1 room <b className="mono">{room.room}</b> is already final.</p> : null}
      </Panel>
    );
  } else if (s.phase === 'round2_open') {
    if (room) {
      main = <><RoomHero room={room.room} wing={wingOf(room.room)} caption={`${howText(room)} This is final.`} /><div><a className="btn secondary" href={`#/s/${sid}/result`}>See how this was decided</a></div></>;
    } else if (app && app.r2) {
      const done = app.r2.status === 'submitted';
      main = (
        <Panel title={done ? 'Round 2 choices submitted' : app.late ? 'Late form: choose from free rooms' : 'Round 2: choose again'} tone={done ? 'accent' : 'attn'}>
          <p>{done ? `You can change them until ${fmtDeadline(s.settings.r2Deadline)}.`
            : app.late ? `Round 1 has closed. Your form is handled after everyone who applied on time. Round 2 closes ${fmtDeadline(s.settings.r2Deadline)}.`
              : `${memberIds(app).length > 1 ? 'Your group’s' : 'Your'} three choices were taken in Round 1. Pick again from the rooms still free before ${fmtDeadline(s.settings.r2Deadline)}. If you don’t, you’ll be placed in a random free room.`}</p>
          <a className="btn primary" href={`#/s/${sid}/round2`}>{done ? 'View Round 2 choices' : 'Choose rooms'}</a>
        </Panel>
      );
    } else {
      main = (
        <Panel title="You didn’t apply in Round 1" tone="attn">
          <p>You can still send a late form. Late forms are handled after everyone who applied on time, and only rooms still free can be chosen. If you don’t apply, you’ll be placed in any room left after Round 2.</p>
          <Button kind="primary" onClick={() => create(false)}>Send a late form</Button>
        </Panel>
      );
    }
  } else if (s.phase === 'round1_review') {
    main = <Panel title="Round 1 is closed">The GS is checking the results. You’ll see your room, or be asked to choose again in Round 2, once they approve it.</Panel>;
  } else if (s.phase === 'setup') {
    main = <Panel title="Applications open soon">The GS is preparing the room list. You can look around the building in the meantime.</Panel>;
  } else if (!app) {
    main = (
      <section className="start">
        <h2>Apply for a room</h2>
        <p className="muted measure">Round 1 closes <b>{fmtDeadline(s.settings.r1Deadline)}</b>. Wing groups (5–8) are placed first, then groups (2–4), then individuals. Within each, 4th years go before 3rd years.</p>
        <div className="start-options">
          <button type="button" className="option" onClick={() => create(false)}>
            <span className="option-t">Apply alone</span>
            <span className="option-d">Pick three single rooms on the building plan, in order.</span>
          </button>
          <button type="button" className="option" onClick={() => create(true)}>
            <span className="option-t">Apply with friends</span>
            <span className="option-d">Add 1–7 friends. You fill one form for everyone; no one needs to approve.</span>
          </button>
        </div>
      </section>
    );
  } else {
    const check = readiness(s, app);
    const isRep = app.repId === sid;
    const submitted = app.status === 'submitted';
    main = (
      <Panel title={submitted ? 'Application submitted' : 'Application not submitted yet'} tone={submitted ? 'accent' : 'attn'}>
        <p>{submitted ? `You can still change it until ${fmtDeadline(s.settings.r1Deadline)}.`
          : isRep ? check.blocking[0] : `Your rep, ${s.students[app.repId].name}, still needs to submit it.`}</p>
        <a className="btn primary" href={`#/s/${sid}/apply`}>{isRep ? (submitted ? 'Review application' : 'Continue application') : 'View application'}</a>
      </Panel>
    );
  }

  return (
    <>
      <PageHead title={`Hello, ${me.name.split(' ')[0]}`} sub={`${s.hostel.name} room allotment ${s.hostel.session}`} />
      <div className="content">
        <div className="home-grid">
          <div className="home-main">{main}</div>
          <aside className="home-side">
            {app && s.phase !== 'published' ? <AppSummary s={s} app={app} sid={sid} /> : (
              <section className="summary">
                <h3 className="h-sec">How rooms are given</h3>
                <ol className="rules">
                  <li>Wing groups (5–8) first, then groups (2–4), then individuals.</li>
                  <li>Within each, 4th years before 3rd years.</li>
                  <li>Then your 1st choice beats anyone’s 2nd or 3rd.</li>
                  <li>Exact ties: bigger group, then lottery.</li>
                </ol>
              </section>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}

function AppSummary({ s, app, sid }) {
  const ci = appClass(s, app);
  const n = memberIds(app).length;
  return (
    <section className="summary">
      <h3 className="h-sec">Your application</h3>
      <dl className="kv">
        <dt>Type</dt><dd>{n > 1 ? `${appLabel(s, app)} · ${n} people` : 'Individual'}</dd>
        <dt>Priority class</dt><dd>{classLabel(ci)}{ci.mixed ? ' (mixed years count as 3rd year)' : ''}</dd>
        {n > 1 && <><dt>Members</dt><dd className="member-list">{app.members.map((m) => (
          <span key={m.sid}>{m.sid === sid ? 'You' : s.students[m.sid].name.split(' ')[0]}{m.sid === app.repId ? ' (rep)' : ''}{m.status === 'pending' ? ' (invited)' : ''}</span>
        ))}</dd></>}
        <dt>Choices</dt><dd className="mono">{app.choices.map((c, i) => `${i + 1}. ${blockLabel(c)}`).join('   ')}</dd>
        {app.r2 && <><dt>Round 2</dt><dd className="mono">{app.r2.choices.filter((c) => c.length).map((c, i) => `${i + 1}. ${blockLabel(c)}`).join('   ') || 'Not chosen yet'}</dd></>}
      </dl>
    </section>
  );
}

// ---------------------------------------------------------------- Building
function Building({ sid }) {
  const s = useStore();
  const [sel, setSel] = useState(null);
  const room = roomOf(s, sid);
  const mine = roomVisible(s, sid) ? room.room : null;
  const showTaken = s.phase !== 'round1_open' && s.phase !== 'setup';
  const published = s.phase === 'published';
  const cellInfo = (r) => {
    const x = s.rooms[r];
    if (r === mine) return { state: 'mine', label: 'You' };
    if (x.status !== 'available') return { state: 'blocked', label: 'Unavailable' };
    if (showTaken && s.holder[r]) return { state: 'taken', label: published ? s.students[s.holder[r].sid].name.split(' ')[0] : 'Taken' };
    return { state: 'free' };
  };
  const wingNote = (w) => {
    const free = Array.from({ length: 8 }, (_, i) => `${w.id}${i + 1}`).filter((r) => cellInfo(r).state === 'free').length;
    return `${free} free`;
  };
  const info = sel ? cellInfo(sel) : null;
  const wing = sel ? s.wings.find((w) => w.id === sel[0]) : null;
  const n = sel ? Number(sel.slice(1)) : 0;

  return (
    <>
      <PageHead title="Building" sub={`${s.hostel.name} · 2 floors · 4 wings of 8 single rooms`}
        actions={s.phase === 'round1_open' && <a className="btn primary" href={`#/s/${sid}/apply`}>Choose rooms</a>} />
      <div className="content">
        <p className="muted measure">Select any room to see where it is. Rooms with consecutive numbers are next to each other, which is what a group block needs.</p>
        <BuildingMap wings={s.wings} mode="select" cellInfo={cellInfo} onRoom={setSel} focus={sel} wingNote={wingNote} />
        <MapLegend items={[['free', 'Free'], ...(showTaken ? [['taken', 'Taken']] : []), ...(mine ? [['mine', 'Your room']] : []), ['blocked', 'Unavailable']]} />
        {sel && (
          <section className="room-card" aria-live="polite">
            <div>
              <span className="eyebrow">Selected room</span>
              <p className="room-card-no mono">{sel}</p>
            </div>
            <dl className="kv">
              <dt>Wing</dt><dd>{wing.name} · {wingPlace(wing)}</dd>
              <dt>Side of corridor</dt><dd>{n <= 4 ? 'North' : 'South'}</dd>
              <dt>Next to</dt><dd className="mono">{[n > 1 ? `${wing.id}${n - 1}` : null, n < 8 ? `${wing.id}${n + 1}` : null].filter(Boolean).join(', ')}</dd>
              <dt>Status</dt><dd>{info.state === 'mine' ? 'Your room' : info.state === 'free' ? 'Free' : info.state === 'taken' ? (published ? `Allotted to ${info.label}` : 'Taken') : 'Unavailable'}</dd>
            </dl>
          </section>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Result
function Result({ sid }) {
  const s = useStore();
  const room = roomOf(s, sid);
  const wl = onWaitlist(s, sid);
  const events = eventsFor(s, sid);
  const visible = roomVisible(s, sid) || (wl && s.phase === 'published');
  if (!visible) {
    return <><PageHead title="My room" /><div className="content"><Panel title="Not available yet">Your result appears here once the GS approves it.</Panel></div></>;
  }
  const wing = room ? s.wings.find((w) => w.id === room.room[0]) : null;
  const neighbours = room ? Array.from({ length: 8 }, (_, i) => `${wing.id}${i + 1}`).map((r) => {
    const x = s.rooms[r];
    const h = s.holder[r];
    const who = x.status === 'pre' ? s.students[x.preSid] : h ? s.students[h.sid] : null;
    return { r, who, me: r === room.room, blocked: x.status === 'blocked' };
  }) : [];
  // wing rep: the wing group with at least 5 of its rooms in this wing
  const wingRep = room ? Object.values(s.apps).find((a) => memberIds(a).length >= 5 && !a.splitParent && a.status !== 'discarded' &&
    Object.entries(s.holder).filter(([r, h]) => h.appId === a.id && r[0] === wing.id).length >= 5) : null;

  return (
    <>
      <PageHead title="My room" />
      <div className="content">
        {room ? <RoomHero room={room.room} wing={wing} caption={howText(room)} /> : (
          <Panel title={`Waitlist position #${wl}`} tone="attn">Every room was taken before your turn. Rooms that free up are offered down the waitlist in order.</Panel>
        )}
        {room && (
          <section>
            <h3 className="h-sec">{wing.name}</h3>
            <p className="muted small">Wing rep: {wingRep ? s.students[wingRep.repId].name : 'to be appointed by the GS'}</p>
            <ul className="neighbours">
              {neighbours.map((nb) => (
                <li key={nb.r} className={nb.me ? 'me' : ''}>
                  <span className="mono">{nb.r}</span>
                  <span>{nb.me ? 'You' : nb.blocked ? 'Unavailable' : nb.who ? nb.who.name : 'Empty'}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section>
          <h3 className="h-sec">How this was decided</h3>
          {events.length ? (
            <ol className="timeline">
              {events.map((e, i) => (
                <li key={i} className={`tl-${e.outcome}`}>
                  <span className="tl-when mono">{e.round === 'final' ? 'After Round 2' : e.round === 'override' ? 'GS change' : `Round ${e.round}`}</span>
                  <span className="tl-what">{e.detail}</span>
                </li>
              ))}
            </ol>
          ) : <p className="muted">{isPreassigned(s, sid) ? 'This room was pre-assigned by the GS before applications opened.' : 'No decisions recorded.'}</p>}
          <p className="muted small mt-s">Rules: wing groups, then groups, then individuals; 4th years before 3rd years; then 1st choices before 2nd and 3rd; then bigger groups; then the lottery number drawn from seed {s.settings.seed}.</p>
        </section>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Profile
function Profile({ sid }) {
  const s = useStore();
  return (
    <>
      <PageHead title="Profile" sub="Your details as held by the hostel office. Ask the GS to correct anything wrong." />
      <div className="content">
        <ProfileView s={s} sid={sid} />
      </div>
    </>
  );
}
