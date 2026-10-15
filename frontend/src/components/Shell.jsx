import { useEffect, useRef, useState } from 'react';
import {
  ArrowRightIcon,
  BuildingsIcon,
  CalendarCheckIcon,
  CaretDownIcon,
  CaretDoubleLeftIcon,
  CaretDoubleRightIcon,
  CheckCircleIcon,
  ClockClockwiseIcon,
  ConfettiIcon,
  InfoIcon,
  ListIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  SquaresFourIcon,
  SunIcon,
  UserCircleIcon,
  UserFocusIcon,
  UsersThreeIcon,
  WarningIcon,
  XCircleIcon,
  XIcon,
} from '@phosphor-icons/react';
import { useApp } from '../state.jsx';
import { ROLE_L, ROLE_TONE, fullName } from '../lib/ui.js';
import { Avatar } from './common.jsx';

const NAV = [
  ['dashboard', 'Dashboard', SquaresFourIcon, '/'],
  ['employees', 'Employees', UsersThreeIcon, '/employees'],
  ['departments', 'Departments', BuildingsIcon, '/departments'],
  ['leave', 'Leave', CalendarCheckIcon, '/leave'],
  ['attendance', 'Attendance', ClockClockwiseIcon, '/attendance'],
  ['holidays', 'Holidays', ConfettiIcon, '/holidays'],
];

function Logo() {
  return (
    <span className="logo" aria-hidden="true">
      <span className="l1" />
      <span className="l2" />
      <span className="l3" />
      <span className="l4" />
    </span>
  );
}

export function Sidebar() {
  const { route, go, drawer, setDrawer, collapsed, toggleCollapsed, viewer, canApprove, pendingFor, core } = useApp();
  const active = route.page === 'profile' ? 'employees' : route.page;
  const dept = viewer && core.departments.find((d) => d.id === viewer.department_id);
  return (
    <>
      {drawer && <div className="drawer-scrim" onClick={() => setDrawer(false)} />}
      <aside aria-label="Main navigation" className={`sidebar ${drawer ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
        <div className="brand">
          <Logo />
          <span className="brand-name">Fellow</span>
          <button type="button" className="drawer-close" aria-label="Close menu" onClick={() => setDrawer(false)}>
            <XIcon />
          </button>
        </div>
        <button
          type="button"
          className="collapse-btn"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={toggleCollapsed}
        >
          {collapsed ? <CaretDoubleRightIcon /> : <CaretDoubleLeftIcon />}
        </button>
        <nav className="nav">
          <div className="nav-label">Workspace</div>
          {NAV.map(([id, label, Icon, path]) => {
            const on = id === active;
            const badge = id === 'leave' && canApprove ? pendingFor.length : 0;
            return (
              <button
                key={id}
                type="button"
                className="nav-item"
                aria-current={on ? 'page' : undefined}
                aria-label={collapsed ? label : undefined}
                title={collapsed ? (badge ? `${label} (${badge} pending)` : label) : undefined}
                onClick={() => go(path)}
              >
                <span className="nav-icon">
                  <Icon weight={on ? 'fill' : 'regular'} />
                  {badge > 0 && <span className="badge-dot" aria-hidden="true">{badge}</span>}
                </span>
                <span className="grow nav-text">{label}</span>
                {badge > 0 && <span className="badge" aria-label={`${badge} pending approvals`}>{badge}</span>}
              </button>
            );
          })}
        </nav>
        {viewer && (
          <div className="me-card">
            <div className="row gap-10" title={collapsed ? fullName(viewer) : undefined}>
              <Avatar emp={viewer} />
              <div className="grow me-text">
                <div className="me-name ellipsis">{fullName(viewer)}</div>
                <div className="sub">
                  {ROLE_L[viewer.role]} · {dept?.name || 'Unassigned'}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              aria-label="My profile"
              title={collapsed ? 'My profile' : undefined}
              onClick={() => go(`/employees/${viewer.id}`)}
            >
              <UserCircleIcon />
              <span className="me-text">My profile</span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

function Search() {
  const { core, go } = useApp();
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (e.key === '/' && !['input', 'textarea', 'select'].includes(tag)) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const term = q.trim().toLowerCase();
  const results = term
    ? core.employees
        .filter((e) => fullName(e).toLowerCase().includes(term) || e.email.toLowerCase().includes(term))
        .slice(0, 6)
    : [];
  const open = (e) => {
    setQ('');
    setFocus(false);
    ref.current?.blur();
    go(`/employees/${e.id}`);
  };

  return (
    <div className="search">
      <MagnifyingGlassIcon />
      <input
        ref={ref}
        className="input"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setFocus(true);
        }}
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) open(results[0]);
          if (e.key === 'Escape') {
            setQ('');
            e.target.blur();
          }
        }}
        placeholder="Search people by name or email"
        aria-label="Search employees"
      />
      <span className="kbd" aria-hidden="true">/</span>
      {focus && term && (
        <div role="listbox" className="popover">
          {results.map((e) => (
            <button key={e.id} type="button" role="option" aria-selected="false" className="option" onMouseDown={() => open(e)}>
              <Avatar emp={e} size="sm" />
              <span className="grow">
                <span className="option-title">{fullName(e)}</span>
                <span className="sub ellipsis block">
                  {e.email} · {e.department_name || 'Unassigned'}
                </span>
              </span>
              <ArrowRightIcon className="faint" />
            </button>
          ))}
          {!results.length && (
            <div className="popover-empty">
              <UserFocusIcon />
              No one matches "{q.trim()}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ViewerMenu() {
  const { viewer, viewerOptions, chooseViewer, route, go, toast } = useApp();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  if (!viewer) return null;
  const pick = (e) => {
    setOpen(false);
    chooseViewer(e.id);
    if (route.page === 'profile') go('/');
    else if (route.page === 'leave' && route.tab) go('/leave');
    toast(`Now viewing as ${fullName(e)} (${ROLE_L[e.role]})`, 'info');
  };
  return (
    <div className="viewer">
      <button
        type="button"
        className="viewer-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Viewing as ${fullName(viewer)}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar emp={viewer} size="sm" />
        <span className="viewer-text">
          <span className="k">Viewing as</span>
          <span className="v">
            {fullName(viewer)} <span className="muted fw-6">· {ROLE_L[viewer.role]}</span>
          </span>
        </span>
        <CaretDownIcon className="muted" />
      </button>
      {open && (
        <>
          <div className="menu-scrim" onClick={() => setOpen(false)} />
          <div role="menu" className="popover">
            <div className="menu-hint">Switch who you're viewing as. Approvals show for admins and managers.</div>
            {viewerOptions.map((e) => (
              <button
                key={e.id}
                type="button"
                role="menuitemradio"
                aria-checked={e.id === viewer.id}
                className={`option ${e.id === viewer.id ? 'selected' : ''}`}
                onClick={() => pick(e)}
              >
                <Avatar emp={e} size="ms" />
                <span className="grow">
                  <span className="option-title">{fullName(e)}</span>
                  <span className="sub block">{e.designation}</span>
                </span>
                <span className={`role-tag tone-${ROLE_TONE[e.role]}`}>{ROLE_L[e.role]}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function Topbar({ crumb, title }) {
  const { theme, toggleTheme, setDrawer } = useApp();
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button type="button" className="icon-btn menu-btn" aria-label="Open menu" onClick={() => setDrawer(true)}>
          <ListIcon />
        </button>
        <div className="grow">
          <div className="crumb ellipsis">{crumb}</div>
          <h1 className="page-title ellipsis">{title}</h1>
        </div>
        <Search />
        <ViewerMenu />
        <button type="button" className="icon-btn" aria-label={label} title={label} onClick={toggleTheme}>
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>
    </header>
  );
}

const TOAST_KINDS = {
  ok: ['ok', CheckCircleIcon],
  info: ['info', InfoIcon],
  warn: ['warn', WarningIcon],
  bad: ['bad', XCircleIcon],
};

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    <div aria-live="polite" className="toasts">
      {toasts.map((t) => {
        const [tone, Icon] = TOAST_KINDS[t.kind] || TOAST_KINDS.ok;
        return (
          <div key={t.id} role="status" className="toast">
            <span className={`icon tone-${tone}`}><Icon weight="fill" /></span>
            <span className="msg">{t.msg}</span>
            <button type="button" className="x" aria-label="Dismiss" onClick={() => dismissToast(t.id)}>
              <XIcon />
            </button>
          </div>
        );
      })}
    </div>
  );
}
