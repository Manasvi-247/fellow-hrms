import { ArrowClockwiseIcon, PlusIcon, WifiSlashIcon, WarningIcon } from '@phosphor-icons/react';
import { avatarTone, chipFor, employeeChip, fullName, initialsOf, leaveStyle } from '../lib/ui.js';

export function Avatar({ emp, size, onClick, label }) {
  const cls = `avatar ${size || ''} ${emp ? `av-${avatarTone(emp.id)}` : 'av-grey'}`;
  const text = emp ? initialsOf(emp) : '?';
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-label={label || `Open ${fullName(emp)}`}>
        {text}
      </button>
    );
  }
  return (
    <span className={cls} title={label} aria-hidden={label ? undefined : 'true'}>
      {text}
    </span>
  );
}

export function Chip({ chip, size, label, icon }) {
  const { tone, Icon, weight } = chip;
  const ShownIcon = icon || Icon;
  return (
    <span className={`chip tone-${tone} ${size ? `chip-${size}` : ''}`}>
      <ShownIcon weight={weight} />
      {label || chip.label}
    </span>
  );
}

export const StatusChip = ({ k, size }) => <Chip chip={chipFor(k)} size={size} />;
export const EmployeeStatus = ({ status, size }) => <Chip chip={employeeChip(status)} size={size} />;

export function Seg({ items, value, onChange, label, compact }) {
  return (
    <div role="tablist" aria-label={label} className={`seg ${compact ? 'compact' : ''}`}>
      {items.map(({ id, label: text, Icon, badge }) => (
        <button key={id} type="button" role="tab" aria-selected={value === id} onClick={() => onChange(id)}>
          {Icon && <Icon />}
          {text}
          {badge ? <span className="badge badge-sm">{badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

const pct = (n, total) => `${total ? Math.min(100, (n / total) * 100) : 0}%`;
function balanceLine(b) {
  return `${b.used} used · ${b.pending} pending · ${b.total} total`;
}

export function BalanceBar({ b, type, onSurface }) {
  const s = leaveStyle(type);
  return (
    <div role="progressbar" aria-label={`${b.leave_type_name} used`} className={`bar ${onSurface ? 'on-surface' : ''}`}>
      <span style={{ width: pct(b.used, b.total), background: s.ink }} />
      <span style={{ width: pct(b.pending, b.total), background: s.color, opacity: onSurface ? 0.7 : 1 }} />
    </div>
  );
}

export function BalanceSoft({ b, type }) {
  return (
    <div className="bal-soft" style={{ background: leaveStyle(type).soft }}>
      <div className="head">
        <span className="title-sm">{b.leave_type_name}</span>
        <span className="muted fs-13">
          <span className="num">{Math.max(0, b.available)}</span> of {b.total} left
        </span>
      </div>
      <BalanceBar b={b} type={type} onSurface />
      <div className="sub">{balanceLine(b)}</div>
    </div>
  );
}

export function BalanceCard({ b, type }) {
  const s = leaveStyle(type);
  return (
    <div className="bal-card">
      <div className="row between">
        <span className="title-sm">{b.leave_type_name}</span>
        <span className="code-tag" style={{ background: s.soft, color: s.ink }}>{b.code}</span>
      </div>
      <div>
        <span className="num">{Math.max(0, b.available)}</span>
        <span className="muted title-sm fw-6"> days available</span>
      </div>
      <BalanceBar b={b} type={type} />
      <div className="sub">{balanceLine(b)}</div>
    </div>
  );
}

export function Skeleton({ variant = 'dashboard' }) {
  if (variant === 'list') {
    return (
      <div role="status" aria-label="Loading" className="stack gap-16">
        <div className="skel" style={{ height: 70 }} />
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skel" style={{ height: 62 }} />)}
      </div>
    );
  }
  return (
    <div role="status" aria-label="Loading" className="stack gap-20">
      <div className="skel" style={{ height: 44, width: '40%' }} />
      <div className="grid-auto g-kpi">
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skel" style={{ height: 128 }} />)}
      </div>
      <div className="grid-auto g-360">
        <div className="skel" style={{ height: 300 }} />
        <div className="skel" style={{ height: 300 }} />
      </div>
      <div className="skel" style={{ height: 220 }} />
    </div>
  );
}

export function ErrorState({ error, what, onRetry }) {
  const offline = !error?.status || error.status >= 500;
  return (
    <div role="alert" className="state-card">
      <span className={`state-icon tone-${offline ? 'bad' : 'warn'}`}>
        {offline ? <WifiSlashIcon /> : <WarningIcon />}
      </span>
      <h2>{offline ? "We can't reach the server" : 'Something went wrong'}</h2>
      <p>
        {offline
          ? `Fellow couldn't load ${what}. Check your connection, or try again in a moment. Nothing you entered has been lost.`
          : `Fellow couldn't load ${what}: ${error.message}`}
      </p>
      <div className="row gap-10 mt-8">
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          <ArrowClockwiseIcon />
          Retry
        </button>
      </div>
      {error?.path && (
        <code>
          GET {error.path} · {error.status ? `HTTP ${error.status}` : 'ERR_CONNECTION_REFUSED'}
        </code>
      )}
    </div>
  );
}

export function EmptyState({ Icon, title, body, cta, onCta, CtaIcon = PlusIcon }) {
  return (
    <div className="state-card">
      <span className="empty-icon"><Icon /></span>
      <h2>{title}</h2>
      <p>{body}</p>
      {cta && (
        <button type="button" className="btn btn-primary mt-8" onClick={onCta}>
          <CtaIcon />
          {cta}
        </button>
      )}
    </div>
  );
}

export function DashedEmpty({ Icon, tone = 'green', title, body, action, span }) {
  return (
    <div className={`dashed-empty ${span ? 'span-all' : ''}`}>
      <span className={`icon-tile big tone-${tone}`}><Icon weight={tone === 'ok' ? 'fill' : 'regular'} /></span>
      <div className="t">{title}</div>
      {body && <div className="b">{body}</div>}
      {action}
    </div>
  );
}

export function PersonCell({ emp, name, sub, onOpen, size = 'ms' }) {
  return (
    <button type="button" className="cell-person" onClick={onOpen}>
      <Avatar emp={emp} size={size} />
      <span className="grow">
        <span className="person-name ellipsis">{name || fullName(emp)}</span>
        {sub && <span className="person-sub ellipsis">{sub}</span>}
      </span>
    </button>
  );
}
