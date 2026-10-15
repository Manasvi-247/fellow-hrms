import { ConfettiIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import * as api from '../api.js';
import { useApp } from '../state.jsx';
import { useLoad } from '../lib/hooks.js';
import { MON, MONL, daysBetween, dowLong, fmtLong, plural, toD, todayISO } from '../lib/dates.js';
import { chipFor } from '../lib/ui.js';
import { Chip, EmptyState, ErrorState, Skeleton } from '../components/common.jsx';

export default function Holidays() {
  const { isAdmin, version, openModal } = useApp();
  const today = todayISO();
  const year = Number(today.slice(0, 4));
  const q = useLoad(() => api.listHolidays(year), [year, version]);

  if (q.error) return <ErrorState error={q.error} what="holidays" onRetry={q.reload} />;
  if (!q.data) return <Skeleton variant="list" />;
  if (!q.data.length) {
    return (
      <EmptyState
        Icon={ConfettiIcon}
        title={`No holidays for ${year}`}
        body="Add public and optional holidays so everyone can plan their time off."
        cta={isAdmin ? 'Add holiday' : null}
        onCta={() => openModal('holiday')}
      />
    );
  }

  const list = [...q.data].sort((a, b) => (a.date < b.date ? -1 : 1));
  const months = [];
  list.forEach((h) => {
    const m = +h.date.slice(5, 7) - 1;
    let g = months.find((x) => x.m === m);
    if (!g) months.push((g = { m, items: [] }));
    g.items.push(h);
  });
  const next = list.find((h) => h.date >= today);
  const awayOf = (h) => daysBetween(today, h.date);

  return (
    <div className="page">
      <div className="hol-top">
        <section className="hol-next">
          <div className="hero-tex" aria-hidden="true" />
          <div className="hero-veil" aria-hidden="true" />
          <span className="badge-icon"><ConfettiIcon weight="fill" /></span>
          <div className="grow hol-next-text">
            <div className="label-sm muted">Next holiday</div>
            <div className="name">{next ? next.name : 'None left this year'}</div>
            <div className="fs-14 muted">{next ? fmtLong(next.date) : 'Enjoy the rest of the year.'}</div>
          </div>
          {next && (
            <span className="away">{awayOf(next) === 0 ? 'Today' : `${plural(awayOf(next), 'day')} to go`}</span>
          )}
        </section>
        <section className="card hol-counts">
          <div><div className="n">{list.filter((h) => h.type === 'PUBLIC').length}</div><div className="l">Public</div></div>
          <div><div className="n">{list.filter((h) => h.type === 'OPTIONAL').length}</div><div className="l">Optional</div></div>
          <div><div className="n">{list.filter((h) => h.date >= today).length}</div><div className="l">Still ahead</div></div>
        </section>
      </div>
      <div className="toolbar">
        <p className="fs-14 muted">Optional holidays can be taken in place of any one working day.</p>
        {isAdmin && (
          <button type="button" className="btn btn-primary" onClick={() => openModal('holiday')}>
            <PlusIcon weight="bold" />
            Add holiday
          </button>
        )}
      </div>
      <div className="hol-months">
        {months.map((g) => (
          <section key={g.m} className="card hol-month">
            <div className="row between baseline mb-6">
              <h3 className="card-title">{MONL[g.m]}</h3>
              <span className="fs-12 muted fw-6">{plural(g.items.length, 'holiday')}</span>
            </div>
            {g.items.map((h) => {
              const d = toD(h.date);
              const away = awayOf(h);
              const chip = chipFor(h.type);
              return (
                <div key={h.id} className={`hol-item ${away < 0 ? 'past' : ''}`}>
                  <span className={`date-tile sm tone-${chip.tone}`}>
                    <span className="m">{MON[d.getMonth()].toUpperCase()}</span>
                    <span className="d">{d.getDate()}</span>
                  </span>
                  <span className="grow">
                    <span className="person-name">{h.name}</span>
                    <span className="sub block">
                      {dowLong(h.date)} · {away < 0 ? 'Passed' : away === 0 ? 'Today' : `In ${plural(away, 'day')}`}
                    </span>
                  </span>
                  <Chip chip={chip} size="sm" />
                  {isAdmin && (
                    <button
                      type="button"
                      className="icon-btn-sm danger"
                      aria-label={`Delete ${h.name}`}
                      onClick={() => openModal('deleteHoliday', { holiday: h })}
                    >
                      <TrashIcon />
                    </button>
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
