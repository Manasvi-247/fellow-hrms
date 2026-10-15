import { ArrowRightIcon, BuildingsIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import * as api from '../api.js';
import { useApp } from '../state.jsx';
import { useLoad } from '../lib/hooks.js';
import { plural } from '../lib/dates.js';
import { TONES4, deptIcon, fullName } from '../lib/ui.js';
import { Avatar, EmptyState, ErrorState, Skeleton } from '../components/common.jsx';

export default function Departments() {
  const { core, live, byId, isAdmin, version, openModal, go } = useApp();
  const depts = useLoad(api.listDepartments, [version]);

  if (depts.error) return <ErrorState error={depts.error} what="departments" onRetry={depts.reload} />;
  if (!depts.data) return <Skeleton variant="list" />;
  if (!depts.data.length) {
    return (
      <EmptyState
        Icon={BuildingsIcon}
        title="No departments yet"
        body="Create departments to group people and assign a head for each team."
        cta={isAdmin ? 'Add department' : null}
        onCta={() => openModal('department')}
      />
    );
  }

  const openMembers = (d) => go(`/departments/${d.id}`);
  return (
    <div className="page page-tight">
      <div className="toolbar">
        <p className="fs-14 muted">
          {plural(depts.data.length, 'department')} · {plural(live.length, 'person', 'people')}
        </p>
        {isAdmin && (
          <button type="button" className="btn btn-primary" onClick={() => openModal('department')}>
            <PlusIcon weight="bold" />
            Add department
          </button>
        )}
      </div>
      <div className="dept-grid">
        {depts.data.map((d, i) => {
          const Icon = deptIcon(d.code);
          const members = core.employees.filter((e) => e.department_id === d.id && e.status !== 'EXITED');
          const head = byId.get(d.head_id);
          const stop = (fn) => (e) => {
            e.stopPropagation();
            fn();
          };
          return (
            <div
              key={d.id}
              role="button"
              tabIndex={0}
              className="dept-card hover-lift"
              aria-label={`View members of ${d.name}`}
              onClick={() => openMembers(d)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openMembers(d))}
            >
              <div className="row gap-12 start">
                <span className={`icon-tile dept tone-${TONES4[i % 4]}`}><Icon weight="fill" /></span>
                <div className="grow">
                  <div className="dept-name">{d.name}</div>
                  <span className="cell-code fs-12">{d.code}</span>
                </div>
                {isAdmin && (
                  <div className="row gap-4">
                    <button
                      type="button"
                      className="icon-btn-sm"
                      aria-label={`Edit ${d.name}`}
                      onClick={stop(() => openModal('department', { department: d }))}
                    >
                      <PencilSimpleIcon />
                    </button>
                    <button
                      type="button"
                      className="icon-btn-sm danger"
                      aria-label={`Delete ${d.name}`}
                      onClick={stop(() => openModal('deleteDepartment', { department: d }))}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                )}
              </div>
              <p className="dept-desc">{d.description || 'No description yet.'}</p>
              <div className="dept-head">
                <Avatar emp={head} size="sm" />
                <span>
                  <span className="label-sm block">Head of department</span>
                  <span className="title-sm block">{head ? fullName(head) : d.head_name || 'Not assigned'}</span>
                </span>
              </div>
              <div className="dept-foot">
                <div className="faces">
                  {members.slice(0, 5).map((e) => <Avatar key={e.id} emp={e} size="xs" label={fullName(e)} />)}
                  {members.length > 5 && <span className="avatar xs more">+{members.length - 5}</span>}
                </div>
                <span className="fs-13 fw-7 row gap-6">
                  {plural(d.headcount, 'person', 'people')}
                  <ArrowRightIcon className="muted" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
