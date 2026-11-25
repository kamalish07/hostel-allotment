import { createContext, useContext, useState } from 'react';
import Icon from './Icon.jsx';

const ShellCtx = createContext({ toggle: () => {}, status: null });

/* Dark sidebar with icon navigation, used by both the GS console and the student portal.
   On phones the sidebar slides in from the left. */
export default function Shell({ title, subtitle, nav, active, me, status, children }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('ha.side') === '1'; } catch { return false; } });
  const collapse = () => setCollapsed((c) => { try { localStorage.setItem('ha.side', c ? '0' : '1'); } catch { /* ignore */ } return !c; });

  return (
    <div className={`app ${collapsed ? 'collapsed' : ''} ${open ? 'menu-open' : ''}`}>
      <aside className="side" aria-label="Sidebar">
        <a className="brand" href={nav[0]?.href} onClick={() => setOpen(false)}>
          <span className="brand-mark"><Icon name="building" /></span>
          <span className="brand-text"><span className="brand-name">{title}</span><span className="brand-sub">{subtitle}</span></span>
        </a>
        <nav className="nav" aria-label="Main">
          {nav.map((n) => (
            <a key={n.id} href={n.href} className={active === n.id ? 'on' : ''} aria-current={active === n.id ? 'page' : undefined}
              title={n.label} onClick={() => setOpen(false)}>
              <Icon name={n.icon} /><span>{n.label}</span>
              {n.count ? <b className={`badge ${n.attn ? '' : 'quiet'}`}>{n.count}</b> : null}
            </a>
          ))}
        </nav>
        <div className="side-foot">
          <a className={`me ${active === me.id ? 'on' : ''}`} href={me.href} onClick={() => setOpen(false)}>
            <span className="avatar">{me.initials}</span>
            <span className="me-text"><span className="me-name">{me.name}</span><span className="me-mail">{me.sub}</span></span>
          </a>
          <a className="foot-btn" href="#/"><Icon name="logout" /><span className="label">Switch user</span></a>
          <button type="button" className="foot-btn collapse-btn" onClick={collapse} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <Icon name="chevL" /><span className="label">Collapse</span>
          </button>
        </div>
      </aside>
      {open && <div className="menu-scrim" onClick={() => setOpen(false)} />}
      <main className="main">
        <ShellCtx.Provider value={{ toggle: () => setOpen((o) => !o), status }}>{children}</ShellCtx.Provider>
      </main>
    </div>
  );
}

export function PageHead({ title, sub, actions, back }) {
  const { toggle, status } = useContext(ShellCtx);
  return (
    <header className="topbar">
      <button type="button" className="btn light icon menu-btn" onClick={toggle} aria-label="Open menu"><Icon name="menu" /></button>
      <div className="titles">
        {back && <a className="back" href={back.href}><Icon name="chevL" />{back.label}</a>}
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      <div className="top-actions">
        {actions}
        {status && <span className={`status-chip ${status.tone || ''}`}><i />{status.label}</span>}
      </div>
    </header>
  );
}
