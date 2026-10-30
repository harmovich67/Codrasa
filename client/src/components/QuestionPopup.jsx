import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleCheck, Lightbulb, Play, SkipForward, Sparkles, Target, Trophy } from 'lucide-react';
import { api } from '../lib/api.js';
import { toast } from '../store/toast.js';
import Markdown from './Markdown.jsx';
import { HELP_PROMPTS } from './AssistantPanel.jsx';
import { Badge, Button, cx } from './ui.jsx';

/*
 * The question the lesson stopped for. Voice and lesson are paused behind it; the student answers
 * (and may ask for the teacher's hint or an AI hint) before the lesson can go on.
 */
export default function QuestionPopup({ checkpoint, index, total, result, busy, onSubmit, onContinue, onSkip, aiEnabled, lessonId, getContext }) {
  const [picked, setPicked] = useState(null);
  const [teacherHint, setTeacherHint] = useState(false);
  const [ai, setAi] = useState({ text: '', busy: false });
  const abortRef = useRef(null);
  const passed = checkpoint.progress.passed;
  const wrong = result && result.id === checkpoint.id && !result.passed;

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  async function askAi() {
    if (ai.busy) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setAi({ text: '', busy: true });
    try {
      await api.stream(
        '/ai/chat',
        { lessonId, tier: 'fast', helpLevel: 'hint', ...getContext(), messages: [{ role: 'user', content: HELP_PROMPTS.hint }] },
        (text) => setAi({ text, busy: true }),
        controller.signal,
      );
    } catch (err) {
      if (err.name !== 'AbortError') {
        setAi({ text: '', busy: false });
        toast.error(err);
        return;
      }
    }
    setAi((a) => ({ ...a, busy: false }));
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/55 backdrop-blur-sm animate-fade sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="سؤال من المدرّس">
      <div className="flex max-h-[92dvh] w-full max-w-lg animate-sheet flex-col overflow-hidden rounded-t-3xl border border-line bg-panel shadow-float sm:animate-none sm:rounded-2xl">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-5 py-3.5">
          <Badge color="brand">
            <Target className="size-3" /> سؤال {index} من {total}
          </Badge>
          {checkpoint.skill && <Badge color="muted">{checkpoint.skill}</Badge>}
          {!checkpoint.required && <Badge color="amber">اختياري</Badge>}
          <span className="mr-auto text-xs text-muted">⏸ الدرس والصوت واقفين لحد ما تجاوب</span>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <Markdown className="text-base">{checkpoint.prompt}</Markdown>

          {passed ? (
            <div className="space-y-3 rounded-xl border border-mint/40 bg-mint/10 p-4">
              <p className="flex items-center gap-2 font-semibold text-mint">
                <Trophy className="size-5" /> إجابة صح! برافو
              </p>
              <Button variant="mint" icon={Play} onClick={onContinue} className="w-full" autoFocus>
                كمّل الدرس
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {checkpoint.options.map((option, i) => (
                  <label
                    key={i}
                    className={cx(
                      'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-sm transition',
                      picked === i ? 'border-brand bg-brand/10' : 'border-line bg-panel-2 hover:border-muted/40',
                    )}
                  >
                    <input type="radio" name={`popup-${checkpoint.id}`} checked={picked === i} onChange={() => setPicked(i)} className="mt-1 accent-[#7c5cff]" />
                    <span className="min-w-0 flex-1 whitespace-pre-wrap">{option}</span>
                  </label>
                ))}
              </div>

              {wrong && <p className="rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-sm text-rose">{result.message || 'الإجابة دي مش صح — فكّر تاني 💪'}</p>}

              {teacherHint && checkpoint.hint && <p className="rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-sm leading-7">💡 {checkpoint.hint}</p>}

              {(ai.text || ai.busy) && (
                <div className="rounded-xl border border-brand/30 bg-brand/5 p-3 text-sm">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-brand">
                    <Sparkles className="size-3.5" /> تلميح من المساعد
                  </p>
                  {ai.text ? <Markdown>{ai.text}</Markdown> : <span className="animate-pulse text-muted">بيفكر…</span>}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <Button icon={CircleCheck} onClick={() => onSubmit(picked)} disabled={picked === null} loading={busy} className="flex-1 sm:flex-none">
                  سلّم الإجابة
                </Button>
                {checkpoint.hint && !teacherHint && (
                  <Button variant="subtle" size="sm" icon={Lightbulb} onClick={() => setTeacherHint(true)}>
                    تلميح المدرّس
                  </Button>
                )}
                {aiEnabled && (
                  <Button variant="subtle" size="sm" icon={Sparkles} onClick={askAi} loading={ai.busy}>
                    {ai.text ? 'تلميح تاني' : 'تلميح ذكي'}
                  </Button>
                )}
                {!checkpoint.required && (
                  <Button variant="ghost" size="sm" icon={SkipForward} onClick={onSkip} className="mr-auto">
                    تخطّى
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
