import { useState } from 'react';
import {
  CalendarXIcon,
  PaperPlaneTiltIcon,
  SignOutIcon,
  TrashIcon,
  UsersThreeIcon,
  WarningIcon,
  XCircleIcon,
} from '@phosphor-icons/react';
import * as api from '../api.js';
import { useApp } from '../state.jsx';
import { useLoad } from '../lib/hooks.js';
import {
  countWorkingDays,
  daysLabel,
  dowFmtS,
  fmtLong,
  fmtS,
  holidayDates,
  nextWorkingDay,
  plural,
  todayISO,
} from '../lib/dates.js';
import { fullName, leaveStyle } from '../lib/ui.js';
import { ConfirmBody, DialogFoot, DialogHead, Field, Modal } from './Modal.jsx';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const blank = (v) => !String(v ?? '').trim();

function useForm(initial) {
  const [form, setForm] = useState(initial);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const onField = (e) => {
    const t = e.target;
    setForm((f) => ({ ...f, [t.name]: t.type === 'checkbox' ? t.checked : t.value }));
    setErrs((x) => ({ ...x, [t.name]: '' }));
  };
  return { form, setForm, errs, setErrs, busy, setBusy, formError, setFormError, onField };
}

async function submitWith(f, fn) {
  f.setBusy(true);
  f.setFormError('');
  try {
    return { data: await fn() };
  } catch (error) {
    f.setFormError(error.message);
    return { error };
  } finally {
    f.setBusy(false);
  }
}

function FormError({ message }) {
  if (!message) return null;
  return (
    <div role="alert" className="alert tone-bad">
      <WarningIcon weight="fill" />
      {message}
    </div>
  );
}

function Input({ f, name, invalidKey, ...rest }) {
  const key = invalidKey || name;
  return (
    <input
      name={name}
      value={f.form[name] ?? ''}
      onChange={f.onField}
      className={`input ${f.errs[key] ? 'invalid' : ''}`}
      {...rest}
    />
  );
}

function Select({ f, name, children }) {
  return (
    <select name={name} value={f.form[name] ?? ''} onChange={f.onField} className={`select ${f.errs[name] ? 'invalid' : ''}`}>
      {children}
    </select>
  );
}

export function EmployeeForm({ employee }) {
  const { core, live, closeModal, toast, refresh } = useApp();
  const editing = !!employee;
  const f = useForm(
    editing
      ? {
          ...employee,
          department_id: employee.department_id ? String(employee.department_id) : '',
          manager_id: employee.manager_id ? String(employee.manager_id) : '',
          date_of_birth: employee.date_of_birth || '',
          gender: employee.gender || '',
          salary: employee.salary ? String(employee.salary) : '',
        }
      : {
          first_name: '', last_name: '', email: '', phone: '+91 ', designation: '', department_id: '',
          manager_id: '', role: 'EMPLOYEE', employment_type: 'FULL_TIME', date_of_joining: todayISO(),
          date_of_birth: '', gender: '', salary: '', address: '',
        },
  );
  const managers = live.filter((e) => e.id !== employee?.id && e.role !== 'EMPLOYEE');

  const save = async (e) => {
    e.preventDefault();
    const { form } = f;
    const er = {};
    ['first_name', 'last_name', 'designation', 'department_id', 'date_of_joining'].forEach((k) => {
      if (blank(form[k])) er[k] = 'Required';
    });
    if (!EMAIL.test(form.email || '')) er.email = 'Enter a valid email';
    if (form.salary && !(Number(form.salary.replace(/,/g, '')) >= 0)) er.salary = 'Enter a number';
    if (Object.keys(er).length) return f.setErrs(er);
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim() === '+91' ? '' : form.phone.trim(),
      designation: form.designation.trim(),
      department_id: Number(form.department_id),
      manager_id: form.manager_id ? Number(form.manager_id) : null,
      role: form.role,
      employment_type: form.employment_type,
      date_of_joining: form.date_of_joining,
      date_of_birth: form.date_of_birth || null,
      gender: form.gender || null,
      salary: Number(String(form.salary || 0).replace(/,/g, '')) || 0,
      address: form.address.trim(),
    };
    const { data: saved, error } = await submitWith(f, () =>
      editing ? api.updateEmployee(employee.id, payload) : api.createEmployee(payload),
    );
    if (error) {
      if (error.status === 409) f.setErrs({ email: 'Someone already uses this email' });
      return;
    }
    closeModal();
    toast(editing ? `Saved changes to ${fullName(saved)}` : `${fullName(saved)} added to the directory`);
    refresh();
  };

  return (
    <form onSubmit={save} noValidate>
      <DialogHead
        title={editing ? `Edit ${fullName(employee)}` : 'Add employee'}
        sub="Fields marked * are required."
        onClose={closeModal}
      />
      <div className="dialog-body grid-form">
        <Field label="First name *" error={f.errs.first_name}><Input f={f} name="first_name" /></Field>
        <Field label="Last name *" error={f.errs.last_name}><Input f={f} name="last_name" /></Field>
        <Field label="Work email *" error={f.errs.email}>
          <Input f={f} name="email" type="email" placeholder="name@company.com" />
        </Field>
        <Field label="Phone"><Input f={f} name="phone" /></Field>
        <Field label="Designation *" error={f.errs.designation}>
          <Input f={f} name="designation" placeholder="e.g. Product Designer" />
        </Field>
        <Field label="Department *" error={f.errs.department_id}>
          <Select f={f} name="department_id">
            <option value="">Select department</option>
            {core.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>
        <Field label="Manager">
          <Select f={f} name="manager_id">
            <option value="">No manager</option>
            {managers.map((m) => <option key={m.id} value={m.id}>{fullName(m)}</option>)}
          </Select>
        </Field>
        <Field label="Role">
          <Select f={f} name="role">
            <option value="EMPLOYEE">Employee</option>
            <option value="MANAGER">Manager</option>
            <option value="ADMIN">Admin</option>
          </Select>
        </Field>
        <Field label="Employment type">
          <Select f={f} name="employment_type">
            <option value="FULL_TIME">Full time</option>
            <option value="PART_TIME">Part time</option>
            <option value="CONTRACT">Contract</option>
            <option value="INTERN">Intern</option>
          </Select>
        </Field>
        <Field label="Date of joining *" error={f.errs.date_of_joining}>
          <Input f={f} name="date_of_joining" type="date" />
        </Field>
        <Field label="Date of birth"><Input f={f} name="date_of_birth" type="date" max={todayISO()} /></Field>
        <Field label="Gender">
          <Select f={f} name="gender">
            <option value="">Prefer not to say</option>
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>
        <Field label="Annual salary (₹)" error={f.errs.salary}>
          <Input f={f} name="salary" inputMode="numeric" placeholder="1200000" />
        </Field>
        <Field label="Address" span><Input f={f} name="address" placeholder="Area, City" /></Field>
        {f.formError && <div className="span-all"><FormError message={f.formError} /></div>}
      </div>
      <DialogFoot onCancel={closeModal}>
        <button type="submit" className="btn btn-primary" disabled={f.busy}>
          {editing ? 'Save changes' : 'Add employee'}
        </button>
      </DialogFoot>
    </form>
  );
}

export function ApplyLeave() {
  const { core, viewer, closeModal, toast, refresh } = useApp();
  const hset = holidayDates(core.upcomingHolidays);
  const start = nextWorkingDay(todayISO(), hset);
  const f = useForm({ leave_type_id: String(core.leaveTypes[0]?.id || ''), from_date: start, to_date: start, half_day: false, reason: '' });
  const balances = useLoad(() => api.getLeaveBalance(viewer.id), [viewer.id]);
  const { form } = f;
  const type = core.leaveTypes.find((t) => String(t.id) === form.leave_type_id) || core.leaveTypes[0];
  const style = leaveStyle(type);
  const bal = balances.data?.find((b) => b.leave_type_id === type?.id);
  const same = form.from_date && form.from_date === form.to_date;
  const bad = form.from_date && form.to_date && form.to_date < form.from_date;
  const wd = countWorkingDays(form.from_date, form.to_date, hset);
  const days = same && form.half_day ? (wd.days ? 0.5 : 0) : wd.days;
  const available = bal ? Math.max(0, bal.available) : null;
  const after = available == null ? null : available - days;
  const over = !bad && after != null && after < 0;

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (!form.from_date) er.from_date = 'Pick a start date';
    if (!form.to_date) er.to_date = 'Pick an end date';
    else if (bad) er.to_date = 'End date is before start date';
    else if (!days) er.from_date = 'Pick at least one working day';
    if (blank(form.reason)) er.reason = 'Add a short reason';
    if (Object.keys(er).length) return f.setErrs(er);
    const { error } = await submitWith(f, () =>
      api.applyLeave({
        employee_id: viewer.id,
        leave_type_id: Number(form.leave_type_id),
        from_date: form.from_date,
        to_date: form.to_date,
        half_day: !!(same && form.half_day),
        reason: form.reason.trim(),
      }),
    );
    if (error) return;
    closeModal();
    toast('Leave request sent for approval');
    refresh();
  };

  return (
    <form onSubmit={submit} noValidate>
      <DialogHead title="Apply for leave" onClose={closeModal} />
      <div className="dialog-body">
        <Field label="Leave type">
          <Select f={f} name="leave_type_id">
            {core.leaveTypes.map((t) => {
              const b = balances.data?.find((x) => x.leave_type_id === t.id);
              return (
                <option key={t.id} value={t.id}>
                  {t.name}{b ? ` (${Math.max(0, b.available)} left)` : ''}
                </option>
              );
            })}
          </Select>
        </Field>
        <div className="date-pair">
          <Field label="From" error={f.errs.from_date}><Input f={f} name="from_date" type="date" /></Field>
          <Field label="To" error={f.errs.to_date}><Input f={f} name="to_date" type="date" min={form.from_date} /></Field>
        </div>
        <label className={`checkbox-row ${same ? '' : 'disabled'}`}>
          <input type="checkbox" name="half_day" checked={!!form.half_day} disabled={!same} onChange={f.onField} />
          Half day <span className="field-label-muted fs-12">(single day only)</span>
        </label>
        <Field label="Reason" error={f.errs.reason}>
          <textarea
            name="reason"
            rows={3}
            value={form.reason}
            onChange={f.onField}
            placeholder="A short note for your manager"
            className={`textarea ${f.errs.reason ? 'invalid' : ''}`}
          />
        </Field>
        <div className="apply-summary" style={{ background: style.soft }}>
          <div className="row between wrap gap-10 baseline">
            <span className="fs-13 muted fw-7">You're requesting</span>
            <span className="days">{bad ? '--' : daysLabel(days, days === 0.5)}</span>
          </div>
          <div className="sub">
            {wd.skipped
              ? `${wd.skipped} weekend or holiday ${wd.skipped === 1 ? 'day' : 'days'} not counted`
              : 'Weekends and company holidays are not counted'}
          </div>
          <div role="progressbar" aria-label="Balance after this request" className="bar on-surface">
            <span
              style={{
                width: `${bal && after != null ? Math.max(0, Math.min(100, (after / bal.total) * 100)) : 0}%`,
                background: style.color,
                transition: 'width .3s',
              }}
            />
          </div>
          <div className="row between fs-13 fw-6">
            <span>{type?.name} balance: {available ?? '...'}</span>
            <span>After: {after == null ? '...' : Math.max(0, after)}</span>
          </div>
        </div>
        {over && (
          <div role="alert" className="alert tone-warn">
            <WarningIcon weight="fill" />
            This is {plural(Math.abs(after), 'day')} more than your {type.name.toLowerCase()} balance. Pick fewer days or
            another leave type.
          </div>
        )}
        <FormError message={f.formError} />
      </div>
      <DialogFoot onCancel={closeModal}>
        <button type="submit" className="btn btn-primary" disabled={f.busy || over}>
          <PaperPlaneTiltIcon />
          Send request
        </button>
      </DialogFoot>
    </form>
  );
}

export function RejectLeave({ leave }) {
  const { viewer, byId, closeModal, toast, refresh } = useApp();
  const f = useForm({ comment: '' });
  const emp = byId.get(leave.employee_id);
  const dates = leave.from_date === leave.to_date ? dowFmtS(leave.from_date) : `${fmtS(leave.from_date)} to ${fmtS(leave.to_date)}`;
  const reject = async () => {
    const { error } = await submitWith(f, () => api.rejectLeave(leave.id, viewer.id, f.form.comment.trim()));
    if (error) return;
    closeModal();
    toast(`Rejected ${leave.employee_name}'s request`, 'bad');
    refresh();
  };
  return (
    <ConfirmBody
      Icon={XCircleIcon}
      tone="bad"
      title="Reject this request?"
      body={`${leave.employee_name} · ${leave.leave_type_name} · ${dates} (${daysLabel(leave.days, leave.half_day)})`}
      actions={
        <>
          <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
          <button type="button" className="btn btn-danger" onClick={reject} disabled={f.busy}>Reject request</button>
        </>
      }
    >
      <Field label={`Comment for ${emp?.first_name || leave.employee_name}`} hint="Optional">
        <textarea
          name="comment"
          rows={3}
          className="textarea"
          value={f.form.comment}
          onChange={f.onField}
          placeholder="e.g. We have a release that week, could you move it?"
        />
      </Field>
      <FormError message={f.formError} />
    </ConfirmBody>
  );
}

export function ExitEmployee({ employee }) {
  const { closeModal, run } = useApp();
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    const r = await run(() => api.updateEmployee(employee.id, { status: 'EXITED' }), `${fullName(employee)} marked as exited`, 'info');
    setBusy(false);
    if (r.ok) closeModal();
  };
  return (
    <ConfirmBody
      Icon={SignOutIcon}
      tone="grey"
      title={`Mark ${fullName(employee)} as exited?`}
      body="They'll stay in records and reports, but won't appear in headcount, attendance or approvals."
      actions={
        <>
          <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={confirm} disabled={busy}>Mark as exited</button>
        </>
      }
    />
  );
}

export function DeleteEmployee({ employee }) {
  const { core, closeModal, run, go } = useApp();
  const [busy, setBusy] = useState(false);
  const reports = core.employees.filter((e) => e.manager_id === employee.id).length;
  const confirm = async () => {
    setBusy(true);
    const r = await run(() => api.deleteEmployee(employee.id), `${fullName(employee)} was deleted`, 'bad');
    setBusy(false);
    if (r.ok) {
      closeModal();
      go('/employees');
    }
  };
  return (
    <ConfirmBody
      Icon={TrashIcon}
      tone="bad"
      title={`Delete ${fullName(employee)}?`}
      body="This permanently removes their profile, leave history and attendance. This can't be undone. If they've left the company, mark them as exited instead."
      actions={
        <>
          <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
          <button type="button" className="btn btn-danger" onClick={confirm} disabled={busy}>Delete permanently</button>
        </>
      }
    >
      {reports > 0 && (
        <div className="alert tone-warn">
          <WarningIcon weight="fill" />
          {plural(reports, 'person', 'people')} report to them and will be left without a manager.
        </div>
      )}
    </ConfirmBody>
  );
}

export function DepartmentForm({ department }) {
  const { live, closeModal, toast, refresh } = useApp();
  const editing = !!department;
  const f = useForm({
    name: department?.name || '',
    code: department?.code || '',
    description: department?.description || '',
    head_id: department?.head_id ? String(department.head_id) : '',
  });
  const save = async (e) => {
    e.preventDefault();
    const er = {};
    if (blank(f.form.name)) er.name = 'Required';
    if (blank(f.form.code)) er.code = 'Required';
    if (Object.keys(er).length) return f.setErrs(er);
    const payload = {
      name: f.form.name.trim(),
      code: f.form.code.trim().toUpperCase(),
      description: f.form.description.trim(),
      head_id: f.form.head_id ? Number(f.form.head_id) : null,
    };
    const { data: saved, error } = await submitWith(f, () =>
      editing ? api.updateDepartment(department.id, payload) : api.createDepartment(payload),
    );
    if (error) {
      if (error.status === 409) f.setErrs({ code: 'Name or code already in use' });
      return;
    }
    closeModal();
    toast(`${editing ? 'Updated' : 'Created'} ${saved.name}`);
    refresh();
  };
  return (
    <form onSubmit={save} noValidate>
      <DialogHead title={editing ? 'Edit department' : 'Add department'} onClose={closeModal} />
      <div className="dialog-body dept-form">
        <Field label="Name *" error={f.errs.name}><Input f={f} name="name" placeholder="e.g. Customer Success" /></Field>
        <Field label="Code *" error={f.errs.code}>
          <input
            name="code"
            value={f.form.code}
            onChange={f.onField}
            placeholder="CS"
            maxLength={10}
            className={`input code ${f.errs.code ? 'invalid' : ''}`}
          />
        </Field>
        <Field label="Head of department" span>
          <Select f={f} name="head_id">
            <option value="">Not assigned</option>
            {live.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}
          </Select>
        </Field>
        <Field label="Description" span>
          <textarea
            name="description"
            rows={3}
            className="textarea"
            value={f.form.description}
            onChange={f.onField}
            placeholder="What does this team do?"
          />
        </Field>
        {f.formError && <div className="span-all"><FormError message={f.formError} /></div>}
      </div>
      <DialogFoot onCancel={closeModal}>
        <button type="submit" className="btn btn-primary" disabled={f.busy}>Save department</button>
      </DialogFoot>
    </form>
  );
}

const membersOf = (employees, dept) => employees.filter((e) => e.department_id === dept.id);

export function DeleteDepartment({ department }) {
  const { core, closeModal, run, go, route } = useApp();
  const [busy, setBusy] = useState(false);
  const members = membersOf(core.employees, department);
  if (members.length) {
    const exited = members.filter((e) => e.status === 'EXITED').length;
    return (
      <ConfirmBody
        Icon={UsersThreeIcon}
        tone="warn"
        title={`${department.name} still has people in it`}
        body={`${plural(members.length, 'person', 'people')}${exited ? ` (including ${exited} exited)` : ''} belong to this department. Move them to another department first, then you can delete it.`}
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={closeModal}>Got it</button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                closeModal();
                go(`/departments/${department.id}`);
              }}
            >
              View members
            </button>
          </>
        }
      />
    );
  }
  const confirm = async () => {
    setBusy(true);
    const r = await run(() => api.deleteDepartment(department.id), `${department.name} department deleted`, 'bad');
    setBusy(false);
    if (r.ok) {
      closeModal();
      if (route.page === 'department') go('/departments');
    }
  };
  return (
    <ConfirmBody
      Icon={TrashIcon}
      tone="bad"
      title={`Delete ${department.name}?`}
      body="This department is empty. Deleting it can't be undone."
      actions={
        <>
          <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
          <button type="button" className="btn btn-danger" onClick={confirm} disabled={busy}>Delete department</button>
        </>
      }
    />
  );
}

export function HolidayForm() {
  const { core, closeModal, toast, refresh } = useApp();
  const f = useForm({ name: '', date: '', type: 'OPTIONAL' });
  const save = async (e) => {
    e.preventDefault();
    const er = {};
    if (blank(f.form.name)) er.name = 'Required';
    if (!f.form.date) er.date = 'Pick a date';
    else if (core.upcomingHolidays.some((h) => h.date === f.form.date)) er.date = 'There is already a holiday on this date';
    if (Object.keys(er).length) return f.setErrs(er);
    const { data: saved, error } = await submitWith(f, () =>
      api.createHoliday({ name: f.form.name.trim(), date: f.form.date, type: f.form.type }),
    );
    if (error) return;
    closeModal();
    toast(`${saved.name} added to the calendar`);
    refresh();
  };
  return (
    <form onSubmit={save} noValidate>
      <DialogHead title="Add holiday" onClose={closeModal} />
      <div className="dialog-body gap-14">
        <Field label="Name *" error={f.errs.name}><Input f={f} name="name" placeholder="e.g. Company offsite day" /></Field>
        <Field label="Date *" error={f.errs.date}><Input f={f} name="date" type="date" /></Field>
        <div className="field">
          Type
          <div role="radiogroup" className="radio-tiles">
            {[['PUBLIC', 'Public'], ['OPTIONAL', 'Optional']].map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={f.form.type === value}
                onClick={() => f.setForm((x) => ({ ...x, type: value }))}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <FormError message={f.formError} />
      </div>
      <DialogFoot onCancel={closeModal}>
        <button type="submit" className="btn btn-primary" disabled={f.busy}>Add holiday</button>
      </DialogFoot>
    </form>
  );
}

export function DeleteHoliday({ holiday }) {
  const { closeModal, run } = useApp();
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    const r = await run(() => api.deleteHoliday(holiday.id), `${holiday.name} removed from the calendar`, 'info');
    setBusy(false);
    if (r.ok) closeModal();
  };
  return (
    <ConfirmBody
      Icon={CalendarXIcon}
      tone="bad"
      title={`Remove ${holiday.name}?`}
      body={`${fmtLong(holiday.date)} will become a regular working day for everyone.`}
      actions={
        <>
          <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
          <button type="button" className="btn btn-danger" onClick={confirm} disabled={busy}>Remove holiday</button>
        </>
      }
    />
  );
}

const MODALS = {
  employee: [EmployeeForm, '760', 'Employee form'],
  apply: [ApplyLeave, '560', 'Apply for leave'],
  reject: [RejectLeave, null, 'Reject leave'],
  exit: [ExitEmployee, null, 'Mark as exited'],
  deleteEmployee: [DeleteEmployee, null, 'Delete employee'],
  department: [DepartmentForm, '520', 'Department form'],
  deleteDepartment: [DeleteDepartment, null, 'Delete department'],
  holiday: [HolidayForm, '480', 'Add holiday'],
  deleteHoliday: [DeleteHoliday, null, 'Remove holiday'],
};

export function ModalHost() {
  const { modal, closeModal } = useApp();
  if (!modal || !MODALS[modal.type]) return null;
  const [Component, width, label] = MODALS[modal.type];
  return (
    <Modal key={modal.type} width={width} onClose={closeModal} label={label}>
      <Component {...modal.props} />
    </Modal>
  );
}
