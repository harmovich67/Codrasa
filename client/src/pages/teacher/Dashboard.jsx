import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Users, BookOpen, Wallet, MessagesSquare, Activity, Flame, UserPlus, CircleAlert, CircleCheck, Inbox } from 'lucide-react';
import HeroBanner from '../../components/HeroBanner.jsx';
import { api } from '../../lib/api.js';
import { fmtMoney, fmtNumber, fmtRelative, fmtTime } from '../../lib/format.js';
import { useAuth } from '../../store/auth.js';
import { toast } from '../../store/toast.js';
import { Card, PageLoader, Stat } from '../../components/ui.jsx';

function Section({ icon: Icon, title, link, children, tone = 'text-brand' }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <Icon className={`size-4.5 ${tone}`} /> {title}
        </h2>
        {link && (
          <Link to={link} className="text-xs text-brand hover:underline">
            عرض الكل
          </Link>
        )}
      </div>
      {children}
    </Card>
  );
}

const Row = ({ to, title, meta, side }) => (
  <Link to={to} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition hover:bg-panel-2">
    <div className="min-w-0">
      <p className="truncate text-sm">{title}</p>
      {meta && <p className="truncate text-xs text-muted">{meta}</p>}
    </div>
    {side && <span className="shrink-0 text-xs text-muted">{side}</span>}
  </Link>
);

const Nothing = ({ text }) => <p className="py-4 text-center text-sm text-muted">{text}</p>;

export default function Dashboard() {
  const { user, platform } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/dashboard').then(setData).catch(toast.error);
  }, []);

  if (!data) return <PageLoader />;
  const s = data.stats;

  return (
    <>
      <HeroBanner
        title={`${new Date().getHours() < 12 ? 'صباح الخير' : new Date().getHours() < 18 ? 'نهارك سعيد' : 'مساء الخير'} يا ${user.name.split(' ')[0]} 👋`}
        subtitle={new Date().toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        chips={[
          { icon: Users, label: `${fmtNumber(s.students)} طالب` },
          { icon: MessagesSquare, label: `${s.pending_questions} سؤال مستني رد` },
          { icon: Inbox, label: `${s.pending_requests} طلب اشتراك` },
        ]}
      />

      {s.pending_requests > 0 && (
        <Link to="/requests" className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-brand/40 bg-brand/10 px-5 py-3 text-sm transition hover:bg-brand/15">
          <span>
            📥 عندك <b>{s.pending_requests}</b> طلب اشتراك مستني قرارك
          </span>
          <span className="text-brand">راجعها ←</span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat icon={Users} label="الطلاب" value={fmtNumber(s.students)} hint={`${s.active_7d} نشطين آخر 7 أيام`} />
        <Stat icon={BookOpen} label="الكورسات / الدروس" value={`${s.courses} / ${s.lessons}`} hint={`${fmtNumber(s.completions)} درس اتكمّل`} tone="mint" />
        <Stat icon={Wallet} label="دخل الشهر" value={fmtMoney(s.revenue_month, platform.currency)} hint={`الإجمالي ${fmtMoney(s.revenue_total, platform.currency)}`} tone="amber" />
        <Stat icon={MessagesSquare} label="أسئلة مستنية رد" value={s.pending_questions} tone={s.pending_questions ? 'rose' : 'mint'} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Section icon={Flame} title="دروس الطلاب بيتلخبطوا فيها (آخر 30 يوم)" tone="text-rose">
          {data.hotLessons.length ? (
            data.hotLessons.map((l) => <Row key={l.id} to={`/lessons/${l.id}/studio`} title={l.title} meta={l.course_title} side={`${l.signals} إشارة`} />)
          ) : (
            <Nothing text="لسه مفيش بيانات — أول ما الطلاب يتفرجوا هتظهر هنا." />
          )}
        </Section>

        <Section icon={MessagesSquare} title="أحدث الأسئلة" link="/questions">
          {data.pendingQuestions.length ? (
            data.pendingQuestions.map((q) => (
              <Row key={q.id} to="/questions" title={q.body} meta={`${q.student_name} · ${q.lesson_title} @ ${fmtTime(q.t_ms)}`} side={fmtRelative(q.created_at)} />
            ))
          ) : (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-mint">
              <CircleCheck className="size-4" /> رديت على كل الأسئلة
            </div>
          )}
        </Section>

        <Section icon={UserPlus} title="اشتراكات جديدة" link="/students" tone="text-mint">
          {data.recentEnrollments.length ? (
            data.recentEnrollments.map((e, i) => <Row key={i} to={`/students/${e.user_id}`} title={e.name} meta={e.course_title} side={fmtRelative(e.created_at)} />)
          ) : (
            <Nothing text="مفيش اشتراكات لسه." />
          )}
        </Section>

        <Section icon={CircleAlert} title="طلاب ممكن يسيبوا الكورس" tone="text-amber">
          {data.atRisk.length ? (
            data.atRisk.map((u) => <Row key={u.id} to={`/students/${u.id}`} title={u.name} meta="مدخلش أي درس من أسبوع أو أكتر" side={fmtRelative(u.last_active)} />)
          ) : (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-mint">
              <Activity className="size-4" /> كل الطلاب نشطين
            </div>
          )}
        </Section>
      </div>
    </>
  );
}
