import { useState } from 'react';
import { useAuth } from '../../store/auth.js';
import { Button, Field, Input, Modal, Textarea, Toggle } from '../../components/ui.jsx';

export const COLORS = ['#7c5cff', '#2dd4a7', '#f5b544', '#f0607a', '#38bdf8', '#a3e635', '#f472b6', '#fb923c'];

export default function CourseForm({ open, onClose, initial, onSubmit, title }) {
  const currency = useAuth((s) => s.platform.currency);
  const [form, setForm] = useState(() => ({ title: '', description: '', price: 0, color: COLORS[0], published: false, ...initial }));
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit(form);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={submit} loading={busy}>
            حفظ
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="اسم الكورس">
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} autoFocus required />
        </Field>
        <Field label="الوصف">
          <Textarea value={form.description || ''} onChange={(e) => set('description', e.target.value)} rows={3} />
        </Field>
        <Field label={`السعر (${currency})`} hint="0 = مجاني والطالب يقدر يشترك بنفسه. المدفوع بتفعّله انت بعد الدفع.">
          <Input type="number" min="0" step="any" value={form.price} onChange={(e) => set('price', e.target.value)} dir="ltr" />
        </Field>
        <Field label="اللون">
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => set('color', c)}
                className={`size-8 rounded-lg transition ${form.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-panel' : ''}`}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
        </Field>
        <Toggle checked={!!form.published} onChange={(v) => set('published', v)} label="منشور ويظهر للطلاب" />
        <div>
          <Toggle checked={!!form.private} onChange={(v) => set('private', v)} label="كورس خاص (مش بيظهر في قائمة الكورسات)" />
          <p className="mt-1.5 mr-12 text-xs text-muted">الطلاب اللي بتفتحلهم الكورس بس هم اللي هيشوفوه، وتفتحه من صفحة الكورس أو صفحة الطالب.</p>
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
