import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Voice tracks may end a hair before the lesson clock; this much slack avoids flapping at the boundary.
const END_SLACK_MS = 120;

/*
 * Lesson clock. While a voice part covers the current moment, its <audio> element is the source of
 * truth; everywhere else (no voice, a gap between sittings, a part that failed to load) a virtual
 * clock runs on performance.now().
 *
 * `audio` = a single url (legacy) or [{ url, start, dur }]: one part per recording sitting, `start`
 * in lesson-clock ms and `dur` its length (null = until the file ends).
 */
export function usePlayback(duration, audio, initialTime = 0) {
  const parts = useMemo(
    () => (typeof audio === 'string' ? [{ url: audio, start: 0, dur: null }] : Array.isArray(audio) ? audio.filter((p) => p?.url) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(audio ?? null)],
  );
  const audiosRef = useRef([]); // one Audio per part, same order
  const partsRef = useRef(parts);
  partsRef.current = parts;
  const activeRef = useRef(-1); // part whose audio drives the clock right now, or -1 = virtual clock
  const st = useRef({ playing: false, rate: 1, base: initialTime, started: 0, audioDone: false });
  const [time, setTime] = useState(initialTime);
  const [playing, setPlaying] = useState(false);
  const [rate, setRateState] = useState(1);

  // The part that should be audible at lesson time t (the latest one that has started and not yet ended).
  const partAt = useCallback((t) => {
    const list = partsRef.current;
    let idx = -1;
    for (let i = 0; i < list.length; i++) if (list[i].start <= t && !list[i].bad) idx = i;
    if (idx >= 0 && list[idx].dur != null && t >= list[idx].start + list[idx].dur + END_SLACK_MS) return -1;
    return idx;
  }, []);

  const current = useCallback(() => {
    const s = st.current;
    if (!s.playing) return s.base;
    const i = activeRef.current;
    if (i >= 0 && !s.audioDone) return partsRef.current[i].start + audiosRef.current[i].currentTime * 1000;
    return s.base + (performance.now() - s.started) * s.rate;
  }, []);

  const silence = useCallback(() => audiosRef.current.forEach((a) => a.pause()), []);

  // Point the clock at lesson time t: play the right voice part from the right offset, or fall back to the virtual clock.
  const engage = useCallback(
    (t) => {
      const s = st.current;
      const idx = partAt(t);
      audiosRef.current.forEach((a, i) => i !== idx && a.pause());
      s.base = t;
      s.started = performance.now();
      s.audioDone = false;
      activeRef.current = idx;
      const a = idx >= 0 ? audiosRef.current[idx] : null;
      if (a) {
        a.currentTime = Math.max(0, (t - partsRef.current[idx].start) / 1000);
        a.playbackRate = s.rate;
        a.play().catch(() => {});
      }
    },
    [partAt],
  );

  const pause = useCallback(() => {
    const s = st.current;
    s.base = Math.min(duration, current());
    s.playing = false;
    silence();
    setPlaying(false);
    setTime(s.base);
  }, [current, duration, silence]);

  const seek = useCallback(
    (t) => {
      const s = st.current;
      const target = Math.max(0, Math.min(duration, t));
      if (s.playing) engage(target);
      else {
        s.base = target;
        s.started = performance.now();
        s.audioDone = false;
      }
      setTime(target);
    },
    [duration, engage],
  );

  const play = useCallback(() => {
    const s = st.current;
    if (s.base >= duration - 50) s.base = 0;
    s.playing = true;
    engage(s.base);
    setPlaying(true);
  }, [duration, engage]);

  const setRate = useCallback(
    (r) => {
      const s = st.current;
      s.base = current();
      s.started = performance.now();
      s.rate = r;
      audiosRef.current.forEach((a) => (a.playbackRate = r));
      setRateState(r);
    },
    [current],
  );

  // One <audio> per voice part.
  useEffect(() => {
    const list = parts.map((part, i) => {
      const a = new Audio(part.url);
      a.preload = i === 0 ? 'auto' : 'metadata';
      const onEnded = () => {
        // The voice may end a few ms before the lesson clock; let the virtual clock finish.
        const s = st.current;
        if (!s.playing || activeRef.current !== i) return;
        s.base = part.start + a.currentTime * 1000;
        s.started = performance.now();
        s.audioDone = true;
      };
      // A voice file that can't be loaded (deleted, or lost with an ephemeral disk) must not freeze the lesson.
      const onError = () => {
        partsRef.current[i] = { ...partsRef.current[i], bad: true };
        const s = st.current;
        if (s.playing && activeRef.current === i) {
          s.base = part.start + a.currentTime * 1000;
          s.started = performance.now();
          activeRef.current = -1;
        }
      };
      a.addEventListener('ended', onEnded);
      a.addEventListener('error', onError);
      a.cleanup = () => {
        a.pause();
        a.removeEventListener('ended', onEnded);
        a.removeEventListener('error', onError);
        a.removeAttribute('src');
        a.load();
      };
      return a;
    });
    audiosRef.current = list;
    activeRef.current = -1;
    return () => {
      list.forEach((a) => a.cleanup());
      audiosRef.current = [];
    };
  }, [parts]);

  useEffect(() => {
    if (!playing) return undefined;
    let id;
    const loop = () => {
      const s = st.current;
      const t = current();
      if (t >= duration) {
        pause();
        setTime(duration);
        return;
      }
      // Cross a sitting boundary: hand the clock to the next voice part, or to the virtual clock in a gap.
      const idx = partAt(t);
      if (idx !== activeRef.current && !(s.audioDone && idx === activeRef.current)) engage(t);
      setTime(t);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [playing, duration, current, pause, partAt, engage]);

  return { time, playing, rate, play, pause, seek, setRate, toggle: () => (st.current.playing ? pause() : play()) };
}
