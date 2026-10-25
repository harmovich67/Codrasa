import { useEffect, useState } from 'react';
import { Save, KeyRound, Zap, Brain, Gauge, Settings as SettingsIcon } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useAuth } from '../../store/auth.js';
import { toast } from '../../store/toast.js';
import { Badge, Button, Card, Field, Input, PageHeader, PageLoader, Toggle } from '../../components/ui.jsx';

export default function Settings() {
  const refreshPlatform = useAuth((s) => s.refreshPlatform);
  const [s, setS] = useState(null);
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null);

  const load = () => api.get('/settings').then(setS).catch(toast.error);
  useEffect(() => {
    load();
  }, []);

  if (!s) return <PageLoader />;
  const set = (k, v) => setS((x) => ({ ...x, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      await api.put('/settings', { ...s, gemini_api_key: key || undefined });
      setKey('');
      await Promise.all([load(), refreshPlatform()]);
      toast.success('اتحفظت الإعدادات ✓');
    } catch (err) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function test(tier) {
    setTesting(tier);
    try {
      const res = await api.post('/ai/test', { tier });
      toast.success(`${res.model} شغال ✓ (${res.ms}ms): ${res.text}`);
    } catch (err) {
      toast.error(err);
    } finally {
      setTesting(null);
    }
  }

  async function clearKey() {
    if (!window.confirm('مسح مفتاح Gemini المحفوظ؟')) return;
    await api.put('/settings', { clear_gemini_key: true }).catch(toast.error);
    load();
  }

  const keyReady = s.gemini_key_set || s.gemini_key_from_env;

  return (
    <>
      <PageHeader
        title="الإعدادات"
        actions={
          <Button icon={Save} onClick={save} loading={saving}>
            حفظ الإعدادات
          </Button>
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="space-y-4 p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <SettingsIcon className="size-4.5 text-brand" /> المنصة
          </h2>
          <Field label="اسم المنصة">
            <Input value={s.platform_name} onChange={(e) => set('platform_name', e.target.value)} />
          </Field>
          <Field label="العملة">
            <Input value={s.currency} onChange={(e) => set('currency', e.target.value)} className="w-32" />
          </Field>
          <Toggle
            checked={s.allow_registration === '1'}
            onChange={(v) => set('allow_registration', v ? '1' : '0')}
            label="السماح للطلاب بإنشاء حسابات بنفسهم"
          />
        </Card>

        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <KeyRound className="size-4.5 text-brand" /> Gemini
            </h2>
            {keyReady ? <Badge color="mint">{s.gemini_key_set ? 'المفتاح محفوظ' : 'من ملف .env'}</Badge> : <Badge color="rose">مفيش مفتاح</Badge>}
          </div>
          <Field label="API Key" hint="من Google AI Studio. بيتخزن على السيرفر بس ومبيوصلش للطلاب أبدًا.">
            <div className="flex gap-2">
              <Input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={s.gemini_key_set ? '•••••••• (اكتب مفتاح جديد للتغيير)' : 'AIza…'} dir="ltr" />
              {s.gemini_key_set && (
                <Button variant="ghost" onClick={clearKey}>
                  مسح
                </Button>
              )}
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={<span className="inline-flex items-center gap-1"><Zap className="size-3.5" /> الموديل السريع</span>} hint="للمحادثة اليومية للطلاب">
              <Input value={s.fast_model} onChange={(e) => set('fast_model', e.target.value)} dir="ltr" className="font-mono text-xs" />
            </Field>
            <Field label={<span className="inline-flex items-center gap-1"><Brain className="size-3.5" /> الموديل الأذكى</span>} hint="للملخصات والاختبارات والردود">
              <Input value={s.smart_model} onChange={(e) => set('smart_model', e.target.value)} dir="ltr" className="font-mono text-xs" />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="subtle" icon={Zap} onClick={() => test('fast')} loading={testing === 'fast'} disabled={!keyReady}>
              اختبار السريع
            </Button>
            <Button size="sm" variant="subtle" icon={Brain} onClick={() => test('smart')} loading={testing === 'smart'} disabled={!keyReady}>
              اختبار الأذكى
            </Button>
          </div>
          <p className="text-xs text-muted">احفظ الأول قبل الاختبار لو غيّرت المفتاح أو أسماء الموديلات.</p>
        </Card>

        <Card className="space-y-4 p-5 lg:col-span-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <Gauge className="size-4.5 text-brand" /> التحكم في المساعد الذكي للطلاب
          </h2>
          <p className="text-xs leading-6 text-muted">لو وقفته، تبويب «المساعد» بيختفي من كل الدروس عند الطلاب وأزرار المساعدة في التحديات كمان. تقدر تعمل استثناء لدرس معين من استوديو الدرس (تبويب المحتوى).</p>
          <div className="flex flex-wrap items-end gap-6">
            <Field label="الحد اليومي لرسائل كل طالب">
              <Input type="number" min="0" value={s.ai_daily_limit} onChange={(e) => set('ai_daily_limit', e.target.value)} className="w-32" dir="ltr" />
            </Field>
            <Toggle checked={s.student_ai === '1'} onChange={(v) => set('student_ai', v ? '1' : '0')} label="إظهار المساعد الذكي للطلاب" />
            <Toggle checked={s.student_smart === '1'} onChange={(v) => set('student_smart', v ? '1' : '0')} label="السماح للطلاب باستخدام الموديل الأذكى (أغلى)" />
          </div>
        </Card>
      </div>
    </>
  );
}
