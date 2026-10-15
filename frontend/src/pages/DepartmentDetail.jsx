import { ArrowLeftIcon, BuildingsIcon, PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import { useParams } from 'react-router-dom';
import * as api from '../api.js';
import { useApp } from '../state.jsx';
import { useLoad } from '../lib/hooks.js';
import { plural } from '../lib/dates.js';
import { deptIcon, fullName } from '../lib/ui.js';
import { Avatar, EmployeeStatus, EmptyState, ErrorState, Skeleton } from '../components/common.jsx';

export default function DepartmentDetail() {
  const { go, isAdmin, version, openModal } = useApp();
  const id = Number(useParams().id);
  const dept = useLoad(() => api.getDepartment(id), [id, version]);
  const members = useLoad(() => api.listEmployees({ department_id: id }), [id, version]);

  if (dept.error?.status === 404 || !Number.isInteger(id)) {
    return (
      <EmptyState
        Icon={BuildingsIcon}
        title="Department not found"
        body="It may have been deleted or renamed."
        cta="All departments"
        CtaIcon={ArrowLeftIcon}
        onCta={() => go('/departments')}
      />
    );
  }
  const error = dept.error || members.error;
  if (error) return <ErrorState error={error} what="this department" onRetry={() => (dept.reload(), members.reload())} />;
  if (!dept.data || !members.data) return <Skeleton variant="list" />;

  const d = dept.data;
  const Icon = deptIcon(d.code);
  const rank = (e) => (e.id === d.head_id ? 0 : e.status === 'EXITED' ? 2 : 1);
  const list = [...members.data].sort((a, b) => rank(a) - rank(b) || fullName(a).localeCompare(fullName(b)));

  return (
    <div className="page page-tight">
      <button type="button" className="back-link" onClick={() => go('/departments')}>
        <ArrowLeftIcon />
        All departments
      </button>
      <section className="card stack gap-16">
        <div className="row gap-12 start">
          <span className="icon-tile dept tone-teal"><Icon weight="fill" /></span>
          <div className="grow">
            <div className="dept-name">{d.name}</div>
            <span className="cell-code fs-12">{d.code} · {plural(d.headcount, 'person', 'people')}</span>
          </div>
          {isAdmin && (
            <div className="row gap-8 wrap">
              <button type="button" className="btn btn-secondary btn-md" onClick={() => openModal('department', { department: d })}>
                <PencilSimpleIcon />
                Edit
              </button>
              <button type="button" className="btn btn-md btn-danger-soft" onClick={() => openModal('deleteDepartment', { department: d })}>
                <TrashIcon />
                Delete
              </button>
            </div>
          )}
        </div>
        <p className="dept-desc">{d.description || 'No description yet.'}</p>
        <div className="dept-head">
          <span className="label-sm">Head of department</span>
          <span className="title-sm">{d.head_name || 'Not assigned'}</span>
        </div>
      </section>
      <section className="card flush">
        <h3 className="list-title">Members</h3>
        <div className="rows members-list">
          {list.map((e) => (
            <button key={e.id} type="button" className="person-row" onClick={() => go(`/employees/${e.id}`)}>
              <Avatar emp={e} />
              <span className="grow">
                <span className="row gap-6 title-sm">
                  {fullName(e)}
                  {e.id === d.head_id && <span className="head-tag tone-lilac">Head</span>}
                </span>
                <span className="sub block">{e.designation}</span>
              </span>
              <EmployeeStatus status={e.status} />
            </button>
          ))}
          {!list.length && <div className="mini-empty fs-14">No one in this department yet.</div>}
        </div>
      </section>
    </div>
  );
}
