import { useEffect, useRef, useState } from 'react';
import { Bot, Send, Zap, Brain, Square, Eraser, Lightbulb, Compass, Bug, KeyRound } from 'lucide-react';
import { api } from '../lib/api.js';
import { fmtTime } from '../lib/format.js';
import { useAuth } from '../store/auth.js';
import Markdown from './Markdown.jsx';
import { Button, IconButton, cx } from './ui.jsx';

const QUICK = [
  'اشرحلي الكود اللي قدامي سطر سطر',
  'إيه اللي بيحصل في السطر اللي عليه المؤشر؟',
  'ليه الكود بيطلع الناتج ده؟',
  'اديني تمرين صغير على اللي اتشرح لحد دلوقتي',
];

/* `getContext` returns the live moment: { t_ms, code, output, line } */
export const HELP_PROMPTS = {
  hint: 'اديني تلميح صغير بس من غير ما تحلها.',
  guide: 'وجّهني بأسئلة تقودني للحل بنفسي.',
  explain: 'اشرحلي ليه محاولتي الأخيرة مش مظبوطة.',
  solution: 'اعرض الحل الكامل مع الشرح.',
};

const LEVELS = [
  { level: 'hint', label: 'تلميح', icon: Lightbulb },
  { level: 'guide', label: 'وجّهني', icon: Compass },
  { level: 'explain', label: 'اشرح الخطأ', icon: Bug },
  { level: 'solution', label: 'الحل', icon: KeyRound },
];

/* `request` = { id, level } fired from outside (the challenge card); each new id sends one message. */
export default function AssistantPanel({ lessonId, getContext, asStudent, request, challengeActive }) {
  const { user, platform } = useAuth();
  const canSmart = (user.role === 'teacher' && !asStudent) || platform.student_smart;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [tier, setTier] = useState('fast');
  const abortRef = useRef(null);
  const endRef = useRef(null);

  // Braces matter: an effect must return a cleanup function or nothing, never the call's result.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const sendRef = useRef(null);
  const lastRequest = useRef(null);

  async function send(text, helpLevel) {
    const body = text.trim();
    if (!body || busy) return;
    const ctx = getContext();
    const history = [...messages.filter((m) => !m.error), { role: 'user', content: body, at: ctx.t_ms }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setInput('');
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await api.stream(
        '/ai/chat',
        { lessonId, tier, helpLevel, ...ctx, messages: history.map(({ role, content }) => ({ role, content })) },
        (txt) => setMessages((m) => [...m.slice(0, -1), { role: 'assistant', content: txt }]),
        controller.signal,
      );
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages((m) => [...m.slice(0, -1), { role: 'assistant', content: `⚠️ ${err.message}`, error: true }]);
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  sendRef.current = send;
  useEffect(() => {
    if (!request || lastRequest.current === request.id) return;
    lastRequest.current = request.id;
    sendRef.current(HELP_PROMPTS[request.level], request.level);
  }, [request]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <div className="flex rounded-lg border border-line bg-panel-2 p-0.5 text-xs">
          <button
            onClick={() => setTier('fast')}
            className={cx('inline-flex items-center gap-1 rounded-md px-2 py-1', tier === 'fast' ? 'bg-brand/20 text-ink' : 'text-muted')}
          >
            <Zap className="size-3.5" /> سريع
          </button>
          {canSmart && (
            <button
              onClick={() => setTier('smart')}
              className={cx('inline-flex items-center gap-1 rounded-md px-2 py-1', tier === 'smart' ? 'bg-brand/20 text-ink' : 'text-muted')}
            >
              <Brain className="size-3.5" /> أذكى
            </button>
          )}
        </div>
        {messages.length > 0 && <IconButton icon={Eraser} title="محادثة جديدة" onClick={() => setMessages([])} disabled={busy} />}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
        {messages.length === 0 ? (
          <div className="space-y-4 pt-4 text-center">
            <div className="mx-auto w-fit rounded-2xl bg-brand/15 p-3 text-brand">
              <Bot className="size-7" />
            </div>
            <div>
              <p className="font-semibold">مساعد Gemini</p>
              <p className="mt-1 text-xs text-muted">شايف الكود في نفس اللحظة اللي انت واقف عندها في الدرس.</p>
            </div>
            <div className="space-y-2 text-right">
              {QUICK.map((q) => (
                <button key={q} onClick={() => send(q)} className="block w-full rounded-xl border border-line bg-panel-2 px-3 py-2 text-sm text-muted transition hover:border-brand/50 hover:text-ink">
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="mr-auto max-w-[90%] rounded-2xl rounded-tl-sm bg-brand/20 px-3.5 py-2.5 text-sm">
                <span className="mb-1 block font-mono text-[10px] text-muted">⏱ {fmtTime(m.at)}</span>
                {m.content}
              </div>
            ) : (
              <div key={i} className={cx('text-sm', m.error && 'text-rose')}>
                {m.content ? <Markdown>{m.content}</Markdown> : <span className="animate-pulse text-muted">بيفكر…</span>}
              </div>
            ),
          )
        )}
        <div ref={endRef} />
      </div>

      {challengeActive && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-3 pt-2.5">
          <span className="text-[11px] text-muted">مساعدة على التحدي:</span>
          {LEVELS.map(({ level, label, icon: Icon }) => (
            <button
              key={level}
              disabled={busy}
              onClick={() => send(HELP_PROMPTS[level], level)}
              className="inline-flex items-center gap-1 rounded-md border border-line bg-panel-2 px-2 py-1 text-[11px] text-muted transition hover:border-brand/50 hover:text-ink disabled:opacity-50"
            >
              <Icon className="size-3" /> {label}
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className={cx('flex items-end gap-2 p-3', !challengeActive && 'border-t border-line')}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="اسأل عن الكود اللي قدامك…"
          className="input max-h-32 min-h-10 flex-1 resize-none"
        />
        {busy ? (
          <Button type="button" variant="subtle" icon={Square} onClick={() => abortRef.current?.abort()} title="إيقاف" />
        ) : (
          <Button type="submit" icon={Send} disabled={!input.trim()} title="إرسال" />
        )}
      </form>
    </div>
  );
}
