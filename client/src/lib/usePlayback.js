import { useCallback, useEffect, useRef, useState } from 'react';

/*
 * Lesson clock. With a voice track, the <audio> element is the source of truth;
 * without one, a virtual clock runs on performance.now().
 */
export function usePlayback(duration, audioUrl, initialTime = 0) {
  const audioRef = useRef(null);
  const st = useRef({ playing: false, rate: 1, base: initialTime, started: 0, audioDone: false });
  const [time, setTime] = useState(initialTime);
  const [playing, setPlaying] = useState(false);
  const [rate, setRateState] = useState(1);

  const current = useCallback(() => {
    const a = audioRef.current;
    const s = st.current;
    if (a && s.playing && !s.audioDone) return a.currentTime * 1000;
    return s.playing ? s.base + (performance.now() - s.started) * s.rate : s.base;
  }, []);

  const pause = useCallback(() => {
    const s = st.current;
    s.base = Math.min(duration, current());
    s.playing = false;
    audioRef.current?.pause();
    setPlaying(false);
    setTime(s.base);
  }, [current, duration]);

  const seek = useCallback(
    (t) => {
      const s = st.current;
      s.base = Math.max(0, Math.min(duration, t));
      s.started = performance.now();
      s.audioDone = false;
      if (audioRef.current) audioRef.current.currentTime = s.base / 1000;
      setTime(s.base);
    },
    [duration],
  );

  const play = useCallback(() => {
    const s = st.current;
    if (s.base >= duration - 50) seek(0);
    s.started = performance.now();
    s.playing = true;
    s.audioDone = false;
    const a = audioRef.current;
    if (a) {
      a.currentTime = s.base / 1000;
      a.playbackRate = s.rate;
      a.play().catch(() => {});
    }
    setPlaying(true);
  }, [duration, seek]);

  const setRate = useCallback(
    (r) => {
      const s = st.current;
      s.base = current();
      s.started = performance.now();
      s.rate = r;
      if (audioRef.current) audioRef.current.playbackRate = r;
      setRateState(r);
    },
    [current],
  );

  useEffect(() => {
    if (!audioUrl) {
      audioRef.current = null;
      return undefined;
    }
    const a = new Audio(audioUrl);
    a.preload = 'auto';
    audioRef.current = a;
    const onMeta = () => (a.currentTime = st.current.base / 1000);
    const onEnded = () => {
      // The voice track may end a few ms before the code stream; let the virtual clock finish.
      const s = st.current;
      if (!s.playing) return;
      s.base = a.currentTime * 1000;
      s.started = performance.now();
      s.audioDone = true;
    };
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('ended', onEnded);
    return () => {
      a.pause();
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('ended', onEnded);
      a.removeAttribute('src');
      a.load();
    };
  }, [audioUrl]);

  useEffect(() => {
    if (!playing) return undefined;
    let id;
    const loop = () => {
      const t = current();
      if (t >= duration) {
        pause();
        setTime(duration);
        return;
      }
      setTime(t);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [playing, duration, current, pause]);

  return { time, playing, rate, play, pause, seek, setRate, toggle: () => (st.current.playing ? pause() : play()) };
}
