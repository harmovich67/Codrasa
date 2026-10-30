import { useMemo, useRef, useState } from 'react';
import { Grid3x3, StickyNote } from 'lucide-react';
import { BoardRecorder, createBoardTimeline } from '../../lib/board.js';
import { fmtTime } from '../../lib/format.js';
import BoardEditor from '../../components/Board.jsx';
import { Button, IconButton } from '../../components/ui.jsx';
import { useStudioSession } from './useStudioSession.js';
import { Prompter, RecorderBar, VoiceMissingNotice, useLiveQuestion, useVoiceMissing } from './StudioParts.jsx';

/* Recording tab for whiteboard lessons (math, physics…): the same studio as code lessons, with a board instead of the editor. */
export default function BoardRecorderTab({ lesson, form, set, reload }) {
  const timeline = useMemo(() => (lesson.recording ? createBoardTimeline(lesson.recording) : null), [lesson.recording]);
  const finalItems = useMemo(() => (timeline ? timeline.visibleAt(Infinity) : []), [timeline]);
  const boardRef = useRef(null);
  const [bg, setBg] = useState(lesson.recording?.bg || 'plain');
  const [prompter, setPrompter] = useState(true);

  const session = useStudioSession({
    lesson,
    language: 'board',
    reload,
    createRecorder: (base) => {
      // Continuing starts from what is on the board at the end of the recording; a new recording starts blank.
      boardRef.current.setItems(base ? finalItems : []);
      return new BoardRecorder(base, bg);
    },
  });
  const question = useLiveQuestion(session, lesson);
  const voiceMissing = useVoiceMissing(lesson);
  const live = session.state === 'recording' || session.state === 'paused';
  const busy = session.state === 'starting' || session.state === 'saving';
  const recorder = live ? session.recorder.current : null;

  return (
    <div className="space-y-3">
      <RecorderBar session={session} lesson={lesson} onAsk={question.ask}>
        <div className="flex-1" />
        <Button
          variant="subtle"
          size="sm"
          icon={Grid3x3}
          onClick={() => setBg(bg === 'grid' ? 'plain' : 'grid')}
          disabled={live || busy}
          title="خلفية السبورة"
        >
          {bg === 'grid' ? 'شبكة' : 'سادة'}
        </Button>
        <IconButton icon={StickyNote} title="التلقين (Teleprompter)" active={prompter} onClick={() => setPrompter(!prompter)} />
      </RecorderBar>
      {question.dialog}

      {!live && voiceMissing && <VoiceMissingNotice />}
      {!live && (
        <p className="text-xs leading-6 text-muted">
          {timeline ? (
            <>
              التسجيل الحالي: <b className="font-mono text-ink">{fmtTime(timeline.duration)}</b> · {lesson.audio_parts?.length ? 'بالصوت' : 'بدون صوت'} · {lesson.recording.events.length} حدث. «كمّل» بيضيف على آخره
              (السبورة هترجع زي ما انتهت)، و«تسجيل جديد» بيبدأ سبورة فاضية.{' '}
            </>
          ) : (
            'الدرس ده لسه متسجلش. '
          )}
          كل خط بترسمه وكل نص بتكتبه بيتسجل مع صوتك — مش فيديو، والطالب يقدر يوقف ويرجّع في أي لحظة. «وقفة» بتوقف التسجيل والصوت من غير فجوة، و«سؤال للطلاب» بيحط سؤال بيوقف الدرس عند اللحظة دي.
        </p>
      )}

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="min-w-0 flex-1">
          <BoardEditor ref={boardRef} recorder={recorder} active={session.state === 'recording'} bg={live ? recorder.bg : bg} initialItems={finalItems} />
        </div>
        {prompter && <Prompter value={form.notes} onChange={(v) => set('notes', v)} />}
      </div>
    </div>
  );
}
