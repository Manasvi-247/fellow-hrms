import { useState } from 'react';
import {
  CalendarBlankIcon,
  CheckCircleIcon,
  CheckIcon,
  CheckSquareOffsetIcon,
  FunnelXIcon,
  IslandIcon,
  ListChecksIcon,
  PlusIcon,
  UserIcon,
  XIcon,
} from '@phosphor-icons/react';
import { Navigate, useParams } from 'react-router-dom';
import * as api from '../api.js';
import { useApp } from '../state.jsx';
import { useLoad, useViewport } from '../lib/hooks.js';
import { dateOf, daysLabel, fmtS, plural } from '../lib/dates.js';
import { chipFor, leaveStyle } from '../lib/ui.js';
import { Avatar, BalanceCard, Chip, DashedEmpty, ErrorState, PersonCell, Seg, Skeleton } from '../components/common.jsx';
import { approveWithToast, leaveDates } from './Dashboard.jsx';
import { LeaveLine, leaveNote } from './Profile.jsx';

const NO_FILTERS = { status: '', type: '', dept: '', from: '', to: '' };

function MyLeave() {
  const { core, viewer, byId, version, run } = useApp();
  const balances = useLoad(() => api.getLeaveBalance(viewer.id), [viewer.id, version]);
  const mine = useLoad(() => api.listLeaves({ employee_id: viewer.id }), [viewer.id, version]);
  if (mine.error || balances.error) {
    const err = mine.error || balances.error;
    return <ErrorState error={err} what="your leave" onRetry={() => (mine.reload(), balances.reload())} />;
  }
  if (!mine.data || !balances.data) return <Skeleton variant="list" />;
  const list = [...mine.data].sort((a, b) => (a.from_date < b.from_date ? 1 : -1));
  const cancel = (l) => run(() => api.cancelLeave(l.id), 'Leave request cancelled', 'info');
  return (
    <div className="stack gap-20 fade-in">
      <div className="grid-auto g-220">
        {balances.data.map((b) => (
          <BalanceCard key={b.leave_type_id} b={b} type={core.leaveTypes.find((t) => t.id === b.leave_type_id)} />
        ))}
      </div>
      <section className="card flush">
        <h3 className="list-title">My requests</h3>
        {list.map((l) => <LeaveLine key={l.id} l={l} byId={byId} types={core.leaveTypes} onCancel={cancel} />)}
        {!list.length && (
          <div className="list-empty center">
            <IslandIcon />
            You haven't requested any leave yet.
          </div>
        )}
      </section>
    </div>
  );
}

function Approvals() {
  const { core, pendingFor, byId, viewer, run, openModal, go } = useApp();
  const list = [...pendingFor].sort((a, b) => (a.applied_at < b.applied_at ? -1 : 1));
  return (
    <div className="appr-grid fade-in">
      {list.map((l) => {
        const style = leaveStyle(core.leaveTypes.find((t) => t.id === l.leave_type_id));
        return (
          <article key={l.id} className="appr-card">
            <div className="row gap-12">
              <Avatar emp={byId.get(l.employee_id)} size="lg" onClick={() => go(`/employees/${l.employee_id}`)} label={`Open ${l.employee_name}`} />
              <div className="grow">
                <div className="fs-14 fw-8">{l.employee_name}</div>
                <div className="sub">{l.department_name || 'Unassigned'} · Applied {fmtS(dateOf(l.applied_at))}</div>
              </div>
              <span className="chip chip-lg" style={{ background: style.soft, color: style.ink }}>
                <span className="dot" style={{ background: style.color }} />
                {l.leave_type_name}
              </span>
            </div>
            <div className="appr-dates">
              <span className="title-sm row gap-8"><CalendarBlankIcon className="muted" />{leaveDates(l)}</span>
              <span className="fs-14 fw-8">{daysLabel(l.days, l.half_day)}</span>
            </div>
            {l.reason && <p className="appr-reason">"{l.reason}"</p>}
            <div className="row gap-8">
              <button type="button" className="btn btn-primary btn-flex btn-md" onClick={() => approveWithToast(run, l, viewer)}>
                <CheckIcon weight="bold" />
                Approve
              </button>
              <button type="button" className="btn btn-ghost-bad btn-flex btn-md" onClick={() => openModal('reject', { leave: l })}>
                <XIcon weight="bold" />
                Reject
              </button>
            </div>
          </article>
        );
      })}
      {!list.length && (
        <DashedEmpty
          span
          Icon={CheckCircleIcon}
          tone="ok"
          title="All caught up"
          body="No leave requests are waiting for your review."
        />
      )}
    </div>
  );
}

function AllRequests() {
  const { core, byId, version, go } = useApp();
  const { isMobile } = useViewport();
  const [f, setF] = useState(NO_FILTERS);
  const all = useLoad(
    () => api.listLeaves({ status: f.status, leave_type_id: f.type, department_id: f.dept, from: f.from, to: f.to }),
    [f.status, f.type, f.dept, f.from, f.to, version],
  );
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const filtered = Object.values(f).some(Boolean);
  const typeOf = (l) => core.leaveTypes.find((t) => t.id === l.leave_type_id);
  return (
    <div className="stack gap-16 fade-in">
      <div className="filters leaves">
        <label className="field fs-12 muted">
          Status
          <select className="select" value={f.status} onChange={set('status')}>
            <option value="">Any status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </label>
        <label className="field fs-12 muted">
          Leave type
          <select className="select" value={f.type} onChange={set('type')}>
            <option value="">All types</option>
            {core.leaveTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label className="field fs-12 muted">
          Department
          <select className="select" value={f.dept} onChange={set('dept')}>
            <option value="">All departments</option>
            {core.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label className="field fs-12 muted">
          From
          <input type="date" className="input" value={f.from} onChange={set('from')} />
        </label>
        <label className="field fs-12 muted">
          To
          <input type="date" className="input" value={f.to} min={f.from || undefined} onChange={set('to')} />
        </label>
        <button type="button" className="btn btn-secondary btn-sm fs-13 h-42" onClick={() => setF(NO_FILTERS)}>
          Reset
        </button>
      </div>
      {all.error && <ErrorState error={all.error} what="leave requests" onRetry={all.reload} />}
      {!all.error && !all.data && <Skeleton variant="list" />}
      {all.data && (
        <>
          <div className="fs-13 muted">
            {plural(all.data.length, 'request')}{filtered ? ' match these filters' : ''}
          </div>
          {all.data.length > 0 && !isMobile && (
            <div className="table-card">
              <div role="table" aria-label="All leave requests">
                <div role="row" className="thead cols-leave">
                  <span>Employee</span><span>Type</span><span>Dates</span><span>Days</span><span>Applied</span><span>Status</span><span>Decided by</span>
                </div>
                {all.data.map((l) => (
                  <div key={l.id} role="row" className="trow cols-leave">
                    <PersonCell emp={byId.get(l.employee_id)} name={l.employee_name} sub={l.department_name} onOpen={() => go(`/employees/${l.employee_id}`)} />
                    <span className="row gap-6"><span className="dot" style={{ background: leaveStyle(typeOf(l)).color }} />{l.leave_type_name}</span>
                    <span>{leaveDates(l)}</span>
                    <span className="fw-7">{l.half_day ? 0.5 : l.days}</span>
                    <span className="muted fs-13">{fmtS(dateOf(l.applied_at))}</span>
                    <span><Chip chip={chipFor(l.status)} /></span>
                    <span className="muted fs-13">{leaveNote(l, byId)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {all.data.length > 0 && isMobile && (
            <div className="stack gap-10">
              {all.data.map((l) => (
                <div key={l.id} className="mobile-card">
                  <div className="row gap-10">
                    <Avatar emp={byId.get(l.employee_id)} size="ms" />
                    <span className="grow title-sm">{l.employee_name}</span>
                    <Chip chip={chipFor(l.status)} />
                  </div>
                  <div className="fs-13 muted">{l.leave_type_name} · {leaveDates(l)} · {daysLabel(l.days, l.half_day)}</div>
                </div>
              ))}
            </div>
          )}
          {!all.data.length && (
            <DashedEmpty Icon={FunnelXIcon} title="No requests match these filters" body="Try a wider date range or another status." />
          )}
        </>
      )}
    </div>
  );
}

export default function Leave() {
  const { go, canApprove, isAdmin, pendingFor, openModal } = useApp();
  const { tab: param } = useParams();
  if (param && (!['approvals', 'all'].includes(param) || (param === 'approvals' && !canApprove) || (param === 'all' && !isAdmin))) {
    return <Navigate to="/leave" replace />;
  }
  const tab = param || 'mine';
  const tabs = [
    { id: 'mine', label: 'My leave', Icon: UserIcon },
    canApprove && { id: 'approvals', label: 'Approvals', Icon: CheckSquareOffsetIcon, badge: pendingFor.length },
    isAdmin && { id: 'all', label: 'All requests', Icon: ListChecksIcon },
  ].filter(Boolean);
  return (
    <div className="page page-tight">
      <div className="toolbar">
        <Seg label="Leave sections" items={tabs} value={tab} onChange={(t) => go(t === 'mine' ? '/leave' : `/leave/${t}`)} />
        <button type="button" className="btn btn-primary" onClick={() => openModal('apply')}>
          <PlusIcon weight="bold" />
          Apply leave
        </button>
      </div>
      {tab === 'mine' && <MyLeave />}
      {tab === 'approvals' && <Approvals />}
      {tab === 'all' && <AllRequests />}
    </div>
  );
}
