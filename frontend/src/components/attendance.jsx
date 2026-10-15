import { useState } from 'react';
import {
  AirplaneTiltIcon,
  CheckCircleIcon,
  ClockIcon,
  ConfettiIcon,
  HourglassIcon,
  TimerIcon,
  XCircleIcon,
} from '@phosphor-icons/react';
import * as api from '../api.js';
import { useApp } from '../state.jsx';
import { useLoad, useNow } from '../lib/hooks.js';
import { WEEK_HEAD, fmt, hm, isWeekend, minutesOf, pd, timeOf, toD, todayISO } from '../lib/dates.js';
import { chipFor } from '../lib/ui.js';

export function useMyDay() {
  const { viewer, version, toast, refresh } = useApp();
  const now = useNow();
  const today = now.date;
  const q = useLoad(() => api.getAttendanceForDay(viewer.id, today), [viewer.id, version, today]);
  const [busy, setBusy] = useState(false);
  const rec = q.data?.[0] || null;
  const isIn = !!rec?.check_in;
  const isOut = !!rec?.check_out;
  const onLeave = rec?.status === 'ON_LEAVE' && !isIn;
  const nowMin = now.h * 60 + now.m + now.s / 60;
  const inMin = isIn ? minutesOf(rec.check_in) : null;
  const hours = isOut ? rec.hours_worked : isIn ? Math.max(0, (nowMin - inMin) / 60) : null;

  const act = async (fn, message) => {
    setBusy(true);
    try {
      const r = await fn(viewer.id);
      const [text, kind] = message(r);
      toast(text, kind);
      refresh();
    } catch (error) {
      toast(error.message, 'bad');
    } finally {
      setBusy(false);
    }
  };
  const checkIn = () =>
    act(api.checkIn, (r) =>
      r.status === 'LATE'
        ? [`Checked in at ${timeOf(r.check_in)}. Marked late (after 09:30 AM).`, 'warn']
        : [`Checked in at ${timeOf(r.check_in)}. Have a great day!`, 'ok'],
    );
  const checkOut = () => act(api.checkOut, (r) => [`Checked out. You worked ${hm(r.hours_worked)} today.`, 'ok']);

  let chip = { ...chipFor('ABSENT'), tone: 'grey', Icon: HourglassIcon, weight: 'regular', label: 'Not in yet' };
  if (isIn || onLeave) chip = chipFor(rec.status);
  const line = onLeave
    ? 'You are on leave today. Enjoy your time off.'
    : isOut
      ? 'Day complete. See you tomorrow.'
      : isIn
        ? `Checked in at ${timeOf(rec.check_in)}${rec.status === 'LATE' ? ', after the 09:30 AM cutoff.' : ', right on time.'}`
        : "You haven't checked in yet. Check in after 09:30 AM is marked late.";
  const end = isOut ? minutesOf(rec.check_out) : nowMin;
  const dayPct = isIn ? Math.max(0, Math.min(100, ((end - 540) / 540) * 100)) : 0;

  return {
    now, today, rec, loading: q.loading && !q.data, error: q.error, isIn, isOut, onLeave, hours, chip, line, dayPct,
    busy, checkIn, checkOut,
    canIn: !q.error && !!q.data && !isIn && !onLeave,
    canOut: isIn && !isOut,
    inL: isIn ? timeOf(rec.check_in) : '--:--',
    outL: isOut ? timeOf(rec.check_out) : '--:--',
    hoursL: isIn ? hm(hours) : '0h 00m',
  };
}

const CELL = {
  PRESENT: ['ok', CheckCircleIcon, 'Present'],
  LATE: ['warn', ClockIcon, 'Late'],
  ABSENT: ['bad', XCircleIcon, 'Absent'],
  ON_LEAVE: ['info', AirplaneTiltIcon, 'Leave'],
};

export function monthCells({ month, rows, holidays, joined, compact }) {
  const today = todayISO();
  const first = toD(`${month}-01`);
  const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const byDate = new Map((rows || []).map((r) => [r.date, r]));
  const holidayByDate = new Map((holidays || []).map((h) => [h.date, h]));
  const cells = [];
  for (let i = 0; i < (first.getDay() + 6) % 7; i++) cells.push({ key: `b${i}`, blank: true });
  const totals = { PRESENT: 0, LATE: 0, ABSENT: 0, ON_LEAVE: 0 };
  let hours = 0;
  let counted = 0;
  for (let d = 1; d <= daysIn; d++) {
    const ds = `${month}-${pd(d)}`;
    const r = byDate.get(ds);
    const hol = holidayByDate.get(ds);
    let cell;
    if (r) {
      totals[r.status]++;
      if (r.hours_worked != null) {
        hours += r.hours_worked;
        counted++;
      }
      const [tone, Icon, short] = CELL[r.status];
      cell = { cls: `tone-${tone}`, Icon, short, title: `${fmt(ds)}: ${short}${r.check_in ? `, in ${timeOf(r.check_in)}` : ''}` };
    } else if (hol) cell = { cls: 'tone-green', Icon: ConfettiIcon, short: 'Holiday', title: hol.name };
    else if (isWeekend(ds)) cell = { cls: 'weekend', title: 'Weekend' };
    else if (ds > today) cell = { cls: 'future', title: 'Upcoming' };
    else if (joined && ds < joined) cell = { cls: 'future', title: 'Not yet joined' };
    else cell = { cls: 'future', title: 'No record' };
    if (compact) cell.short = '';
    cells.push({ ...cell, key: ds, day: d, today: ds === today });
  }
  const tiles = [
    ['Present', totals.PRESENT, 'ok', CheckCircleIcon],
    ['Late', totals.LATE, 'warn', ClockIcon],
    ['Absent', totals.ABSENT, 'bad', XCircleIcon],
    ['On leave', totals.ON_LEAVE, 'info', AirplaneTiltIcon],
    ['Avg hours', counted ? hm(hours / counted) : '--', 'green', TimerIcon],
  ];
  return { cells, tiles };
}

export function StatTiles({ tiles }) {
  return (
    <div className="grid-auto g-130">
      {tiles.map(([label, value, tone, Icon]) => (
        <div key={label} className="stat-tile">
          <span className={`icon-tile sm tone-${tone}`}><Icon weight="fill" /></span>
          <span>
            <span className="v">{value}</span>
            <span className="l">{label}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export function MonthCalendar({ cells }) {
  return (
    <div className="cal">
      {WEEK_HEAD.map((w) => <div key={w} className="cal-head">{w}</div>)}
      {cells.map((c) =>
        c.blank ? (
          <div key={c.key} />
        ) : (
          <div key={c.key} title={c.title} className={`cal-cell ${c.cls} ${c.today ? 'today' : ''}`}>
            <span className="d">{c.day}</span>
            <span className="s">
              {c.Icon && <c.Icon weight="fill" />}
              {c.short}
            </span>
          </div>
        ),
      )}
    </div>
  );
}
