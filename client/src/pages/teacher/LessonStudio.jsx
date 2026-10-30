import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  ArrowRight,
  Terminal,
  Eye,
  Save,
  Sparkles,
  StickyNote,
  Eraser,
  Plus,
  Trash2,
  Flame,
  FileText,
  ListChecks,
  Radio,
  Target,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { LessonRecorder, createTimeline } from '../../lib/recording.js';
import { useStudioSession } from './useStudioSession.js';
import { Prompter, RecorderBar, useLiveQuestion } from './StudioParts.jsx';
import BoardRecorderTab from './BoardStudio.jsx';
import { runCode } from '../../lib/runner.js';
import { fmtTime } from '../../lib/format.js';
import { HINTS, LANGUAGES, STARTERS, langInfo } from '../../lib/languages.js';
import { toast } from '../../store/toast.js';
import { useAuth } from '../../store/auth.js';
import CodeEditor from '../../components/CodeEditor.jsx';
import OutputPanel from '../../components/OutputPanel.jsx';
import StuckMap from '../../components/StuckMap.jsx';
import CheckpointEditor from '../../components/CheckpointEditor.jsx';
import Markdown from '../../components/Markdown.jsx';
import { Badge, Button, Card, Field, IconButton, Input, PageLoader, Select, Tabs, Textarea, Toggle, cx } from '../../components/ui.jsx';

export default function LessonStudio() {
  const { id } = useParams();
  const [lesson, setLesson] = useState(null);
  const load = useCallback(() => api.get(`/lessons/${id}`).then(setLesson).catch(toast.error), [id]);
  useEffect(() => {
    load();
  }, [load]);
  if (!lesson) return <PageLoader />;
  return <Studio key={lesson.id} lesson={lesson} reload={load} />;
}

function Studio({ lesson, reload }) {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const [tab, setTab] = useState(search.get('tab') || 'record');
  const [draftRequest, setDraftRequest] = useState(() => (search.get('tab') === 'challenges' && search.has('t') ? { id: 'initial', t: Number(search.get('t')) || 0 } : null));
  const [form, setForm] = useState({
    title: lesson.title,
    description: lesson.description || '',
    notes: lesson.notes || '',
    summary: lesson.summary || '',
    published: !!lesson.published,
    language: lesson.language,
    ai_mode: lesson.ai_mode || '',
    questions_mode: lesson.questions_mode || '',
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  async function saveMeta({ silent = false } = {}) {
    setSaving(true);
    try {
      await api.put(`/lessons/${lesson.id}`, form);
      setDirty(false);
      if (!silent) toast.success('اتحفظ ✓');
    } catch (err) {
      toast.error(err);
      throw err;
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to={`/courses/${lesson.course_id}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowRight className="size-4" /> {lesson.course_title}
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          className="min-w-64 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-2xl font-bold outline-none hover:border-line focus:border-brand"
        />
        <Toggle checked={form.published} onChange={(v) => set('published', v)} label={form.published ? 'منشور للطلاب' : 'مسودة'} />
        <Button
          variant="subtle"
          icon={Eye}
          onClick={async () => {
            // The preview loads from the server, so unsaved edits must be saved first.
            if (dirty) await saveMeta({ silent: true }).catch(() => {});
            navigate(`/lessons/${lesson.id}?as=student`);
          }}
        >
          معاينة كطالب
        </Button>
        <Button icon={Save} onClick={() => saveMeta()} loading={saving} disabled={!dirty}>
          حفظ
        </Button>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'record', label: 'تسجيل الدرس', icon: Radio },
          { id: 'content', label: 'المحتوى والملخص', icon: FileText },
          { id: 'challenges', label: 'التحديات', icon: Target },
          { id: 'quiz', label: 'الاختبار', icon: ListChecks },
          { id: 'stuck', label: 'خريطة التوهان', icon: Flame },
        ]}
      />

      <div className={tab === 'record' ? '' : 'hidden'}>
        {lesson.kind === 'board' ? (
          <BoardRecorderTab lesson={lesson} form={form} set={set} reload={reload} />
        ) : (
          <Recorder lesson={lesson} form={form} set={set} reload={reload} />
        )}
      </div>
      {tab === 'content' && <ContentTab lesson={lesson} form={form} set={set} saveMeta={saveMeta} />}
      <div className={tab === 'challenges' ? '' : 'hidden'}>
        {/* remounts when questions are added while recording, so the list shows them */}
        <CheckpointEditor key={(lesson.checkpoints || []).map((c) => c.id).join()} lesson={lesson} draftRequest={draftRequest} />
      </div>
      {tab === 'quiz' && <QuizEditor lesson={lesson} saveMeta={saveMeta} dirty={dirty} />}
      {tab === 'stuck' && (
        <Card className="p-5">
          <StuckMap
            lessonId={lesson.id}
            onJump={(t) => navigate(`/lessons/${lesson.id}?t=${Math.round(t)}`)}
            onAddChallenge={(t) => {
              setDraftRequest({ id: Date.now(), t: Math.round(t) });
              setTab('challenges');
            }}
          />
        </Card>
      )}
    </div>
  );
}

function Recorder({ lesson, form, set, reload }) {
  const existing = useMemo(() => (lesson.recording ? createTimeline(lesson.recording) : null), [lesson.recording]);
  const info = langInfo(form.language);
  const editorRef = useRef(null);
  const [prompter, setPrompter] = useState(true);
  const [output, setOutput] = useState(null);
  const [code, setCode] = useState(() => existing?.finalCode ?? STARTERS[form.language] ?? '');

  const session = useStudioSession({
    lesson,
    language: form.language,
    reload,
    createRecorder: (base) => {
      const editor = editorRef.current;
      // Continuing: the editor must hold exactly what the recording ended with.
      if (base) editor.setValue(existing.finalCode.replaceAll('\r\n', '\n'));
      setOutput(null);
      return new LessonRecorder(editor, form.language, base);
    },
    onStarted: () => editorRef.current?.focus(),
  });
  const question = useLiveQuestion(session, lesson);
  const live = session.state === 'recording' || session.state === 'paused';
  const busy = session.state === 'starting' || session.state === 'saving';
  const canContinue = !existing || lesson.recording.language === form.language;

  // While paused nothing is captured, so the editor is locked too.
  useEffect(() => {
    editorRef.current?.updateOptions({ readOnly: session.state === 'paused' });
  }, [session.state]);

  async function run() {
    if (!langInfo(form.language).runnable) return;
    const res = await runCode(form.language, editorRef.current.getValue().replaceAll('\r\n', '\n'));
    setOutput(res);
    if (session.state === 'recording') session.recorder.current.markRun(res.lines, res.error);
  }
  const runRef = useRef(run);
  runRef.current = run;

  const onMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
  };

  return (
    <div className="space-y-3">
      <RecorderBar session={session} lesson={lesson} canContinue={canContinue} onAsk={question.ask}>
        <Select value={form.language} onChange={(e) => set('language', e.target.value)} disabled={live || busy} className="w-36">
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </Select>
        <div className="flex-1" />
        {info.runnable && (
          <Button variant="mint" size="sm" icon={Terminal} onClick={run} title="Ctrl+Enter" disabled={session.state === 'paused'}>
            شغّل
          </Button>
        )}
        <IconButton
          icon={Eraser}
          title="تفريغ المحرر"
          disabled={live}
          onClick={() => {
            editorRef.current?.setValue('');
            setOutput(null);
          }}
        />
        <IconButton icon={StickyNote} title="التلقين (Teleprompter)" active={prompter} onClick={() => setPrompter(!prompter)} />
      </RecorderBar>
      {question.dialog}

      {!live && (
        <p className="text-xs leading-6 text-muted">
          {existing ? (
            <>
              التسجيل الحالي: <b className="font-mono text-ink">{fmtTime(existing.duration)}</b> · {lesson.audio_parts?.length ? 'بالصوت' : 'بدون صوت'} · {lesson.recording.events.length} حدث. «كمّل» بيضيف على آخره
              (المحرر هيرجع لآخر كود)، و«تسجيل جديد» بيستبدله.{' '}
            </>
          ) : (
            'الدرس ده لسه متسجلش. '
          )}
          اللي في المحرر دلوقتي هو نقطة البداية. كل ضغطة زرار وحركة مؤشر وتشغيل كود بيتسجلوا مع صوتك — مش فيديو. «وقفة» بتوقف التسجيل والصوت مؤقتًا من غير فجوة، و«سؤال للطلاب» بيحط سؤال بيوقف الدرس عند اللحظة دي.
        </p>
      )}

      {HINTS[form.language] && (
        <p className="rounded-lg border border-line bg-panel px-3 py-2 text-xs leading-6 text-muted">
          <span className="text-amber">💡 تلميح:</span> {HINTS[form.language]}
        </p>
      )}

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div
            className={cx(
              'h-[50dvh] overflow-hidden rounded-2xl border shadow-card lg:h-[58vh]',
              session.state === 'recording' ? 'border-rose/60 shadow-[0_0_0_3px] shadow-rose/15' : session.state === 'paused' ? 'border-amber/60' : 'border-line',
            )}
          >
            <CodeEditor language={form.language} defaultValue={code} onMount={onMount} onChange={setCode} />
          </div>
          {info.preview ? (
            <OutputPanel html={code} className="h-56" />
          ) : (
            <OutputPanel lines={output?.lines} ms={output?.ms} className="h-36" empty={info.runnable ? undefined : `التشغيل مش مدعوم لـ ${info.label} — الطلاب هيشوفوا الكود بس`} />
          )}
        </div>
        {prompter && <Prompter value={form.notes} onChange={(v) => set('notes', v)} />}
      </div>
    </div>
  );
}

// A form field with its label row and a "generate with Gemini" button beside it.
function AiField({ label, hint, onGenerate, busy, disabled, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted">{label}</span>
        <Button size="sm" variant="subtle" icon={Sparkles} onClick={onGenerate} loading={busy} disabled={disabled}>
          ولّد بـ Gemini
        </Button>
      </div>
      {children}
      {hint && <span className="block text-xs text-muted/70">{hint}</span>}
    </div>
  );
}

// What each AI draft is called, which form field it fills, and what to say when it lands.
const DRAFTS = {
  summary: { field: 'summary', name: 'الملخص' },
  description: { field: 'description', name: 'الوصف' },
  script: { field: 'notes', name: 'السكريبت' },
};

function ContentTab({ lesson, form, set, saveMeta }) {
  const platform = useAuth((s) => s.platform);
  const [generating, setGenerating] = useState(null); // which draft is being written
  const [preview, setPreview] = useState(false);

  async function generate(kind) {
    const { field, name } = DRAFTS[kind];
    if (kind !== 'summary' && form[field].trim() && !window.confirm(`${name} الحالي هيتستبدل بنسخة جديدة. نكمل؟`)) return;
    setGenerating(kind);
    try {
      await saveMeta({ silent: true });
      const res = await api.post('/ai/generate', { lessonId: lesson.id, kind });
      set(field, res[field]);
      if (kind === 'summary') setPreview(true);
      toast.success(`اتولد ${name} بـ ${res.model} — راجعه واحفظ`);
    } catch (err) {
      toast.error(err);
    } finally {
      setGenerating(null);
    }
  }

  return (
    // grid-cols-1 = minmax(0, 1fr): a plain `grid` track is `auto` and grows to fit wide generated content (code, tables).
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card className="min-w-0 space-y-4 p-5">
        <Field label="المساعد الذكي للطلاب في الدرس ده" hint="الافتراضي بيتبع الإعدادات العامة للمنصة. «مخفي» بيشيل تبويب المساعد وأزرار المساعدة في التحديات.">
          <Select value={form.ai_mode} onChange={(e) => set('ai_mode', e.target.value)}>
            <option value="">الافتراضي (حسب الإعدادات)</option>
            <option value="on">ظاهر للطلاب</option>
            <option value="off">مخفي عن الطلاب</option>
          </Select>
        </Field>
        <Field
          label="الأسئلة التفاعلية في الدرس ده"
          hint={`الدرس بيقف عند السؤال لحد ما الطالب يجاوب (وممكن يطلب تلميح). الافتراضي بيتبع إعدادات المنصة (حاليًا: ${platform.questions_enabled ? 'مفعّلة' : 'متوقفة'}). «متوقفة» بتخفي الأسئلة عن الطلاب في الدرس ده من غير ما تتمسح.`}
        >
          <Select value={form.questions_mode} onChange={(e) => set('questions_mode', e.target.value)}>
            <option value="">الافتراضي (حسب الإعدادات)</option>
            <option value="on">مفعّلة</option>
            <option value="off">متوقفة</option>
          </Select>
        </Field>
        <AiField label="وصف الدرس (بيظهر للطلاب)" onGenerate={() => generate('description')} busy={generating === 'description'} disabled={!!generating}>
          <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={4} />
        </AiField>
        <AiField
          label="سكريبت الشرح / التلقين (خاص بيك)"
          hint="بيظهر جنبك وانت بتسجل، والمساعد بيستخدمه كسياق لما يولّد الملخص والاختبار. Gemini بيكتبلك مسودة تعدّل عليها، ولو كتبت نقاط الأول بيطوّرها."
          onGenerate={() => generate('script')}
          busy={generating === 'script'}
          disabled={!!generating}
        >
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={10} />
        </AiField>
      </Card>
      <Card className="min-w-0 space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">ملخص الدرس (Markdown)</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setPreview(!preview)}>
              {preview ? 'تعديل' : 'معاينة'}
            </Button>
            <Button size="sm" variant="subtle" icon={Sparkles} onClick={() => generate('summary')} loading={generating === 'summary'} disabled={!!generating}>
              ولّد بـ Gemini
            </Button>
          </div>
        </div>
        {preview ? (
          <div className="min-h-96 min-w-0 overflow-x-auto rounded-lg border border-line bg-panel-2 p-4">
            <Markdown>{form.summary || '_لسه مفيش ملخص_'}</Markdown>
          </div>
        ) : (
          <Textarea value={form.summary} onChange={(e) => set('summary', e.target.value)} rows={18} dir="auto" className="font-mono text-[13px]" />
        )}
      </Card>
    </div>
  );
}

const blankQuestion = () => ({ q: '', options: ['', '', '', ''], answer: 0, explain: '' });

function QuizEditor({ lesson, saveMeta, dirty }) {
  const [quiz, setQuiz] = useState(lesson.quiz || []);
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = (i, patch) => setQuiz((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  async function generate() {
    if (quiz.length && !window.confirm('الأسئلة الحالية هتتستبدل. نكمل؟')) return;
    setBusy(true);
    try {
      if (dirty) await saveMeta({ silent: true });
      const res = await api.post('/ai/generate', { lessonId: lesson.id, kind: 'quiz', count });
      setQuiz(res.quiz);
      toast.success(`اتولد ${res.quiz.length} سؤال بـ ${res.model} — راجعهم واحفظ`);
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const clean = quiz
      .map((q) => ({ ...q, options: q.options.map((o) => o.trim()) }))
      .filter((q) => q.q.trim() && q.options.filter(Boolean).length >= 2);
    setSaving(true);
    try {
      await api.put(`/lessons/${lesson.id}`, { quiz: clean });
      setQuiz(clean);
      toast.success('اتحفظ الاختبار ✓');
    } catch (err) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <Sparkles className="size-5 text-brand" />
        <span className="text-sm">ولّد اختبار من كود الدرس وسكريبت الشرح:</span>
        <Select value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-28">
          {[3, 5, 8, 10].map((n) => (
            <option key={n} value={n}>
              {n} أسئلة
            </option>
          ))}
        </Select>
        <Button icon={Sparkles} onClick={generate} loading={busy}>
          ولّد بـ Gemini
        </Button>
        <div className="flex-1" />
        <Button variant="subtle" icon={Plus} onClick={() => setQuiz([...quiz, blankQuestion()])}>
          سؤال يدوي
        </Button>
        <Button icon={Save} onClick={save} loading={saving}>
          حفظ الاختبار
        </Button>
      </Card>

      {quiz.length === 0 && <p className="py-10 text-center text-sm text-muted">مفيش أسئلة لسه.</p>}

      {quiz.map((q, i) => (
        <Card key={i} className="space-y-3 p-4">
          <div className="flex items-start gap-2">
            <span className="mt-2 text-sm text-muted">{i + 1}.</span>
            <Textarea value={q.q} onChange={(e) => update(i, { q: e.target.value })} rows={2} placeholder="نص السؤال" className="min-h-0" />
            <IconButton icon={Trash2} title="حذف السؤال" onClick={() => setQuiz(quiz.filter((_, j) => j !== i))} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {q.options.map((opt, j) => (
              <label key={j} className={cx('flex items-center gap-2 rounded-lg border px-2', q.answer === j ? 'border-mint/60 bg-mint/5' : 'border-line')}>
                <input type="radio" checked={q.answer === j} onChange={() => update(i, { answer: j })} className="accent-[#2dd4a7]" />
                <input
                  value={opt}
                  onChange={(e) => update(i, { options: q.options.map((o, k) => (k === j ? e.target.value : o)) })}
                  placeholder={`اختيار ${j + 1}`}
                  className="w-full bg-transparent py-2 text-sm outline-none"
                />
              </label>
            ))}
          </div>
          <Input value={q.explain} onChange={(e) => update(i, { explain: e.target.value })} placeholder="شرح الإجابة الصحيحة (بيظهر بعد التسليم)" />
        </Card>
      ))}
    </div>
  );
}
