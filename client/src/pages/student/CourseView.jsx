import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowRight, Play, Check, Lock, ListChecks } from 'lucide-react';
import RequestAccess from '../../components/RequestAccess.jsx';
import { api } from '../../lib/api.js';
import { fmtMoney, fmtTime, percent } from '../../lib/format.js';
import { langInfo } from '../../lib/languages.js';
import { useAuth } from '../../store/auth.js';
import { toast } from '../../store/toast.js';
import { Badge, Button, Card, PageHeader, PageLoader, ProgressBar, cx } from '../../components/ui.jsx';

export default function CourseView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currency = useAuth((s) => s.platform.currency);
  const [course, setCourse] = useState(null);
  const [joining, setJoining] = useState(false);

  const load = () => api.get(`/courses/${id}`).then(setCourse).catch(toast.error);
  useEffect(() => {
    load();
  }, [id]);

  async function join() {
    setJoining(true);
    try {
      await api.post(`/courses/${id}/enroll`);
      toast.success('اشتركت 🎉');
      load();
    } catch (err) {
      toast.error(err);
    } finally {
      setJoining(false);
    }
  }

  if (!course) return <PageLoader />;
  const done = course.lessons.filter((l) => l.completed).length;
  const next = course.lessons.find((l) => !l.completed);

  return (
    <>
      <PageHeader
        title={course.title}
        subtitle={course.description}
        actions={
          course.enrolled ? (
            next && (
              <Button icon={Play} onClick={() => navigate(`/lessons/${next.id}`)}>
                {done ? 'كمّل' : 'ابدأ الكورس'}
              </Button>
            )
          ) : course.price > 0 ? (
            <RequestAccess course={course} onChanged={load} />
          ) : (
            <Button onClick={join} loading={joining}>
              اشترك مجانًا
            </Button>
          )
        }
      >
        <Link to="/" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowRight className="size-4" /> كورساتي
        </Link>
      </PageHeader>

      {course.enrolled && (
        <Card className="mb-5 p-4">
          <div className="mb-2 flex justify-between text-sm">
            <span>تقدمك</span>
            <span className="text-muted">
              {done}/{course.lessons.length} · {percent(done, course.lessons.length)}%
            </span>
          </div>
          <ProgressBar value={percent(done, course.lessons.length)} />
        </Card>
      )}

      <div className="space-y-2">
        {course.lessons.map((l, i) => {
          const locked = !course.enrolled;
          const started = l.position_ms > 0 && !l.completed;
          const Inner = (
            <Card className={cx('flex items-center gap-4 p-4 transition', !locked && 'hover:border-brand/50')}>
              <div
                className={cx(
                  'flex size-9 shrink-0 items-center justify-center rounded-full text-sm',
                  l.completed ? 'bg-mint/15 text-mint' : locked ? 'bg-panel-2 text-muted' : 'bg-brand/15 text-brand',
                )}
              >
                {l.completed ? <Check className="size-4" /> : locked ? <Lock className="size-4" /> : i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{l.title}</p>
                {l.description && <p className="truncate text-xs text-muted">{l.description}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs text-muted">
                {l.has_quiz ? (
                  <Badge color={l.quiz_score != null ? 'mint' : 'muted'}>
                    <ListChecks className="size-3" /> {l.quiz_score != null ? `${l.quiz_score}%` : 'اختبار'}
                  </Badge>
                ) : null}
                {started && <Badge color="brand">وقفت عند {fmtTime(l.position_ms)}</Badge>}
                <span className="hidden font-mono sm:inline">{langInfo(l.language).label}</span>
                <span className="font-mono">{fmtTime(l.duration_ms)}</span>
              </div>
            </Card>
          );
          return locked ? (
            <div key={l.id} className="opacity-70">
              {Inner}
            </div>
          ) : (
            <Link key={l.id} to={`/lessons/${l.id}`} className="block">
              {Inner}
            </Link>
          );
        })}
        {course.lessons.length === 0 && <p className="py-10 text-center text-sm text-muted">الدروس هتنزل قريب.</p>}
      </div>
    </>
  );
}
