import { useStore } from '../lib/store.js';
import Shell, { PageHead } from '../components/Shell.jsx';
import { phaseStatus } from '../components/ui.jsx';
import Overview from './Overview.jsx';
import Rooms from './Rooms.jsx';
import Students from './Students.jsx';
import Candidate from './Candidate.jsx';
import Applications from './Applications.jsx';
import Allotment from './Allotment.jsx';
import Settings from './Settings.jsx';

export { PageHead };

export default function AdminApp({ page, arg }) {
  const s = useStore();
  const flags = Object.values(s.holder).filter((h) => h.flag).length;
  const nav = [
    { id: 'overview', label: 'Overview', icon: 'grid' },
    { id: 'rooms', label: 'Building', icon: 'building' },
    { id: 'students', label: 'Students', icon: 'users' },
    { id: 'applications', label: 'Applications', icon: 'file', count: Object.values(s.apps).filter((a) => a.status !== 'discarded' && !a.splitParent).length },
    { id: 'allotment', label: 'Allotment', icon: 'key', count: flags || null, attn: true },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ].map((n) => ({ ...n, href: `#/gs/${n.id}` }));

  let body;
  if (page === 'students' && arg && s.students[arg]) body = <Candidate sid={arg} />;
  else {
    const Page = { overview: Overview, rooms: Rooms, students: Students, applications: Applications, allotment: Allotment, settings: Settings }[page] || Overview;
    body = <Page />;
  }

  return (
    <Shell title={s.hostel.name} subtitle={`Allotment ${s.hostel.session}`} nav={nav} active={page} status={phaseStatus(s)}
      me={{ id: 'settings', href: '#/gs/settings', initials: 'GS', name: 'General Secretary', sub: 'Hostel office' }}>
      {body}
    </Shell>
  );
}
