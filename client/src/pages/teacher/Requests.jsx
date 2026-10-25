import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Check, X, Inbox, Phone, Mail } from 'lucide-react';
import { api } from '../../lib/api.js';
import { fmtMoney, fmtRelative } from '../../lib/format.js';
import { useAuth } from '../../store/auth.js';
import { toast } from '../../store/toast.js';
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, PageLoader, Select, Tabs, Toggle } from '../../components/ui.jsx';

const METHODS = ['كاش', 'فودافون كاش', 'إنستاباي', 'تحويل بنكي', 'PayPal', 'أخرى'];

function Decide({ request, mode, onClose, onDone }) {
  const currency = useAuth((s) => s.platform.currency);
  const approve = mode === 'approve';
  const [record, setRecord] = useState(request.course_price > 0);
  const [amount, setAmount] = useState(request.course_price || '');
  const [method, setMethod] = useState(METHODS[0]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await api.post(`/requests/${request.id}/${mode}`, { recordPayment: approve && record, amount, method, reply });
      toast.success(approve ? `اتفعّل اشتراك ${request.student_name} في الكورس ✓` : 'اترفض الطلب');
      onDone();
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
      title={approve ? 'قبول الطلب وتفعيل الكورس' : 'رفض الطلب'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button variant={approve ? 'primary' : 'danger'} icon={approve ? Check : X} onClick={submit} loading={busy}>
            {approve ? 'قبول وتفعيل' : 'رفض الطلب'}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">
        {request.student_name} — {request.course_title}
      </p>
      {approve && (
        <>
          <Toggle checked={record} onChange={setRecord} label="سجّل دفعة مع القبول" />
          {record && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={`المبلغ (${currency})`}>
                <Input type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} dir="ltr" />
              </Field>
              <Field label="طريقة الدفع">
                <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                  {METHODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
        </>
      )}
      <Field label={approve ? 'رسالة للطالب (اختياري)' : 'سبب الرفض (بيظهر للطالب)'}>
        <Input value={reply} onChange={(e) => setReply(e.target.value)} />
      </Field>
    </Modal>
  );
}

export default function Requests() {
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState(null);
  const [deciding, setDeciding] = useState(null);
  const currency = useAuth((s) => s.platform.currency);

  const load = useCallback(() => api.get(`/requests?status=${status}`).then(setItems).catch(toast.error), [status]);
  useEffect(() => {
    setItems(null);
    load();
  }, [load]);

  return (
    <>
      <PageHeader title="طلبات الاشتراك" subtitle="الطلاب بيطلبوا الكورسات المدفوعة من هنا، وانت بتقبل وتفعّل أو ترفض." />
      <Tabs
        className="mb-5 w-fit"
        value={status}
        onChange={setStatus}
        tabs={[
          { id: 'pending', label: 'مستنية قرارك' },
          { id: 'all', label: 'كل الطلبات' },
        ]}
      />
      {!items ? (
        <PageLoader />
      ) : items.length === 0 ? (
        <Empty icon={Inbox} title={status === 'pending' ? 'مفيش طلبات جديدة' : 'مفيش طلبات'} text="لما طالب يطلب الاشتراك في كورس هيظهر هنا." />
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <Card key={r.id} className="flex flex-wrap items-start justify-between gap-4 p-5">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/students/${r.user_id}`} className="font-semibold hover:text-brand">
                    {r.student_name}
                  </Link>
                  <span className="text-muted">طلب</span>
                  <Link to={`/courses/${r.course_id}`} className="font-semibold hover:text-brand">
                    {r.course_title}
                  </Link>
                  <Badge color={r.course_price > 0 ? 'amber' : 'mint'}>{r.course_price > 0 ? fmtMoney(r.course_price, currency) : 'مجاني'}</Badge>
                  {r.status === 'approved' && <Badge color="mint">اتقبل</Badge>}
                  {r.status === 'rejected' && <Badge color="rose">اترفض</Badge>}
                  <span className="text-xs text-muted">{fmtRelative(r.created_at)}</span>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-muted" dir="ltr">
                  <span className="inline-flex items-center gap-1">
                    <Mail className="size-3.5" /> {r.student_email}
                  </span>
                  {r.student_phone && (
                    <a href={`https://wa.me/${r.student_phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-mint">
                      <Phone className="size-3.5" /> {r.student_phone}
                    </a>
                  )}
                </div>
                {r.message && <p className="rounded-lg bg-panel-2 p-3 text-sm whitespace-pre-wrap">{r.message}</p>}
                {r.reply && <p className="text-xs text-muted">ردك: {r.reply}</p>}
              </div>
              {r.status === 'pending' && (
                <div className="flex gap-2">
                  <Button icon={Check} onClick={() => setDeciding({ request: r, mode: 'approve' })}>
                    قبول
                  </Button>
                  <Button variant="danger" icon={X} onClick={() => setDeciding({ request: r, mode: 'reject' })}>
                    رفض
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      {deciding && (
        <Decide
          {...deciding}
          onClose={() => setDeciding(null)}
          onDone={() => {
            setDeciding(null);
            load();
          }}
        />
      )}
    </>
  );
}
