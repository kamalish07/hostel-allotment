import { useEffect, useState } from 'react';
import SignIn from './SignIn.jsx';
import AdminApp from './admin/AdminApp.jsx';
import StudentApp from './student/StudentApp.jsx';
import { useStore } from './lib/store.js';

/*
  Routes live in the hash as plain names, e.g. #gs-rooms, #gs-students-24CE137, #s-24EC249-apply.
  Plain names (letters, digits, hyphens) work everywhere, including inside a hosted page whose address
  only keeps simple names. Links written as #/gs/rooms still work: they are converted on click.
*/
export const toHash = (path) => path.replace(/^#?\/?/, '').replace(/\?/g, '/').split('/').filter(Boolean).join('-');

function parse() {
  const h = window.location.hash;
  if (h.startsWith('#/')) return h.slice(2).replace(/\?.*$/, '').split('/').filter(Boolean);
  return h.replace(/^#/, '').split('-').filter(Boolean);
}

function useRoute() {
  const [parts, setParts] = useState(parse);
  useEffect(() => {
    const on = () => { setParts(parse()); window.scrollTo(0, 0); };
    // Turn any #/path link into its plain-name form before the browser follows it.
    const click = (e) => {
      const a = e.target.closest && e.target.closest('a[href^="#/"]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      go(a.getAttribute('href'));
    };
    window.addEventListener('hashchange', on);
    document.addEventListener('click', click);
    if (window.location.hash.startsWith('#/')) go(window.location.hash);
    return () => { window.removeEventListener('hashchange', on); document.removeEventListener('click', click); };
  }, []);
  return parts;
}

export const go = (path) => {
  const next = toHash(path);
  if (window.location.hash.replace(/^#/, '') === next) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else window.location.hash = next;
};

export default function App() {
  const route = useRoute();
  const students = useStore((s) => s.students);
  if (route[0] === 'gs') return <AdminApp page={route[1] || 'overview'} arg={route[2]} />;
  if (route[0] === 's' && students[route[1]]) return <StudentApp sid={route[1]} page={route[2] || 'home'} />;
  return <SignIn />;
}

// True when the app runs inside a hosted frame, where file downloads are blocked.
export const isEmbedded = (() => { try { return window.self !== window.top; } catch { return true; } })();
