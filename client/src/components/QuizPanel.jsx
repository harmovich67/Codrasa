import { useState } from 'react';
import { ListChecks, Check, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { toast } from '../store/toast.js';
import Markdown from './Markdown.jsx';
import { Button, Empty, cx } from './ui.jsx';

export default function QuizPanel({ lesson, isTeacher, preview }) {
  const quiz = lesson.quiz || [];
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const best = lesson.progress?.quiz_score;

  if (!quiz.length) return <Empty icon={ListChecks} title="مفيش اختبار للدرس ده" text={isTeacher ? 'ولّد اختبار من الاستوديو بضغطة زرار.' : undefined} />;

  async function submit() {
    if (preview) {
      // The teacher's payload already includes the answers, so grade locally and save nothing.
      const results = quiz.map((item, i) => ({ correct: answers[i] === item.answer, answer: item.answer, explain: item.explain || '' }));
      return setResult({ score: Math.round((results.filter((r) => r.correct).length / quiz.length) * 100), results });
    }
    setBusy(true);
    try {
      setResult(await api.post(`/lessons/${lesson.id}/quiz`, { answers: quiz.map((_, i) => answers[i] ?? -1) }));
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  const correctOf = (i) => (isTeacher ? quiz[i].answer : result?.results[i]?.answer);

  return (
    <div className="space-y-4 p-4">
      {result ? (
        <div className={cx('rounded-xl p-4 text-center', result.score >= 70 ? 'bg-mint/10 text-mint' : 'bg-amber/10 text-amber')}>
          <p className="text-3xl font-bold">{result.score}%</p>
          <p className="mt-1 text-sm">{result.score >= 70 ? 'ممتاز! فاهم الدرس كويس 🎉' : 'محتاج تراجع شوية — شوف التوضيحات تحت'}</p>
        </div>
      ) : (
        best != null && <p className="text-xs text-muted">أفضل نتيجة ليك: {best}%</p>
      )}
      {quiz.map((item, i) => {
        const correct = correctOf(i);
        const shown = correct !== undefined;
        return (
          <div key={i} className="rounded-xl border border-line bg-panel-2 p-3">
            <div className="mb-2 flex gap-2 text-sm font-medium">
              <span className="text-muted">{i + 1}.</span>
              <Markdown>{item.q}</Markdown>
            </div>
            <div className="space-y-1.5">
              {item.options.map((opt, j) => {
                const picked = answers[i] === j;
                const tone = shown ? (j === correct ? 'border-mint/60 bg-mint/10' : picked ? 'border-rose/60 bg-rose/10' : 'border-line') : picked ? 'border-brand bg-brand/10' : 'border-line hover:border-muted/40';
                return (
                  <button
                    key={j}
                    disabled={shown}
                    onClick={() => setAnswers((a) => ({ ...a, [i]: j }))}
                    className={cx('flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-right text-sm transition', tone)}
                  >
                    {shown && j === correct ? <Check className="size-4 text-mint" /> : shown && picked ? <X className="size-4 text-rose" /> : <span className="size-4" />}
                    <span className="flex-1">{opt}</span>
                  </button>
                );
              })}
            </div>
            {shown && (result?.results[i]?.explain || item.explain) && (
              <p className="mt-2 text-xs leading-relaxed text-muted">💡 {result?.results[i]?.explain || item.explain}</p>
            )}
          </div>
        );
      })}
      {!isTeacher &&
        (result ? (
          <Button
            variant="subtle"
            className="w-full"
            onClick={() => {
              setResult(null);
              setAnswers({});
            }}
          >
            حاول تاني
          </Button>
        ) : (
          <Button className="w-full" onClick={submit} loading={busy} disabled={Object.keys(answers).length < quiz.length}>
            تسليم الإجابات
          </Button>
        ))}
    </div>
  );
}
