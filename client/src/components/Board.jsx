import { forwardRef, useEffect, useImperativeHandle, useReducer, useRef, useState } from 'react';
import { Eraser, Pencil, Type, Undo2, Trash2 } from 'lucide-react';
import { BOARD_H, BOARD_W, PEN_COLORS, PEN_WIDTHS, SYMBOLS, TEXT_SIZES, drawBoard, hitsItem, newId } from '../lib/board.js';
import { cx } from './ui.jsx';

// A 3:2 box whose <canvas> is sized to its own width (and the screen's pixel density).
function useFitCanvas() {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const [cssWidth, setCssWidth] = useState(0);
  useEffect(() => {
    const el = wrap.current;
    const measure = () => setCssWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const dpr = typeof window === 'undefined' ? 1 : Math.min(2, window.devicePixelRatio || 1);
  const pxW = Math.round(cssWidth * dpr);
  return { wrap, canvas, cssWidth, pxW, pxH: Math.round((pxW * BOARD_H) / BOARD_W) };
}

/* Read-only board for lesson playback: draws whatever the timeline says is on the board at `time`. */
export function BoardCanvas({ timeline, time, className }) {
  const { wrap, canvas, pxW, pxH } = useFitCanvas();
  useEffect(() => {
    if (!pxW || !canvas.current) return;
    drawBoard(canvas.current.getContext('2d'), timeline.visibleAt(time), time, pxW, pxH, timeline.bg);
  }, [timeline, time, pxW, pxH, canvas]);
  return (
    <div ref={wrap} className={cx('relative aspect-[3/2] w-full overflow-hidden rounded-xl bg-white', className)}>
      <canvas ref={canvas} width={pxW} height={pxH} className="absolute inset-0 size-full" role="img" aria-label="سبورة الدرس" />
    </div>
  );
}

const TOOLS = [
  { id: 'pen', label: 'قلم', icon: Pencil },
  { id: 'text', label: 'نص', icon: Type },
  { id: 'eraser', label: 'ممحاة', icon: Eraser },
];

/*
 * The teacher's board. Everything drawn while `recorder` is running is pushed to it as events;
 * `initialItems` is what is on the board before/after recording (a preview of the saved lesson).
 */
const BoardEditor = forwardRef(function BoardEditor({ recorder, active, bg, initialItems }, ref) {
  const { wrap, canvas, cssWidth, pxW, pxH } = useFitCanvas();
  const itemsRef = useRef(initialItems || []);
  const recRef = useRef(recorder);
  recRef.current = recorder;
  const [rev, bump] = useReducer((n) => n + 1, 0); // bump = items changed from outside, repaint
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [sizeIdx, setSizeIdx] = useState(1);
  const [draft, setDraft] = useState(null); // text being typed: { x, y, left, top, value }
  const current = useRef(null); // the stroke under the pen
  const pendingText = useRef(null); // where a text label was asked for, opened on pointer-up
  const draftRef = useRef(null);
  draftRef.current = draft;

  const paint = () => {
    if (!pxW || !canvas.current) return;
    drawBoard(canvas.current.getContext('2d'), itemsRef.current, Infinity, pxW, pxH, bg);
  };
  useEffect(paint, [pxW, pxH, bg, rev]);

  // Outside a recording the board just mirrors the saved lesson.
  useEffect(() => {
    if (!recorder) {
      itemsRef.current = initialItems || [];
      setDraft(null);
      bump();
    }
  }, [recorder, initialItems]);

  useImperativeHandle(ref, () => ({
    setItems(list) {
      itemsRef.current = list;
      bump();
    },
  }));

  const point = (e) => {
    const r = canvas.current.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * BOARD_W), Math.round(((e.clientY - r.top) / r.height) * BOARD_H)];
  };

  const remove = (ids) => {
    if (!ids.length) return;
    recRef.current.push({ t: recRef.current.now(), k: 'd', ids });
    itemsRef.current = itemsRef.current.filter((item) => !ids.includes(item.id));
    paint();
  };
  const eraseAt = (x, y) => remove(itemsRef.current.filter((item) => hitsItem(item, x, y, 16)).map((item) => item.id));

  function commitDraft() {
    const d = draftRef.current;
    draftRef.current = null; // a blur and the click that caused it must not commit twice
    setDraft(null);
    if (!d || !d.value.trim() || !recRef.current) return;
    const item = { id: newId(), kind: 't', t0: recRef.current.now(), die: Infinity, x: d.x, y: d.y, s: d.value.trimEnd(), c: color, z: TEXT_SIZES[sizeIdx] };
    recRef.current.push({ t: item.t0, k: 't', id: item.id, x: item.x, y: item.y, s: item.s, c: item.c, z: item.z });
    itemsRef.current = [...itemsRef.current, item];
    paint();
  }

  function onPointerDown(e) {
    if (!active || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (draftRef.current) return commitDraft();
    const [x, y] = point(e);
    if (tool === 'pen') {
      e.currentTarget.setPointerCapture(e.pointerId);
      current.current = { id: newId(), kind: 's', c: color, w: PEN_WIDTHS[sizeIdx], p: [[x, y, 0]], t0: recRef.current.now(), die: Infinity };
      itemsRef.current = [...itemsRef.current, current.current];
      paint();
    } else if (tool === 'eraser') {
      e.currentTarget.setPointerCapture(e.pointerId);
      current.current = { erasing: true };
      eraseAt(x, y);
    } else {
      // Opened on pointer-up: the browser moves focus on mousedown, which would blur a box opened right now.
      const r = canvas.current.getBoundingClientRect();
      pendingText.current = { x, y, left: e.clientX - r.left, top: e.clientY - r.top, value: '' };
    }
  }

  function onPointerMove(e) {
    const cur = current.current;
    if (!cur || !active) return;
    const [x, y] = point(e);
    if (cur.erasing) return eraseAt(x, y);
    const last = cur.p.at(-1);
    if (Math.hypot(x - last[0], y - last[1]) < 2) return;
    cur.p.push([x, y, recRef.current.now() - cur.t0]);
    paint();
  }

  function onPointerUp(e) {
    if (pendingText.current) {
      const opened = pendingText.current;
      pendingText.current = null;
      if (e.type === 'pointerup') setDraft(opened);
      return;
    }
    const cur = current.current;
    current.current = null;
    if (!cur || cur.erasing) return;
    recRef.current.push({ t: cur.t0, k: 's', id: cur.id, c: cur.c, w: cur.w, p: cur.p });
  }

  const undo = () => {
    if (!active || current.current) return;
    const last = itemsRef.current.at(-1);
    if (last) remove([last.id]);
  };
  const clear = () => {
    if (!active || current.current || !itemsRef.current.length) return;
    recRef.current.push({ t: recRef.current.now(), k: 'z' });
    itemsRef.current = [];
    paint();
  };

  const scale = cssWidth / BOARD_W;
  const btn = 'inline-flex size-10 items-center justify-center rounded-xl border transition active:scale-95 disabled:opacity-40 md:size-9';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-panel p-2 shadow-card">
        <div className="flex gap-1">
          {TOOLS.map(({ id, label, icon: Icon }) => (
            <button key={id} title={label} aria-label={label} onClick={() => setTool(id)} className={cx(btn, tool === id ? 'border-brand bg-brand/10 text-brand' : 'border-line bg-panel-2 text-muted')}>
              <Icon className="size-4.5" />
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {PEN_COLORS.map((c) => (
            <button
              key={c}
              aria-label={c}
              onClick={() => setColor(c)}
              className={cx('size-7 rounded-full border-2 transition', color === c ? 'scale-110 border-ink' : 'border-white shadow')}
              style={{ background: c }}
            />
          ))}
        </div>
        <div className="flex items-center gap-1">
          {PEN_WIDTHS.map((w, i) => (
            <button key={w} title={`سُمك ${i + 1}`} onClick={() => setSizeIdx(i)} className={cx(btn, sizeIdx === i ? 'border-brand bg-brand/10' : 'border-line bg-panel-2')}>
              <span className="rounded-full bg-ink" style={{ width: 5 + i * 5, height: 5 + i * 5 }} />
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button title="تراجع" aria-label="تراجع" disabled={!active} onClick={undo} className={cx(btn, 'border-line bg-panel-2 text-muted')}>
          <Undo2 className="size-4.5" />
        </button>
        <button title="مسح السبورة" aria-label="مسح السبورة" disabled={!active} onClick={clear} className={cx(btn, 'border-line bg-panel-2 text-rose')}>
          <Trash2 className="size-4.5" />
        </button>
      </div>

      {tool === 'text' && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-panel px-2 py-1.5">
          <span className="text-xs text-muted">رموز:</span>
          {SYMBOLS.map((s) => (
            <button
              key={s}
              // keep the text box focused: a click here must not blur (and so commit) the label being typed
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => draft && setDraft({ ...draft, value: draft.value + s })}
              className="h-8 min-w-8 rounded-lg border border-line bg-panel-2 px-1.5 font-mono text-sm text-ink transition hover:border-brand/50 disabled:opacity-40"
              disabled={!draft}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div ref={wrap} className={cx('relative aspect-[3/2] w-full overflow-hidden rounded-2xl border bg-white shadow-card', active ? 'border-rose/60 shadow-[0_0_0_3px] shadow-rose/15' : 'border-line')}>
        <canvas
          ref={canvas}
          width={pxW}
          height={pxH}
          className={cx('absolute inset-0 size-full touch-none', active ? (tool === 'text' ? 'cursor-text' : 'cursor-crosshair') : 'cursor-not-allowed')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {!active && !recorder && <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-muted">ابدأ التسجيل عشان ترسم على السبورة</p>}
        {draft && (
          <textarea
            autoFocus
            dir="auto"
            value={draft.value}
            onChange={(e) => setDraft({ ...draft, value: e.target.value })}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setDraft(null);
              else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                commitDraft();
              }
            }}
            rows={1}
            placeholder="اكتب هنا ثم Enter"
            className="absolute resize-none rounded-md border border-dashed border-brand/60 bg-white/80 px-1 outline-none"
            style={{ left: draft.left, top: draft.top, minWidth: 140, color, fontSize: Math.max(14, TEXT_SIZES[sizeIdx] * scale), lineHeight: 1.35 }}
          />
        )}
      </div>
    </div>
  );
});

export default BoardEditor;
