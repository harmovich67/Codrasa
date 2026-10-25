import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Save, Play, Target, Lightbulb, TriangleAlert, ListChecks, Code2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { createTimeline } from '../lib/recording.js';
import { outputText, runCode } from '../lib/runner.js';
import { fmtTime } from '../lib/format.js';
import { toast } from '../store/toast.js';
import { Badge, Button, Card, Empty, Field, IconButton, Input, Select, Textarea, Toggle, cx } from './ui.jsx';

const key = () => Math.random().toString(36).slice(2);

const blank = (t_ms, language) => ({
  _key: key(),
  type: 'choice',
  title: '',
  skill: '',
  prompt: '',
  hint: '',
  t_ms,
  required: true,
  options: ['', ''],
  answer: 0,
  starter_code: language === 'javascript' ? '// اكتب الحل هنا\n' : language === 'python' ? '# اكتب الحل هنا\n' : '',
  expected_output: '',
});

const withKeys = (list) => list.map((c) => ({ ...c, _key: c.id || key() }));

function parseTime(text) {
  const parts = text.trim().split(':').map(Number);
  if (!parts.length || parts.length > 3 || parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  return parts.reduce((total, n) => total * 60 + n, 0) * 1000;
}

function TimeInput({ value, onChange }) {
  const [text, setText] = useState(fmtTime(value));
  useEffect(() => setText(fmtTime(value)), [value]);
  return (
    <Input
      dir="ltr"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const ms = parseTime(text);
        if (ms == null) setText(fmtTime(value));
        else onChange(ms);
      }}
      className="w-24 font-mono"
      placeholder="mm:ss"
    />
  );
}

/* Teacher tool: places challenges on the lesson timeline. `draftRequest` = { id, t } adds a blank one at t. */
export default function CheckpointEditor({ lesson, draftRequest }) {
  const duration = lesson.duration_ms;
  const language = lesson.language;
  const timeline = useMemo(() => (lesson.recording ? createTimeline(lesson.recording) : null), [lesson.recording]);
  const [items, setItems] = useState(() => withKeys(lesson.checkpoints || []));
  const [stats, setStats] = useState({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const lastDraft = useRef(null);

  const loadStats = () =>
    api
      .get(`/lessons/${lesson.id}/checkpoint-stats`)
      .then((rows) => setStats(Object.fromEntries(rows.map((row) => [row.id, row]))))
      .catch(() => {});
  useEffect(() => {
    loadStats();
  }, [lesson.id]);

  const update = (k, patch) => {
    setItems((list) => list.map((c) => (c._key === k ? { ...c, ...patch } : c)));
    setDirty(true);
  };
  const add = (t_ms) => {
    setItems((list) => [...list, blank(Math.min(duration, Math.max(0, Math.round(t_ms))), language)]);
    setDirty(true);
  };

  useEffect(() => {
    if (!draftRequest || lastDraft.current === draftRequest.id) return;
    lastDraft.current = draftRequest.id;
    add(draftRequest.t);
  }, [draftRequest]);

  const skills = [...new Set(items.map((c) => c.skill.trim()).filter(Boolean))];
  const sorted = [...items].sort((a, b) => a.t_ms - b.t_ms);

  async function save() {
    setSaving(true);
    try {
      const payload = items.map(({ _key, id, ...rest }) => (id ? { id, ...rest } : rest));
      await api.put(`/lessons/${lesson.id}`, { checkpoints: payload });
      const fresh = await api.get(`/lessons/${lesson.id}`);
      setItems(withKeys(fresh.checkpoints));
      setDirty(false);
      toast.success('اتحفظت التحديات ✓');
      loadStats();
    } catch (err) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  }

  if (!duration) {
    return <Empty icon={Target} title="سجّل الدرس الأول" text="التحديات بتتحط على لحظات من التسجيل، فسجّل الشرح وبعدين ارجع هنا." />;
  }

  const suggestions = (timeline?.runs || []).filter((r) => !items.some((c) => Math.abs(c.t_ms - r.t) < 4000)).slice(0, 6);

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Target className="size-5 text-brand" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">لحظات تفاعل إجبارية</p>
            <p className="text-xs leading-6 text-muted">
              الدرس بيقف عند اللحظة دي ومبيكمّلش لحد ما الطالب يحلّ التحدي. كل تحدي مربوط بمهارة، ومنها بتتبني خريطة مهارات الطالب.
            </p>
          </div>
          <Button variant="subtle" icon={Plus} onClick={() => add(0)}>
            تحدي جديد
          </Button>
          <Button icon={Save} onClick={save} loading={saving} disabled={!dirty}>
            حفظ التحديات
          </Button>
        </div>
        {suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3 text-xs text-muted">
            <Lightbulb className="size-3.5 text-amber" /> أماكن مقترحة (بعد ما شغّلت الكود في التسجيل):
            {suggestions.map((run) => (
              <button key={run.t} onClick={() => add(run.t)} className="rounded-md border border-line bg-panel-2 px-2 py-1 font-mono text-ink transition hover:border-brand/50">
                + {fmtTime(run.t)}
              </button>
            ))}
          </div>
        )}
        {dirty && (
          <p className="flex items-center gap-2 text-xs text-amber">
            <TriangleAlert className="size-3.5" /> فيه تعديلات لسه محفوظتش. ملحوظة: تعديل نص التحدي أو إجابته بيصفّر تقدم الطلاب عليه.
          </p>
        )}
      </Card>

      {sorted.length === 0 && <Empty icon={Target} title="مفيش تحديات لسه" text="ضيف أول تحدي — حتى سؤال واحد بعد أهم فكرة في الدرس بيفرق." />}

      <datalist id="skill-names">
        {skills.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {sorted.map((c, i) => (
        <Challenge key={c._key} index={i + 1} item={c} stat={c.id ? stats[c.id] : null} language={language} duration={duration} update={(patch) => update(c._key, patch)} remove={() => {
          setItems((list) => list.filter((x) => x._key !== c._key));
          setDirty(true);
        }} />
      ))}
    </div>
  );
}

function Challenge({ index, item: c, stat, language, duration, update, remove }) {
  const [solution, setSolution] = useState('');
  const [running, setRunning] = useState(false);
  const canCode = language === 'javascript' || language === 'python';

  async function captureOutput() {
    if (!solution.trim()) return toast.info('اكتب الحل النموذجي الأول');
    setRunning(true);
    const res = await runCode(language, solution);
    setRunning(false);
    if (res.error) toast.error('الحل النموذجي فيه خطأ — شوف الناتج');
    update({ expected_output: outputText(res.lines) });
  }

  const setOption = (j, value) => update({ options: c.options.map((o, k) => (k === j ? value : o)) });

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge color="brand">#{index}</Badge>
        <TimeInput value={c.t_ms} onChange={(t_ms) => update({ t_ms: Math.min(duration, t_ms) })} />
        <Select value={c.type} onChange={(e) => update({ type: e.target.value })} className="w-40">
          <option value="choice">اختيار من متعدد</option>
          {canCode && <option value="code">تحدي كود</option>}
          {!canCode && c.type === 'code' && <option value="code">تحدي كود</option>}
        </Select>
        <Toggle checked={c.required} onChange={(required) => update({ required })} label={c.required ? 'إجباري' : 'اختياري'} />
        <div className="flex-1" />
        {stat && stat.learners > 0 && (
          <span className="text-xs text-muted" title="الطلاب اللي جرّبوه / نجحوا / متوسط المحاولات">
            {stat.passed}/{stat.learners} نجحوا · {stat.avg_attempts} محاولة في المتوسط
            {stat.stuck > 0 && <span className="text-rose"> · {stat.stuck} متعطل</span>}
          </span>
        )}
        <IconButton icon={Trash2} title="حذف التحدي" onClick={remove} />
      </div>

      {c.type === 'code' && !canCode && (
        <p className="rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-xs text-rose">تحديات الكود متاحة لدروس JavaScript وPython فقط — حوّل النوع لاختيار من متعدد.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="عنوان التحدي">
          <Input value={c.title} onChange={(e) => update({ title: e.target.value })} placeholder="مثلًا: غيّر قيمة المتغير" />
        </Field>
        <Field label="المهارة اللي بيقيسها" hint="نفس الاسم في أكتر من تحدي = مهارة واحدة في خريطة الطالب">
          <Input value={c.skill} onChange={(e) => update({ skill: e.target.value })} list="skill-names" placeholder="مثلًا: المتغيرات" />
        </Field>
      </div>
      <Field label="المطلوب من الطالب (Markdown)">
        <Textarea value={c.prompt} onChange={(e) => update({ prompt: e.target.value })} rows={3} dir="auto" placeholder="اوصف المطلوب بوضوح، ولو الحل ناتج معين اكتبه." />
      </Field>
      <Field label="تلميح المدرّس (اختياري — بيظهر للطالب لو طلبه)">
        <Input value={c.hint} onChange={(e) => update({ hint: e.target.value })} />
      </Field>

      {c.type === 'choice' ? (
        <div className="space-y-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <ListChecks className="size-3.5" /> الاختيارات (حدد الصح)
          </span>
          {c.options.map((option, j) => (
            <label key={j} className={cx('flex items-center gap-2 rounded-lg border px-2', c.answer === j ? 'border-mint/60 bg-mint/5' : 'border-line')}>
              <input type="radio" checked={c.answer === j} onChange={() => update({ answer: j })} className="accent-[#2dd4a7]" />
              <input value={option} onChange={(e) => setOption(j, e.target.value)} placeholder={`اختيار ${j + 1}`} className="w-full bg-transparent py-2 text-sm outline-none" />
              {c.options.length > 2 && (
                <IconButton
                  icon={Trash2}
                  title="حذف الاختيار"
                  onClick={() => update({ options: c.options.filter((_, k) => k !== j), answer: c.answer === j ? 0 : c.answer > j ? c.answer - 1 : c.answer })}
                />
              )}
            </label>
          ))}
          {c.options.length < 6 && (
            <Button variant="ghost" size="sm" icon={Plus} onClick={() => update({ options: [...c.options, ''] })}>
              اختيار
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <Code2 className="size-3.5" /> الكود بيتصحّح بمقارنة الناتج (console.log / print) بالناتج المتوقع
          </span>
          <div className="grid gap-3 lg:grid-cols-2">
            <Field label="كود البداية اللي هيظهر للطالب">
              <Textarea dir="ltr" value={c.starter_code} onChange={(e) => update({ starter_code: e.target.value })} rows={6} className="font-mono text-[13px]" />
            </Field>
            <Field label="الحل النموذجي (مؤقت — مش بيتحفظ)">
              <Textarea dir="ltr" value={solution} onChange={(e) => setSolution(e.target.value)} rows={6} className="font-mono text-[13px]" />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="mint" size="sm" icon={Play} onClick={captureOutput} loading={running}>
              شغّل الحل والتقط الناتج
            </Button>
            <span className="text-xs text-muted">أو اكتب الناتج المتوقع يدويًا:</span>
          </div>
          <Textarea dir="ltr" value={c.expected_output} onChange={(e) => update({ expected_output: e.target.value })} rows={3} className="font-mono text-[13px]" placeholder="الناتج المتوقع" />
        </div>
      )}
    </Card>
  );
}
