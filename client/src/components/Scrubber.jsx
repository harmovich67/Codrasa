import { useRef, useState } from 'react';
import { fmtTime } from '../lib/format.js';

/* Timeline with a typing-activity waveform behind it and markers (questions, runs) on top. */
export default function Scrubber({ time, duration, onSeek, activity = [], markers = [] }) {
  const ref = useRef(null);
  const dragging = useRef(false);
  const [hover, setHover] = useState(null);
  const pct = duration ? (time / duration) * 100 : 0;

  const tAt = (e) => {
    const r = ref.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    return { t: ratio * duration, x: ratio * 100 };
  };

  return (
    <div
      dir="ltr"
      ref={ref}
      className="group relative h-11 flex-1 cursor-pointer touch-none select-none"
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        onSeek(tAt(e).t);
      }}
      onPointerMove={(e) => {
        const p = tAt(e);
        setHover(p);
        if (dragging.current) onSeek(p.t);
      }}
      onPointerUp={() => (dragging.current = false)}
      onPointerLeave={() => setHover(null)}
    >
      <div className="absolute inset-x-0 top-1 flex h-6 items-end gap-px">
        {activity.map((v, i) => (
          <div
            key={i}
            className={(i / activity.length) * 100 < pct ? 'flex-1 rounded-sm bg-brand/50' : 'flex-1 rounded-sm bg-muted/20'}
            style={{ height: `${v ? Math.max(12, v * 100) : 4}%` }}
          />
        ))}
      </div>
      <div className="absolute inset-x-0 top-8 h-1.5 rounded-full bg-line">
        <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
      </div>
      <div
        className="absolute top-[26px] size-3.5 -translate-x-1/2 rounded-full border-2 border-white bg-brand shadow transition-transform group-hover:scale-125"
        style={{ left: `${pct}%` }}
      />
      {markers.map((m, i) => (
        <div
          key={i}
          title={m.title}
          className={`absolute -translate-x-1/2 ${m.big ? 'top-[35px] size-3 rotate-45 rounded-[3px] ring-2 ring-panel' : 'top-[38px] size-1.5 rounded-full'} ${m.color || 'bg-amber'}`}
          style={{ left: `${duration ? (m.t / duration) * 100 : 0}%` }}
        />
      ))}
      {hover && (
        <div
          className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded-md bg-panel-2 px-2 py-0.5 font-mono text-xs shadow"
          style={{ left: `${hover.x}%` }}
        >
          {fmtTime(hover.t)}
        </div>
      )}
    </div>
  );
}
