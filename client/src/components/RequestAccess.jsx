import { useState } from 'react';
import { Clock, Send, CircleX, Lock, Copy } from 'lucide-react';
import { api } from '../lib/api.js';
import { fmtMoney } from '../lib/format.js';
import { useAuth } from '../store/auth.js';
import { toast } from '../store/toast.js';
import { Badge, Button, Field, IconButton, Input, Modal, Textarea, cx } from './ui.jsx';

const PAYMENT_METHODS = ['فودافون كاش', 'إنستاباي'];

/*
 * What a student sees on a course they haven't joined and can't join by themselves:
 * a "request access" button, then the request's status.
 */
export default function RequestAccess({ course, onChanged, compact }) {
  const { currency, payment_phone: phone } = useAuth((s) => s.platform);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [method, setMethod] = useState('');
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const paid = course.price > 0;

  function copyPhone() {
    navigator.clipboard?.writeText(phone).then(() => toast.success('اتنسخ الرقم ✓'), () => {});
  }

  async function send() {
    if (paid && !method) return toast.error('اختار طريقة الدفع: فودافون كاش أو إنستاباي');
    if (paid && !ref.trim()) return toast.error('اكتب الرقم اللي حوّلت منه أو رقم العملية');
    setBusy(true);
    try {
      await api.post(`/courses/${course.id}/request`, { message, paymentMethod: method, paymentRef: ref });
      toast.success('اتبعت طلب الاشتراك للمدرّس ✓');
      setOpen(false);
      setMessage('');
      setMethod('');
      setRef('');
      onChanged?.();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  if (course.request_status === 'pending') {
    return (
      <Badge color="amber" className="px-3 py-2 text-xs">
        <Clock className="size-3.5" /> طلبك قيد المراجعة — هيتفعّل أول ما المدرّس يوافق
      </Badge>
    );
  }

  return (
    <>
      {course.request_status === 'rejected' && (
        <p className="mb-2 flex items-center gap-1.5 text-xs text-rose">
          <CircleX className="size-3.5" /> الطلب السابق اترفض{course.request_reply ? `: ${course.request_reply}` : ''} — تقدر تبعت طلب جديد.
        </p>
      )}
      <Button className={compact ? 'w-full' : ''} icon={Send} onClick={() => setOpen(true)}>
        اطلب الاشتراك{course.price > 0 ? ` (${fmtMoney(course.price, currency)})` : ''}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`طلب اشتراك في "${course.title}"`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            <Button icon={Send} onClick={send} loading={busy}>
              إرسال الطلب
            </Button>
          </>
        }
      >
        {paid && (
          <>
            <div className="space-y-2 rounded-xl border border-amber/30 bg-amber/10 p-4 text-sm">
              <p className="flex items-start gap-2 text-amber">
                <Lock className="mt-0.5 size-4 shrink-0" />
                حوّل {fmtMoney(course.price, currency)} على فودافون كاش أو إنستاباي على الرقم ده، وبعدين اكتب بيانات التحويل تحت. المدرّس هيراجع التحويل ويفعّل اشتراكك.
              </p>
              <div className="flex items-center justify-between gap-2 rounded-lg bg-panel px-3 py-2">
                <span className="font-mono text-base font-semibold tracking-wide" dir="ltr">
                  {phone}
                </span>
                <IconButton icon={Copy} title="نسخ الرقم" onClick={copyPhone} />
              </div>
            </div>
            <Field label="حوّلت بإيه؟">
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={cx(
                      'rounded-xl border px-3 py-2.5 text-sm font-medium transition',
                      method === m ? 'border-brand bg-brand/10 text-brand' : 'border-line bg-panel-2 text-muted hover:text-ink',
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="الرقم اللي حوّلت منه أو رقم العملية">
              <Input value={ref} onChange={(e) => setRef(e.target.value)} dir="ltr" placeholder="01xxxxxxxxx" />
            </Field>
          </>
        )}
        <Field label="رسالة للمدرّس (اختياري)">
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
        </Field>
      </Modal>
    </>
  );
}
