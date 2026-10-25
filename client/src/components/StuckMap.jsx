import { useEffect, useState } from 'react';
import { Flame, Eye, CircleCheck, ListChecks, Target, Wrench } from 'lucide-react';
import { api } from '../lib/api.js';
import { fmtTime } from '../lib/format.js';
import { toast } from '../store/toast.js';
import { Button, Empty, PageLoader, Stat, cx } from './ui.jsx';

const LEGEND = [
  { key: 'pause', label: 'إيقاف', color: 'bg-muted' },
  { key: 'rewind', label: 'رجوع للخلف', color: 'bg-amber' },
  { key: 'error', label: 'Error في كود الطالب', color: 'bg-rose' },
  { key: 'question', label: 'سؤال', color: 'bg-brand' },
];

// Turns the loudest signal of a hot spot into something the teacher can act on.
function advice(bin) {
  const signals = [
    ['error', bin.error * 3, 'الطلاب بيغلطوا في تشغيل الكود هنا — أعد شرح الخطوة دي بمثال شغّال وركّز على الخطأ الشائع.'],
    ['question', bin.question * 4, 'أسئلة كتير اتسألت هنا — الفكرة غامضة؛ أعد صياغتها أو ضيف مثال قبلها.'],
    ['rewind', bin.rewind * 2, 'الطلاب بيرجعوا لهنا كتير — أعد الشرح بسرعة أبطأ أو قسّمه لخطوتين.'],
    ['pause', bin.pause, 'الطلاب بيقفوا هنا يفكروا — ضيف تحدي صغير يثبّت الفكرة.'],
  ];
  return signals.sort((a, b) => b[1] - a[1])[0][2];
}

function heat(score, max) {
  const r = max ? score / max : 0;
  if (r > 0.66) return 'bg-rose';
  if (r > 0.33) return 'bg-amber';
  if (r > 0) return 'bg-brand/70';
  return 'bg-line';
}

export default function StuckMap({ lessonId, onJump, onAddChallenge }) {
  const [data, setData] = useState(null);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    api.get(`/lessons/${lessonId}/stuckmap`).then(setData).catch(toast.error);
  }, [lessonId]);

  if (!data) return <PageLoader />;
  const max = Math.max(0, ...data.bins.map((b) => b.score));

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={Eye} label="طلاب شافوا الدرس" value={data.viewers} />
        <Stat icon={CircleCheck} label="كمّلوه للآخر" value={data.completed} tone="mint" />
        <Stat icon={ListChecks} label="متوسط الاختبار" value={data.avg_quiz != null ? `${data.avg_quiz}%` : '—'} tone="amber" />
      </div>

      {data.totalEvents === 0 ? (
        <Empty icon={Flame} title="لسه مفيش بيانات كفاية" text="أول ما الطلاب يبدأوا يتفرجوا، هتشوف هنا بالظبط فين بيوقفوا ويرجعوا ويغلطوا." />
      ) : (
        <>
          <div>
            <div dir="ltr" className="relative flex h-40 items-end gap-0.5 rounded-xl border border-line bg-panel-2 p-3">
              {data.bins.map((b, i) => (
                <button
                  key={i}
                  onClick={() => onJump?.(b.start)}
                  onMouseEnter={() => setHover(b)}
                  onMouseLeave={() => setHover(null)}
                  className={cx('flex-1 rounded-t transition hover:opacity-80', heat(b.score, max))}
                  style={{ height: `${max ? Math.max(3, (b.score / max) * 100) : 3}%` }}
                />
              ))}
            </div>
            <div dir="ltr" className="mt-1 flex justify-between font-mono text-[11px] text-muted">
              <span>00:00</span>
              <span>{fmtTime(data.duration)}</span>
            </div>
            <div className="mt-2 h-12 text-sm">
              {hover ? (
                <div className="flex flex-wrap items-center gap-4">
                  <span className="font-mono">
                    {fmtTime(hover.start)} – {fmtTime(hover.end)}
                  </span>
                  {LEGEND.map((l) => (
                    <span key={l.key} className="inline-flex items-center gap-1.5 text-muted">
                      <span className={cx('size-2 rounded-full', l.color)} />
                      {l.label}: <b className="text-ink">{hover[l.key]}</b>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted">مرّر على أي عمود لتفاصيله، واضغط عليه لتفتح الدرس عند اللحظة دي.</p>
              )}
            </div>
          </div>

          <div>
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <Flame className="size-4.5 text-rose" /> أكتر لحظات الطلاب اتلخبطوا فيها
            </h3>
            <div className="space-y-2">
              {data.hot.map((b, i) => (
                <div key={i} className="overflow-hidden rounded-xl border border-line bg-panel-2">
                  <button onClick={() => onJump?.(b.start)} className="flex w-full items-center justify-between px-4 py-3 text-sm transition hover:bg-panel">
                    <span className="font-mono">
                      {fmtTime(b.start)} – {fmtTime(b.end)}
                    </span>
                    <span className="flex gap-3 text-xs text-muted">
                      {b.rewind > 0 && <span>↩ {b.rewind} رجوع</span>}
                      {b.error > 0 && <span className="text-rose">✕ {b.error} أخطاء</span>}
                      {b.question > 0 && <span className="text-brand">؟ {b.question} أسئلة</span>}
                      {b.pause > 0 && <span>⏸ {b.pause}</span>}
                    </span>
                  </button>
                  <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-2.5">
                    <Wrench className="size-4 shrink-0 text-amber" />
                    <p className="min-w-0 flex-1 text-xs leading-6 text-muted">
                      <b className="text-ink">أعد شرح {fmtTime(b.start)}:</b> {advice(b)}
                    </p>
                    {onAddChallenge && (
                      <Button size="sm" variant="subtle" icon={Target} onClick={() => onAddChallenge(b.start)}>
                        أضف تحدي هنا
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
