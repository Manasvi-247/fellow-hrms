import {
  AirplaneTiltIcon,
  BuildingsIcon,
  ChartLineUpIcon,
  CheckCircleIcon,
  ClockIcon,
  CodeIcon,
  FlagIcon,
  HandPointingIcon,
  HeartIcon,
  HourglassMediumIcon,
  MegaphoneIcon,
  PenNibIcon,
  ProhibitIcon,
  ScalesIcon,
  SignOutIcon,
  WalletIcon,
  XCircleIcon,
} from '@phosphor-icons/react';

const CHIPS = {
  ACTIVE: ['ok', CheckCircleIcon, 'fill', 'Active'],
  ON_LEAVE_E: ['warn', AirplaneTiltIcon, 'fill', 'On leave'],
  EXITED: ['grey', SignOutIcon, 'regular', 'Exited'],
  PENDING: ['warn', HourglassMediumIcon, 'fill', 'Pending'],
  APPROVED: ['ok', CheckCircleIcon, 'fill', 'Approved'],
  REJECTED: ['bad', XCircleIcon, 'fill', 'Rejected'],
  CANCELLED: ['grey', ProhibitIcon, 'regular', 'Cancelled'],
  PRESENT: ['ok', CheckCircleIcon, 'fill', 'Present'],
  LATE: ['warn', ClockIcon, 'fill', 'Late'],
  ABSENT: ['bad', XCircleIcon, 'fill', 'Absent'],
  ON_LEAVE: ['info', AirplaneTiltIcon, 'fill', 'On leave'],
  PUBLIC: ['teal', FlagIcon, 'fill', 'Public'],
  OPTIONAL: ['lilac', HandPointingIcon, 'regular', 'Optional'],
};

export function chipFor(key) {
  const [tone, Icon, weight, label] = CHIPS[key] || CHIPS.ACTIVE;
  return { tone, Icon, weight, label };
}

export const employeeChip = (status) => chipFor(status === 'ON_LEAVE' ? 'ON_LEAVE_E' : status);

export const ROLE_L = { ADMIN: 'Admin', MANAGER: 'Manager', EMPLOYEE: 'Employee' };
export const ROLE_TONE = { ADMIN: 'teal', MANAGER: 'lilac', EMPLOYEE: 'beige' };
export const ET_L = { FULL_TIME: 'Full time', PART_TIME: 'Part time', CONTRACT: 'Contract', INTERN: 'Intern' };
export const G_L = { MALE: 'Male', FEMALE: 'Female', OTHER: 'Other' };
export const TONES4 = ['teal', 'lilac', 'green', 'beige'];

const AVATAR_TONES = ['teal', 'beige', 'green', 'lilac'];
export const avatarTone = (id) => AVATAR_TONES[(id || 0) % AVATAR_TONES.length];

export const fullName = (e) => (e ? `${e.first_name} ${e.last_name}`.trim() : '');
export const initialsOf = (e) => (e ? `${e.first_name[0] || ''}${e.last_name[0] || ''}`.toUpperCase() : '?');

const DEPT_ICONS = {
  ENG: CodeIcon,
  SLS: ChartLineUpIcon,
  SAL: ChartLineUpIcon,
  DSN: PenNibIcon,
  HR: HeartIcon,
  FIN: WalletIcon,
  MKT: MegaphoneIcon,
  LGL: ScalesIcon,
};
export const deptIcon = (code) => DEPT_ICONS[(code || '').toUpperCase()] || BuildingsIcon;

const LEAVE_STYLES = {
  CL: { color: 'var(--teal)', soft: 'var(--teal-soft)', ink: 'var(--teal-ink)' },
  SL: { color: 'var(--pink)', soft: 'var(--pink-soft)', ink: 'var(--pink-ink)' },
  EL: { color: 'var(--lilac)', soft: 'var(--lilac-soft)', ink: 'var(--lilac-ink)' },
};

export function leaveStyle(type) {
  if (!type) return { color: 'var(--grey)', soft: 'var(--grey-soft)', ink: 'var(--grey)' };
  return (
    LEAVE_STYLES[type.code] || {
      color: type.color,
      soft: `color-mix(in oklab, ${type.color} 16%, transparent)`,
      ink: type.color,
    }
  );
}

export const VIEWER_PRESETS = [1, 4, 2, 12, 9];
