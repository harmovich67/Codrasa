const LOCALE = 'ar-EG-u-nu-latn';

export function fmtTime(ms = 0) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const mmss = `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return h ? `${h}:${mmss}` : mmss;
}

// SQLite returns "YYYY-MM-DD HH:MM:SS" in UTC, or a bare date.
export function parseDate(s) {
  if (!s) return null;
  if (s.length === 10) return new Date(`${s}T00:00:00`);
  return new Date(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`);
}

export function fmtDate(s) {
  const d = parseDate(s);
  return d ? d.toLocaleDateString(LOCALE, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
}

const rtf = new Intl.RelativeTimeFormat('ar', { numeric: 'auto' });

export function fmtRelative(s) {
  const d = parseDate(s);
  if (!d) return 'لم يبدأ بعد';
  const diff = (d.getTime() - Date.now()) / 1000;
  const steps = [
    [60, 'second'],
    [3600, 'minute', 60],
    [86400, 'hour', 3600],
    [604800, 'day', 86400],
    [2629800, 'week', 604800],
    [31557600, 'month', 2629800],
    [Infinity, 'year', 31557600],
  ];
  for (const [limit, unit, div = 1] of steps) {
    if (Math.abs(diff) < limit) return rtf.format(Math.round(diff / div), unit);
  }
  return fmtDate(s);
}

export const fmtNumber = (n) => Number(n || 0).toLocaleString(LOCALE);
export const fmtMoney = (n, currency = '') => `${fmtNumber(Math.round((n || 0) * 100) / 100)} ${currency}`.trim();

export const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);
