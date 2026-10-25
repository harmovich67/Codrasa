import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import fixWebmDuration from 'fix-webm-duration';
import {
  ArrowRight,
  Circle,
  Square,
  X,
  Mic,
  MicOff,
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
import { runCode } from '../../lib/runner.js';
import { fmtTime } from '../../lib/format.js';
import { HINTS, LANGUAGES, STARTERS, langInfo } from '../../lib/languages.js';
import { toast } from '../../store/toast.js';
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
        <Recorder lesson={lesson} form={form} set={set} reload={reload} />
      </div>
      {tab === 'content' && <ContentTab lesson={lesson} form={form} set={set} saveMeta={saveMeta} />}
      <div className={tab === 'challenges' ? '' : 'hidden'}>
        <CheckpointEditor lesson={lesson} draftRequest={draftRequest} />
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

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

function Recorder({ lesson, form, set, reload }) {
  const existing = useMemo(() => (lesson.recording ? createTimeline(lesson.recording) : null), [lesson.recording]);
  const info = langInfo(form.language);
  const editorRef = useRef(null);
  const recorderRef = useRef(null);
  const mediaRef = useRef(null);
  const [state, setState] = useState('idle'); // idle | starting | recording | saving
  const stateRef = useRef(state);
  stateRef.current = state;
  const [elapsed, setElapsed] = useState(0);
  const [withMic, setWithMic] = useState(true);
  const [prompter, setPrompter] = useState(true);
  const [output, setOutput] = useState(null);
  const [code, setCode] = useState(() => existing?.finalCode ?? STARTERS[form.language] ?? '');

  useEffect(() => {
    if (state !== 'recording') return undefined;
    const iv = setInterval(() => setElapsed(recorderRef.current.now()), 250);
    return () => clearInterval(iv);
  }, [state]);

  // Release the mic if the page closes mid-recording.
  useEffect(() => {
    return () => {
      mediaRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function run() {
    if (!langInfo(form.language).runnable) return;
    const res = await runCode(form.language, editorRef.current.getValue().replaceAll('\r\n', '\n'));
    setOutput(res);
    if (stateRef.current === 'recording') recorderRef.current.markRun(res.lines, res.error);
  }
  const runRef = useRef(run);
  runRef.current = run;

  function begin() {
    setOutput(null);
    setElapsed(0);
    setState('recording');
    editorRef.current.focus();
  }

  async function start() {
    if (lesson.recording && !window.confirm('التسجيل الجديد هيستبدل التسجيل الحالي للدرس. نكمل؟')) return;
    setState('starting');
    const recorder = new LessonRecorder(editorRef.current, form.language);
    recorderRef.current = recorder;
    if (!withMic) {
      recorder.start();
      return begin();
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      toast.error('مقدرناش نوصل للمايك — اسمح للمتصفح بالوصول أو سجّل بدون صوت');
      return setState('idle');
    }
    const mime = pickMime();
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks = [];
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    // Start the code clock exactly when audio capture starts so both tracks line up.
    mr.onstart = () => {
      recorder.start();
      begin();
    };
    mediaRef.current = { mr, stream, chunks };
    mr.start(1000);
  }

  function stopMedia() {
    const m = mediaRef.current;
    mediaRef.current = null;
    if (!m) return Promise.resolve(null);
    return new Promise((resolve) => {
      m.mr.onstop = () => {
        m.stream.getTracks().forEach((t) => t.stop());
        resolve(new Blob(m.chunks, { type: m.mr.mimeType || 'audio/webm' }));
      };
      m.mr.stop();
    });
  }

  async function stop() {
    const recording = recorderRef.current.stop();
    setState('saving');
    try {
      let blob = await stopMedia();
      if (recording.duration < 1500) {
        toast.error('التسجيل أقصر من ثانية ونص — متحفظش');
        return;
      }
      await api.put(`/lessons/${lesson.id}`, { recording, language: form.language });
      if (blob?.size) {
        if (blob.type.includes('webm')) {
          // Chrome's MediaRecorder writes WebM without a duration, which breaks seeking.
          blob = await fixWebmDuration(blob, recording.duration, { logger: false }).catch(() => blob);
        }
        const fd = new FormData();
        fd.append('audio', blob, 'voice.webm');
        await api.upload(`/lessons/${lesson.id}/audio`, fd);
      }
      toast.success(`اتحفظ التسجيل (${fmtTime(recording.duration)}) ✓`);
      await reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setState('idle');
    }
  }

  async function cancel() {
    recorderRef.current?.stop();
    await stopMedia();
    setState('idle');
    toast.info('اتلغى التسجيل');
  }

  const onMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
  };

  const recording = state === 'recording';
  const busy = state === 'starting' || state === 'saving';

  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap items-center gap-3 p-3">
        {recording ? (
          <>
            <Badge color="rose" className="px-3 py-1.5 text-sm">
              <span className="rec-dot size-2 rounded-full bg-rose" /> REC <span className="font-mono">{fmtTime(elapsed)}</span>
            </Badge>
            <Button variant="danger" icon={Square} onClick={stop}>
              إيقاف وحفظ
            </Button>
            <Button variant="ghost" icon={X} onClick={cancel}>
              إلغاء
            </Button>
          </>
        ) : (
          <>
            <Button variant="rec" icon={Circle} onClick={start} loading={busy}>
              {state === 'saving' ? 'بيتحفظ…' : 'ابدأ التسجيل'}
            </Button>
            <Button variant="subtle" size="sm" icon={withMic ? Mic : MicOff} onClick={() => setWithMic(!withMic)} disabled={busy}>
              {withMic ? 'بالصوت' : 'بدون صوت'}
            </Button>
          </>
        )}
        <Select value={form.language} onChange={(e) => set('language', e.target.value)} disabled={recording || busy} className="w-36">
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </Select>
        <div className="flex-1" />
        {info.runnable && (
          <Button variant="mint" size="sm" icon={Terminal} onClick={run} title="Ctrl+Enter">
            شغّل
          </Button>
        )}
        <IconButton
          icon={Eraser}
          title="تفريغ المحرر"
          disabled={recording}
          onClick={() => {
            editorRef.current?.setValue('');
            setOutput(null);
          }}
        />
        <IconButton icon={StickyNote} title="التلقين (Teleprompter)" active={prompter} onClick={() => setPrompter(!prompter)} />
      </Card>

      {!recording && (
        <p className="text-xs leading-6 text-muted">
          {existing ? (
            <>
              التسجيل الحالي: <b className="font-mono text-ink">{fmtTime(existing.duration)}</b> · {lesson.audio_url ? 'بالصوت' : 'بدون صوت'} ·{' '}
              {lesson.recording.events.length} حدث.{' '}
            </>
          ) : (
            'الدرس ده لسه متسجلش. '
          )}
          اللي في المحرر دلوقتي هيبقى نقطة البداية للتسجيل. كل ضغطة زرار وحركة مؤشر وتشغيل كود بيتسجلوا مع صوتك — مش فيديو.
        </p>
      )}

      {HINTS[form.language] && (
        <p className="rounded-lg border border-line bg-panel px-3 py-2 text-xs leading-6 text-muted">
          <span className="text-amber">💡 تلميح:</span> {HINTS[form.language]}
        </p>
      )}

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className={cx('h-[50dvh] overflow-hidden rounded-2xl border shadow-card lg:h-[58vh]', recording ? 'border-rose/60 shadow-[0_0_0_3px] shadow-rose/15' : 'border-line')}>
            <CodeEditor language={form.language} defaultValue={code} onMount={onMount} onChange={setCode} />
          </div>
          {info.preview ? (
            <OutputPanel html={code} className="h-56" />
          ) : (
            <OutputPanel lines={output?.lines} ms={output?.ms} className="h-36" empty={info.runnable ? undefined : `التشغيل مش مدعوم لـ ${info.label} — الطلاب هيشوفوا الكود بس`} />
          )}
        </div>
        {prompter && (
          <Card className="flex w-full flex-col lg:w-80">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-medium">
              <StickyNote className="size-4 text-amber" /> التلقين
              <span className="text-xs font-normal text-muted">(سكريبتك — الطلاب مش بيشوفوه)</span>
            </div>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder={'اكتب نقاط الشرح هنا…\n\n1. نعرّف المتغير\n2. نوضح الفرق بين let و const\n3. مثال عملي'}
              className="min-h-64 flex-1 resize-none bg-transparent p-4 text-lg leading-9 outline-none placeholder:text-muted/40"
            />
          </Card>
        )}
      </div>
    </div>
  );
}

function ContentTab({ lesson, form, set, saveMeta }) {
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState(false);

  async function generateSummary() {
    setGenerating(true);
    try {
      await saveMeta({ silent: true });
      const { summary, model } = await api.post('/ai/generate', { lessonId: lesson.id, kind: 'summary' });
      set('summary', summary);
      setPreview(true);
      toast.success(`اتولد الملخص بـ ${model} — راجعه واحفظ`);
    } catch (err) {
      toast.error(err);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="space-y-4 p-5">
        <Field label="المساعد الذكي للطلاب في الدرس ده" hint="الافتراضي بيتبع الإعدادات العامة للمنصة. «مخفي» بيشيل تبويب المساعد وأزرار المساعدة في التحديات.">
          <Select value={form.ai_mode} onChange={(e) => set('ai_mode', e.target.value)}>
            <option value="">الافتراضي (حسب الإعدادات)</option>
            <option value="on">ظاهر للطلاب</option>
            <option value="off">مخفي عن الطلاب</option>
          </Select>
        </Field>
        <Field label="وصف الدرس (بيظهر للطلاب)">
          <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={4} />
        </Field>
        <Field label="سكريبت الشرح / التلقين (خاص بيك)" hint="بيظهر جنبك وانت بتسجل، والمساعد بيستخدمه كسياق لما يولّد الملخص والاختبار.">
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={10} />
        </Field>
      </Card>
      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">ملخص الدرس (Markdown)</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setPreview(!preview)}>
              {preview ? 'تعديل' : 'معاينة'}
            </Button>
            <Button size="sm" variant="subtle" icon={Sparkles} onClick={generateSummary} loading={generating}>
              ولّد بـ Gemini
            </Button>
          </div>
        </div>
        {preview ? (
          <div className="min-h-96 rounded-lg border border-line bg-panel-2 p-4">
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
