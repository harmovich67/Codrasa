import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Target, Trophy, Flame, Sparkles, ChevronDown, CircleCheck, Circle, ArrowLeft } from 'lucide-react';
import { api } from '../../lib/api.js';
import { fmtTime } from '../../lib/format.js';
import { toast } from '../../store/toast.js';
import { Badge, Button, Card, Empty, PageHeader, PageLoader, ProgressBar, Stat, cx } from '../../components/ui.jsx';

const STATUS = {
  mastered: { label: 'متقنها', color: 'mint', bar: 'bg-mint', rank: 2 },
  practicing: { label: 'بتتمرّن', color: 'amber', bar: 'bg-amber', rank: 1 },
  new: { label: 'لسه جديدة', color: 'muted', bar: 'bg-brand', rank: 0 },
};

const challengeLink = (item) => `/lessons/${item.lesson_id}?t=${item.t_ms}&cp=${item.checkpoint_id}`;

export default function SkillMap() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    api.get('/skills').then(setData).catch(toast.error);
  }, []);

  if (!data) return <PageLoader />;
  const { skills, recommendations, totals } = data;

  if (!skills.length) {
    return (
      <>
        <PageHeader title="خريطة مهاراتك" subtitle="كل تحدي بتحلّه بيتحول لمهارة متسجلة باسمك." />
        <Empty icon={Target} title="لسه مفيش تحديات في كورساتك" text="أول ما تقابل تحدي جوه درس وتحلّه، هتلاقي مهارتك هنا." action={<Button onClick={() => navigate('/')}>روح لكورساتي</Button>} />
      </>
    );
  }

  const ordered = [...skills].sort((a, b) => STATUS[a.status].rank - STATUS[b.status].rank || b.percent - a.percent || a.name.localeCompare(b.name, 'ar'));
  const overall = totals.challenges ? Math.round((totals.passed / totals.challenges) * 100) : 0;
  const struggling = skills.filter((s) => s.status === 'practicing').length;

  return (
    <>
      <PageHeader title="خريطة مهاراتك" subtitle="مش بس اتفرجت — دي اللي بقيت تقدر تكتبه بنفسك." />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat icon={Trophy} label="مهارات متقنة" value={`${totals.mastered} / ${totals.skills}`} tone="mint" />
        <Stat icon={Target} label="تحديات اتحلّت" value={`${totals.passed} / ${totals.challenges}`} />
        <Stat icon={Flame} label="مهارات بتتمرّن عليها" value={struggling} tone="amber" hint="جرّبتها ولسه محتاجة تثبيت" />
        <Stat icon={Sparkles} label="الإتقان الكلي" value={`${overall}%`} tone="rose" />
      </div>

      {recommendations.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Sparkles className="size-4.5 text-brand" /> خطوتك الجاية
          </h2>
          <div className="grid gap-3 lg:grid-cols-3">
            {recommendations.map((item) => (
              <Link key={`${item.lesson_id}:${item.checkpoint_id}`} to={challengeLink(item)}>
                <Card className="group h-full overflow-hidden transition hover:border-brand/60">
                  <div className="h-1.5" style={{ background: item.color }} />
                  <div className="space-y-2 p-4">
                    <Badge color="brand">{item.skill}</Badge>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-xs leading-6 text-muted">{item.reason}</p>
                    <p className="flex items-center justify-between text-xs text-muted">
                      <span className="truncate">
                        {item.course_title} · {item.lesson_title}
                      </span>
                      <ArrowLeft className="size-4 shrink-0 text-brand transition group-hover:-translate-x-1" />
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 font-semibold">كل المهارات</h2>
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ordered.map((skill) => {
            const meta = STATUS[skill.status];
            const expanded = open === skill.name;
            return (
              <Card key={skill.name} className={cx('p-4', skill.status === 'mastered' && 'border-mint/30')}>
                <button className="w-full space-y-3 text-right" onClick={() => setOpen(expanded ? null : skill.name)} aria-expanded={expanded}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold">{skill.name}</span>
                    <Badge color={meta.color}>{meta.label}</Badge>
                  </div>
                  <ProgressBar value={skill.percent} color={meta.bar} />
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>
                      {skill.passed} من {skill.total} تحدي · {skill.attempts} محاولة
                    </span>
                    <ChevronDown className={cx('size-4 transition', expanded && 'rotate-180')} />
                  </div>
                </button>
                {expanded && (
                  <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
                    {skill.lessons.map((item) => (
                      <li key={`${item.lesson_id}:${item.checkpoint_id}`}>
                        <Link to={challengeLink(item)} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition hover:bg-panel-2">
                          {item.passed ? <CircleCheck className="size-4 shrink-0 text-mint" /> : <Circle className="size-4 shrink-0 text-muted" />}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{item.title}</span>
                            <span className="block truncate text-xs text-muted">
                              {item.lesson_title} · <span className="font-mono">{fmtTime(item.t_ms)}</span>
                              {!item.passed && item.attempts > 0 && ` · ${item.attempts} محاولة`}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      </section>
    </>
  );
}
