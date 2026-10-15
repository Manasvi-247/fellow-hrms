import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as api from './api.js';
import { todayISO } from './lib/dates.js';
import { VIEWER_PRESETS } from './lib/ui.js';

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

const PAGES = ['dashboard', 'employees', 'departments', 'leave', 'attendance', 'holidays'];

function parseHash() {
  const [page = 'dashboard', a, b] = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (page === 'employees' && a) return { page: 'profile', id: Number(a), tab: b || 'overview' };
  return { page: PAGES.includes(page) ? page : 'dashboard', tab: a || null };
}

function readStore(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage may be unavailable in private windows */
  }
}

export function initialTheme() {
  const saved = readStore('fellow-theme', null);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const EMPTY_CORE = { employees: [], departments: [], leaveTypes: [], holidays: [], pending: [] };

export function AppProvider({ children }) {
  const [route, setRoute] = useState(parseHash);
  const [theme, setTheme] = useState(initialTheme);
  const [core, setCore] = useState({ status: 'loading', error: null, ...EMPTY_CORE });
  const [version, setVersion] = useState(0);
  const [viewerId, setViewerId] = useState(() => Number(readStore('fellow-viewer', '1')) || 1);
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(() => readStore('fellow-sidebar', '0') === '1');
  const coreSeq = useRef(0);

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash());
      setDrawer(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    writeStore('fellow-sidebar', collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    writeStore('fellow-theme', theme);
  }, [theme]);

  const toast = useCallback((msg, kind = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list, { id, msg, kind }].slice(-3));
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4200);
  }, []);
  const dismissToast = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const loadCore = useCallback(async (silent) => {
    const id = ++coreSeq.current;
    if (!silent) setCore((c) => ({ ...c, status: 'loading', error: null }));
    try {
      const year = Number(todayISO().slice(0, 4));
      const [employees, departments, leaveTypes, holidays, nextYear, pending] = await Promise.all([
        api.listEmployees(),
        api.listDepartments(),
        api.listLeaveTypes(),
        api.listHolidays(year),
        api.listHolidays(year + 1),
        api.listLeaves({ status: 'PENDING' }),
      ]);
      if (id !== coreSeq.current) return;
      setCore({
        status: 'ready', error: null, employees, departments, leaveTypes,
        holidays, upcomingHolidays: [...holidays, ...nextYear], pending,
      });
    } catch (error) {
      if (id !== coreSeq.current) return;
      if (silent) setCore((c) => (c.status === 'ready' ? c : { ...c, status: 'error', error }));
      else setCore((c) => ({ ...c, status: 'error', error }));
    }
  }, []);

  useEffect(() => {
    loadCore(false);
  }, [loadCore]);

  const refresh = useCallback(() => {
    setVersion((v) => v + 1);
    loadCore(true);
  }, [loadCore]);

  const run = useCallback(
    async (fn, success, kind = 'ok') => {
      try {
        const data = await fn();
        if (success) toast(typeof success === 'function' ? success(data) : success, kind);
        refresh();
        return { ok: true, data };
      } catch (error) {
        toast(error.message, 'bad');
        return { ok: false, error };
      }
    },
    [toast, refresh],
  );

  const go = useCallback((path) => {
    const next = `#${path}`;
    if (window.location.hash === next) {
      setDrawer(false);
      window.scrollTo(0, 0);
    } else window.location.hash = next;
  }, []);

  const derived = useMemo(() => {
    const { employees, pending } = core;
    const byId = new Map(employees.map((e) => [e.id, e]));
    const live = employees.filter((e) => e.status !== 'EXITED');
    const viewer =
      byId.get(viewerId) && byId.get(viewerId).status !== 'EXITED'
        ? byId.get(viewerId)
        : live.find((e) => e.role === 'ADMIN') || live[0] || null;
    const isAdmin = viewer?.role === 'ADMIN';
    const isManager = viewer?.role === 'MANAGER';
    const canApprove = isAdmin || isManager;
    const pendingFor = viewer
      ? pending.filter(
          (l) =>
            l.employee_id !== viewer.id &&
            (isAdmin || (isManager && byId.get(l.employee_id)?.manager_id === viewer.id)),
        )
      : [];
    let viewerOptions = VIEWER_PRESETS.map((id) => byId.get(id)).filter((e) => e && e.status !== 'EXITED');
    if (viewerOptions.length < 3) {
      const pick = (role, n) => live.filter((e) => e.role === role).slice(0, n);
      viewerOptions = [...pick('ADMIN', 1), ...pick('MANAGER', 2), ...pick('EMPLOYEE', 2)];
    }
    if (viewer && !viewerOptions.some((e) => e.id === viewer.id)) viewerOptions = [viewer, ...viewerOptions];
    return { byId, live, viewer, isAdmin, isManager, canApprove, pendingFor, viewerOptions };
  }, [core, viewerId]);

  const chooseViewer = useCallback((id) => {
    setViewerId(id);
    writeStore('fellow-viewer', String(id));
  }, []);

  const value = {
    route, go, theme, toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    core, loadCore, version, refresh, run, toast, toasts, dismissToast,
    modal, openModal: (type, props = {}) => setModal({ type, props }), closeModal: () => setModal(null),
    drawer, setDrawer, collapsed, toggleCollapsed: () => setCollapsed((c) => !c), chooseViewer, ...derived,
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
