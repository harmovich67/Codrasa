import { useEffect, useState } from 'react';
import { Send, Clock, Trash2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { fmtTime, fmtRelative } from '../lib/format.js';
import { toast } from '../store/toast.js';
import Markdown from './Markdown.jsx';
import { Badge, Button, IconButton } from './ui.jsx';

/* Questions pinned to an exact second + line of the lesson. */
export default function QuestionsPanel({ lessonId, getMoment, onJump, onChange, canAsk, preview }) {
  const [items, setItems] = useState([]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const moment = getMoment();

  useEffect(() => {
    api.get(`/questions/lesson/${lessonId}`).then((list) => {
      setItems(list);
      onChange?.(list);
    }).catch(toast.error);
  }, [lessonId]);

  const update = (list) => {
    setItems(list);
    onChange?.(list);
  };

  async function ask(e) {
    e.preventDefault();
    if (!body.trim()) return;
    if (preview) return toast.info('ده وضع المعاينة — سؤال الطالب الحقيقي هيوصلك في صفحة "أسئلة الطلاب"');
    setBusy(true);
    try {
      const m = getMoment();
      const q = await api.post(`/questions/lesson/${lessonId}`, { body, t_ms: m.t_ms, line: m.line, code: m.code });
      update([...items, q].sort((a, b) => a.t_ms - b.t_ms));
      setBody('');
      toast.success('سؤالك وصل للمدرّس');
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function remove(q) {
    try {
      await api.del(`/questions/${q.id}`);
      update(items.filter((x) => x.id !== q.id));
    } catch (err) {
      toast.error(err);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {canAsk && (
        <form onSubmit={ask} className="space-y-2 border-b border-line p-4">
          <div className="flex items-center gap-2 text-xs text-muted">
            <Clock className="size-3.5" />
            سؤالك هيتثبت عند <span className="font-mono text-ink">{fmtTime(moment.t_ms)}</span>
            {moment.line && (
              <>
                · السطر <span className="font-mono text-ink">{moment.line}</span>
              </>
            )}
          </div>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="إيه اللي مش واضح هنا؟" className="input min-h-20" />
          <Button type="submit" size="sm" icon={Send} loading={busy} disabled={!body.trim()}>
            إرسال السؤال
          </Button>
        </form>
      )}
      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
        {items.length === 0 && <p className="py-8 text-center text-sm text-muted">لسه مفيش أسئلة على الدرس ده.</p>}
        {items.map((q) => (
          <div key={q.id} className="rounded-xl border border-line bg-panel-2 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button onClick={() => onJump(q.t_ms)} className="rounded-md bg-brand/15 px-2 py-0.5 font-mono text-xs text-brand hover:bg-brand/25">
                  ▶ {fmtTime(q.t_ms)}
                </button>
                {q.line && <span className="font-mono text-xs text-muted">L{q.line}</span>}
                {q.mine && <Badge color="brand">سؤالك</Badge>}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-muted">{fmtRelative(q.created_at)}</span>
                {q.mine && !q.answer && <IconButton icon={Trash2} title="حذف" className="size-7" onClick={() => remove(q)} />}
              </div>
            </div>
            <p className="text-sm whitespace-pre-wrap">{q.body}</p>
            {q.answer ? (
              <div className="mt-3 border-r-2 border-mint pr-3">
                <p className="mb-1 text-xs font-medium text-mint">رد المدرّس</p>
                <Markdown>{q.answer}</Markdown>
              </div>
            ) : (
              <p className="mt-2 text-xs text-amber">في انتظار رد المدرّس…</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
