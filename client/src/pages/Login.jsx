import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../lib/api.js';
import { useAuth } from '../store/auth.js';
import { toast } from '../store/toast.js';
import { Button, Field, Input, Tabs } from '../components/ui.jsx';
import AuthShell from './AuthShell.jsx';

export default function Login() {
  const navigate = useNavigate();
  const { authenticate, platform } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/auth/setup-needed').then(({ needed }) => needed && navigate('/setup', { replace: true })).catch(() => {});
  }, [navigate]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await authenticate(mode === 'login' ? '/auth/login' : '/auth/register', form);
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      name={platform.platform_name}
      title={mode === 'login' ? 'أهلًا بيك تاني 👋' : 'ابدأ رحلتك'}
      subtitle={mode === 'login' ? 'سجّل دخولك وكمّل من مكان ما وقفت' : 'اعمل حساب طالب في ثواني'}
    >
      {platform.allow_registration && (
        <Tabs
          className="mb-6"
          value={mode}
          onChange={setMode}
          tabs={[
            { id: 'login', label: 'تسجيل الدخول' },
            { id: 'register', label: 'حساب جديد' },
          ]}
        />
      )}
      <form onSubmit={submit} className="space-y-4">
        {mode === 'register' && (
          <Field label="الاسم">
            <Input value={form.name} onChange={set('name')} required autoFocus />
          </Field>
        )}
        <Field label="البريد الإلكتروني">
          <Input type="email" dir="ltr" value={form.email} onChange={set('email')} required autoFocus={mode === 'login'} />
        </Field>
        <Field label="كلمة المرور">
          <Input type="password" dir="ltr" value={form.password} onChange={set('password')} required minLength={6} />
        </Field>
        <Button type="submit" className="w-full" loading={busy}>
          {mode === 'login' ? 'دخول' : 'إنشاء الحساب'}
        </Button>
      </form>
    </AuthShell>
  );
}
