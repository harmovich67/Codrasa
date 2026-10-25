import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { UserPlus, Search, Users } from 'lucide-react';
import { api } from '../../lib/api.js';
import { fmtMoney, fmtRelative, parseDate } from '../../lib/format.js';
import { useAuth } from '../../store/auth.js';
import { toast } from '../../store/toast.js';
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, PageLoader, Textarea } from '../../components/ui.jsx';

const WEEK = 7 * 24 * 3600 * 1000;

function NewStudent({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e?.preventDefault();
    setBusy(true);
    try {
      await api.post('/students', form);
      toast.success(`اتضاف ${form.name} — ابعتله الإيميل وكلمة المرور`);
      onCreated();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="طالب جديد"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={submit} loading={busy}>
            إضافة
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="الاسم">
          <Input value={form.name} onChange={set('name')} autoFocus />
        </Field>
        <Field label="رقم الموبايل / واتساب">
          <Input value={form.phone} onChange={set('phone')} dir="ltr" />
        </Field>
        <Field label="البريد الإلكتروني">
          <Input type="email" value={form.email} onChange={set('email')} dir="ltr" />
        </Field>
        <Field label="كلمة المرور المبدئية">
          <Input value={form.password} onChange={set('password')} dir="ltr" />
        </Field>
        <Field label="ملاحظات" className="sm:col-span-2">
          <Textarea value={form.notes} onChange={set('notes')} rows={2} />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

export default function Students() {
  const currency = useAuth((s) => s.platform.currency);
  const [students, setStudents] = useState(null);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);

  const load = () => api.get('/students').then(setStudents).catch(toast.error);
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term || !students) return students;
    return students.filter((s) => [s.name, s.email, s.phone].some((v) => v?.toLowerCase().includes(term)));
  }, [students, q]);

  if (!students) return <PageLoader />;

  return (
    <>
      <PageHeader
        title="الطلاب"
        subtitle={`${students.length} طالب`}
        actions={
          <Button icon={UserPlus} onClick={() => setAdding(true)}>
            طالب جديد
          </Button>
        }
      />
      {students.length === 0 ? (
        <Empty icon={Users} title="مفيش طلاب لسه" text="الطلاب يقدروا يسجلوا بنفسهم من صفحة الدخول، أو تضيفهم انت." />
      ) : (
        <Card className="overflow-hidden">
          <div className="border-b border-line p-3">
            <div className="relative max-w-sm">
              <Search className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم أو الإيميل أو الموبايل" className="pr-9" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-line">
                  {['الطالب', 'الكورسات', 'دروس خلّصها', 'المدفوع', 'آخر نشاط', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-right font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const last = parseDate(s.last_active);
                  const idle = s.course_count > 0 && (!last || Date.now() - last.getTime() > WEEK);
                  return (
                    <tr key={s.id} className="border-b border-line/60 transition last:border-0 hover:bg-panel-2">
                      <td className="px-4 py-3">
                        <Link to={`/students/${s.id}`} className="font-medium hover:text-brand">
                          {s.name}
                        </Link>
                        <p className="text-xs text-muted" dir="ltr">
                          {s.email}
                        </p>
                      </td>
                      <td className="px-4 py-3">{s.course_count}</td>
                      <td className="px-4 py-3">{s.completed_lessons}</td>
                      <td className="px-4 py-3 tabular-nums">{fmtMoney(s.total_paid, currency)}</td>
                      <td className="px-4 py-3 text-muted">{fmtRelative(s.last_active)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          {idle && <Badge color="amber">خامل</Badge>}
                          {s.pending_questions > 0 && <Badge color="rose">{s.pending_questions} سؤال</Badge>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {adding && (
        <NewStudent
          onClose={() => setAdding(false)}
          onCreated={() => {
            setAdding(false);
            load();
          }}
        />
      )}
    </>
  );
}
