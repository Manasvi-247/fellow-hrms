import { useEffect, useRef } from 'react';
import { XIcon } from '@phosphor-icons/react';

export function Modal({ width, onClose, children, label }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    const prev = document.activeElement;
    const first = ref.current?.querySelector('input:not([type=checkbox]), select, textarea, button.btn-primary, button.btn-danger');
    first?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, []);
  return (
    <div className="overlay" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`dialog ${width ? `w-${width}` : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHead({ title, sub, onClose }) {
  return (
    <div className="dialog-head">
      <div>
        <h2>{title}</h2>
        {sub && <div className="fs-13 muted mt-2">{sub}</div>}
      </div>
      <button type="button" className="close-btn" aria-label="Close" onClick={onClose}>
        <XIcon />
      </button>
    </div>
  );
}

export function DialogFoot({ onCancel, children, cancelLabel = 'Cancel' }) {
  return (
    <div className="dialog-foot">
      <button type="button" className="btn btn-secondary" onClick={onCancel}>{cancelLabel}</button>
      {children}
    </div>
  );
}

export function ConfirmBody({ Icon, tone, title, body, children, actions }) {
  return (
    <div className="confirm">
      <div className="confirm-head">
        <span className={`icon-tile md tone-${tone}`}><Icon /></span>
        <div>
          <h2>{title}</h2>
          {body && <p>{body}</p>}
        </div>
      </div>
      {children}
      <div className="confirm-actions">{actions}</div>
    </div>
  );
}

export function Field({ label, error, children, span, hint }) {
  return (
    <label className={`field ${span ? 'span-all' : ''}`}>
      <span>
        {label} {hint && <span className="field-label-muted">{hint}</span>}
      </span>
      {children}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}
