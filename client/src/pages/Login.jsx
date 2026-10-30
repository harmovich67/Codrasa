import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../lib/api.js';
import { useAuth } from '../store/auth.js';
import { toast } from '../store/toast.js';
import { Button, Field, Input, Tabs } from '../components/ui.jsx';
import AuthShell from './AuthShell.jsx';

// Don't pop the keyboard open on phones: it would cover the form as soon as the page loads.
const canAutoFocus = typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;

export default function Login() {
  const navigate = useNavigate();
  const { authenticate, platform } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    api.get('/auth/setup-needed').then(({ needed }) => needed && navigate('/setup', { replace: true })).catch(() => {});
  }, [navigate]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await authenticate(mode === 'login' ? '/auth/login' : '/auth/register', form);
      if (result?.pending) {
        setPending(true);
        setMode('login');
        setForm((f) => ({ ...f, password: '' }));
        return;
      }
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
          fill
          className="mb-5"
          value={mode}
          onChange={setMode}
          tabs={[
            { id: 'login', label: 'تسجيل الدخول' },
            { id: 'register', label: 'حساب جديد' },
          ]}
        />
      )}
      {pending && (
        <p className="mb-4 rounded-xl border border-mint/30 bg-mint/10 p-3 text-sm text-mint">
          اتعمل حسابك ✓ — مستني موافقة المدرّس، وأول ما يوافق تقدر تسجّل دخولك من هنا.
        </p>
      )}
      <form onSubmit={submit} className="space-y-4">
        {mode === 'register' && (
          <Field label="الاسم">
            <Input value={form.name} onChange={set('name')} required autoFocus={canAutoFocus} />
          </Field>
        )}
        <Field label="البريد الإلكتروني">
          <Input type="email" dir="ltr" value={form.email} onChange={set('email')} required autoFocus={canAutoFocus && mode === 'login'} />
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
