import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { useAuth } from '../../store/auth.js';
import { toast } from '../../store/toast.js';
import { Button, Field, Input, Modal, Select } from '../../components/ui.jsx';

const METHODS = ['كاش', 'فودافون كاش', 'إنستاباي', 'تحويل بنكي', 'PayPal', 'أخرى'];

export default function PaymentForm({ onClose, onSaved, studentId }) {
  const currency = useAuth((s) => s.platform.currency);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({
    userId: studentId || '',
    courseId: '',
    amount: '',
    method: METHODS[0],
    note: '',
    paidAt: new Date().toISOString().slice(0, 10),
  });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    api.get('/courses').then(setCourses).catch(toast.error);
    if (!studentId) api.get('/students').then(setStudents).catch(toast.error);
  }, [studentId]);

  function pickCourse(id) {
    const course = courses.find((c) => String(c.id) === id);
    setForm((f) => ({ ...f, courseId: id, amount: f.amount || (course?.price > 0 ? course.price : '') }));
  }

  async function submit(e) {
    e?.preventDefault();
    setBusy(true);
    try {
      await api.post('/payments', form);
      toast.success(form.courseId ? 'اتسجلت الدفعة واتفعّل الاشتراك في الكورس ✓' : 'اتسجلت الدفعة ✓');
      onSaved();
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
      title="تسجيل دفعة"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={submit} loading={busy}>
            حفظ الدفعة
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {!studentId && (
          <Field label="الطالب" className="sm:col-span-2">
            <Select value={form.userId} onChange={(e) => set('userId', e.target.value)}>
              <option value="">اختر الطالب…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.email}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="الكورس" hint="اختيار كورس بيفعّل اشتراك الطالب فيه تلقائيًا" className="sm:col-span-2">
          <Select value={form.courseId} onChange={(e) => pickCourse(e.target.value)}>
            <option value="">بدون كورس محدد</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={`المبلغ (${currency})`}>
          <Input type="number" min="0" step="any" value={form.amount} onChange={(e) => set('amount', e.target.value)} dir="ltr" />
        </Field>
        <Field label="التاريخ">
          <Input type="date" value={form.paidAt} onChange={(e) => set('paidAt', e.target.value)} dir="ltr" />
        </Field>
        <Field label="طريقة الدفع">
          <Select value={form.method} onChange={(e) => set('method', e.target.value)}>
            {METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
        </Field>
        <Field label="ملاحظة">
          <Input value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="مثلًا: القسط الأول" />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
