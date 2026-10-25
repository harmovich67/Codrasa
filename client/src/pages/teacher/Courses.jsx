import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Plus, BookOpen, Users, FileText } from 'lucide-react';
import { api } from '../../lib/api.js';
import { fmtMoney } from '../../lib/format.js';
import { useAuth } from '../../store/auth.js';
import { toast } from '../../store/toast.js';
import { Badge, Button, Card, Empty, PageHeader, PageLoader } from '../../components/ui.jsx';
import CourseForm from './CourseForm.jsx';

export default function Courses() {
  const navigate = useNavigate();
  const currency = useAuth((s) => s.platform.currency);
  const [courses, setCourses] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get('/courses').then(setCourses).catch(toast.error);
  }, []);

  async function create(form) {
    try {
      const c = await api.post('/courses', form);
      navigate(`/courses/${c.id}`);
    } catch (err) {
      toast.error(err);
    }
  }

  if (!courses) return <PageLoader />;

  return (
    <>
      <PageHeader
        title="الكورسات"
        subtitle="نظّم كورساتك ودروسك، وسجّل كل درس كجلسة كود حية."
        actions={
          <Button icon={Plus} onClick={() => setCreating(true)}>
            كورس جديد
          </Button>
        }
      />
      {courses.length === 0 ? (
        <Empty
          icon={BookOpen}
          title="ابدأ أول كورس"
          text="اعمل كورس، ضيف دروس، وسجّل الشرح بصوتك والكود بيتكتب قدام الطالب."
          action={
            <Button icon={Plus} onClick={() => setCreating(true)}>
              كورس جديد
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((c) => (
            <Link key={c.id} to={`/courses/${c.id}`}>
              <Card className="group h-full overflow-hidden transition hover:border-muted/40">
                <div className="h-2" style={{ background: c.color }} />
                <div className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold group-hover:text-brand">{c.title}</h3>
                    {c.published ? <Badge color="mint">منشور</Badge> : <Badge>مسودة</Badge>}
                  </div>
                  {c.description && <p className="line-clamp-2 text-sm text-muted">{c.description}</p>}
                  <div className="flex flex-wrap gap-4 pt-1 text-xs text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <FileText className="size-3.5" /> {c.lesson_count} درس
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="size-3.5" /> {c.student_count} طالب
                    </span>
                    <span>{c.price > 0 ? fmtMoney(c.price, currency) : 'مجاني'}</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
      {creating && <CourseForm open title="كورس جديد" onClose={() => setCreating(false)} onSubmit={create} />}
    </>
  );
}
