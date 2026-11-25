import { useStore, gs, appOf, invitesFor, isPreassigned, appLabel, memberIds, yearLabel } from '../lib/store.js';
import { ConfirmButton, useAct, fmtDeadline, phaseStatus } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { PageHead } from '../components/Shell.jsx';
import { go } from '../App.jsx';

function Action({ s }) {
  const act = useAct();
  const apps = Object.values(s.apps).filter((a) => a.status !== 'discarded' && !a.splitParent);
  const drafts = apps.filter((a) => a.status === 'draft');
  const draftStudents = drafts.reduce((n, a) => n + memberIds(a).length, 0);
  const flags = Object.values(s.holder).filter((h) => h.flag).length;
  const r2 = Object.values(s.apps).filter((a) => a.r2 && a.status !== 'discarded');
  const r2done = r2.filter((a) => a.r2.status === 'submitted').length;

  const box = (title, text, buttons) => (
    <section className="card c-action">
      <div className="card-head"><div><h3>{title}</h3><p className="sub">{text}</p></div></div>
      <div className="row gap-s wrap">{buttons}</div>
    </section>
  );

  switch (s.phase) {
    case 'setup':
      return box('Open applications', 'Students form groups, accept invites and submit three choices. Check blocked and pre-assigned rooms in Building first.',
        <ConfirmButton label="Open Round 1" onConfirm={() => act(gs.openRound1, 'Round 1 is open')}>Students can apply until {fmtDeadline(s.settings.r1Deadline)}.</ConfirmButton>);
    case 'round1_open':
      return box('Close Round 1 and run the allotment', `Closing locks every form, draws lottery numbers from seed ${s.settings.seed} and runs Round 1. You review the result before any student sees it.`,
        <ConfirmButton label="Close Round 1 and run" confirmLabel="Close and run" onConfirm={() => act(() => { gs.runRound1(); go('/gs/allotment'); }, 'Round 1 ran. Review the draft.')}>
          {drafts.length ? <><b>{drafts.length} unsubmitted application{drafts.length > 1 ? 's' : ''}</b> ({draftStudents} student{draftStudents > 1 ? 's' : ''}) will be discarded. They can still send a late form in Round 2.</> : 'Every application is submitted.'}
        </ConfirmButton>);
    case 'round1_review':
      return box('Review Round 1, then open Round 2', `${flags ? `${flags} room${flags > 1 ? 's need' : ' needs'} review. ` : 'Nothing needs review. '}Approving makes Round 1 rooms final and opens Round 2 for ${r2.length} application${r2.length === 1 ? '' : 's'} left over.`, <>
        <a className="btn light" href="#/gs/allotment">Review draft</a>
        <ConfirmButton label="Approve and open Round 2" onConfirm={() => act(gs.approveRound1, 'Round 2 is open')}>Round 1 rooms become final and students are told their result.</ConfirmButton>
        <ConfirmButton label="Reopen Round 1" kind="ghost" danger confirmLabel="Discard this run" onConfirm={() => act(gs.reopenRound1, 'Round 1 reopened')}>Throws away this run and any changes, and reopens the Round 1 form.</ConfirmButton>
      </>);
    case 'round2_open':
      return box('Close Round 2 and run the final allotment', `${r2done} of ${r2.length} Round 2 form${r2.length === 1 ? '' : 's'} submitted. Anyone who hasn’t submitted gets a random free room; students with no form come last.`,
        <ConfirmButton label="Close Round 2 and run" onConfirm={() => act(() => { gs.runRound2(); go('/gs/allotment'); }, 'Final allotment ready for review')}>Runs Round 2, places everyone left and builds the waitlist.</ConfirmButton>);
    case 'round2_review':
      return box('Final review, then publish', `${flags ? `${flags} room${flags > 1 ? 's need' : ' needs'} review` : 'Nothing needs review'} · ${s.waitlist.length} on the waitlist. Publishing shows every student their room and the reason.`, <>
        <a className="btn light" href="#/gs/allotment">Review final list</a>
        <ConfirmButton label="Publish allotment" onConfirm={() => act(gs.publish, 'Allotment published')}>Every student will see their room. Later changes go through Move or swap.</ConfirmButton>
        <ConfirmButton label="Reopen Round 2" kind="ghost" danger confirmLabel="Discard final run" onConfirm={() => act(gs.reopenRound2, 'Round 2 reopened')}>Throws away the final run and reopens the Round 2 form.</ConfirmButton>
      </>);
    default:
      return box('Allotment published', 'Students can see their rooms and how each was decided. Withdrawals and swaps are handled from Allotment.',
        <a className="btn light" href="#/gs/allotment">Open allotment</a>);
  }
}

export default function Overview() {
  const s = useStore();
  const students = Object.values(s.students);
  const apps = Object.values(s.apps).filter((a) => a.status !== 'discarded' && !a.splitParent);
  const submitted = apps.filter((a) => a.status === 'submitted');
  const drafts = apps.filter((a) => a.status === 'draft');
  const covered = submitted.reduce((n, a) => n + memberIds(a).length, 0);
  const pre = students.filter((x) => isPreassigned(s, x.id));
  const placedIds = new Set(Object.values(s.holder).map((h) => h.sid));
  const noApp = students.filter((x) => !appOf(s, x.id) && !isPreassigned(s, x.id) && !invitesFor(s, x.id).length && !placedIds.has(x.id));
  const invites = students.filter((x) => invitesFor(s, x.id).length);
  const rooms = Object.values(s.rooms);
  const open = s.phase === 'round1_open' || s.phase === 'setup';
  const flagged = Object.entries(s.holder).filter(([, h]) => h.flag);
  const status = phaseStatus(s);

  const hero = open
    ? { n: covered, of: students.length, label: 'students covered by a submitted application', pills: [['Applications', submitted.length], ['Drafts', drafts.length], ['Rooms open', rooms.filter((r) => r.status === 'available').length]] }
    : { n: placedIds.size + pre.length, of: students.length, label: 'students have a room', pills: [['Need review', flagged.length], ['Waitlist', s.waitlist.length], ['Rooms', rooms.length]] };

  const attention = open
    ? [...drafts.map((a) => ({ key: a.id, title: appLabel(s, a), text: a.members.some((m) => m.status === 'pending') ? 'Waiting for an invite to be answered' : 'Rep hasn’t submitted yet', href: '#/gs/applications', tone: 'wait' })),
      ...invites.map((x) => ({ key: `inv-${x.id}`, title: x.name, text: 'Has an invite they haven’t answered', href: `#/gs/students/${x.id}`, tone: 'wait' }))]
    : flagged.map(([r, h]) => ({ key: r, title: `${r} · ${s.students[h.sid].name}`, text: h.label !== s.students[h.sid].name ? `${h.label}: placed without a stated choice` : 'Placed without a stated choice', href: '#/gs/allotment', tone: 'flag' }));

  return (
    <>
      <PageHead title="Overview" sub={`${s.hostel.name} · ${s.wings.length} wings · ${rooms.length} single rooms · ${students.length} students`} />
      <div className="content">
        <div className="dash-grid">
          <section className="card dark-card c-hero">
            <span className="hero-tag"><i className={status.tone} />{status.label}</span>
            <div className="big-num">{hero.n}<span className="big-of">/{hero.of}</span></div>
            <div className="big-sub">{hero.label}</div>
            <div className="stat-row">
              {hero.pills.map(([k, v]) => <div className="stat-pill" key={k}><div className="k">{k}</div><div className="v">{v}</div></div>)}
            </div>
          </section>

          <Action s={s} />

          <section className="card c-attn">
            <div className="card-head"><div><h3>Needs attention</h3><p className="sub">{open ? 'Applications that will be discarded if Round 1 closes now' : 'Rooms given without a stated choice'}</p></div></div>
            {attention.length ? attention.slice(0, 8).map((a) => (
              <a className="attn-item" key={a.key} href={a.href}>
                <span className={`dot ${a.tone}`} />
                <span className="t"><b>{a.title}</b><span>{a.text}</span></span>
                <Icon name="chevR" className="go" />
              </a>
            )) : <p className="muted">Nothing right now.</p>}
          </section>

          <section className="card c-side">
            <div className="card-head"><div><h3>{open ? 'No application yet' : 'Waitlist'}</h3><p className="sub">{open ? 'Placed in a random free room after Round 2 if they don’t apply' : 'Offered rooms in this order if any free up'}</p></div></div>
            {(open ? noApp : s.waitlist.map((w) => s.students[w.sid])).map((x, i) => (
              <a className="person" key={x.id} href={`#/gs/students/${x.id}`}>
                <span className="avatar sm">{open ? x.name.split(' ').map((p) => p[0]).join('') : i + 1}</span>
                <span className="t"><b>{x.name}</b><span>{x.id} · {yearLabel(x.year)}</span></span>
              </a>
            ))}
            {(open ? noApp : s.waitlist).length === 0 && <p className="muted">{open ? 'Everyone has applied.' : 'Nobody is waiting.'}</p>}
          </section>
        </div>
      </div>
    </>
  );
}
