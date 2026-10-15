export const TZ = 'Asia/Kolkata';
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DOWL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEK_HEAD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const pd = (n) => String(n).padStart(2, '0');
export const toD = (s) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const iso = (d) => `${d.getFullYear()}-${pd(d.getMonth() + 1)}-${pd(d.getDate())}`;
export const addDays = (s, n) => {
  const d = toD(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
export const daysBetween = (a, b) => Math.round((toD(b) - toD(a)) / 864e5);

const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
const timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: true });

function partsOf(date) {
  const p = Object.fromEntries(partsFmt.formatToParts(date).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, h: +p.hour, m: +p.minute, s: +p.second };
}

export const nowParts = () => partsOf(new Date());
export const todayISO = () => nowParts().date;
export const minutesOf = (stamp) => {
  const p = partsOf(new Date(stamp));
  return p.h * 60 + p.m + p.s / 60;
};
export const dateOf = (stamp) => partsOf(new Date(stamp)).date;
export const timeOf = (stamp) => (stamp ? timeFmt.format(new Date(stamp)) : '--:--');

export const fmt = (s) => {
  if (!s) return '';
  const d = toD(s);
  return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
};
export const fmtS = (s) => {
  const d = toD(s);
  return `${d.getDate()} ${MON[d.getMonth()]}`;
};
export const dow = (s) => DOW[toD(s).getDay()];
export const dowLong = (s) => DOWL[toD(s).getDay()];
export const fmtLong = (s) => `${dowLong(s)}, ${fmt(s)}`;
export const dowFmtS = (s) => `${dow(s)}, ${fmtS(s)}`;
export const monthLabel = (ym) => `${MONL[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;

export const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
export const hm = (h) => {
  if (h == null) return '--';
  const t = Math.max(0, Math.round(h * 60));
  return `${Math.floor(t / 60)}h ${pd(t % 60)}m`;
};
export const clock12 = (h, m) => ({ hm: `${pd(((h + 11) % 12) + 1)}:${pd(m)}`, ap: h >= 12 ? 'PM' : 'AM' });

export function tenure(from, to) {
  const a = toD(from);
  const b = toD(to || todayISO());
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) m--;
  if (m < 1) {
    const d = Math.max(0, Math.round((b - a) / 864e5));
    return `${d} ${d === 1 ? 'day' : 'days'}`;
  }
  const y = Math.floor(m / 12);
  const mo = m % 12;
  return [y ? `${y} ${y > 1 ? 'yrs' : 'yr'}` : '', mo ? `${mo} ${mo > 1 ? 'mos' : 'mo'}` : ''].filter(Boolean).join(' ');
}

export const isWeekend = (s) => [0, 6].includes(toD(s).getDay());

// The backend treats every holiday (public or optional) as a non-working day.
export const holidayDates = (holidays) => new Set((holidays || []).map((h) => h.date));
export const isWorkingDay = (s, hset) => !isWeekend(s) && !hset.has(s);

export function nextWorkingDay(s, hset) {
  let d = addDays(s, 1);
  for (let i = 0; i < 60 && !isWorkingDay(d, hset); i++) d = addDays(d, 1);
  return d;
}

export function countWorkingDays(from, to, hset) {
  if (!from || !to || to < from) return { days: 0, skipped: 0 };
  let days = 0;
  let skipped = 0;
  for (let d = from, guard = 0; d <= to && guard < 400; d = addDays(d, 1), guard++) {
    if (isWorkingDay(d, hset)) days++;
    else skipped++;
  }
  return { days, skipped };
}

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many || `${one}s`}`;
export const daysLabel = (days, half) => (half ? 'Half day' : plural(days, 'day'));
