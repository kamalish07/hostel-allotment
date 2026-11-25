import { useState } from 'react';
import {
  useStore, student, appOf, roomOf, isPreassigned, onWaitlist, appLabel, appClass, memberIds, readiness, eventsFor, wingPlace, wingOf, yearLabel,
} from '../lib/store.js';
import { blockLabel, classLabel, ORD } from '../lib/engine.js';
import { FLOOR_NAMES } from '../lib/seed.js';
import { Button, useAct, fmtDeadline, phaseStatus } from '../components/ui.jsx';
import { initials } from '../components/Profile.jsx';
import Shell, { PageHead } from '../components/Shell.jsx';
import BuildingMap, { MapLegend } from '../components/BuildingMap.jsx';
import ProfileView, { roomVisible } from '../components/Profile.jsx';
import Icon from '../components/Icon.jsx';
import { Apply, Round2 } from './Apply.jsx';
import { go } from '../App.jsx';

export default function StudentApp({ sid, page }) {
  const s = useStore();
  const me = s.students[sid];
  const app = appOf(s, sid);
  const r2open = app && app.r2 && s.phase === 'round2_open';
  const showResult = roomVisible(s, sid) || (s.phase === 'published' && onWaitlist(s, sid));
  const needsChoices = s.phase === 'round1_open' && (!app || app.status !== 'submitted');
  const nav = [
    { id: 'home', label: 'Home', icon: 'home' },
    ...((app && !app.late && !app.splitFrom) || s.phase === 'round1_open'
      ? [{ id: 'apply', label: 'Choose rooms', icon: 'bed', count: needsChoices ? '1' : null, attn: true }] : []),
    ...(r2open ? [{ id: 'round2', label: app.late ? 'Late form' : 'Round 2', icon: 'refresh', count: app.r2.status === 'submitted' ? null : '1', attn: true }] : []),
    ...(showResult ? [{ id: 'result', label: 'My room', icon: 'key' }] : []),
    { id: 'building', label: 'Building', icon: 'building' },
  ].map((n) => ({ ...n, href: `#/s/${sid}${n.id === 'home' ? '' : `/${n.id}`}` }));

  const Page = { home: Home, building: Building, apply: Apply, round2: Round2, result: Result, profile: Profile }[page] || Home;
  return (
    <Shell title={s.hostel.name} subtitle={`Allotment ${s.hostel.session}`} nav={nav} active={page} status={phaseStatus(s)}
      me={{ id: 'profile', href: `#/s/${sid}/profile`, initials: initials(me.name), name: me.name, sub: `${me.id} · ${yearLabel(me.year)}` }}>
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
        <p className="muted">{wing ? `${wing.name} · ${wingPlace(wing)}` : ''}</p>
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

// The big "choose your rooms" card on Home.
function ChooseCard({ s, sid, app, onCreate }) {
  const isRep = app && app.repId === sid;
  const submitted = app && app.status === 'submitted';
  const check = app ? readiness(s, app) : null;
  const size = app ? memberIds(app).length : 1;
  const where = (rooms) => { const w = wingOf(s, rooms[0]); return w ? `${w.name} · ${FLOOR_NAMES[w.floor]}` : ''; };

  return (
    <section className={`choose-card ${submitted ? 'done' : ''}`}>
      <div className="choose-top">
        <div>
          <span className="choose-eyebrow">{submitted ? 'Submitted' : 'Round 1 is open'}</span>
          <h2>{submitted ? 'Your rooms are in' : 'Choose your rooms'}</h2>
          <p>
            {submitted ? `You can still change your choices until ${fmtDeadline(s.settings.r1Deadline)}.`
              : `Pick 3 choices on the building plan, best first${size > 1 ? `: each one is ${size} rooms side by side` : ''}. Closes ${fmtDeadline(s.settings.r1Deadline)}.`}
          </p>
        </div>
        <span className="choose-icon" aria-hidden="true"><Icon name="bed" /></span>
      </div>
      {app && app.notice ? <p className="choose-notice" role="status">{app.notice}</p> : null}
      {app ? (
        <>
          <div className="choose-slots">
            {[0, 1, 2].map((i) => {
              const c = app.choices[i] && app.choices[i].length ? app.choices[i] : null;
              return (
                <a key={i} className={`cslot ${c ? 'set' : ''}`} href={`#/s/${sid}/apply`}>
                  <span className="cslot-n">{ORD[i]}</span>
                  <span className="cslot-v">{c ? blockLabel(c) : 'Not chosen'}</span>
                  <span className="cslot-w">{c ? where(c) : 'Tap to choose'}</span>
                </a>
              );
            })}
          </div>
          <div className="choose-foot">
            <span className={check && check.ok ? 'ok' : 'todo'}>
              {submitted ? 'Submitted' : !isRep ? `Your rep, ${s.students[app.repId].name.split(' ')[0]}, chooses and submits for the group.` : check.ok ? 'Ready to submit.' : check.blocking[0]}
            </span>
            <a className="btn primary" href={`#/s/${sid}/apply`}>{isRep ? (submitted ? 'Review choices' : 'Choose on the plan') : 'See your group’s choices'}<Icon name="chevR" /></a>
          </div>
        </>
      ) : (
        <div className="choose-start">
          <button type="button" className="option" onClick={() => onCreate(false)}>
            <span className="option-t">Apply alone</span>
            <span className="option-d">Pick three single rooms on the plan.</span>
          </button>
          <button type="button" className="option" onClick={() => onCreate(true)}>
            <span className="option-t">Apply with friends</span>
            <span className="option-d">Add up to 7 friends, pick rooms side by side and decide who gets which.</span>
          </button>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Home
function Home({ sid }) {
  const s = useStore();
  const act = useAct();
  const me = s.students[sid];
  const app = appOf(s, sid);
  const room = roomOf(s, sid);
  const wl = onWaitlist(s, sid);
  const create = (withFriends) => {
    const id = act(() => student.createApplication(sid));
    if (id) go(s.phase === 'round2_open' ? `/s/${sid}/round2` : `/s/${sid}/apply${withFriends ? '?invite' : ''}`);
  };

  let main;
  if (isPreassigned(s, sid)) {
    main = <RoomHero room={room.room} wing={wingOf(s, room.room)} caption="Pre-assigned by the GS. You don’t need to apply." />;
  } else if (s.phase === 'published') {
    main = room ? (
      <>
        <RoomHero room={room.room} wing={wingOf(s, room.room)} caption={howText(room)} />
        <div><a className="btn light" href={`#/s/${sid}/result`}>See how this was decided</a></div>
      </>
    ) : wl ? (
      <Panel title={`You are #${wl} on the waitlist`} tone="attn">
        <p>Every room is taken. If a room frees up, it is offered down the waitlist in order.</p>
        <a className="btn light" href={`#/s/${sid}/result`}>See why</a>
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
      main = <><RoomHero room={room.room} wing={wingOf(s, room.room)} caption={`${howText(room)} This is final.`} /><div><a className="btn light" href={`#/s/${sid}/result`}>See how this was decided</a></div></>;
    } else if (app && app.r2) {
      const done = app.r2.status === 'submitted';
      main = (
        <section className={`choose-card ${done ? 'done' : ''}`}>
          <div className="choose-top">
            <div>
              <span className="choose-eyebrow">{app.late ? 'Late form' : 'Round 2'}</span>
              <h2>{done ? 'Round 2 choices submitted' : 'Choose again from free rooms'}</h2>
              <p>{done ? `You can change them until ${fmtDeadline(s.settings.r2Deadline)}.`
                : app.late ? `Round 1 has closed. Late forms are handled after everyone who applied on time. Closes ${fmtDeadline(s.settings.r2Deadline)}.`
                  : `${memberIds(app).length > 1 ? 'Your group’s' : 'Your'} Round 1 choices were taken. Pick again before ${fmtDeadline(s.settings.r2Deadline)}, or you’ll get a random free room.`}</p>
            </div>
            <span className="choose-icon" aria-hidden="true"><Icon name="refresh" /></span>
          </div>
          <div className="choose-foot"><span /><a className="btn primary" href={`#/s/${sid}/round2`}>{done ? 'View choices' : 'Choose on the plan'}<Icon name="chevR" /></a></div>
        </section>
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
  } else {
    main = <ChooseCard s={s} sid={sid} app={app} onCreate={create} />;
  }

  return (
    <>
      <PageHead title={`Hello, ${me.name.split(' ')[0]}`} sub={`${s.hostel.name} room allotment ${s.hostel.session} · ${yearLabel(me.year)}`} />
      <div className="content">
        <div className="home-grid">
          <div className="home-main">{main}</div>
          <aside className="home-side">
            {app && s.phase !== 'published' ? <AppSummary s={s} app={app} sid={sid} /> : null}
            <section className="summary">
              <h3 className="h-sec">How rooms are given</h3>
              <ol className="rules">
                <li>Wing groups (5–8 people) first, then groups (2–4), then individuals.</li>
                <li>Within each, final years ({yearLabel(4)}) go before incoming students ({yearLabel(3)}).</li>
                <li>Then a 1st choice beats anyone’s 2nd or 3rd.</li>
                <li>Exact ties: bigger group, then lottery.</li>
              </ol>
            </section>
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
        <dt>Priority</dt><dd>{classLabel(ci)}{ci.mixed ? ' (a mixed group counts with its incoming members)' : ''}</dd>
        {n > 1 && <><dt>Members</dt><dd className="member-list">{app.members.map((m) => (
          <span key={m.sid}>{m.sid === sid ? 'You' : s.students[m.sid].name.split(' ')[0]}{m.sid === app.repId ? ' (rep)' : ''}</span>
        ))}</dd></>}
        {app.r2 && <><dt>Round 2</dt><dd>{app.r2.choices.filter((c) => c.length).map((c) => blockLabel(c)).join(' · ') || 'Not chosen yet'}</dd></>}
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
  const info = sel ? cellInfo(sel) : null;
  const wing = sel ? wingOf(s, sel) : null;
  const pos = wing ? wing.rooms.indexOf(sel) : -1;

  return (
    <>
      <PageHead title="Building" sub={`${s.hostel.name} · 3 floors · ${s.wings.length} wings of 8 single rooms`}
        actions={s.phase === 'round1_open' && <a className="btn primary" href={`#/s/${sid}/apply`}>Choose rooms</a>} />
      <div className="content">
        <BuildingMap wings={s.wings} mode="select" cellInfo={cellInfo} onRoom={setSel} focus={sel}
          reveal={mine ? { room: mine, n: 1 } : null} />
        <MapLegend items={[['free', 'Free'], ...(showTaken ? [['taken', 'Taken']] : []), ...(mine ? [['mine', 'Your room']] : []), ['blocked', 'Unavailable']]} />
        {sel && (
          <section className="room-card" aria-live="polite">
            <div>
              <span className="eyebrow">Selected room</span>
              <p className="room-card-no mono">{sel}</p>
            </div>
            <dl className="kv">
              <dt>Wing</dt><dd>{wing.name} · {wingPlace(wing)}</dd>
              <dt>Next to</dt><dd className="mono">{[wing.rooms[pos - 1], wing.rooms[pos + 1]].filter(Boolean).join(', ')}</dd>
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
  const wing = room ? wingOf(s, room.room) : null;
  const neighbours = wing ? wing.rooms.map((r) => {
    const x = s.rooms[r];
    const h = s.holder[r];
    const who = x.status === 'pre' ? s.students[x.preSid] : h ? s.students[h.sid] : null;
    return { r, who, me: r === room.room, blocked: x.status === 'blocked' };
  }) : [];
  // wing rep: the wing group with at least 5 of its rooms in this wing
  const wingRep = wing ? Object.values(s.apps).find((a) => memberIds(a).length >= 5 && !a.splitParent && a.status !== 'discarded' &&
    wing.rooms.filter((r) => s.holder[r] && s.holder[r].appId === a.id).length >= 5) : null;

  return (
    <>
      <PageHead title="My room" />
      <div className="content">
        {room ? <RoomHero room={room.room} wing={wing} caption={howText(room)} /> : (
          <Panel title={`Waitlist position #${wl}`} tone="attn">Every room was taken before your turn. Rooms that free up are offered down the waitlist in order.</Panel>
        )}
        {wing && (
          <section>
            <h3 className="h-sec">{wing.name} · {FLOOR_NAMES[wing.floor]}</h3>
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
          <p className="muted small mt-s">Rules: wing groups, then groups, then individuals; final years before incoming students; then 1st choices before 2nd and 3rd; then bigger groups; then the lottery number drawn from seed {s.settings.seed}.</p>
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
