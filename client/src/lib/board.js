/*
 * A whiteboard lesson is, like a code lesson, not a video: it is the stream of what the teacher drew.
 *   { v: 2, kind: 'board', bg: 'plain' | 'grid', duration, events: [...] }
 * events (t = ms from start, coordinates live in a fixed BOARD_W x BOARD_H space so any screen can replay them):
 *   { t, k: 's', id, c, w, p: [[x, y, dt], ...] }   a pen stroke (t = when the pen went down, dt = ms since then)
 *   { t, k: 't', id, x, y, s, c, z }                 a text label
 *   { t, k: 'd', ids: [...] }                        items removed (undo / eraser)
 *   { t, k: 'z' }                                    board cleared
 */

export const BOARD_W = 1200;
export const BOARD_H = 800;
export const PEN_COLORS = ['#1c2040', '#d63a56', '#0b8f6c', '#6c4cf6', '#b8730a', '#0ea5e9'];
export const PEN_WIDTHS = [3, 6, 12];
export const TEXT_SIZES = [28, 40, 56];
export const SYMBOLS = ['²', '³', '√', 'π', '∑', '∫', '∞', '±', '×', '÷', '≤', '≥', '≠', '≈', 'θ', 'α', 'β', 'Δ', 'Ω', '°', '½', '→'];

export const newId = () => Math.random().toString(36).slice(2, 9);
const isArabic = (s) => /[؀-ۿ]/.test(s);

// ---------------------------------------------------------------- recording

export class BoardRecorder {
  // `base` = an existing recording to continue: new events are appended after its last moment.
  constructor(base = null, bg = 'plain') {
    this.base = base;
    this.bg = base?.bg ?? bg;
    this.events = [];
    this.t0 = 0;
    this.pausedAt = null;
  }

  now() {
    return Math.round((this.pausedAt ?? performance.now()) - this.t0);
  }

  start() {
    this.t0 = performance.now() - (this.base?.duration || 0);
    this.events = this.base ? [...this.base.events] : [];
  }

  pause() {
    if (this.pausedAt === null) this.pausedAt = performance.now();
  }

  resume() {
    if (this.pausedAt === null) return;
    this.t0 += performance.now() - this.pausedAt;
    this.pausedAt = null;
  }

  push(event) {
    if (this.pausedAt === null) this.events.push(event);
  }

  stop() {
    return { v: 2, kind: 'board', bg: this.bg, duration: this.now(), events: this.events };
  }
}

// ---------------------------------------------------------------- playback

// Turns the event list into items that know when they appear and disappear.
export function createBoardTimeline(rec) {
  const items = [];
  const byId = new Map();
  for (const ev of rec?.events || []) {
    if (ev.k === 's') {
      const item = { ...ev, kind: 's', t0: ev.t, t1: ev.t + (ev.p.at(-1)?.[2] ?? 0), die: Infinity };
      items.push(item);
      byId.set(ev.id, item);
    } else if (ev.k === 't') {
      const item = { ...ev, kind: 't', t0: ev.t, t1: ev.t, die: Infinity };
      items.push(item);
      byId.set(ev.id, item);
    } else if (ev.k === 'd') {
      for (const id of ev.ids || []) {
        const item = byId.get(id);
        if (item && item.die === Infinity) item.die = ev.t;
      }
    } else if (ev.k === 'z') {
      for (const item of items) if (item.die === Infinity) item.die = ev.t;
    }
  }

  const visibleAt = (t) => items.filter((item) => item.t0 <= t && t < item.die);

  // Drawing density per bucket, shown under the scrubber like the typing waveform of code lessons.
  function activity(buckets = 120) {
    const duration = Math.max(1, rec?.duration || 1);
    const out = new Array(buckets).fill(0);
    for (const item of items) {
      const from = Math.min(buckets - 1, Math.floor((item.t0 / duration) * buckets));
      const to = Math.min(buckets - 1, Math.floor((item.t1 / duration) * buckets));
      for (let b = from; b <= to; b++) out[b] += 1;
    }
    const max = Math.max(1, ...out);
    return out.map((n) => n / max);
  }

  return { duration: rec?.duration || 0, bg: rec?.bg || 'plain', items, visibleAt, activity };
}

// ---------------------------------------------------------------- drawing

export function drawBoard(ctx, items, t, width, height, bg = 'plain') {
  const k = width / BOARD_W;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  if (bg === 'grid') {
    ctx.strokeStyle = '#e3e7f6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= BOARD_W; x += 50) {
      ctx.moveTo(x * k, 0);
      ctx.lineTo(x * k, height);
    }
    for (let y = 0; y <= BOARD_H; y += 50) {
      ctx.moveTo(0, y * k);
      ctx.lineTo(width, y * k);
    }
    ctx.stroke();
  }
  ctx.setTransform(k, 0, 0, k, 0, 0);
  for (const item of items) {
    if (item.kind === 's') drawStroke(ctx, item, t);
    else drawText(ctx, item);
  }
}

function drawStroke(ctx, item, t) {
  const pts = [];
  for (const p of item.p) {
    if (item.t0 + p[2] > t) break;
    pts.push(p);
  }
  if (!pts.length) return;
  ctx.strokeStyle = item.c;
  ctx.fillStyle = item.c;
  ctx.lineWidth = item.w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0][0], pts[0][1], item.w / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  // Quadratic curves through the midpoints make hand strokes look smooth instead of polygonal.
  for (let i = 1; i < pts.length - 1; i++) {
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
  }
  ctx.lineTo(pts.at(-1)[0], pts.at(-1)[1]);
  ctx.stroke();
}

const LINE_HEIGHT = 1.35;

function drawText(ctx, item) {
  const rtl = isArabic(item.s);
  ctx.fillStyle = item.c;
  ctx.font = `${item.z}px "IBM Plex Sans Arabic", system-ui, sans-serif`;
  ctx.textBaseline = 'top';
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.textAlign = rtl ? 'right' : 'left';
  item.s.split('\n').forEach((line, i) => ctx.fillText(line, item.x, item.y + i * item.z * LINE_HEIGHT));
}

// ---------------------------------------------------------------- hit testing (eraser)

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const u = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + u * dx), py - (ay + u * dy));
}

function textBox(item) {
  const lines = item.s.split('\n');
  const width = Math.max(...lines.map((l) => l.length)) * item.z * 0.6;
  const height = lines.length * item.z * LINE_HEIGHT;
  const x0 = isArabic(item.s) ? item.x - width : item.x;
  return { x0, y0: item.y, x1: x0 + width, y1: item.y + height };
}

export function hitsItem(item, x, y, radius) {
  if (item.kind === 't') {
    const b = textBox(item);
    return x >= b.x0 - radius && x <= b.x1 + radius && y >= b.y0 - radius && y <= b.y1 + radius;
  }
  const reach = radius + item.w / 2;
  const p = item.p;
  if (p.length === 1) return Math.hypot(x - p[0][0], y - p[0][1]) <= reach;
  for (let i = 1; i < p.length; i++) {
    if (distToSegment(x, y, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1]) <= reach) return true;
  }
  return false;
}
