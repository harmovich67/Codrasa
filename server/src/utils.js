export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const httpError = (status, message) => new HttpError(status, message);

export function toInt(value) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

export function parseJSON(text, fallback = null) {
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export function errorHandler(err, req, res, _next) {
  if (res.headersSent) return res.end();
  let status = err.status || 500;
  if (err.code === 'LIMIT_FILE_SIZE') status = 413;
  if (err.type === 'entity.too.large') status = 413;
  if (status === 500) console.error(err);
  const message =
    status === 413 ? 'الملف أو البيانات أكبر من المسموح' : status === 500 ? 'حدث خطأ غير متوقع في الخادم' : err.message;
  res.status(status).json({ error: message });
}
