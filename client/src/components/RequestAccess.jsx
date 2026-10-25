import { useState } from 'react';
import { Clock, Send, CircleX, Lock } from 'lucide-react';
import { api } from '../lib/api.js';
import { fmtMoney } from '../lib/format.js';
import { useAuth } from '../store/auth.js';
import { toast } from '../store/toast.js';
import { Badge, Button, Field, Modal, Textarea } from './ui.jsx';

/*
 * What a student sees on a course they haven't joined and can't join by themselves:
 * a "request access" button, then the request's status.
 */
export default function RequestAccess({ course, onChanged, compact }) {
  const currency = useAuth((s) => s.platform.currency);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      await api.post(`/courses/${course.id}/request`, { message });
      toast.success('اتبعت طلب الاشتراك للمدرّس ✓');
      setOpen(false);
      setMessage('');
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
        {course.price > 0 && (
          <p className="flex items-start gap-2 rounded-lg bg-amber/10 p-3 text-sm text-amber">
            <Lock className="mt-0.5 size-4 shrink-0" />
            السعر {fmtMoney(course.price, currency)}. ادفع للمدرّس بالطريقة المتفق عليها، واكتب هنا رقم التحويل أو طريقة الدفع، والمدرّس هيفعّل اشتراكك بعد المراجعة.
          </p>
        )}
        <Field label="رسالة للمدرّس (اختياري)">
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="مثلًا: حوّلت المبلغ على فودافون كاش من رقم 01xxxxxxxxx" />
        </Field>
      </Modal>
    </>
  );
}
