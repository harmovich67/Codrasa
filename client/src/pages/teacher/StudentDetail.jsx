import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowRight, Save, Trash2, Plus, Wallet, BookOpen, MessagesSquare, Activity, Mail, Phone, X } from 'lucide-react';
import { api } from '../../lib/api.js';
import { fmtDate, fmtMoney, fmtRelative, fmtTime, percent } from '../../lib/format.js';
import { useAuth } from '../../store/auth.js';
import { toast } from '../../store/toast.js';
import { Badge, Button, Card, Field, IconButton, Input, PageHeader, PageLoader, ProgressBar, Select, Textarea } from '../../components/ui.jsx';
import PaymentForm from './PaymentForm.jsx';

const Box = ({ icon: Icon, title, action, children }) => (
  <Card className="p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 font-semibold">
        <Icon className="size-4.5 text-brand" /> {title}
      </h2>
      {action}
    </div>
    {children}
  </Card>
);

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currency = useAuth((s) => s.platform.currency);
  const [s, setS] = useState(null);
  const [form, setForm] = useState(null);
  const [allCourses, setAllCourses] = useState([]);
  const [enrollId, setEnrollId] = useState('');
  const [paying, setPaying] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    () =>
      api
        .get(`/students/${id}`)
        .then((data) => {
          setS(data);
          setForm({ name: data.name, email: data.email, phone: data.phone || '', notes: data.notes || '', password: '' });
        })
        .catch(toast.error),
    [id],
  );

  useEffect(() => {
    load();
    api.get('/courses').then(setAllCourses).catch(() => {});
  }, [load]);

  if (!s || !form) return <PageLoader />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const totalPaid = s.payments.reduce((sum, p) => sum + p.amount, 0);
  const available = allCourses.filter((c) => !s.courses.some((x) => x.id === c.id));

  async function save() {
    setSaving(true);
    try {
      await api.put(`/students/${id}`, form);
      toast.success('اتحفظت البيانات ✓');
      load();
    } catch (err) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(`حذف ${s.name} نهائيًا مع كل تقدمه ومدفوعاته؟`)) return;
    try {
      await api.del(`/students/${id}`);
      navigate('/students');
    } catch (err) {
      toast.error(err);
    }
  }

  async function enroll() {
    if (!enrollId) return;
    await api.post(`/students/${id}/enroll`, { courseId: enrollId }).catch(toast.error);
    setEnrollId('');
    load();
  }

  async function unenroll(course) {
    if (!window.confirm(`إلغاء اشتراك ${s.name} في "${course.title}"؟`)) return;
    await api.del(`/students/${id}/enroll/${course.id}`).catch(toast.error);
    load();
  }

  async function deletePayment(p) {
    if (!window.confirm('حذف الدفعة دي؟')) return;
    await api.del(`/payments/${p.id}`).catch(toast.error);
    load();
  }

  return (
    <>
      <PageHeader
        title={s.name}
        subtitle={`انضم ${fmtDate(s.created_at)}`}
        actions={
          <Button variant="danger" icon={Trash2} onClick={remove}>
            حذف الطالب
          </Button>
        }
      >
        <Link to="/students" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowRight className="size-4" /> الطلاب
        </Link>
        <div className="mb-2 flex flex-wrap gap-3 text-xs text-muted">
          <a href={`mailto:${s.email}`} className="inline-flex items-center gap-1 hover:text-ink" dir="ltr">
            <Mail className="size-3.5" /> {s.email}
          </a>
          {s.phone && (
            <a href={`https://wa.me/${s.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-mint" dir="ltr">
              <Phone className="size-3.5" /> {s.phone}
            </a>
          )}
        </div>
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Box
            icon={BookOpen}
            title="الكورسات والتقدم"
            action={
              <div className="flex flex-wrap gap-2">
                <Select value={enrollId} onChange={(e) => setEnrollId(e.target.value)} className="h-8 w-52 max-w-full py-0 text-xs" disabled={available.length === 0}>
                  <option value="">{available.length ? 'افتح كورس للطالب…' : 'مفتوحله كل الكورسات'}</option>
                  {available.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </Select>
                <Button size="sm" icon={Plus} onClick={enroll} disabled={!enrollId}>
                  فتح
                </Button>
              </div>
            }
          >
            {s.courses.length === 0 ? (
              <p className="text-sm text-muted">مش مشترك في أي كورس.</p>
            ) : (
              <div className="space-y-4">
                {s.courses.map((c) => {
                  const pct = percent(c.completed_count, c.lesson_count);
                  return (
                    <div key={c.id} className="flex items-center gap-4">
                      <div className="size-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between text-sm">
                          <Link to={`/courses/${c.id}`} className="hover:text-brand">
                            {c.title}
                          </Link>
                          <span className="text-xs text-muted">
                            {c.completed_count}/{c.lesson_count} · {pct}%{c.avg_quiz != null && ` · اختبارات ${c.avg_quiz}%`}
                          </span>
                        </div>
                        <ProgressBar value={pct} className="mt-1.5" />
                      </div>
                      <IconButton icon={X} title="إلغاء الاشتراك" className="size-7 hover:text-rose" onClick={() => unenroll(c)} />
                    </div>
                  );
                })}
              </div>
            )}
          </Box>

          <Box
            icon={Wallet}
            title={`المدفوعات · ${fmtMoney(totalPaid, currency)}`}
            action={
              <Button size="sm" icon={Plus} onClick={() => setPaying(true)}>
                دفعة جديدة
              </Button>
            }
          >
            {s.payments.length === 0 ? (
              <p className="text-sm text-muted">مفيش مدفوعات.</p>
            ) : (
              <div className="divide-y divide-line">
                {s.payments.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="w-28 font-semibold tabular-nums">{fmtMoney(p.amount, currency)}</span>
                    <span className="flex-1 text-muted">
                      {p.course_title || 'بدون كورس'} · {p.method}
                      {p.note && ` · ${p.note}`}
                    </span>
                    <span className="text-xs text-muted">{fmtDate(p.paid_at)}</span>
                    <IconButton icon={Trash2} title="حذف" className="size-7 hover:text-rose" onClick={() => deletePayment(p)} />
                  </div>
                ))}
              </div>
            )}
          </Box>

          <div className="grid gap-5 md:grid-cols-2">
            <Box icon={Activity} title="آخر نشاط">
              {s.activity.length === 0 ? (
                <p className="text-sm text-muted">لسه مبدأش.</p>
              ) : (
                <div className="space-y-2">
                  {s.activity.map((a, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{a.lesson_title}</span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {a.completed ? <Badge color="mint">خلّصه</Badge> : <Badge>بدأه</Badge>}
                        {a.quiz_score != null && <Badge color="amber">{a.quiz_score}%</Badge>}
                        <span className="text-[11px] text-muted">{fmtRelative(a.updated_at)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Box>
            <Box icon={MessagesSquare} title="أسئلته">
              {s.questions.length === 0 ? (
                <p className="text-sm text-muted">مسألش لسه.</p>
              ) : (
                <div className="space-y-2">
                  {s.questions.map((q) => (
                    <Link key={q.id} to={`/lessons/${q.lesson_id}?t=${q.t_ms}`} className="block rounded-lg p-2 text-sm transition hover:bg-panel-2">
                      <p className="line-clamp-2">{q.body}</p>
                      <p className="mt-1 text-[11px] text-muted">
                        {q.lesson_title} @ {fmtTime(q.t_ms)} · {q.answer ? '✓ اترد عليه' : '⏳ مستني'}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </Box>
          </div>
        </div>

        <Card className="h-fit space-y-4 p-5">
          <h2 className="font-semibold">بيانات الطالب</h2>
          <Field label="الاسم">
            <Input value={form.name} onChange={set('name')} />
          </Field>
          <Field label="البريد">
            <Input value={form.email} onChange={set('email')} dir="ltr" />
          </Field>
          <Field label="الموبايل">
            <Input value={form.phone} onChange={set('phone')} dir="ltr" />
          </Field>
          <Field label="ملاحظات خاصة">
            <Textarea value={form.notes} onChange={set('notes')} rows={4} />
          </Field>
          <Field label="كلمة مرور جديدة" hint="سيبها فاضية لو مش عايز تغيرها">
            <Input value={form.password} onChange={set('password')} dir="ltr" />
          </Field>
          <Button icon={Save} className="w-full" onClick={save} loading={saving}>
            حفظ
          </Button>
        </Card>
      </div>

      {paying && (
        <PaymentForm
          studentId={s.id}
          onClose={() => setPaying(false)}
          onSaved={() => {
            setPaying(false);
            load();
          }}
        />
      )}
    </>
  );
}
