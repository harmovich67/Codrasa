import { useRef, useState } from 'react';
import { Circle, CircleHelp, Mic, MicOff, Pause, Play, Square, StickyNote, X } from 'lucide-react';
import { fmtTime } from '../../lib/format.js';
import { toast } from '../../store/toast.js';
import QuestionForm from '../../components/QuestionForm.jsx';
import { Badge, Button, Card, IconButton } from '../../components/ui.jsx';

/*
 * Adding a question mid-lesson: the recording is paused while the form is open (so the question
 * costs the students no dead air) and resumed when it is saved or cancelled.
 */
export function useLiveQuestion(session, lesson) {
  const [open, setOpen] = useState(false);
  const pausedByUs = useRef(false);

  const ask = () => {
    pausedByUs.current = session.state === 'recording';
    session.pause();
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    if (pausedByUs.current) session.resume();
    pausedByUs.current = false;
  };
  const dialog = (
    <QuestionForm
      open={open}
      onClose={close}
      defaultSkill={lesson.title}
      onSave={(question) => {
        session.addQuestion(question);
        toast.success('اتضاف السؤال في اللحظة دي — هيتحفظ مع التسجيل ✓');
        close();
      }}
    />
  );
  return { ask, dialog };
}

/* The record / pause / question / stop controls, the same for code lessons and whiteboard lessons. */
export function RecorderBar({ session, lesson, canContinue = true, onAsk, children }) {
  const { state, elapsed, withMic, setWithMic, pending } = session;
  const live = state === 'recording' || state === 'paused';
  const busy = state === 'starting' || state === 'saving';
  const hasRecording = !!lesson.recording;

  return (
    <Card className="flex flex-wrap items-center gap-3 p-3">
      {live ? (
        <>
          {state === 'recording' ? (
            <Badge color="rose" className="px-3 py-1.5 text-sm">
              <span className="rec-dot size-2 rounded-full bg-rose" /> REC <span className="font-mono">{fmtTime(elapsed)}</span>
            </Badge>
          ) : (
            <Badge color="amber" className="px-3 py-1.5 text-sm">
              <Pause className="size-3.5" /> واقف مؤقتًا <span className="font-mono">{fmtTime(elapsed)}</span>
            </Badge>
          )}
          {state === 'recording' ? (
            <Button variant="subtle" icon={Pause} onClick={session.pause}>
              وقفة
            </Button>
          ) : (
            <Button variant="mint" icon={Play} onClick={session.resume}>
              كمّل
            </Button>
          )}
          <Button variant="subtle" icon={CircleHelp} onClick={onAsk} title="اوقف التسجيل واكتب سؤال للطلاب في اللحظة دي">
            سؤال للطلاب
          </Button>
          <Button variant="danger" icon={Square} onClick={session.stop}>
            إيقاف وحفظ
          </Button>
          <IconButton icon={X} title="إلغاء التسجيل" onClick={session.cancel} />
          {pending.length > 0 && <Badge color="brand">{pending.length} سؤال اتضاف</Badge>}
        </>
      ) : (
        <>
          <Button variant="rec" icon={Circle} onClick={() => session.start('new')} loading={busy} disabled={busy}>
            {state === 'saving' ? 'بيتحفظ…' : hasRecording ? 'تسجيل جديد (يستبدل)' : 'ابدأ التسجيل'}
          </Button>
          {hasRecording && (
            <Button
              variant="mint"
              icon={Play}
              onClick={() => session.start('continue')}
              disabled={busy || !canContinue}
              title={canContinue ? `كمّل من ${fmtTime(lesson.recording.duration)}` : 'غيّرت لغة الدرس — رجّعها للغة التسجيل الحالي عشان تكمّل'}
            >
              كمّل من {fmtTime(lesson.recording.duration)}
            </Button>
          )}
          <Button variant="subtle" size="sm" icon={withMic ? Mic : MicOff} onClick={() => setWithMic(!withMic)} disabled={busy}>
            {withMic ? 'بالصوت' : 'بدون صوت'}
          </Button>
        </>
      )}
      {children}
    </Card>
  );
}

/* The teacher's private teleprompter notes, shown beside the editor/board while recording. */
export function Prompter({ value, onChange }) {
  return (
    <Card className="flex w-full flex-col lg:w-80">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-medium">
        <StickyNote className="size-4 text-amber" /> التلقين
        <span className="text-xs font-normal text-muted">(سكريبتك — الطلاب مش بيشوفوه)</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={'اكتب نقاط الشرح هنا…\n\n1. نعرّف المتغير\n2. نوضح الفرق بين let و const\n3. مثال عملي'}
        className="min-h-64 flex-1 resize-none bg-transparent p-4 text-lg leading-9 outline-none placeholder:text-muted/40"
      />
    </Card>
  );
}
