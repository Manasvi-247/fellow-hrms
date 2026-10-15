import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  BriefcaseIcon,
  BuildingsIcon,
  CakeIcon,
  CalendarBlankIcon,
  CalendarCheckIcon,
  ClockIcon,
  CurrencyInrIcon,
  EnvelopeSimpleIcon,
  GenderIntersexIcon,
  IdentificationCardIcon,
  MapPinIcon,
  PencilSimpleIcon,
  PhoneIcon,
  ShieldCheckIcon,
  SignOutIcon,
  TrashIcon,
  TreeStructureIcon,
  UserCircleIcon,
  UserFocusIcon,
} from '@phosphor-icons/react';
import { Navigate, useParams } from 'react-router-dom';
import * as api from '../api.js';
import { useApp } from '../state.jsx';
import { useLoad, useViewport } from '../lib/hooks.js';
import { daysLabel, fmt, inr, monthLabel, plural, tenure, todayISO } from '../lib/dates.js';
import { ET_L, G_L, ROLE_L, ROLE_TONE, chipFor, fullName, leaveStyle } from '../lib/ui.js';
import { Avatar, BalanceCard, Chip, EmployeeStatus, EmptyState, ErrorState, Seg, Skeleton } from '../components/common.jsx';
import { MonthCalendar, StatTiles, monthCells } from '../components/attendance.jsx';
import { leaveDates } from './Dashboard.jsx';

const TABS = [
  { id: 'overview', label: 'Overview', Icon: IdentificationCardIcon },
  { id: 'leave', label: 'Leave', Icon: CalendarCheckIcon },
  { id: 'attendance', label: 'Attendance', Icon: ClockIcon },
  { id: 'team', label: 'Team', Icon: TreeStructureIcon },
];

export function leaveNote(l, byId) {
  if (l.status === 'APPROVED') return `Approved by ${l.approver_name || 'Admin'}`;
  if (l.status === 'REJECTED') return `Rejected by ${l.approver_name || 'Admin'}`;
  if (l.status === 'CANCELLED') return 'Cancelled by employee';
  const mgr = byId.get(byId.get(l.employee_id)?.manager_id);
  return `Waiting on ${mgr ? fullName(mgr) : 'an admin'}`;
}

export function LeaveLine({ l, byId, types, onCancel }) {
  const type = types.find((t) => t.id === l.leave_type_id);
  return (
    <div className="leave-line">
      <span className="main-part">
        <span className="dot dot-lg" style={{ background: leaveStyle(type).color }} />
        <span className="grow">
          <span className="person-name">{l.leave_type_name} · {daysLabel(l.days, l.half_day)}</span>
          <span className="sub block">{leaveDates(l)}{l.reason ? ` · ${l.reason}` : ''}</span>
        </span>
      </span>
      <span className="note">
        {leaveNote(l, byId)}
        {l.approver_comment && <em>"{l.approver_comment}"</em>}
      </span>
      <Chip chip={chipFor(l.status)} />
      {onCancel && l.status === 'PENDING' && (
        <button type="button" className="btn btn-secondary btn-xs" onClick={() => onCancel(l)}>Cancel</button>
      )}
    </div>
  );
}

function KV({ rows }) {
  return rows.map(([k, v, Icon]) => (
    <div key={k} className="kv">
      <Icon />
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  ));
}

export default function Profile() {
  const { go, core, byId, viewer, isAdmin, version, openModal, run } = useApp();
  const { isMobile } = useViewport();
  const params = useParams();
  const id = Number(params.id);
  const validTab = !params.tab || TABS.some((t) => t.id === params.tab);
  const tab = params.tab && validTab ? params.tab : 'overview';
  const month = todayISO().slice(0, 7);
  const emp = useLoad(() => api.getEmployee(id), [id, version]);
  const balances = useLoad(() => (tab === 'leave' ? api.getLeaveBalance(id) : null), [id, tab, version]);
  const history = useLoad(() => (tab === 'leave' ? api.listLeaves({ employee_id: id }) : null), [id, tab, version]);
  const att = useLoad(() => (tab === 'attendance' ? api.getAttendanceMonth(id, month) : null), [id, tab, month, version]);
  const reports = useLoad(() => (tab === 'team' ? api.getDirectReports(id) : null), [id, tab, version]);

  if (!validTab) return <Navigate to={`/employees/${params.id}`} replace />;
  if (!Number.isInteger(id) || emp.error?.status === 404) {
    return (
      <EmptyState
        Icon={UserFocusIcon}
        title="Profile not found"
        body="This person may have been removed from the directory."
        cta="Back to employees"
        CtaIcon={ArrowLeftIcon}
        onCta={() => go('/employees')}
      />
    );
  }
  if (emp.error) return <ErrorState error={emp.error} what="this profile" onRetry={emp.reload} />;
  if (!emp.data || emp.data.id !== id) return <Skeleton />;

  const p = emp.data;
  const mgr = byId.get(p.manager_id);
  const canSalary = isAdmin || viewer.id === p.id;
  const isSelf = viewer.id === p.id;
  const cancel = (l) => run(() => api.cancelLeave(l.id), 'Leave request cancelled', 'info');
  const tabData = { leave: history, attendance: att, team: reports }[tab];

  return (
    <div className="page page-tight">
      <button type="button" className="back-link" onClick={() => go('/employees')}>
        <ArrowLeftIcon />
        All employees
      </button>
      <section className="profile-card">
        <div className="profile-band"><div className="hero-tex" aria-hidden="true" /></div>
        <div className="profile-head">
          <Avatar emp={p} size="hero" />
          <div className="profile-id">
            <h2>{fullName(p)}</h2>
            <div className="fs-14 muted mt-2">{p.designation} · {p.department_name || 'Unassigned'}</div>
            <div className="tags mt-10">
              <EmployeeStatus status={p.status} size="lg" />
              <span className={`chip chip-lg tone-${ROLE_TONE[p.role]}`}>{ROLE_L[p.role]}</span>
              <span className="chip chip-lg chip-plain">{ET_L[p.employment_type]}</span>
            </div>
          </div>
          {isAdmin && (
            <div className="row gap-8 wrap">
              <button type="button" className="btn btn-secondary btn-md" onClick={() => openModal('employee', { employee: p })}>
                <PencilSimpleIcon />
                Edit
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-md"
                disabled={p.status === 'EXITED'}
                onClick={() => openModal('exit', { employee: p })}
              >
                <SignOutIcon />
                Mark as exited
              </button>
              <button type="button" className="btn btn-md btn-danger-soft" onClick={() => openModal('deleteEmployee', { employee: p })}>
                <TrashIcon />
                Delete
              </button>
            </div>
          )}
        </div>
        <div className="profile-facts">
          <div><div className="fact-k">Employee code</div><div className="fact-v mono fw-7">{p.employee_code}</div></div>
          <div className="grow">
            <div className="fact-k">Email</div>
            <a href={`mailto:${p.email}`} className="fact-v ellipsis block">{p.email}</a>
          </div>
          <div><div className="fact-k">Phone</div><div className="fact-v">{p.phone || 'Not added'}</div></div>
          <div>
            <div className="fact-k">Manager</div>
            {mgr ? (
              <button type="button" className="link-btn fact-v fs-14" onClick={() => go(`/employees/${mgr.id}`)}>
                {fullName(mgr)}
                <ArrowUpRightIcon />
              </button>
            ) : (
              <div className="fact-v">None</div>
            )}
          </div>
          <div><div className="fact-k">Joined</div><div className="fact-v">{fmt(p.date_of_joining)}</div></div>
          <div><div className="fact-k">Tenure</div><div className="fact-v">{tenure(p.date_of_joining)}</div></div>
        </div>
      </section>

      <Seg label="Profile sections" items={TABS} value={tab} onChange={(t) => go(t === 'overview' ? `/employees/${id}` : `/employees/${id}/${t}`)} />

      {tab === 'overview' && (
        <div className="grid-auto g-360 fade-in">
          <section className="card">
            <h3 className="card-title mb-8">Personal details</h3>
            <KV
              rows={[
                ['Date of birth', p.date_of_birth ? fmt(p.date_of_birth) : 'Not added', CakeIcon],
                ['Gender', G_L[p.gender] || 'Not specified', GenderIntersexIcon],
                ['Phone', p.phone || 'Not added', PhoneIcon],
                ['Email', p.email, EnvelopeSimpleIcon],
                ['Address', p.address || 'Not added', MapPinIcon],
              ]}
            />
          </section>
          <section className="card">
            <h3 className="card-title mb-8">Job details</h3>
            <KV
              rows={[
                ['Role', ROLE_L[p.role], ShieldCheckIcon],
                ['Department', p.department_name || 'Unassigned', BuildingsIcon],
                ['Manager', p.manager_name || 'None', UserCircleIcon],
                ['Employment type', ET_L[p.employment_type], BriefcaseIcon],
                ['Date of joining', fmt(p.date_of_joining), CalendarBlankIcon],
                ['Annual salary', canSalary ? inr(p.salary) : 'Visible to admins only', CurrencyInrIcon],
              ]}
            />
          </section>
        </div>
      )}

      {tab !== 'overview' && tabData?.error && (
        <ErrorState error={tabData.error} what={`this ${tab} information`} onRetry={tabData.reload} />
      )}
      {tab !== 'overview' && !tabData?.error && !tabData?.data && <Skeleton variant="list" />}

      {tab === 'leave' && history.data && (
        <div className="stack gap-20 fade-in">
          <div className="grid-auto g-220">
            {(balances.data || []).map((b) => (
              <BalanceCard key={b.leave_type_id} b={b} type={core.leaveTypes.find((t) => t.id === b.leave_type_id)} />
            ))}
          </div>
          <section className="card flush">
            <h3 className="list-title">Leave history</h3>
            {history.data.map((l) => (
              <LeaveLine key={l.id} l={l} byId={byId} types={core.leaveTypes} onCancel={isSelf ? cancel : null} />
            ))}
            {!history.data.length && <div className="list-empty">No leave requests yet.</div>}
          </section>
        </div>
      )}

      {tab === 'attendance' && att.data && (
        <AttendanceTab rows={att.data} month={month} holidays={core.upcomingHolidays} joined={p.date_of_joining} compact={isMobile} />
      )}

      {tab === 'team' && reports.data && (
        <div className="grid-auto g-340 fade-in">
          <section className="card">
            <h3 className="card-title mb-16">Reports to</h3>
            {mgr ? (
              <button type="button" className="report-to" onClick={() => go(`/employees/${mgr.id}`)}>
                <Avatar emp={mgr} size="xl" />
                <span className="grow">
                  <span className="block fs-14 fw-8">{fullName(mgr)}</span>
                  <span className="block fs-13 muted">{mgr.designation}</span>
                </span>
                <ArrowRightIcon className="muted" />
              </button>
            ) : (
              <div className="fs-14 muted">Top of the org chart. No manager assigned.</div>
            )}
          </section>
          <section className="card">
            {(() => {
              const list = reports.data.filter((r) => r.status !== 'EXITED');
              return (
                <>
                  <h3 className="card-title mb-16">{plural(list.length, 'direct report')}</h3>
                  <div className="rows">
                    {list.map((r) => (
                      <button key={r.id} type="button" className="person-row" onClick={() => go(`/employees/${r.id}`)}>
                        <Avatar emp={r} />
                        <span className="grow">
                          <span className="person-name">{fullName(r)}</span>
                          <span className="sub block">{r.designation}</span>
                        </span>
                        <EmployeeStatus status={r.status} />
                      </button>
                    ))}
                    {!list.length && <div className="fs-14 muted">No direct reports.</div>}
                  </div>
                </>
              );
            })()}
          </section>
        </div>
      )}
    </div>
  );
}

export function AttendanceTab({ rows, month, holidays, joined, compact, title }) {
  const { cells, tiles } = monthCells({ month, rows, holidays, joined, compact });
  return (
    <div className="stack gap-20 fade-in">
      <StatTiles tiles={tiles} />
      <section className="card">
        <div className="card-head">
          <h3 className="card-title">{title || monthLabel(month)}</h3>
          <span className="fs-12 muted fw-6">Today is outlined</span>
        </div>
        <MonthCalendar cells={cells} />
      </section>
    </div>
  );
}
