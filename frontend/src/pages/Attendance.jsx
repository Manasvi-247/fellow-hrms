import { useState } from 'react';
import {
  AirplaneTiltIcon,
  CalendarDotsIcon,
  CheckCircleIcon,
  ClockIcon,
  CoffeeIcon,
  ConfettiIcon,
  FunnelXIcon,
  HourglassIcon,
  SignInIcon,
  SignOutIcon,
  XCircleIcon,
} from '@phosphor-icons/react';
import * as api from '../api.js';
import { useApp } from '../state.jsx';
import { useLoad, useViewport } from '../lib/hooks.js';
import { clock12, fmtLong, hm, isWeekend, minutesOf, monthLabel, timeOf } from '../lib/dates.js';
import { chipFor } from '../lib/ui.js';
import { Avatar, Chip, ErrorState, PersonCell, Skeleton } from '../components/common.jsx';
import { useMyDay } from '../components/attendance.jsx';
import { AttendanceTab } from './Profile.jsx';

const SUMMARY = [
  ['PRESENT', 'Present', CheckCircleIcon, 'ok'],
  ['LATE', 'Late', ClockIcon, 'warn'],
  ['ABSENT', 'Absent', XCircleIcon, 'bad'],
  ['ON_LEAVE', 'On leave', AirplaneTiltIcon, 'info'],
];
const NOT_IN = { ...chipFor('ABSENT'), tone: 'grey', Icon: HourglassIcon, weight: 'regular', label: 'Not in yet' };

function Hero({ day }) {
  const c = clock12(day.now.h, day.now.m);
  return (
    <section className="att-hero">
      <div className="hero-tex" aria-hidden="true" />
      <div className="hero-veil" aria-hidden="true" />
      <div className="gap-10">
        <div className="row gap-8 wrap">
          <span className="fs-13 fw-7 muted">{fmtLong(day.today)}</span>
          <Chip chip={day.chip} />
        </div>
        <div className="clock big">
          <span className="hm">{c.hm}</span>
          <span className="s">:{String(day.now.s).padStart(2, '0')}</span>
          <span className="ap">{c.ap}</span>
        </div>
        <p className="line-muted">{day.line}</p>
        <div className="mt-4">
          <div className="day-scale"><span>09:00 AM</span><span>01:30 PM</span><span>06:00 PM</span></div>
          <div role="progressbar" aria-label="Workday progress" aria-valuenow={Math.round(day.dayPct)} className="day-track">
            <div className="day-fill" style={{ width: `${day.dayPct}%` }} />
          </div>
        </div>
      </div>
      <div className="gap-14">
        <div className="mini-stats">
          <div className="mini-stat"><div className="k">Check in</div><div className="v">{day.inL}</div></div>
          <div className="mini-stat"><div className="k">Check out</div><div className="v">{day.outL}</div></div>
          <div className="mini-stat"><div className="k">Worked</div><div className="v">{day.hoursL}</div></div>
        </div>
        {day.canIn && (
          <button type="button" className="btn btn-primary btn-huge tall" onClick={day.checkIn} disabled={day.busy}>
            <SignInIcon weight="fill" size={22} />
            Check in
          </button>
        )}
        {day.canOut && (
          <button type="button" className="btn btn-huge tall lilac" onClick={day.checkOut} disabled={day.busy}>
            <SignOutIcon weight="fill" size={22} />
            Check out
          </button>
        )}
        {day.isOut && (
          <div className="status-block tall tone-ok"><CheckCircleIcon weight="fill" size={20} />Day complete</div>
        )}
        {day.onLeave && (
          <div className="status-block tall tone-info"><AirplaneTiltIcon weight="fill" size={20} />On leave today</div>
        )}
        {day.error && <div className="sub">Couldn't load today's record. {day.error.message}</div>}
      </div>
    </section>
  );
}

function Board({ day }) {
  const { core, byId, version, go } = useApp();
  const { isMobile } = useViewport();
  const today = day.today;
  const [date, setDate] = useState(today);
  const [dept, setDept] = useState('');
  const [status, setStatus] = useState('');
  const board = useLoad(() => api.getAttendanceBoard(date, dept), [date, dept, version]);
  const nowMin = day.now.h * 60 + day.now.m;

  let off = null;
  const holiday = core.upcomingHolidays.find((h) => h.date === date);
  if (board.data && !board.data.length) {
    if (date > today) off = [CalendarDotsIcon, "This day hasn't happened yet", 'Pick today or an earlier date to see the board.'];
    else if (isWeekend(date)) off = [CoffeeIcon, "It's the weekend", 'No attendance is recorded on Saturdays and Sundays.'];
    else if (holiday) off = [ConfettiIcon, 'Company holiday', `${holiday.name}. The office is closed.`];
    else off = [CalendarDotsIcon, 'No attendance recorded', 'No one was on the team yet for this day.'];
  }
  const counts = { PRESENT: 0, LATE: 0, ABSENT: 0, ON_LEAVE: 0 };
  (board.data || []).forEach((r) => counts[r.status]++);
  const rows = (board.data || [])
    .filter((r) => !status || r.status === status)
    .map((r) => {
      const working = r.check_in && !r.check_out && date === today;
      return {
        ...r,
        inL: timeOf(r.check_in),
        outL: r.check_out ? timeOf(r.check_out) : working ? 'Working' : '--:--',
        hoursL: r.hours_worked != null ? hm(r.hours_worked) : working ? hm((nowMin - minutesOf(r.check_in)) / 60) : '--',
        chip: r.status === 'ABSENT' && date === today ? NOT_IN : chipFor(r.status),
      };
    });
  const open = (r) => go(`/employees/${r.employee_id}`);
  const OffIcon = off?.[0];

  return (
    <section className="card clip">
      <div className="board-head">
        <div>
          <h3 className="card-title">Daily board</h3>
          <div className="fs-13 muted mt-2">{fmtLong(date)}</div>
        </div>
        <div className="board-controls">
          <input
            type="date"
            className="input sm"
            value={date}
            max={today}
            aria-label="Board date"
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
          <button type="button" className="btn btn-secondary btn-md fs-13" onClick={() => setDate(today)}>Today</button>
          <select className="select sm" value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department">
            <option value="">All departments</option>
            {core.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className="select sm" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="">Any status</option>
            {SUMMARY.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
      </div>
      {board.error && <ErrorState error={board.error} what="attendance" onRetry={board.reload} />}
      {!board.error && !board.data && <div className="board-off"><Skeleton variant="list" /></div>}
      {board.data && !off && (
        <div className="board-sum">
          {SUMMARY.map(([k, label, Icon, tone]) => (
            <button
              key={k}
              type="button"
              aria-pressed={status === k}
              className={`sum-tile ${status === k ? `on-${tone}` : ''}`}
              onClick={() => setStatus((s) => (s === k ? '' : k))}
            >
              <span className={`icon-tile sm tone-${tone}`}><Icon weight="fill" /></span>
              <span>
                <span className="v">{counts[k]}</span>
                <span className="l">{label}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {board.data && !off && rows.length > 0 && !isMobile && (
        <div className="att-table">
          <div role="table" aria-label="Attendance">
            <div role="row" className="thead cols-att">
              <span>Employee</span><span>Check in</span><span>Check out</span><span>Hours</span><span>Status</span>
            </div>
            {rows.map((r) => (
              <div key={r.employee_id} role="row" className="trow cols-att">
                <PersonCell emp={byId.get(r.employee_id)} name={r.employee_name} sub={r.department_name} onOpen={() => open(r)} />
                <span>{r.inL}</span>
                <span className="muted">{r.outL}</span>
                <span className="fw-7">{r.hoursL}</span>
                <span><Chip chip={r.chip} /></span>
              </div>
            ))}
          </div>
        </div>
      )}
      {board.data && !off && rows.length > 0 && isMobile && (
        <div className="stack">
          {rows.map((r) => (
            <button key={r.employee_id} type="button" className="board-card" onClick={() => open(r)}>
              <span className="row gap-10 btn-block">
                <Avatar emp={byId.get(r.employee_id)} size="ms" />
                <span className="grow title-sm">{r.employee_name}</span>
                <Chip chip={r.chip} />
              </span>
              <span className="fs-13 muted">In {r.inL} · Out {r.outL} · {r.hoursL}</span>
            </button>
          ))}
        </div>
      )}
      {off && (
        <div className="board-off">
          <span className="icon-tile big tone-lilac"><OffIcon /></span>
          <div className="t">{off[1]}</div>
          <div className="b">{off[2]}</div>
        </div>
      )}
      {board.data && !off && !rows.length && (
        <div className="mini-empty fs-14">
          <FunnelXIcon />
          No one matches these filters for this day.
        </div>
      )}
    </section>
  );
}

function MyMonth({ day }) {
  const { core, viewer, version } = useApp();
  const { isMobile } = useViewport();
  const month = day.today.slice(0, 7);
  const q = useLoad(() => api.getAttendanceMonth(viewer.id, month), [viewer.id, month, version]);
  if (q.error) return <ErrorState error={q.error} what="your attendance" onRetry={q.reload} />;
  if (!q.data) return <Skeleton variant="list" />;
  return (
    <AttendanceTab
      rows={q.data}
      month={month}
      holidays={core.upcomingHolidays}
      joined={viewer.date_of_joining}
      compact={isMobile}
      title={`My ${monthLabel(month).split(' ')[0]}`}
    />
  );
}

export default function Attendance() {
  const { canApprove } = useApp();
  const day = useMyDay();
  return (
    <div className="page">
      <Hero day={day} />
      {canApprove ? <Board day={day} /> : <MyMonth day={day} />}
    </div>
  );
}
