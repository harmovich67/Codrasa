import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { GraduationCap, FileText, BookOpen, CircleCheck, Play } from 'lucide-react';
import HeroBanner from '../../components/HeroBanner.jsx';
import RequestAccess from '../../components/RequestAccess.jsx';
import { api } from '../../lib/api.js';
import { fmtMoney, percent } from '../../lib/format.js';
import { useAuth } from '../../store/auth.js';
import { toast } from '../../store/toast.js';
import { Badge, Button, Card, Empty, PageLoader, ProgressBar } from '../../components/ui.jsx';

export default function StudentHome() {
  const navigate = useNavigate();
  const { user, platform } = useAuth();
  const [courses, setCourses] = useState(null);
  const [joining, setJoining] = useState(null);

  const load = () => api.get('/courses').then(setCourses).catch(toast.error);
  useEffect(() => {
    load();
  }, []);

  async function join(c) {
    setJoining(c.id);
    try {
      await api.post(`/courses/${c.id}/enroll`);
      toast.success(`اشتركت في "${c.title}" 🎉`);
      navigate(`/courses/${c.id}`);
    } catch (err) {
      toast.error(err);
      setJoining(null);
    }
  }

  if (!courses) return <PageLoader />;
  const mine = courses.filter((c) => c.enrolled);
  const others = courses.filter((c) => !c.enrolled);
  const resume = mine.find((c) => c.lesson_count > c.completed_count);

  return (
    <>
      <HeroBanner
        title={`أهلًا يا ${user.name.split(' ')[0]} 👋`}
        subtitle={new Date().toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        chips={[
          { icon: BookOpen, label: `${mine.length} كورس` },
          { icon: CircleCheck, label: `${mine.reduce((sum, c) => sum + c.completed_count, 0)} درس اتكمّل` },
        ]}
      >
        {resume && (
          <Button icon={Play} onClick={() => navigate(`/courses/${resume.id}`)}>
            كمّل من مكان ما وقفت
          </Button>
        )}
      </HeroBanner>

      {mine.length === 0 ? (
        <Empty icon={GraduationCap} title="لسه مش مشترك في أي كورس" text="اختار كورس من تحت وابدأ." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {mine.map((c) => {
            const pct = percent(c.completed_count, c.lesson_count);
            return (
              <Link key={c.id} to={`/courses/${c.id}`}>
                <Card className="group h-full overflow-hidden transition hover:border-muted/40">
                  <div className="h-2" style={{ background: c.color }} />
                  <div className="space-y-3 p-5">
                    <h3 className="font-semibold group-hover:text-brand">{c.title}</h3>
                    <div className="flex justify-between text-xs text-muted">
                      <span>
                        {c.completed_count} من {c.lesson_count} درس
                      </span>
                      <span>{pct}%</span>
                    </div>
                    <ProgressBar value={pct} />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {others.length > 0 && (
        <>
          <h2 className="mt-10 mb-4 text-lg font-semibold">كورسات متاحة</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {others.map((c) => (
              <Card key={c.id} className="flex flex-col overflow-hidden">
                <div className="h-2" style={{ background: c.color }} />
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{c.title}</h3>
                    <Badge color={c.price > 0 ? 'amber' : 'mint'}>{c.price > 0 ? fmtMoney(c.price, platform.currency) : 'مجاني'}</Badge>
                  </div>
                  {c.description && <p className="line-clamp-3 text-sm text-muted">{c.description}</p>}
                  <p className="inline-flex items-center gap-1.5 text-xs text-muted">
                    <FileText className="size-3.5" /> {c.lesson_count} درس
                  </p>
                  <div className="mt-auto pt-2">
                    {c.price > 0 ? (
                      <RequestAccess course={c} onChanged={load} compact />
                    ) : (
                      <Button className="w-full" onClick={() => join(c)} loading={joining === c.id}>
                        اشترك مجانًا
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}
