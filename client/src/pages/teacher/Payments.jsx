import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Plus, Wallet, Receipt, TrendingUp, Trash2 } from 'lucide-react';
import { api } from '../../lib/api.js';
import { fmtDate, fmtMoney } from '../../lib/format.js';
import { useAuth } from '../../store/auth.js';
import { toast } from '../../store/toast.js';
import { Button, Card, Empty, IconButton, PageHeader, PageLoader, Stat } from '../../components/ui.jsx';
import PaymentForm from './PaymentForm.jsx';

function lastMonths(n) {
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

export default function Payments() {
  const currency = useAuth((s) => s.platform.currency);
  const [data, setData] = useState(null);
  const [adding, setAdding] = useState(false);

  const load = () => api.get('/payments').then(setData).catch(toast.error);
  useEffect(() => {
    load();
  }, []);

  async function remove(p) {
    if (!window.confirm('حذف الدفعة دي؟')) return;
    await api.del(`/payments/${p.id}`).catch(toast.error);
    load();
  }

  if (!data) return <PageLoader />;

  const byMonth = Object.fromEntries(data.monthly.map((m) => [m.month, m.total]));
  const months = lastMonths(12).map((m) => ({ month: m, total: byMonth[m] || 0 }));
  const max = Math.max(1, ...months.map((m) => m.total));

  return (
    <>
      <PageHeader
        title="الماليات"
        subtitle="سجّل المدفوعات، والدفعة بتفعّل اشتراك الطالب في الكورس تلقائيًا."
        actions={
          <Button icon={Plus} onClick={() => setAdding(true)}>
            دفعة جديدة
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={TrendingUp} label="دخل الشهر ده" value={fmtMoney(data.totals.this_month, currency)} tone="mint" />
        <Stat icon={Wallet} label="إجمالي الدخل" value={fmtMoney(data.totals.total, currency)} tone="amber" />
        <Stat icon={Receipt} label="عدد الدفعات" value={data.totals.count} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold">آخر 12 شهر</h2>
          <div className="flex h-48 items-end gap-2" dir="ltr">
            {months.map((m) => (
              <div key={m.month} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-[10px] text-muted opacity-0 transition group-hover:opacity-100">{fmtMoney(m.total)}</span>
                <div className="w-full rounded-t-md bg-brand/70 transition group-hover:bg-brand" style={{ height: `${Math.max(2, (m.total / max) * 100)}%` }} />
                <span className="font-mono text-[10px] text-muted">{m.month.slice(5)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 font-semibold">حسب الكورس</h2>
          {data.byCourse.length === 0 ? (
            <p className="text-sm text-muted">—</p>
          ) : (
            <div className="space-y-3">
              {data.byCourse.map((c) => (
                <div key={c.title}>
                  <div className="flex justify-between text-sm">
                    <span className="truncate">{c.title}</span>
                    <span className="tabular-nums text-muted">{fmtMoney(c.total, currency)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-line">
                    <div className="h-full rounded-full bg-amber" style={{ width: `${(c.total / data.totals.total) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-5 overflow-hidden">
        {data.items.length === 0 ? (
          <div className="p-5">
            <Empty icon={Wallet} title="مفيش مدفوعات لسه" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-line">
                  {['التاريخ', 'الطالب', 'الكورس', 'المبلغ', 'الطريقة', 'ملاحظة', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-right font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id} className="border-b border-line/60 last:border-0 hover:bg-panel-2">
                    <td className="px-4 py-3 text-muted">{fmtDate(p.paid_at)}</td>
                    <td className="px-4 py-3">
                      <Link to={`/students/${p.user_id}`} className="hover:text-brand">
                        {p.student_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{p.course_title || '—'}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums">{fmtMoney(p.amount, currency)}</td>
                    <td className="px-4 py-3 text-muted">{p.method}</td>
                    <td className="px-4 py-3 text-muted">{p.note}</td>
                    <td className="px-2 py-3">
                      <IconButton icon={Trash2} title="حذف" className="size-7 hover:text-rose" onClick={() => remove(p)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {adding && (
        <PaymentForm
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            load();
          }}
        />
      )}
    </>
  );
}
