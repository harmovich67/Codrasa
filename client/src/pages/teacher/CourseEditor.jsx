import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowRight, Plus, Pencil, Trash2, ChevronUp, ChevronDown, Play, Radio, ListChecks, Users, Eye, UserPlus, X, EyeOff } from 'lucide-react';
import { api } from '../../lib/api.js';
import { fmtMoney, fmtTime, fmtRelative, percent } from '../../lib/format.js';
import { langInfo } from '../../lib/languages.js';
import { useAuth } from '../../store/auth.js';
import { toast } from '../../store/toast.js';
import { Badge, Button, Card, Empty, IconButton, Input, PageHeader, PageLoader, ProgressBar, Select } from '../../components/ui.jsx';
import CourseForm from './CourseForm.jsx';

export default function CourseEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currency = useAuth((s) => s.platform.currency);
  const [course, setCourse] = useState(null);
  const [editing, setEditing] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [allStudents, setAllStudents] = useState([]);
  const [pick, setPick] = useState('');
  const [opening, setOpening] = useState(false);

  const load = useCallback(() => api.get(`/courses/${id}`).then(setCourse).catch(toast.error), [id]);
  useEffect(() => {
    load();
    api.get('/students').then(setAllStudents).catch(() => {});
  }, [load]);

  async function openForStudent() {
    if (!pick) return;
    setOpening(true);
    try {
      await api.post(`/students/${pick}/enroll`, { courseId: id });
      toast.success('اتفتح الكورس للطالب ✓');
      setPick('');
      await load();
    } catch (err) {
      toast.error(err);
    } finally {
      setOpening(false);
    }
  }

  async function closeForStudent(student) {
    if (!window.confirm(`قفل الكورس عن ${student.name}؟ (تقدمه هيفضل محفوظ)`)) return;
    await api.del(`/students/${student.id}/enroll/${id}`).catch(toast.error);
    load();
  }

  async function save(form) {
    try {
      await api.put(`/courses/${id}`, form);
      setEditing(false);
      load();
      toast.success('اتحفظ ✓');
    } catch (err) {
      toast.error(err);
    }
  }

  async function remove() {
    if (!window.confirm(`حذف "${course.title}" هيمسح كل الدروس والتسجيلات والتقدم بتاعها. متأكد؟`)) return;
    await api.del(`/courses/${id}`).catch(toast.error);
    navigate('/courses');
  }

  async function addLesson(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      const { id: lessonId } = await api.post(`/courses/${id}/lessons`, { title: newTitle });
      navigate(`/lessons/${lessonId}/studio`);
    } catch (err) {
      toast.error(err);
      setAdding(false);
    }
  }

  async function move(index, dir) {
    const lessons = [...course.lessons];
    const j = index + dir;
    if (j < 0 || j >= lessons.length) return;
    [lessons[index], lessons[j]] = [lessons[j], lessons[index]];
    setCourse({ ...course, lessons });
    await api.put(`/courses/${id}/lessons/order`, { ids: lessons.map((l) => l.id) }).catch(toast.error);
    // Always end on the server's order: a slower earlier fetch can't leave the screen out of sync with what a click will act on.
    await load();
  }

  async function removeLesson(lesson) {
    if (!window.confirm(`حذف درس "${lesson.title}"؟`)) return;
    await api.del(`/lessons/${lesson.id}`).catch(toast.error);
    load();
  }

  if (!course) return <PageLoader />;
  const total = course.lessons.length;

  return (
    <>
      <PageHeader
        title={course.title}
        subtitle={course.description}
        actions={
          <>
            <Button variant="subtle" icon={Pencil} onClick={() => setEditing(true)}>
              تعديل
            </Button>
            <Button variant="danger" icon={Trash2} onClick={remove}>
              حذف
            </Button>
          </>
        }
      >
        <Link to="/courses" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowRight className="size-4" /> الكورسات
        </Link>
        <div className="mb-2 flex gap-2">
          {course.published ? <Badge color="mint">منشور</Badge> : <Badge>مسودة</Badge>}
          {course.private ? (
            <Badge color="brand">
              <EyeOff className="size-3" /> خاص
            </Badge>
          ) : null}
          <Badge color="amber">{course.price > 0 ? fmtMoney(course.price, currency) : 'مجاني'}</Badge>
        </div>
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <form onSubmit={addLesson} className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="min-w-0 flex-1"
              placeholder="عنوان درس جديد… (مثلًا: المتغيرات و let و const)"
            />
            <Button type="submit" icon={Plus} loading={adding} disabled={!newTitle.trim()} className="w-full sm:w-auto">
              إضافة وفتح الاستوديو
            </Button>
          </form>

          {total === 0 ? (
            <Empty icon={Radio} title="مفيش دروس لسه" text="ضيف أول درس وابدأ التسجيل." />
          ) : (
            course.lessons.map((l, i) => (
              <Card key={l.id} className="flex items-center gap-3 p-3">
                <div className="flex flex-col">
                  <IconButton icon={ChevronUp} title="لفوق" className="size-6" disabled={i === 0} onClick={() => move(i, -1)} />
                  <IconButton icon={ChevronDown} title="لتحت" className="size-6" disabled={i === total - 1} onClick={() => move(i, 1)} />
                </div>
                <span className="w-6 text-center font-mono text-sm text-muted">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <Link to={`/lessons/${l.id}/studio`} className="font-medium hover:text-brand">
                    {l.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className="font-mono">{langInfo(l.language).label}</span>
                    {l.has_recording ? <Badge color="brand">⏺ {fmtTime(l.duration_ms)}</Badge> : <Badge color="amber">مش متسجل</Badge>}
                    {l.has_quiz ? (
                      <Badge color="mint">
                        <ListChecks className="size-3" /> اختبار
                      </Badge>
                    ) : null}
                    {l.published ? <Badge color="mint">منشور</Badge> : <Badge>مسودة</Badge>}
                  </div>
                </div>
                <IconButton icon={Play} title="معاينة" onClick={() => navigate(`/lessons/${l.id}`)} />
                <IconButton icon={Pencil} title="الاستوديو" onClick={() => navigate(`/lessons/${l.id}/studio`)} />
                <IconButton icon={Trash2} title="حذف" onClick={() => removeLesson(l)} className="hover:text-rose" />
              </Card>
            ))
          )}
        </div>

        <Card className="h-fit p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold">
            <Users className="size-4.5 text-brand" /> الطلاب المشتركين ({course.students.length})
          </h2>

          <div className="mb-4 space-y-2 rounded-xl border border-line bg-panel-2 p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <UserPlus className="size-3.5" /> افتح الكورس لطالب معين
            </p>
            <Select value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">اختار الطالب…</option>
              {allStudents
                .filter((s) => !course.students.some((x) => x.id === s.id))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.email}
                  </option>
                ))}
            </Select>
            <Button size="sm" className="w-full" icon={UserPlus} onClick={openForStudent} loading={opening} disabled={!pick}>
              فتح الكورس للطالب
            </Button>
            {allStudents.length === 0 && <p className="text-[11px] text-muted">مفيش طلاب لسه — ضيفهم من صفحة الطلاب أو هيسجلوا بنفسهم.</p>}
          </div>

          {course.students.length === 0 ? (
            <p className="text-sm text-muted">مفيش طلاب مشتركين لسه.</p>
          ) : (
            <div className="space-y-1">
              {course.students.map((s) => (
                <div key={s.id} className="group flex items-start gap-1 rounded-lg p-2 transition hover:bg-panel-2">
                  <Link to={`/students/${s.id}`} className="block min-w-0 flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate">{s.name}</span>
                      <span className="text-xs text-muted">
                        {s.completed_count}/{total}
                      </span>
                    </div>
                    <ProgressBar value={percent(s.completed_count, total)} className="mt-1.5" />
                    <p className="mt-1 text-[11px] text-muted">اشترك {fmtRelative(s.enrolled_at)}</p>
                  </Link>
                  <IconButton icon={X} title="قفل الكورس عنه" className="size-7 hover:text-rose" onClick={() => closeForStudent(s)} />
                </div>
              ))}
            </div>
          )}
          <Button variant="ghost" size="sm" icon={Eye} className="mt-4 w-full" onClick={() => navigate('/students')}>
            إدارة الطلاب
          </Button>
        </Card>
      </div>

      {editing && <CourseForm open title="تعديل الكورس" initial={course} onClose={() => setEditing(false)} onSubmit={save} />}
    </>
  );
}
