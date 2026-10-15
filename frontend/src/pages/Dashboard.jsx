import {
  AirplaneTiltIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  CakeIcon,
  CalendarPlusIcon,
  CheckCircleIcon,
  CheckIcon,
  CheckSquareOffsetIcon,
  ClockIcon,
  ConfettiIcon,
  HandWavingIcon,
  HourglassMediumIcon,
  SignInIcon,
  SignOutIcon,
  SunIcon,
  UserCheckIcon,
  UsersThreeIcon,
  XCircleIcon,
  XIcon,
} from '@phosphor-icons/react';
import * as api from '../api.js';
import { useApp } from '../state.jsx';
import { useLoad } from '../lib/hooks.js';
import {
  MON,
  clock12,
  dateOf,
  daysBetween,
  daysLabel,
  dow,
  dowFmtS,
  fmtLong,
  fmtS,
  holidayDates,
  nextWorkingDay,
  plural,
  toD,
} from '../lib/dates.js';
import { TONES4, chipFor, fullName, leaveStyle } from '../lib/ui.js';
import { Avatar, BalanceSoft, Chip, ErrorState, Skeleton } from '../components/common.jsx';
import { useMyDay } from '../components/attendance.jsx';

const BAR_COLORS = ['var(--teal)', 'var(--lilac)', 'var(--green)'];
const SEGMENTS = [
  ['PRESENT', 'Present', 'ok', CheckCircleIcon],
  ['LATE', 'Late', 'warn', ClockIcon],
  ['ABSENT', 'Absent', 'bad', XCircleIcon],
  ['ON_LEAVE', 'On leave', 'info', AirplaneTiltIcon],
];

export function approveWithToast(run, leave, viewer) {
  return run(
    () => api.approveLeave(leave.id, viewer.id),
    `Approved ${leave.employee_name}'s leave (${daysLabel(leave.days, leave.half_day).toLowerCase()})`,
  );
}

export const leaveDates = (l) =>
  l.from_date === l.to_date ? dowFmtS(l.from_date) : `${fmtS(l.from_date)} to ${fmtS(l.to_date)}`;

function TodayCard({ day }) {
  const c = clock12(day.now.h, day.now.m);
  return (
    <section className="card today-card">
      <div className="blob" aria-hidden="true" />
      <div className="row between gap-12 start">
        <div>
          <h3 className="card-title">Today</h3>
          <div className="fs-13 muted mt-2">{fmtLong(day.today)}</div>
        </div>
        <Chip chip={day.chip} size="lg" />
      </div>
      <div className="clock">
        <span className="hm">{c.hm}</span>
        <span className="s">:{String(day.now.s).padStart(2, '0')}</span>
        <span className="ap">{c.ap}</span>
      </div>
      <p className="line-muted">{day.line}</p>
      {day.canIn && (
        <button type="button" className="btn btn-primary btn-huge" onClick={day.checkIn} disabled={day.busy}>
          <SignInIcon weight="fill" size={22} />
          Check in
        </button>
      )}
      {day.canOut && (
        <button type="button" className="btn btn-huge secondary" onClick={day.checkOut} disabled={day.busy}>
          <SignOutIcon weight="fill" size={22} />
          Check out · {day.hoursL} so far
        </button>
      )}
      {day.isOut && (
        <div className="status-block tone-ok">
          <CheckCircleIcon weight="fill" size={20} />
          Worked {day.hoursL} today
        </div>
      )}
      {day.onLeave && (
        <div className="status-block tone-info">
          <AirplaneTiltIcon weight="fill" size={20} />
          On leave today
        </div>
      )}
    </section>
  );
}

export default function Dashboard() {
  const { core, viewer, canApprove, pendingFor, version, go, run, openModal, byId } = useApp();
  const stats = useLoad(api.getDashboardStats, [version]);
  const balances = useLoad(() => (canApprove ? null : api.getLeaveBalance(viewer.id)), [viewer.id, canApprove, version]);
  const day = useMyDay();

  if (stats.error) return <ErrorState error={stats.error} what="your dashboard" onRetry={stats.reload} />;
  if (!stats.data) return <Skeleton />;
  const s = stats.data;
  const today = day.today;
  const hset = holidayDates(core.upcomingHolidays);
  const typeByName = new Map(core.leaveTypes.map((t) => [t.name, t]));
  const typeByCode = new Map(core.leaveTypes.map((t) => [t.code, t]));

  const myPending = core.pending.filter((l) => l.employee_id === viewer.id);
  const backDates = s.on_leave_today_list.map((o) => nextWorkingDay(o.to_date, hset)).sort();
  const joiners = core.employees.filter(
    (e) => e.status !== 'EXITED' && e.date_of_joining.slice(0, 7) === today.slice(0, 7),
  );
  const oldest = pendingFor.map((l) => l.applied_at).sort()[0];
  const kpis = [
    [UsersThreeIcon, 'Total employees', s.total_employees, plural(core.departments.length, 'department'), '/employees'],
    [UserCheckIcon, 'Present today', s.present_today, `${s.late_today} arrived late`, '/attendance'],
    [AirplaneTiltIcon, 'On leave today', s.on_leave_today, backDates.length ? `Back by ${dowFmtS(backDates[backDates.length - 1])}` : 'No one away', '/attendance'],
    canApprove
      ? [HourglassMediumIcon, 'Pending requests', pendingFor.length, oldest ? `Oldest from ${fmtS(dateOf(oldest))}` : 'All caught up', '/leave/approvals']
      : [HourglassMediumIcon, 'My pending requests', myPending.length, myPending.length ? 'Awaiting approval' : 'Nothing waiting', '/leave'],
    [HandWavingIcon, 'New joiners', s.new_joiners_this_month, joiners.map((e) => e.first_name).join(', ') || 'None this month', '/employees'],
  ];

  const cnt = {
    PRESENT: s.present_today - s.late_today,
    LATE: s.late_today,
    ABSENT: s.absent_today,
    ON_LEAVE: s.on_leave_today,
  };
  const tot = Object.values(cnt).reduce((a, b) => a + b, 0);
  let acc = 0;
  const stops = SEGMENTS.map(([k, , tone]) => {
    const a = acc;
    acc += tot ? (cnt[k] / tot) * 360 : 0;
    return `var(--${tone}) ${a}deg ${acc}deg`;
  });
  const donutBg = tot ? `conic-gradient(${stops.join(',')})` : 'var(--sunken)';
  const pctOf = (n) => `${tot ? Math.round((n / tot) * 100) : 0}%`;

  const maxDept = Math.max(1, ...s.headcount_by_department.map((d) => d.count));
  const holidayType = new Map(core.upcomingHolidays.map((h) => [h.date, h.type]));
  const celebrations = [
    ...s.upcoming_birthdays.map((b) => ({ ...b, Icon: CakeIcon, what: 'Birthday', tone: 'pink' })),
    ...s.upcoming_anniversaries.map((a) => ({
      ...a,
      Icon: ConfettiIcon,
      what: `${plural(a.years, 'year')} at Fellow`,
      tone: 'green',
    })),
  ].sort((a, b) => (a.date < b.date ? -1 : 1));
  const dashPending = [...pendingFor].sort((a, b) => (a.applied_at < b.applied_at ? 1 : -1)).slice(0, 5);
  const myBal = balances.data || [];
  const balOf = (code) => myBal.find((b) => b.code === code);
  const nextHol = s.upcoming_holidays[0];
  const greet = day.now.h < 12 ? 'Good morning' : day.now.h < 17 ? 'Good afternoon' : 'Good evening';
  const heroLine = canApprove
    ? `${s.present_today} of ${s.total_employees} people are in today. ${
        pendingFor.length
          ? `${plural(pendingFor.length, 'leave request')} ${pendingFor.length > 1 ? 'are' : 'is'} waiting for your review.`
          : 'No leave requests need your review.'
      }`
    : `${
        balOf('CL') && balOf('EL')
          ? `You have ${Math.max(0, balOf('CL').available)} casual and ${Math.max(0, balOf('EL').available)} earned leaves left. `
          : ''
      }Next holiday is ${nextHol ? `${nextHol.name} on ${dowFmtS(nextHol.date)}` : 'not scheduled yet'}.`;

  return (
    <div className="page">
      <section className="hero">
        <div className="hero-tex" aria-hidden="true" />
        <div className="hero-veil" aria-hidden="true" />
        <div className="hero-body">
          <div>
            <div className="hero-date">{fmtLong(today)}</div>
            <h2 className="hero-title">{greet}, {viewer.first_name}</h2>
            <p className="hero-line">{heroLine}</p>
          </div>
          <div className="row gap-10 wrap">
            {canApprove && (
              <button type="button" className="btn btn-primary" onClick={() => go('/leave/approvals')}>
                <CheckSquareOffsetIcon size={18} />
                Review requests
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => openModal('apply')}>
              <CalendarPlusIcon size={18} />
              Apply leave
            </button>
          </div>
        </div>
      </section>

      <div className="grid-auto g-kpi">
        {kpis.map(([Icon, label, value, hint, path], i) => (
          <button key={label} type="button" className="kpi hover-lift" onClick={() => go(path)}>
            <span className="kpi-top">
              <span className={`icon-tile tone-${TONES4[i % 4]}`}><Icon weight="fill" /></span>
              <ArrowUpRightIcon size={16} />
            </span>
            <span>
              <span className="kpi-value">{value}</span>
              <span className="kpi-label">{label}</span>
              <span className="kpi-hint ellipsis">{hint}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="grid-auto g-360">
        {!canApprove && <TodayCard day={day} />}
        {!canApprove && (
          <section className="card stack gap-14">
            <div className="row between">
              <h3 className="card-title">My leave balance</h3>
              <button type="button" className="link-btn" onClick={() => go('/leave')}>
                View history
                <ArrowRightIcon />
              </button>
            </div>
            {myBal.map((b) => <BalanceSoft key={b.leave_type_id} b={b} type={typeByCode.get(b.code)} />)}
            {balances.error && <div className="sub">Couldn't load your balance. {balances.error.message}</div>}
          </section>
        )}
        <section className="card">
          <div className="card-head lg">
            <h3 className="card-title">Headcount by department</h3>
            <span className="fs-12 muted fw-6">Active people</span>
          </div>
          <div className="hbars">
            {s.headcount_by_department.map((d, i) => (
              <div key={d.department} className="hbar">
                <span className="fs-13 fw-6 ellipsis">{d.department}</span>
                <div className="track">
                  <div className="fill" style={{ width: `${(d.count / maxDept) * 100}%`, background: BAR_COLORS[i % 3] }} />
                </div>
                <span className="fw-8 tabular right">{d.count}</span>
              </div>
            ))}
            {!s.headcount_by_department.length && <div className="mini-empty">No departments with people yet.</div>}
          </div>
        </section>
        <section className="card">
          <div className="card-head lg">
            <h3 className="card-title">Today's attendance</h3>
            <button type="button" className="link-btn" onClick={() => go('/attendance')}>
              Daily board
              <ArrowRightIcon />
            </button>
          </div>
          <div className="donut-wrap">
            <div
              role="img"
              aria-label={SEGMENTS.map(([k, l]) => `${cnt[k]} ${l.toLowerCase()}`).join(', ')}
              className="donut"
              style={{ background: donutBg }}
            >
              <div className="donut-hole">
                <div>
                  <div className="donut-pct">{pctOf(cnt.PRESENT + cnt.LATE)}</div>
                  <div className="fs-12 muted fw-6">in office</div>
                </div>
              </div>
            </div>
            <div className="legend">
              {SEGMENTS.map(([k, label, tone, Icon]) => (
                <div key={k} className={`legend-row tone-${tone}`}>
                  <Icon weight="fill" />
                  <span className="lbl">{label}</span>
                  <span className="cnt">{cnt[k]}</span>
                  <span className="pct">{pctOf(cnt[k])}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="grid-auto g-330">
        <section className="card">
          <div className="card-head">
            <h3 className="card-title">Who's out today</h3>
            <span className="pill-tag tone-info">{s.on_leave_today_list.length} away</span>
          </div>
          <div className="rows">
            {s.on_leave_today_list.map((o) => {
              const back = nextWorkingDay(o.to_date, hset);
              return (
                <button key={o.employee_id} type="button" className="person-row" onClick={() => go(`/employees/${o.employee_id}`)}>
                  <Avatar emp={byId.get(o.employee_id)} />
                  <span className="grow">
                    <span className="person-name">{o.employee_name}</span>
                    <span className="person-sub row gap-6">
                      <span className="dot" style={{ background: leaveStyle(typeByName.get(o.leave_type_name)).color }} />
                      {o.leave_type_name}
                    </span>
                  </span>
                  <span className="fs-12 fw-6 muted nowrap">Back {dowFmtS(back)}</span>
                </button>
              );
            })}
            {!s.on_leave_today_list.length && (
              <div className="mini-empty">
                <SunIcon />
                Everyone is in today.
              </div>
            )}
          </div>
        </section>

        {canApprove && (
          <section className="card">
            <div className="card-head">
              <h3 className="card-title">Pending approvals</h3>
              <button type="button" className="link-btn" onClick={() => go('/leave/approvals')}>
                See all {pendingFor.length > 5 ? `+${pendingFor.length - 5} more` : ''}
                <ArrowRightIcon />
              </button>
            </div>
            <div className="stack gap-10">
              {dashPending.map((l) => (
                <div key={l.id} className="pending-mini">
                  <div className="row gap-10">
                    <Avatar emp={byId.get(l.employee_id)} size="ms" />
                    <div className="grow">
                      <div className="title-sm">{l.employee_name}</div>
                      <div className="sub">
                        {typeByName.get(l.leave_type_name)?.code || l.leave_type_name} · {leaveDates(l)} · {daysLabel(l.days, l.half_day)}
                      </div>
                    </div>
                  </div>
                  <div className="row gap-8">
                    <button type="button" className="btn btn-sm btn-flex btn-ok-soft" onClick={() => approveWithToast(run, l, viewer)}>
                      <CheckIcon weight="bold" />
                      Approve
                    </button>
                    <button type="button" className="btn btn-sm btn-flex btn-danger-soft" onClick={() => openModal('reject', { leave: l })}>
                      <XIcon weight="bold" />
                      Reject
                    </button>
                  </div>
                </div>
              ))}
              {!pendingFor.length && (
                <div className="mini-empty">
                  <CheckCircleIcon className="ok-ink" />
                  All caught up. No requests waiting.
                </div>
              )}
            </div>
          </section>
        )}

        <section className="card">
          <div className="card-head">
            <h3 className="card-title">Upcoming</h3>
            <button type="button" className="link-btn" onClick={() => go('/holidays')}>
              Holidays
              <ArrowRightIcon />
            </button>
          </div>
          <div className="stack gap-8">
            {s.upcoming_holidays.map((h) => {
              const away = daysBetween(today, h.date);
              const d = toD(h.date);
              return (
                <div key={h.date} className="hol-row">
                  <span className="date-tile tone-teal">
                    <span className="m">{MON[d.getMonth()].toUpperCase()}</span>
                    <span className="d">{d.getDate()}</span>
                  </span>
                  <span className="grow">
                    <span className="person-name">{h.name}</span>
                    <span className="sub block">{dow(h.date)} · {away === 0 ? 'Today' : `in ${plural(away, 'day')}`}</span>
                  </span>
                  <Chip chip={chipFor(holidayType.get(h.date) || 'PUBLIC')} size="sm" />
                </div>
              );
            })}
            {!s.upcoming_holidays.length && <div className="sub">No holidays scheduled.</div>}
          </div>
          <div className="divider" />
          <div className="label-sm mb-8">Next 14 days</div>
          <div className="rows">
            {celebrations.map((c) => (
              <button key={`${c.what}-${c.employee_id}`} type="button" className="person-row" onClick={() => go(`/employees/${c.employee_id}`)}>
                <span className={`icon-tile xs tone-${c.tone}`}><c.Icon weight="fill" /></span>
                <span className="grow">
                  <span className="person-name">{c.employee_name}</span>
                  <span className="sub block">{c.what}</span>
                </span>
                <span className="fs-12 fw-6 muted nowrap">{c.date === today ? 'Today' : dowFmtS(c.date)}</span>
              </button>
            ))}
            {!celebrations.length && <div className="fs-13 muted">No birthdays or anniversaries coming up.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
