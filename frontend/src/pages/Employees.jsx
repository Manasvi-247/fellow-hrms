import { useState } from 'react';
import {
  CalendarBlankIcon,
  CaretDownIcon,
  CaretUpDownIcon,
  CaretUpIcon,
  EnvelopeSimpleIcon,
  FunnelXIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  RowsIcon,
  SquaresFourIcon,
  UsersThreeIcon,
} from '@phosphor-icons/react';
import * as api from '../api.js';
import { useApp } from '../state.jsx';
import { useDebounced, useLoad, useViewport } from '../lib/hooks.js';
import { fmt, tenure } from '../lib/dates.js';
import { avatarTone, fullName } from '../lib/ui.js';
import { Avatar, DashedEmpty, EmployeeStatus, EmptyState, ErrorState, Seg, Skeleton } from '../components/common.jsx';

const NO_FILTERS = { q: '', dept: '', status: '', role: '', sort: 'name' };
const SORTS = {
  name: (a, b) => fullName(a).localeCompare(fullName(b)),
  name_desc: (a, b) => fullName(b).localeCompare(fullName(a)),
  join: (a, b) => (a.date_of_joining < b.date_of_joining ? 1 : -1),
  join_asc: (a, b) => (a.date_of_joining < b.date_of_joining ? -1 : 1),
};

function SortHead({ label, k, sort, onSort }) {
  const alt = k === 'name' ? 'name_desc' : 'join_asc';
  const on = sort === k || sort === alt;
  const Icon = !on ? CaretUpDownIcon : sort === alt ? CaretUpIcon : CaretDownIcon;
  return (
    <button type="button" className={`sort ${on ? 'on' : ''}`} onClick={() => onSort(sort === k ? alt : k)}>
      {label}
      <Icon weight={on ? 'bold' : 'regular'} />
    </button>
  );
}

export default function Employees() {
  const { core, isAdmin, version, go, openModal } = useApp();
  const { isMobile } = useViewport();
  const [f, setF] = useState(NO_FILTERS);
  const [view, setView] = useState('table');
  const q = useDebounced(f.q.trim(), 200);
  const list = useLoad(
    () => api.listEmployees({ q, department_id: f.dept, status: f.status, role: f.role }),
    [q, f.dept, f.status, f.role, version],
  );
  const setField = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const shown = isMobile ? 'grid' : view;

  if (list.error) return <ErrorState error={list.error} what="the employee directory" onRetry={list.reload} />;
  if (core.status === 'ready' && !core.employees.length) {
    return (
      <EmptyState
        Icon={UsersThreeIcon}
        title="No employees yet"
        body="Add people one by one. Each person gets a profile, leave balance and attendance log."
        cta={isAdmin ? 'Add employee' : null}
        onCta={() => openModal('employee')}
      />
    );
  }
  const rows = [...(list.data || [])].sort(SORTS[f.sort] || SORTS.name);
  const open = (e) => go(`/employees/${e.id}`);

  return (
    <div className="page page-tight">
      <div className="toolbar">
        <p className="fs-14 muted">
          {list.data ? `Showing ${rows.length} of ${core.employees.length} people` : 'Loading people...'}
        </p>
        <div className="toolbar-actions">
          {!isMobile && (
            <Seg
              compact
              label="View"
              value={view}
              onChange={setView}
              items={[
                { id: 'table', label: 'Table', Icon: RowsIcon },
                { id: 'grid', label: 'Cards', Icon: SquaresFourIcon },
              ]}
            />
          )}
          {isAdmin && (
            <button type="button" className="btn btn-primary" onClick={() => openModal('employee')}>
              <PlusIcon weight="bold" />
              Add employee
            </button>
          )}
        </div>
      </div>

      <div className="filters emp">
        <div className="search-span input-icon">
          <MagnifyingGlassIcon />
          <input className="input" value={f.q} onChange={setField('q')} placeholder="Name, email or employee code" aria-label="Filter employees" />
        </div>
        <select className="select" value={f.dept} onChange={setField('dept')} aria-label="Department">
          <option value="">All departments</option>
          {core.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className="select" value={f.status} onChange={setField('status')} aria-label="Status">
          <option value="">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="ON_LEAVE">On leave</option>
          <option value="EXITED">Exited</option>
        </select>
        <select className="select" value={f.role} onChange={setField('role')} aria-label="Role">
          <option value="">Any role</option>
          <option value="ADMIN">Admin</option>
          <option value="MANAGER">Manager</option>
          <option value="EMPLOYEE">Employee</option>
        </select>
        <select className="select" value={f.sort} onChange={setField('sort')} aria-label="Sort">
          <option value="name">Name A to Z</option>
          <option value="name_desc">Name Z to A</option>
          <option value="join">Newest joiners</option>
          <option value="join_asc">Longest tenure</option>
        </select>
      </div>

      {!list.data && <Skeleton variant="list" />}

      {list.data && rows.length > 0 && shown === 'table' && (
        <div className="table-card">
          <div role="table" aria-label="Employees">
            <div role="row" className="thead cols-emp">
              <SortHead label="Employee" k="name" sort={f.sort} onSort={(sort) => setF((x) => ({ ...x, sort }))} />
              <span>Code</span>
              <span>Designation</span>
              <span>Department</span>
              <span>Manager</span>
              <SortHead label="Joined" k="join" sort={f.sort} onSort={(sort) => setF((x) => ({ ...x, sort }))} />
              <span>Status</span>
            </div>
            {rows.map((e) => (
              <button key={e.id} type="button" role="row" className="trow cols-emp" onClick={() => open(e)}>
                <span className="row gap-12 grow">
                  <Avatar emp={e} />
                  <span className="grow">
                    <span className="person-name">{fullName(e)}</span>
                    <span className="sub ellipsis block">{e.email}</span>
                  </span>
                </span>
                <span className="cell-code">{e.employee_code}</span>
                <span className="ellipsis">{e.designation}</span>
                <span className="ellipsis">{e.department_name || 'Unassigned'}</span>
                <span className="ellipsis muted">{e.manager_name || 'None'}</span>
                <span className="muted fs-13">{fmt(e.date_of_joining)}</span>
                <span><EmployeeStatus status={e.status} /></span>
              </button>
            ))}
          </div>
        </div>
      )}

      {list.data && rows.length > 0 && shown === 'grid' && (
        <div className="emp-cards">
          {rows.map((e) => (
            <button key={e.id} type="button" className="emp-card hover-lift" onClick={() => open(e)}>
              <span className={`band av-${avatarTone(e.id)}`} aria-hidden="true" />
              <span className="top">
                <Avatar emp={e} size="card" />
                <EmployeeStatus status={e.status} />
              </span>
              <span>
                <span className="name">{fullName(e)}</span>
                <span className="fs-13 muted block mt-2">{e.designation}</span>
              </span>
              <span className="tags">
                <span className="pill-tag">{e.department_name || 'Unassigned'}</span>
                <span className="mono-tag">{e.employee_code}</span>
              </span>
              <span className="meta">
                <span>
                  <EnvelopeSimpleIcon />
                  <span className="ellipsis">{e.email}</span>
                </span>
                <span>
                  <CalendarBlankIcon />
                  Joined {fmt(e.date_of_joining)} · {tenure(e.date_of_joining)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {list.data && !rows.length && (
        <DashedEmpty
          Icon={FunnelXIcon}
          title="No one matches these filters"
          body="Try a different name, or widen the department and status filters."
          action={
            <button type="button" className="btn btn-secondary btn-sm mt-4" onClick={() => setF(NO_FILTERS)}>
              Clear filters
            </button>
          }
        />
      )}
    </div>
  );
}
