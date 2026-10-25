import { useState } from 'react';
import { Link } from 'react-router';
import { Code2, Target, CircleCheck, Lock, Play, Lightbulb, Compass, Bug, KeyRound, RotateCcw, Trophy, SkipForward } from 'lucide-react';
import { fmtTime } from '../lib/format.js';
import Markdown from './Markdown.jsx';
import { Badge, Button, cx } from './ui.jsx';

const HELP = [
  { level: 'hint', label: 'تلميح', icon: Lightbulb },
  { level: 'guide', label: 'وجّهني بأسئلة', icon: Compass },
  { level: 'explain', label: 'اشرح غلطتي', icon: Bug, needsAttempt: 1 },
  { level: 'solution', label: 'الحل', icon: KeyRound, needsAttempt: 2 },
];

/* Challenge list when idle, the live challenge card while one is open. */
export default function ChallengePanel({ checkpoints, active, result, busy, gated, onOpen, onSubmitChoice, onSubmitCode, onContinue, onSkip, onReset, onEditor, onHelp }) {
  const done = checkpoints.filter((c) => c.progress.passed).length;

  if (!checkpoints.length) {
    return <p className="p-6 text-center text-sm text-muted">مفيش تحديات في الدرس ده.</p>;
  }

  if (!active) {
    return (
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">تحديات الدرس</span>
          <Badge color={done === checkpoints.length ? 'mint' : 'muted'}>
            {done} / {checkpoints.length}
          </Badge>
        </div>
        <p className="text-xs leading-6 text-muted">
          {gated ? 'الدرس بيقف عند كل تحدي. حلّه بنفسك وبعدين كمّل — كده بتطلع قادر تكتب الكود مش بس تتفرج عليه.' : 'دي التحديات اللي الطلاب هيقابلوها وهما بيتفرجوا على الدرس.'}
        </p>
        {checkpoints.map((c, i) => (
          <button
            key={c.id}
            onClick={() => onOpen(c)}
            className="flex w-full items-center gap-3 rounded-xl border border-line bg-panel-2 px-3 py-2.5 text-right transition hover:border-brand/50"
          >
            {c.progress.passed ? <CircleCheck className="size-5 shrink-0 text-mint" /> : <Target className="size-5 shrink-0 text-muted" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {i + 1}. {c.title}
              </span>
              <span className="text-xs text-muted">
                {c.skill} · <span className="font-mono">{fmtTime(c.t_ms)}</span>
                {!c.required && ' · اختياري'}
              </span>
            </span>
            {gated && !c.progress.passed && c.required && <Lock className="size-3.5 shrink-0 text-muted" />}
          </button>
        ))}
      </div>
    );
  }

  const attempts = active.progress.attempts;
  const passed = active.progress.passed;
  const failedNow = result && !result.passed && result.id === active.id;

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge color="brand">
          <Target className="size-3" /> تحدي {checkpoints.findIndex((c) => c.id === active.id) + 1} من {checkpoints.length}
        </Badge>
        <Badge color="muted">{active.skill}</Badge>
        {!active.required && <Badge color="amber">اختياري</Badge>}
      </div>
      <h2 className="text-lg font-bold">{active.title}</h2>
      <Markdown>{active.prompt}</Markdown>

      {passed ? (
        <div className="space-y-3 rounded-xl border border-mint/40 bg-mint/10 p-4">
          <p className="flex items-center gap-2 font-semibold text-mint">
            <Trophy className="size-5" /> برافو! مهارة «{active.skill}» اتسجلت ليك
          </p>
          <p className="text-xs text-muted">
            {attempts <= 1 ? 'من أول محاولة!' : `بعد ${attempts} محاولات.`}{' '}
            <Link to="/skills" className="text-brand hover:underline">
              شوف خريطة مهاراتك
            </Link>
          </p>
          <Button variant="mint" icon={Play} onClick={onContinue}>
            كمّل الدرس
          </Button>
        </div>
      ) : (
        <>
          {active.type === 'choice' ? (
            <ChoiceForm key={`${active.id}:${active.revision}`} checkpoint={active} busy={busy} onSubmit={onSubmitChoice} />
          ) : (
            <div className="space-y-2">
              <p className="rounded-lg border border-line bg-panel-2 px-3 py-2 text-xs leading-6 text-muted">
                الكود بتاعك في المحرر (فوق على الموبايل، وعلى الجنب في الشاشة الكبيرة). اكتب الحل وبعدين اضغط «سلّم» — بنشغّل الكود ونقارن الناتج.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button icon={Play} onClick={onSubmitCode} loading={busy}>
                  شغّل وسلّم
                </Button>
                <Button variant="ghost" size="sm" icon={RotateCcw} onClick={onReset} title="ارجع لكود البداية">
                  كود البداية
                </Button>
                <Button variant="subtle" size="sm" icon={Code2} onClick={onEditor} className="lg:hidden">
                  افتح المحرر
                </Button>
              </div>
            </div>
          )}

          {failedNow && (
            <p className="rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-sm text-rose">
              {result.message || 'لسه مش مظبوط — راجع وجرّب تاني. الغلط جزء من التعلم 💪'}
            </p>
          )}

          {active.hint && <TeacherHint key={active.id} hint={active.hint} />}

          {onHelp && (
          <div className="space-y-2 border-t border-line pt-3">
            <p className="text-xs text-muted">محتاج مساعدة؟ المساعد مش هيحلّها عنك إلا في الآخر:</p>
            <div className="flex flex-wrap gap-2">
              {HELP.map(({ level, label, icon: Icon, needsAttempt = 0 }) => {
                const locked = attempts < needsAttempt;
                return (
                  <Button
                    key={level}
                    size="sm"
                    variant="subtle"
                    icon={locked ? Lock : Icon}
                    disabled={locked}
                    title={locked ? `بتفتح بعد ${needsAttempt} ${needsAttempt === 1 ? 'محاولة' : 'محاولات'}` : undefined}
                    onClick={() => onHelp(level)}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          </div>
          )}

          {!active.required && (
            <Button variant="ghost" size="sm" icon={SkipForward} onClick={onSkip}>
              تخطّى التحدي ده
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function ChoiceForm({ checkpoint, busy, onSubmit }) {
  const [picked, setPicked] = useState(null);
  return (
    <div className="space-y-2">
      {checkpoint.options.map((option, i) => (
        <label
          key={i}
          className={cx(
            'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm transition',
            picked === i ? 'border-brand bg-brand/10' : 'border-line bg-panel-2 hover:border-muted/40',
          )}
        >
          <input type="radio" name={`cp-${checkpoint.id}`} checked={picked === i} onChange={() => setPicked(i)} className="mt-1 accent-[#7c5cff]" />
          <span className="min-w-0 flex-1 whitespace-pre-wrap">{option}</span>
        </label>
      ))}
      <Button icon={CircleCheck} onClick={() => onSubmit(picked)} disabled={picked === null} loading={busy}>
        سلّم الإجابة
      </Button>
    </div>
  );
}

function TeacherHint({ hint }) {
  const [shown, setShown] = useState(false);
  return shown ? (
    <p className="rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-sm leading-7">💡 {hint}</p>
  ) : (
    <Button variant="ghost" size="sm" icon={Lightbulb} onClick={() => setShown(true)}>
      تلميح من المدرّس
    </Button>
  );
}
