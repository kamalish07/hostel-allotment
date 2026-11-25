import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export function Button({ kind = 'secondary', size, className = '', ...props }) {
  return <button type="button" className={`btn ${kind} ${size || ''} ${className}`} {...props} />;
}

export function Chip({ tone = 'muted', children, title }) {
  return <span className={`chip ${tone}`} title={title}>{children}</span>;
}

export function Mono({ children, className = '' }) {
  return <span className={`mono ${className}`}>{children}</span>;
}

// ---------------------------------------------------------------- toasts
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((text, tone = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setItems((x) => [...x, { id, text, tone }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), tone === 'bad' ? 5200 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => <div key={t.id} className={`toast ${t.tone}`}>{t.text}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// Runs a store action and reports the result.
export function useAct() {
  const toast = useToast();
  return useCallback((fn, success) => {
    try {
      const r = fn();
      if (success) toast(success, 'ok');
      return r ?? true;
    } catch (e) {
      toast(e.message || 'Something went wrong.', 'bad');
      return false;
    }
  }, [toast]);
}

// ---------------------------------------------------------------- drawer
export function Drawer({ open, onClose, title, children, footer, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="drawer-wrap">
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className={`drawer ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <header className="drawer-head">
          <h2>{title}</h2>
          <Button kind="ghost" size="sm" onClick={onClose} aria-label="Close">Close</Button>
        </header>
        <div className="drawer-body">{children}</div>
        {footer && <footer className="drawer-foot">{footer}</footer>}
      </aside>
    </div>
  );
}

// Two-step confirmation inside the page (the viewer may block window.confirm).
export function ConfirmButton({ label, confirmLabel, kind = 'primary', danger, children, onConfirm, disabled }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Button kind={kind} onClick={() => setOpen(true)} disabled={disabled}>{label}</Button>;
  return (
    <div className={`confirm ${danger ? 'danger' : ''}`}>
      <div className="confirm-text">{children}</div>
      <div className="row gap-s">
        <Button kind={danger ? 'danger' : 'primary'} onClick={() => { setOpen(false); onConfirm(); }}>{confirmLabel || label}</Button>
        <Button kind="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

export function Stat({ value, label, tone }) {
  return (
    <div className={`stat ${tone || ''}`}>
      <span className="stat-v">{value}</span>
      <span className="stat-l">{label}</span>
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <p className="empty-t">{title}</p>
      {children && <div className="empty-b">{children}</div>}
    </div>
  );
}

export function fmtDeadline(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}
export function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

// One-line status for the current round (replaces the old step tracker).
export function phaseStatus(s) {
  switch (s.phase) {
    case 'setup': return { label: 'Applications not open yet', tone: 'quiet' };
    case 'round1_open': return { label: `Round 1 open · closes ${fmtDeadline(s.settings.r1Deadline)}`, tone: 'live' };
    case 'round1_review': return { label: 'Round 1 closed · under review', tone: 'quiet' };
    case 'round2_open': return { label: `Round 2 open · closes ${fmtDeadline(s.settings.r2Deadline)}`, tone: 'live' };
    case 'round2_review': return { label: 'Final list under review', tone: 'quiet' };
    default: return { label: 'Allotment published', tone: 'done' };
  }
}
