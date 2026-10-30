import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X, CircleCheck, CircleAlert, Info } from 'lucide-react';
import { useToasts } from '../store/toast.js';

const cx = (...c) => c.filter(Boolean).join(' ');
export { cx };

const VARIANTS = {
  primary: 'bg-brand text-white hover:bg-brand/90 shadow-lg shadow-brand/20',
  subtle: 'bg-panel-2 text-ink border border-line hover:border-muted/40',
  ghost: 'text-muted hover:text-ink hover:bg-panel-2',
  danger: 'bg-rose/10 text-rose border border-rose/30 hover:bg-rose/20',
  mint: 'bg-mint/15 text-mint border border-mint/30 hover:bg-mint/25',
  rec: 'bg-rose text-white hover:bg-rose/90 shadow-lg shadow-rose/25',
};
const SIZES = { sm: 'h-9 px-3 text-xs gap-1.5 md:h-8', md: 'h-11 px-4 text-sm gap-2 md:h-10', lg: 'h-12 px-6 text-base gap-2' };

export function Button({ variant = 'primary', size = 'md', icon: Icon, loading, className, children, ...props }) {
  return (
    <button
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-xl font-medium transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon && <Icon className="size-4" />}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, title, className, active, ...props }) {
  return (
    <button
      title={title}
      aria-label={title}
      className={cx(
        'inline-flex size-10 items-center justify-center rounded-xl transition active:scale-95 disabled:opacity-40 md:size-9',
        active ? 'bg-brand/20 text-brand' : 'text-muted hover:bg-panel-2 hover:text-ink',
        className,
      )}
      {...props}
    >
      <Icon className="size-4.5" />
    </button>
  );
}

export function Card({ className, children, ...props }) {
  return (
    <div className={cx('rounded-2xl border border-line bg-panel shadow-card', className)} {...props}>
      {children}
    </div>
  );
}

export function Field({ label, hint, children, className }) {
  return (
    <label className={cx('block space-y-1.5', className)}>
      {label && <span className="text-xs font-medium text-muted">{label}</span>}
      {children}
      {hint && <span className="block text-xs text-muted/70">{hint}</span>}
    </label>
  );
}

export const Input = ({ className, ...props }) => <input className={cx('input', className)} {...props} />;
export const Textarea = ({ className, ...props }) => <textarea className={cx('input min-h-24 resize-y', className)} {...props} />;
export const Select = ({ className, children, ...props }) => (
  <select className={cx('input', className)} {...props}>
    {children}
  </select>
);

export function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="inline-flex items-center gap-2.5 text-sm">
      <span className={cx('relative h-5.5 w-10 rounded-full transition', checked ? 'bg-mint' : 'bg-line')}>
        <span className={cx('absolute top-0.5 size-4.5 rounded-full bg-white shadow transition-all', checked ? 'right-5' : 'right-0.5')} />
      </span>
      {label}
    </button>
  );
}

const BADGE = {
  brand: 'bg-brand/15 text-brand',
  mint: 'bg-mint/15 text-mint',
  amber: 'bg-amber/15 text-amber',
  rose: 'bg-rose/15 text-rose',
  muted: 'bg-panel-2 text-muted',
};
export const Badge = ({ color = 'muted', className, children }) => (
  <span className={cx('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium', BADGE[color], className)}>{children}</span>
);

export function Modal({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  // Portal to <body>: the page wrapper's transform animation would otherwise trap `fixed` inside it.
  return createPortal(
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm animate-fade p-0 sm:p-4"
      onMouseDown={onClose}
    >
      <div className="flex min-h-full items-end justify-center sm:items-center">
        <div
          className={cx(
            'relative my-auto flex max-h-[90dvh] w-full flex-col rounded-t-3xl border border-line bg-panel shadow-float animate-sheet sm:max-h-[85vh] sm:animate-none sm:rounded-2xl',
            wide ? 'max-w-3xl' : 'max-w-lg',
          )}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
            <h3 className="font-semibold">{title}</h3>
            <IconButton icon={X} title="إغلاق" onClick={onClose} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto space-y-4 p-5">
            {children}
          </div>
          {footer && (
            <div className="flex shrink-0 justify-end gap-2 border-t border-line px-5 py-4">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export const Spinner = ({ className }) => <Loader2 className={cx('size-6 animate-spin text-brand', className)} />;

export const PageLoader = () => (
  <div className="flex h-64 items-center justify-center">
    <Spinner />
  </div>
);

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      {Icon && (
        <div className="mb-4 rounded-2xl bg-brand/10 p-4 text-brand">
          <Icon className="size-7" />
        </div>
      )}
      <h3 className="font-semibold">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {children}
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ icon: Icon, label, value, hint, tone = 'brand' }) {
  const tones = { brand: 'text-brand bg-brand/10', mint: 'text-mint bg-mint/10', amber: 'text-amber bg-amber/10', rose: 'text-rose bg-rose/10' };
  return (
    <Card className="p-3.5 md:p-4">
      <div className="flex items-start justify-between gap-2 md:gap-3">
        <div>
          <p className="text-xs text-muted">{label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums md:mt-1.5 md:text-2xl">{value}</p>
          {hint && <p className="mt-1 text-[11px] text-muted md:text-xs">{hint}</p>}
        </div>
        {Icon && (
          <div className={cx('shrink-0 rounded-xl p-2 md:p-2.5', tones[tone])}>
            <Icon className="size-4.5 md:size-5" />
          </div>
        )}
      </div>
    </Card>
  );
}

// fill: tabs share the full width equally (forms), instead of hugging their labels.
export function Tabs({ tabs, value, onChange, className, fill }) {
  const bar = useRef(null);
  // On phones the bar scrolls sideways: keep the active tab in view (e.g. when opened with ?tab=…).
  useEffect(() => {
    bar.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [value]);
  return (
    <div ref={bar} role="tablist" className={cx('flex gap-1 overflow-x-auto rounded-2xl border border-line bg-panel p-1 shadow-card [scrollbar-width:none]', className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cx(
            'inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm transition md:py-1.5',
            fill && 'flex-1 justify-center',
            value === t.id ? 'bg-brand/10 font-medium text-brand' : 'text-muted hover:text-ink',
          )}
        >
          {t.icon && <t.icon className="size-4" />}
          {t.label}
          {t.count ? <span className="rounded bg-rose/20 px-1.5 text-[10px] text-rose">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ value, className, color = 'bg-mint' }) {
  return (
    <div className={cx('h-1.5 overflow-hidden rounded-full bg-line', className)}>
      <div className={cx('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

const TOAST_ICON = { success: CircleCheck, error: CircleAlert, info: Info };
const TOAST_TONE = { success: 'text-mint', error: 'text-rose', info: 'text-brand' };
// Errors stand out: tinted card, accent edge, a title and a short shake.
const TOAST_BOX = {
  success: 'border-line bg-panel animate-page',
  info: 'border-line bg-panel animate-page',
  error: 'toast-shake border-rose/40 border-r-4 border-r-rose bg-[#fff1f3] shadow-rose/20',
};

export function Toaster() {
  const { items, dismiss } = useToasts();
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col gap-2 md:inset-x-auto md:bottom-4 md:left-4 md:w-80">
      {items.map((t) => {
        const Icon = TOAST_ICON[t.type];
        return (
          <div
            key={t.id}
            onClick={() => dismiss(t.id)}
            role={t.type === 'error' ? 'alert' : 'status'}
            className={cx('pointer-events-auto flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 text-sm shadow-float', TOAST_BOX[t.type])}
          >
            {t.type === 'error' ? (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-rose text-white">
                <Icon className="size-4.5" />
              </span>
            ) : (
              <Icon className={cx('mt-0.5 size-4.5 shrink-0', TOAST_TONE[t.type])} />
            )}
            {t.type === 'error' ? (
              <span className="min-w-0 leading-relaxed">
                <b className="block text-rose">حصلت مشكلة</b>
                <span className="text-ink">{t.message}</span>
              </span>
            ) : (
              <span className="leading-relaxed">{t.message}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
