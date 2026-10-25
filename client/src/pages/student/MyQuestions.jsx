import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { MessagesSquare, Send } from 'lucide-react';
import { api } from '../../lib/api.js';
import { fmtRelative, fmtTime } from '../../lib/format.js';
import { toast } from '../../store/toast.js';
import Markdown from '../../components/Markdown.jsx';
import { Badge, Button, Card, Empty, Field, PageHeader, PageLoader, Select, Textarea } from '../../components/ui.jsx';

function AskForm({ onAsked }) {
  const [lessons, setLessons] = useState(null);
  const [lessonId, setLessonId] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/questions/lessons').then(setLessons).catch(toast.error);
  }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/questions/lesson/${lessonId}`, { body, t_ms: 0 });
      toast.success('سؤالك وصل للمدرّس ✓');
      setBody('');
      onAsked();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  if (!lessons) return null;
  if (lessons.length === 0) {
    return (
      <Card className="mb-5 p-4 text-sm text-muted">
        اشترك في كورس الأول عشان تقدر تسأل عن دروسه. <Link to="/" className="text-brand hover:underline">شوف الكورسات</Link>
      </Card>
    );
  }

  return (
    <Card className="mb-6 p-5">
      <form onSubmit={submit} className="space-y-3">
        <h2 className="font-semibold">اسأل سؤال جديد</h2>
        <Field label="عن أنهي درس؟">
          <Select value={lessonId} onChange={(e) => setLessonId(e.target.value)} required>
            <option value="">اختار الدرس…</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.course_title} — {l.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="سؤالك" hint="لو سؤالك عن لحظة معينة في الشرح، افتح الدرس وأوقفه عندها واسأل من تبويب الأسئلة — هيتثبت على الثانية والسطر.">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="اكتب سؤالك هنا…" rows={3} required />
        </Field>
        <Button type="submit" icon={Send} loading={busy} disabled={!lessonId || !body.trim()}>
          إرسال السؤال
        </Button>
      </form>
    </Card>
  );
}

export default function MyQuestions() {
  const [items, setItems] = useState(null);

  const load = useCallback(() => api.get('/questions').then(setItems).catch(toast.error), []);
  useEffect(() => {
    load();
  }, [load]);

  if (!items) return <PageLoader />;

  return (
    <>
      <PageHeader title="أسئلتي" subtitle="اسأل المدرّس في أي درس، وهتلاقي الرد هنا." />
      <AskForm onAsked={load} />
      {items.length === 0 ? (
        <Empty icon={MessagesSquare} title="مسألتش لسه" text="اكتب أول سؤال في الفورم اللي فوق." />
      ) : (
        <div className="space-y-4">
          {items.map((q) => (
            <Card key={q.id} className="space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <Link to={`/lessons/${q.lesson_id}?t=${q.t_ms}`} className="text-muted hover:text-brand">
                  {q.course_title} / {q.lesson_title} {q.t_ms > 0 && <span className="font-mono">@ {fmtTime(q.t_ms)}</span>}
                </Link>
                <div className="flex items-center gap-2">
                  {q.answer ? <Badge color="mint">اترد عليه</Badge> : <Badge color="amber">مستني رد</Badge>}
                  <span className="text-xs text-muted">{fmtRelative(q.created_at)}</span>
                </div>
              </div>
              <p className="whitespace-pre-wrap">{q.body}</p>
              {q.answer && (
                <div className="border-r-2 border-mint pr-4">
                  <Markdown>{q.answer}</Markdown>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
