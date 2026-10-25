import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../store/auth.js';
import { toast } from '../store/toast.js';
import { Button, Field, Input } from '../components/ui.jsx';
import AuthShell from './AuthShell.jsx';

export default function Setup() {
  const navigate = useNavigate();
  const { authenticate, platform } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await authenticate('/auth/setup', form);
      toast.success('المنصة جاهزة! ابدأ بإضافة أول كورس');
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell name={platform.platform_name} title="إعداد المنصة" subtitle="أول حساب هيكون حساب المدرّس (صاحب المنصة) وله كل الصلاحيات.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="اسمك">
          <Input value={form.name} onChange={set('name')} required autoFocus />
        </Field>
        <Field label="البريد الإلكتروني">
          <Input type="email" dir="ltr" value={form.email} onChange={set('email')} required />
        </Field>
        <Field label="كلمة المرور" hint="6 أحرف على الأقل">
          <Input type="password" dir="ltr" value={form.password} onChange={set('password')} required minLength={6} />
        </Field>
        <Button type="submit" className="w-full" loading={busy}>
          إنشاء حساب المدرّس
        </Button>
      </form>
    </AuthShell>
  );
}
