import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  Play,
  Pause,
  RotateCcw,
  GitFork,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Pencil,
  FileText,
  MessagesSquare,
  Bot,
  ListChecks,
  Target,
  Lock,
  Terminal,
  ExternalLink,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { createTimeline } from '../lib/recording.js';
import { usePlayback } from '../lib/usePlayback.js';
import { outputText, runCode } from '../lib/runner.js';
import { fmtTime } from '../lib/format.js';
import { langInfo } from '../lib/languages.js';
import { useAuth } from '../store/auth.js';
import { toast } from '../store/toast.js';
import CodeEditor from '../components/CodeEditor.jsx';
import OutputPanel from '../components/OutputPanel.jsx';
import Scrubber from '../components/Scrubber.jsx';
import AssistantPanel from '../components/AssistantPanel.jsx';
import QuestionsPanel from '../components/QuestionsPanel.jsx';
import QuizPanel from '../components/QuizPanel.jsx';
import ChallengePanel from '../components/ChallengePanel.jsx';
import Markdown from '../components/Markdown.jsx';
import { Badge, Button, Empty, IconButton, PageLoader, Tabs, cx } from '../components/ui.jsx';

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

// Replace only the differing middle of the document so scroll position and view state survive.
function syncModel(editor, code) {
  const model = editor.getModel();
  if (!model) return;
  code = code.replace(/\r\n/g, '\n'); // recordings made on Windows may carry CRLF
  const cur = model.getValue();
  if (cur === code) return;
  let start = 0;
  const max = Math.min(cur.length, code.length);
  while (start < max && cur[start] === code[start]) start++;
  let endA = cur.length;
  let endB = code.length;
  while (endA > start && endB > start && cur[endA - 1] === code[endB - 1]) {
    endA--;
    endB--;
  }
  const a = model.getPositionAt(start);
  const b = model.getPositionAt(endA);
  model.applyEdits([
    { range: { startLineNumber: a.lineNumber, startColumn: a.column, endLineNumber: b.lineNumber, endColumn: b.column }, text: code.slice(start, endB) },
  ]);
}

export default function LessonPlayer() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const [lesson, setLesson] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLesson(null);
    setError(null);
    api
      .get(`/lessons/${id}`)
      .then((l) => alive && setLesson(l))
      .catch((e) => alive && setError(e));
    return () => {
      alive = false;
    };
  }, [id]);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="rounded-2xl bg-rose/10 p-4 text-rose">
          <Lock className="size-7" />
        </div>
        <p className="font-semibold">{error.message}</p>
        <Link to="/" className="text-sm text-brand">
          الرجوع للرئيسية
        </Link>
      </div>
    );
  }
  if (!lesson) return <PageLoader />;
  return (
    <Player
      key={lesson.id}
      lesson={lesson}
      startAt={search.has('t') ? Number(search.get('t')) || 0 : null}
      previewAsStudent={search.get('as') === 'student'}
      startCp={search.get('cp')}
    />
  );
}

function Player({ lesson, startAt, previewAsStudent, startCp }) {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const realTeacher = user.role === 'teacher';
  // "Preview as student": the teacher sees the student UI, but nothing is written to the server.
  const asStudent = realTeacher && previewAsStudent;
  const isTeacher = realTeacher && !asStudent;
  const info = langInfo(lesson.language);
  // The teacher can switch the student assistant off globally or per lesson; teachers always keep it.
  const aiVisible = isTeacher || lesson.ai_enabled;

  const timeline = useMemo(() => createTimeline(lesson.recording), [lesson.recording]);
  const duration = timeline.duration;
  const hasRecording = !!lesson.recording && duration > 0;
  const activity = useMemo(() => timeline.activity(120), [timeline]);

  const initial = useMemo(() => {
    const p = lesson.progress;
    let t = startAt != null ? Math.min(startAt, duration) : p && !p.completed && p.position_ms < duration - 2000 ? p.position_ms : 0;
    // Students can't start past a required challenge they haven't solved yet.
    const blocker = isTeacher ? null : lesson.checkpoints.find((c) => c.required && !c.progress.passed && t > c.t_ms);
    if (blocker) t = blocker.t_ms;
    return t;
  }, [startAt, lesson.progress, lesson.checkpoints, duration, isTeacher]);

  const pb = usePlayback(duration, lesson.audio_url, initial);
  const editorRef = useRef(null);
  const applying = useRef(false);
  const timeRef = useRef(initial);
  timeRef.current = pb.time;

  const [mine, setMine] = useState(null); // the student's own edits while paused
  const [myRun, setMyRun] = useState(null);
  const [running, setRunning] = useState(false);
  const [cursorLine, setCursorLine] = useState(1);
  const [tab, setTab] = useState('about');
  const [questions, setQuestions] = useState([]);
  const [forkId, setForkId] = useState(null);

  // ---- interactive checkpoints: the lesson stops until the student solves them ----
  const gated = !isTeacher;
  const [cps, setCps] = useState(lesson.checkpoints);
  const [activeId, setActiveId] = useState(null);
  const [cpResult, setCpResult] = useState(null);
  const [cpBusy, setCpBusy] = useState(false);
  const [aiRequest, setAiRequest] = useState(null);
  const skipped = useRef(new Set());
  const active = cps.find((c) => c.id === activeId) || null;
  const activeRef = useRef(null);
  activeRef.current = active;

  const lessonCode = useMemo(() => timeline.codeAt(pb.time), [timeline, pb.time]);
  const currentCode = () => (editorRef.current?.getValue() ?? mine ?? lessonCode).replaceAll('\r\n', '\n');
  const shownCode = mine ?? lessonCode;
  const lessonRun = timeline.runAt(pb.time);
  const ended = hasRecording && !pb.playing && pb.time >= duration - 100;

  // ---- analytics (feeds the teacher's Stuck Map) ----
  const events = useRef([]);
  const lastRewind = useRef(0);
  const completedRef = useRef(!!lesson.progress?.completed);
  if (hasRecording && pb.time >= duration - 1000) completedRef.current = true;

  const track = useCallback((type, t) => !realTeacher && events.current.push({ type, t: Math.round(t) }), [realTeacher]);
  const flush = useCallback(() => {
    if (!events.current.length) return;
    api.beacon(`/lessons/${lesson.id}/events`, { events: events.current });
    events.current = [];
  }, [lesson.id]);
  const saveProgress = useCallback(() => {
    if (realTeacher || !hasRecording) return;
    api.beacon(`/lessons/${lesson.id}/progress`, { position_ms: Math.round(timeRef.current), completed: completedRef.current });
  }, [realTeacher, hasRecording, lesson.id]);

  useEffect(() => {
    const iv = setInterval(flush, 15000);
    return () => {
      clearInterval(iv);
      flush();
      saveProgress();
    };
  }, [flush, saveProgress]);

  useEffect(() => {
    if (!pb.playing) {
      saveProgress();
      return undefined;
    }
    const iv = setInterval(saveProgress, 10000);
    return () => clearInterval(iv);
  }, [pb.playing, saveProgress]);

  // ---- editor sync ----
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed || mine !== null) return;
    applying.current = true;
    syncModel(ed, lessonCode);
    applying.current = false;
    const p = timeline.cursorAt(pb.time);
    if (p) {
      const pos = { lineNumber: p[0], column: p[1] };
      ed.setPosition(pos);
      if (pb.playing) ed.revealPositionInCenterIfOutsideViewport(pos);
    }
  }, [lessonCode, pb.time, pb.playing, mine, timeline]);

  // On phones the side panel sits below the editor, so panel-driven actions scroll it into view.
  const sectionRef = useRef(null);
  const asideRef = useRef(null);
  const small = () => window.matchMedia('(max-width: 1023px)').matches;
  const focusAside = () => small() && requestAnimationFrame(() => asideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  const focusEditor = () => small() && requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));

  // ---- controls ----
  const leaveMine = () => {
    if (mine === null) return;
    setMine(null);
    setMyRun(null);
  };
  const loadMine = (code) => {
    const ed = editorRef.current;
    if (ed) {
      applying.current = true;
      syncModel(ed, code);
      applying.current = false;
    }
    setMine(code);
    setMyRun(null);
  };

  const dueAt = (t) => (gated ? cps.find((c) => !c.progress.passed && !skipped.current.has(c.id) && t >= c.t_ms && (c.required || t - c.t_ms < 2000)) : null);
  const blockerBefore = (t) => (gated ? cps.find((c) => c.required && !c.progress.passed && t > c.t_ms) : null);

  function openChallenge(cp) {
    if (pb.playing) pb.pause();
    if (Math.abs(timeRef.current - cp.t_ms) > 50) pb.seek(cp.t_ms);
    setActiveId(cp.id);
    setCpResult(null);
    setTab('challenge');
    if (cp.type === 'code') {
      loadMine(cp.progress.code ?? cp.starter_code ?? '');
      focusEditor();
    } else {
      leaveMine();
      focusAside();
    }
  }
  function closeChallenge() {
    setActiveId(null);
    setCpResult(null);
    setTab((t) => (t === 'challenge' ? 'about' : t));
  }
  function openFromList(cp) {
    if (!gated) return seek(cp.t_ms);
    const blocker = blockerBefore(cp.t_ms);
    if (blocker) toast.info('حلّ التحديات اللي قبله الأول 🙂');
    openChallenge(blocker || cp);
  }
  function skipChallenge() {
    skipped.current.add(activeRef.current.id);
    closeChallenge();
    play();
  }

  async function attempt(payload, runResult) {
    const cp = activeRef.current;
    setCpBusy(true);
    try {
      const res = await api.post(`/lessons/${lesson.id}/checkpoints/${cp.id}/attempt`, { revision: cp.revision, ...payload });
      setCps((list) =>
        list.map((c) =>
          c.id === cp.id
            ? { ...c, progress: { passed: c.progress.passed || res.passed, attempts: res.preview ? c.progress.attempts + 1 : res.attempts, code: payload.code ?? c.progress.code } }
            : c,
        ),
      );
      const message = runResult?.error
        ? 'الكود فيه خطأ — شوف الناتج تحت وصلّحه.'
        : cp.type === 'code'
          ? 'الناتج مختلف عن المطلوب — قارن ناتجك بوصف التحدي وجرّب تاني.'
          : 'الإجابة دي مش صح — فكّر تاني.';
      setCpResult({ id: cp.id, passed: res.passed, message });
    } catch (err) {
      toast.error(err);
    } finally {
      setCpBusy(false);
    }
  }
  async function submitCode() {
    if (!activeRef.current || cpBusy) return;
    setCpBusy(true);
    const code = currentCode();
    const res = await runCode(lesson.language, code);
    setMyRun(res);
    if (res.error) track('error', timeRef.current);
    await attempt({ code, output: outputText(res.lines), error: res.error }, res);
  }
  const askHelp = (level) => {
    setAiRequest({ id: Date.now(), level });
    setTab('ai');
    focusAside();
  };

  // Opens the next challenge the moment the clock reaches it (or the end, for a challenge placed there).
  const gateRef = useRef(null);
  gateRef.current = () => {
    if (!gated || activeRef.current || !(pb.playing || pb.time >= duration - 50)) return;
    const due = dueAt(pb.time);
    if (due) openChallenge(due);
  };
  useEffect(() => {
    gateRef.current();
  }, [pb.time, pb.playing]);

  const play = () => {
    const current = activeRef.current;
    if (current && !current.progress.passed) {
      if (current.required) {
        setTab('challenge');
        return toast.info('حلّ التحدي الأول عشان تكمّل الدرس 🎯');
      }
      skipped.current.add(current.id);
    }
    const due = dueAt(timeRef.current);
    if (due) return openChallenge(due);
    if (current) closeChallenge();
    leaveMine();
    setForkId(null);
    pb.play();
  };
  const pause = () => {
    pb.pause();
    track('pause', timeRef.current);
  };
  const toggle = () => (pb.playing ? pause() : play());
  const seek = (t) => {
    const blocker = blockerBefore(t);
    if (blocker) {
      if (activeRef.current?.id !== blocker.id) openChallenge(blocker);
      else if (Math.abs(timeRef.current - blocker.t_ms) > 50) pb.seek(blocker.t_ms);
      return;
    }
    if (activeRef.current && t < activeRef.current.t_ms - 500) closeChallenge();
    const now = performance.now();
    if (t < timeRef.current - 3000 && now - lastRewind.current > 1500) {
      lastRewind.current = now;
      track('rewind', t);
    }
    leaveMine();
    pb.seek(t);
  };

  async function runMine() {
    if (!info.runnable || running) return;
    if (pb.playing) pause();
    setRunning(true);
    const res = await runCode(lesson.language, currentCode());
    setMyRun(res);
    setRunning(false);
    if (res.error) track('error', timeRef.current);
  }
  const runRef = useRef(runMine);
  runRef.current = runMine;

  async function fork() {
    try {
      const { id } = await api.post('/forks', {
        lessonId: lesson.id,
        t_ms: Math.round(timeRef.current),
        language: lesson.language,
        code: currentCode(),
        title: `${lesson.title} — ${fmtTime(timeRef.current)}`,
      });
      setForkId(id);
      toast.success('اتحفظت نسخة من الكود في الملعب بتاعك');
    } catch (err) {
      toast.error(err);
    }
  }

  // Deep links from the skill map (?cp=) open their challenge as soon as the editor is ready.
  const pendingCp = useRef(startCp);
  const openFromListRef = useRef(null);
  openFromListRef.current = openFromList;

  const toggleRef = useRef(toggle);
  toggleRef.current = toggle;
  const seekRef = useRef(seek);
  seekRef.current = seek;
  useEffect(() => {
    const onKey = (e) => {
      const el = e.target;
      if (el.closest?.('.monaco-editor') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        toggleRef.current();
      } else if (e.key === 'ArrowRight') seekRef.current(timeRef.current + 5000);
      else if (e.key === 'ArrowLeft') seekRef.current(timeRef.current - 5000);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.onDidChangeCursorPosition((e) => setCursorLine(e.position.lineNumber));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
    applying.current = true;
    syncModel(editor, timeline.codeAt(timeRef.current));
    applying.current = false;
    const target = pendingCp.current && lesson.checkpoints.find((c) => c.id === pendingCp.current);
    pendingCp.current = null;
    if (target) openFromListRef.current(target);
  };

  const outputLines = myRun ? myRun.lines : lessonRun?.o;
  const getContext = () => ({
    checkpointId: activeRef.current?.id,
    t_ms: Math.round(timeRef.current),
    code: currentCode(),
    line: cursorLine,
    output: outputLines?.map((l) => l.text).join('\n') || '',
  });
  const getMoment = () => ({ t_ms: Math.round(timeRef.current), line: cursorLine, code: currentCode() });

  const markers = [
    ...timeline.runs.map((r) => ({ t: r.t, color: r.x ? 'bg-rose/70' : 'bg-muted/60', title: `تشغيل ${fmtTime(r.t)}` })),
    ...questions.map((q) => ({ t: q.t_ms, color: q.answer ? 'bg-mint' : 'bg-amber', title: q.body.slice(0, 60) })),
    ...cps.map((c) => ({ t: c.t_ms, big: true, color: c.progress.passed ? 'bg-mint' : 'bg-brand', title: `تحدي: ${c.title}` })),
  ];

  const tabs = [
    { id: 'about', label: 'الدرس', icon: FileText },
    ...(cps.length
      ? [{ id: 'challenge', label: 'التحديات', icon: Target, count: gated ? cps.filter((c) => c.required && !c.progress.passed).length : 0 }]
      : []),
    { id: 'questions', label: 'الأسئلة', icon: MessagesSquare, count: questions.filter((q) => !q.answer).length },
    ...(aiVisible ? [{ id: 'ai', label: 'المساعد', icon: Bot }] : []),
    { id: 'quiz', label: 'اختبار', icon: ListChecks },
  ];

  return (
    <div className="flex h-full flex-col">
      {asStudent && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-brand/15 px-4 py-2 text-sm">
          <span>👁 دي معاينة: بتشوف الدرس زي الطالب بالظبط، ومفيش حاجة بتتحفظ (أسئلة أو تقدم أو درجات).</span>
          {!lesson.published && <Badge color="amber">الدرس مسودة — الطلاب مش هيشوفوه لحد ما تنشره</Badge>}
          <Button size="sm" variant="subtle" icon={Pencil} onClick={() => navigate(`/lessons/${lesson.id}/studio`)}>
            رجوع للاستوديو
          </Button>
        </div>
      )}
      <header className="flex shrink-0 items-center gap-2 border-b border-line bg-panel/95 px-3 pt-[max(0.625rem,env(safe-area-inset-top))] pb-2.5 shadow-card backdrop-blur sm:gap-3 sm:px-4">
        <IconButton icon={ArrowRight} title="رجوع للكورس" onClick={() => navigate(`/courses/${lesson.course_id}`)} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted">{lesson.course_title}</p>
          <h1 className="truncate font-semibold">{lesson.title}</h1>
        </div>
        <Badge color="muted" className="hidden font-mono sm:inline-flex">
          {info.label}
        </Badge>
        {!isTeacher && (
          <Button
            size="sm"
            variant="subtle"
            icon={MessagesSquare}
            title="اسأل المدرّس"
            onClick={() => {
              setTab('questions');
              focusAside();
            }}
          >
            <span className="hidden sm:inline">اسأل المدرّس</span>
          </Button>
        )}
        {isTeacher && (
          <Button size="sm" variant="subtle" icon={Pencil} onClick={() => navigate(`/lessons/${lesson.id}/studio`)}>
            الاستوديو
          </Button>
        )}
        <IconButton icon={ChevronRight} title="الدرس السابق" disabled={!lesson.prev_id} onClick={() => navigate(`/lessons/${lesson.prev_id}`)} />
        <IconButton icon={ChevronLeft} title="الدرس التالي" disabled={!lesson.next_id} onClick={() => navigate(`/lessons/${lesson.next_id}`)} />
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain scroll-smooth lg:flex-row lg:overflow-hidden">
        <section ref={sectionRef} className="flex flex-col gap-3 p-3 lg:min-h-0 lg:flex-1">
          {hasRecording ? (
            <>
              <div className="flex min-h-8 flex-wrap items-center gap-2 text-sm">
                {active && !active.progress.passed ? (
                  <>
                    <Badge color="brand">🎯 تحدي: {active.title} — الدرس واقف لحد ما تحلّه</Badge>
                    <Button size="sm" variant="subtle" className="lg:hidden" onClick={focusAside}>
                      المطلوب ↓
                    </Button>
                  </>
                ) : pb.playing ? (
                  <Badge color="brand">
                    <span className="rec-dot size-1.5 rounded-full bg-brand" /> المدرّس بيشرح…
                  </Badge>
                ) : ended && mine === null ? (
                  <>
                    <Badge color="mint">🎉 خلصت الدرس!</Badge>
                    {lesson.quiz?.length > 0 && (
                      <Button size="sm" variant="mint" icon={ListChecks} onClick={() => setTab('quiz')}>
                        اختبر نفسك
                      </Button>
                    )}
                    {lesson.next_id && (
                      <Button size="sm" icon={ChevronLeft} onClick={() => navigate(`/lessons/${lesson.next_id}`)}>
                        الدرس التالي
                      </Button>
                    )}
                  </>
                ) : mine !== null ? (
                  <>
                    <Badge color="amber">✏️ بتعدّل نسختك</Badge>
                    <Button size="sm" variant="ghost" icon={RotateCcw} onClick={leaveMine}>
                      رجوع لكود الدرس
                    </Button>
                  </>
                ) : (
                  <Badge color="mint">⏸ الدرس واقف — الكود دلوقتي بتاعك: عدّل وشغّل براحتك</Badge>
                )}
              </div>

              <div className={cx('relative h-[44dvh] min-h-64 shrink-0 overflow-hidden rounded-2xl border shadow-card lg:h-auto lg:flex-1 lg:shrink', active && !active.progress.passed ? 'border-brand/70 shadow-[0_0_0_3px] shadow-brand/15' : mine !== null ? 'border-amber/50' : 'border-line')}>
                <CodeEditor
                  language={lesson.language}
                  readOnly={pb.playing}
                  onMount={onMount}
                  onChange={(v) => !applying.current && setMine(v)}
                  options={{ readOnlyMessage: { value: 'أوقف الدرس (Space) عشان تعدّل الكود بنفسك' } }}
                />
              </div>

              {info.preview ? (
                <OutputPanel html={shownCode} className="h-52" />
              ) : (
                <OutputPanel
                  className="h-36"
                  lines={outputLines}
                  ms={myRun?.ms}
                  label={myRun ? 'ناتج تشغيلك' : lessonRun ? `ناتج تشغيل المدرّس عند ${fmtTime(lessonRun.t)}` : undefined}
                  empty={info.runnable ? 'أوقف الدرس واضغط "شغّل" (Ctrl+Enter) عشان تجرب الكود بنفسك' : `تشغيل ${info.label} جوه المتصفح لسه مش مدعوم`}
                />
              )}

              <div className="sticky bottom-2 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-line bg-panel/95 px-3 py-2 shadow-float backdrop-blur lg:static lg:flex-nowrap lg:py-1.5 lg:shadow-card">
                <button
                  onClick={toggle}
                  title={pb.playing ? 'إيقاف (Space)' : 'تشغيل (Space)'}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-lg shadow-brand/30 transition hover:scale-105"
                >
                  {pb.playing ? <Pause className="size-4.5" /> : <Play className="size-4.5 -scale-x-100" />}
                </button>
                <div className="order-last flex min-w-0 basis-full items-center gap-3 lg:order-none lg:basis-0 lg:flex-1">
                  <span dir="ltr" className="shrink-0 font-mono text-[11px] text-muted tabular-nums lg:text-xs">
                    {fmtTime(pb.time)} / {fmtTime(duration)}
                  </span>
                  <Scrubber time={pb.time} duration={duration} onSeek={seek} activity={activity} markers={markers} />
                </div>
                <select
                  value={pb.rate}
                  onChange={(e) => pb.setRate(Number(e.target.value))}
                  className="rounded-md border border-line bg-panel-2 px-1.5 py-1 font-mono text-xs"
                  title="السرعة"
                >
                  {SPEEDS.map((s) => (
                    <option key={s} value={s}>
                      {s}x
                    </option>
                  ))}
                </select>
                {info.runnable && (
                  <Button size="sm" variant="mint" icon={Terminal} onClick={runMine} loading={running} title="Ctrl+Enter">
                    شغّل
                  </Button>
                )}
                {forkId ? (
                  <Button size="sm" variant="subtle" icon={ExternalLink} onClick={() => navigate(`/sandbox/${forkId}`)}>
                    افتح النسخة
                  </Button>
                ) : (
                  <IconButton icon={GitFork} title="خد نسخة من الكود ده للملعب (Fork)" onClick={fork} />
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <Empty
                icon={Play}
                title="الدرس ده لسه متسجلش"
                text={isTeacher ? 'افتح الاستوديو وسجّل الشرح كجلسة كود حية.' : 'المدرّس هيرفع الشرح قريب.'}
                action={isTeacher && <Button onClick={() => navigate(`/lessons/${lesson.id}/studio`)}>افتح الاستوديو</Button>}
              />
            </div>
          )}
        </section>

        <aside ref={asideRef} className="flex h-[82dvh] w-full shrink-0 flex-col border-t border-line bg-panel pb-[env(safe-area-inset-bottom)] lg:h-auto lg:min-h-0 lg:w-[400px] lg:border-t-0 lg:border-r">
          <div className="p-3">
            <Tabs tabs={tabs} value={tab} onChange={setTab} />
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {tab === 'about' && (
              <div className="space-y-5 p-4">
                {lesson.description && <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted">{lesson.description}</p>}
                {lesson.summary ? (
                  <Markdown>{lesson.summary}</Markdown>
                ) : (
                  !lesson.description && <p className="text-sm text-muted">مفيش وصف للدرس ده.</p>
                )}
                <div className="rounded-xl border border-line bg-panel-2 p-3 text-xs leading-6 text-muted">
                  <b className="text-ink">اختصارات:</b> Space تشغيل/إيقاف · ← → تقديم/ترجيع 5 ثواني · Ctrl+Enter تشغيل الكود
                </div>
              </div>
            )}
            {tab === 'challenge' && (
              <ChallengePanel
                checkpoints={cps}
                active={active}
                result={cpResult}
                busy={cpBusy}
                gated={gated}
                onOpen={openFromList}
                onSubmitChoice={(answer) => attempt({ answer })}
                onSubmitCode={submitCode}
                onContinue={play}
                onSkip={skipChallenge}
                onReset={() => loadMine(active.starter_code ?? '')}
                onEditor={focusEditor}
                onHelp={aiVisible ? askHelp : null}
              />
            )}
            {/* Kept mounted so the question list (and scrubber markers) survive tab switches. */}
            <div className={tab === 'questions' ? 'h-full' : 'hidden'}>
              <QuestionsPanel
                lessonId={lesson.id}
                getMoment={getMoment}
                onJump={seek}
                onChange={setQuestions}
                canAsk={!isTeacher}
                preview={asStudent}
              />
            </div>
            {aiVisible && (
            <div className={tab === 'ai' ? 'h-full' : 'hidden'}>
              <AssistantPanel lessonId={lesson.id} getContext={getContext} asStudent={asStudent} request={aiRequest} challengeActive={!!active && !active.progress.passed} />
            </div>
            )}
            {tab === 'quiz' && <QuizPanel lesson={lesson} isTeacher={isTeacher} preview={asStudent} />}
          </div>
        </aside>
      </div>
    </div>
  );
}
