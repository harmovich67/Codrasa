import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { MessagesSquare, Sparkles, Send, Trash2, Play } from 'lucide-react';
import { api } from '../../lib/api.js';
import { fmtRelative, fmtTime } from '../../lib/format.js';
import { toast } from '../../store/toast.js';
import Markdown from '../../components/Markdown.jsx';
import { Badge, Button, Card, Empty, IconButton, PageHeader, PageLoader, Tabs, Textarea, cx } from '../../components/ui.jsx';

function CodeSnapshot({ code, line }) {
  if (!code) return null;
  const lines = code.split('\n');
  // Show a window of lines around the one the student pointed at.
  const from = line ? Math.max(0, line - 6) : 0;
  const slice = lines.slice(from, from + 12);
  return (
    <pre dir="ltr" className="overflow-x-auto rounded-lg border border-slate-800 bg-[#0b1018] py-2 text-left font-mono text-xs leading-5 text-slate-200">
      {slice.map((l, i) => {
        const n = from + i + 1;
        return (
          <div key={n} className={cx('flex px-3', n === line && 'bg-amber-400/20')}>
            <span className="w-8 shrink-0 text-slate-500 select-none">{n}</span>
            <span className="whitespace-pre">{l || ' '}</span>
          </div>
        );
      })}
    </pre>
  );
}

function QuestionCard({ q, onChanged }) {
  const [answer, setAnswer] = useState(q.answer || '');
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [editing, setEditing] = useState(!q.answer);

  async function draft() {
    setDrafting(true);
    try {
      const res = await api.post('/ai/draft-answer', { questionId: q.id });
      setAnswer(res.answer);
      setEditing(true);
    } catch (err) {
      toast.error(err);
    } finally {
      setDrafting(false);
    }
  }

  async function send() {
    setBusy(true);
    try {
      await api.put(`/questions/${q.id}/answer`, { answer });
      toast.success('اتبعت الرد ✓');
      setEditing(false);
      onChanged();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm('حذف السؤال؟')) return;
    await api.del(`/questions/${q.id}`).catch(toast.error);
    onChanged();
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">{q.student_name}</span>
          <span className="text-muted">·</span>
          <span className="text-muted">
            {q.course_title} / {q.lesson_title}
          </span>
          <Link to={`/lessons/${q.lesson_id}?t=${q.t_ms}`} className="inline-flex items-center gap-1 rounded-md bg-brand/15 px-2 py-0.5 font-mono text-xs text-brand hover:bg-brand/25">
            <Play className="size-3 -scale-x-100" /> {fmtTime(q.t_ms)}
            {q.line ? ` · L${q.line}` : ''}
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {q.answer ? <Badge color="mint">اترد عليه</Badge> : <Badge color="amber">مستني رد</Badge>}
          <span className="text-xs text-muted">{fmtRelative(q.created_at)}</span>
          <IconButton icon={Trash2} title="حذف" className="size-7 hover:text-rose" onClick={remove} />
        </div>
      </div>
      <p className="whitespace-pre-wrap">{q.body}</p>
      <CodeSnapshot code={q.code} line={q.line} />
      {editing ? (
        <div className="space-y-2">
          <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={5} placeholder="اكتب ردك (Markdown مدعوم)…" />
          <div className="flex gap-2">
            <Button size="sm" icon={Send} onClick={send} loading={busy} disabled={!answer.trim()}>
              إرسال الرد
            </Button>
            <Button size="sm" variant="subtle" icon={Sparkles} onClick={draft} loading={drafting}>
              مسودة من Gemini
            </Button>
            {q.answer && (
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                إلغاء
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="border-r-2 border-mint pr-4">
          <Markdown>{q.answer}</Markdown>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setEditing(true)}>
            تعديل الرد
          </Button>
        </div>
      )}
    </Card>
  );
}

export default function Questions() {
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState(null);

  const load = () => api.get(`/questions?status=${status}`).then(setItems).catch(toast.error);
  useEffect(() => {
    setItems(null);
    load();
  }, [status]);

  return (
    <>
      <PageHeader title="أسئلة الطلاب" subtitle="كل سؤال مربوط بالثانية والسطر اللي الطالب كان واقف عندهم في الدرس." />
      <Tabs
        className="mb-5 w-fit"
        value={status}
        onChange={setStatus}
        tabs={[
          { id: 'pending', label: 'مستنية رد' },
          { id: 'answered', label: 'اترد عليها' },
          { id: 'all', label: 'الكل' },
        ]}
      />
      {!items ? (
        <PageLoader />
      ) : items.length === 0 ? (
        <Empty icon={MessagesSquare} title={status === 'pending' ? 'مفيش أسئلة مستنية 🎉' : 'مفيش أسئلة'} />
      ) : (
        <div className="space-y-4">
          {items.map((q) => (
            <QuestionCard key={q.id} q={q} onChanged={load} />
          ))}
        </div>
      )}
    </>
  );
}
