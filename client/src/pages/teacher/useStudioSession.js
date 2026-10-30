import { useEffect, useRef, useState } from 'react';
import fixWebmDuration from 'fix-webm-duration';
import { api } from '../../lib/api.js';
import { fmtTime } from '../../lib/format.js';
import { VoiceTrack } from '../../lib/studioAudio.js';
import { toast } from '../../store/toast.js';

// What the studio sends back for a checkpoint: only the fields the server validates (it adds revision/progress itself).
const cleanCheckpoint = ({ revision, progress, ...rest }) => rest;

const MIN_SEGMENT_MS = 1500;

/*
 * The recording state machine shared by the code recorder and the whiteboard recorder.
 *   idle -> starting -> recording <-> paused -> saving -> idle
 * `createRecorder(base)` builds the lesson-specific recorder (LessonRecorder / BoardRecorder) with
 * start() / pause() / resume() / now() / stop(); `base` is the recording being continued, if any.
 * While paused the lesson clock and the voice both stand still, so the cut leaves no gap in the lesson.
 */
export function useStudioSession({ lesson, language, createRecorder, onStarted, onEnded, reload }) {
  const [state, setState] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [withMic, setWithMic] = useState(true);
  const [pending, setPending] = useState([]); // questions added during this sitting
  const recorder = useRef(null);
  const voice = useRef(null);
  const base = useRef(null);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  useEffect(() => {
    if (state !== 'recording') return undefined;
    const iv = setInterval(() => setElapsed(recorder.current.now()), 250);
    return () => clearInterval(iv);
  }, [state]);

  // Release the mic if the page closes mid-recording.
  useEffect(
    () => () => {
      voice.current?.release();
    },
    [],
  );

  async function start(mode) {
    if (mode === 'new' && lesson.recording && !window.confirm('التسجيل الجديد هيستبدل التسجيل الحالي للدرس (والصوت). نكمل؟')) return;
    setState('starting');
    let track = null;
    if (withMic) {
      try {
        track = await VoiceTrack.open();
      } catch {
        toast.error('مقدرناش نوصل للمايك — اسمح للمتصفح بالوصول أو سجّل بدون صوت');
        return setState('idle');
      }
    }
    base.current = mode === 'continue' ? lesson.recording : null;
    recorder.current = createRecorder(base.current);
    voice.current = track;
    setPending([]);
    // The lesson clock starts exactly when audio capture starts so both tracks line up.
    if (track) await track.start();
    recorder.current.start();
    setElapsed(recorder.current.now());
    setState('recording');
    onStarted?.(mode);
  }

  function pause() {
    if (state !== 'recording') return;
    recorder.current.pause();
    voice.current?.pause();
    setElapsed(recorder.current.now());
    setState('paused');
  }

  function resume() {
    if (state !== 'paused') return;
    recorder.current.resume();
    voice.current?.resume();
    setState('recording');
  }

  // Stamped with the lesson time of the moment the teacher asked (the clock is paused while the form is open).
  const addQuestion = (question) => setPending((list) => [...list, { ...question, t_ms: Math.round(recorder.current.now()) }]);

  async function stop() {
    const continuing = !!base.current;
    const recording = recorder.current.stop();
    const segment = recording.duration - (base.current?.duration || 0);
    setState('saving');
    try {
      let blob = await voice.current?.stop();
      voice.current = null;
      if (segment < MIN_SEGMENT_MS) {
        toast.error('التسجيل أقصر من ثانية ونص — متحفظش');
        return;
      }
      // Keep earlier questions (never past the end of the lesson) and add the ones made just now.
      const checkpoints = [...(lesson.checkpoints || []).map(cleanCheckpoint), ...pendingRef.current].map((c) => ({ ...c, t_ms: Math.min(c.t_ms, recording.duration) }));
      await api.put(`/lessons/${lesson.id}`, { recording, language, checkpoints, keep_audio: continuing });
      if (blob?.size) {
        if (blob.type.includes('webm')) {
          // Chrome's MediaRecorder writes WebM without a duration, which breaks seeking.
          blob = await fixWebmDuration(blob, segment, { logger: false }).catch(() => blob);
        }
        const fd = new FormData();
        fd.append('audio', blob, 'voice.webm');
        const query = continuing ? `?append=1&start=${base.current.duration}&dur=${segment}` : '';
        await api.upload(`/lessons/${lesson.id}/audio${query}`, fd);
      }
      const added = pendingRef.current.length;
      toast.success(`اتحفظ التسجيل (${fmtTime(recording.duration)})${added ? ` مع ${added} سؤال` : ''} ✓`);
      await reload();
    } catch (err) {
      toast.error(err);
    } finally {
      recorder.current = null;
      setPending([]);
      setState('idle');
      onEnded?.();
    }
  }

  async function cancel() {
    recorder.current?.stop();
    const track = voice.current;
    voice.current = null;
    if (track) await track.stop();
    recorder.current = null;
    setPending([]);
    setState('idle');
    onEnded?.();
    toast.info('اتلغى التسجيل');
  }

  return { state, elapsed, withMic, setWithMic, pending, recorder, start, pause, resume, stop, cancel, addQuestion };
}
