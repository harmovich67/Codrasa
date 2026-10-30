import { useEffect, useState } from 'react';
import { Pause, Pencil, Play } from 'lucide-react';
import { useAuth } from '../store/auth.js';

const SEEN_KEY = 'codrasa_splash_seen';
const MIN_MS = 2400; // the intro always plays through, even when the API answers instantly
const LEAVE_MS = 600;

// Phones only, once per browser session, and never for people who asked for less motion.
function shouldShow() {
  if (typeof window === 'undefined') return false;
  if (!window.matchMedia('(max-width: 767px)').matches) return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  try {
    return !sessionStorage.getItem(SEEN_KEY);
  } catch {
    return true; // private mode: can't remember, so show it
  }
}

const STEPS = [
  { icon: Pause, label: 'وقّف' },
  { icon: Pencil, label: 'عدّل' },
  { icon: Play, label: 'شغّل', last: true },
];

/*
 * Launch screen for phones: the logo pops, a line of code types itself, the three verbs of a live
 * lesson light up one by one, and a lesson-style timeline fills while the app loads underneath.
 */
export default function Splash() {
  const ready = useAuth((s) => s.ready);
  const name = useAuth((s) => s.platform.platform_name);
  const [phase, setPhase] = useState(() => (shouldShow() ? 'in' : 'gone'));
  const [played, setPlayed] = useState(false);

  useEffect(() => {
    if (phase === 'gone') return undefined;
    const t = setTimeout(() => setPlayed(true), MIN_MS);
    return () => clearTimeout(t);
  }, [phase === 'gone']);

  useEffect(() => {
    if (phase === 'in' && played && ready) setPhase('out');
  }, [phase, played, ready]);

  useEffect(() => {
    if (phase !== 'out') return undefined;
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem(SEEN_KEY, '1');
      } catch {
        /* ignore */
      }
      setPhase('gone');
    }, LEAVE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === 'gone') return null;

  return (
    <div
      aria-hidden="true"
      className={`sp-root fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] ${phase === 'out' ? 'sp-out' : ''}`}
      style={{ '--sp-ms': `${MIN_MS}ms` }}
    >
      <div className="sp-orb pointer-events-none absolute -top-24 -left-20 size-80 rounded-full bg-[#9d86ff]/40 blur-3xl" />
      <div className="sp-orb pointer-events-none absolute -right-24 -bottom-20 size-72 rounded-full bg-[#34d3a6]/25 blur-3xl" style={{ animationDelay: '-3s' }} />

      <div className="relative flex flex-col items-center">
        <div className="relative flex size-28 items-center justify-center">
          <span className="sp-ring absolute inset-2 rounded-[30px] border border-white/40" />
          <span className="sp-ring absolute inset-2 rounded-[30px] border border-white/40" style={{ animationDelay: '1.1s' }} />
          <div className="sp-logo flex size-24 items-center justify-center rounded-[28px] border border-white/35 bg-white/15 font-mono text-3xl font-bold text-white shadow-[0_24px_60px_-12px_rgba(18,8,80,0.65)] backdrop-blur-md">
            {'</>'}
          </div>
        </div>

        <h1 className="sp-rise mt-7 text-4xl font-bold tracking-tight text-white" style={{ animationDelay: '0.45s' }}>
          {name}
        </h1>
        <p className="sp-rise mt-2 text-sm text-white/75" style={{ animationDelay: '0.6s' }}>
          دروس برمجة حيّة بتتعاد
        </p>

        <div
          dir="ltr"
          className="sp-rise mt-8 rounded-xl border border-white/15 bg-black/25 px-4 py-2.5 font-mono text-sm text-white/90 backdrop-blur-sm"
          style={{ animationDelay: '0.8s' }}
        >
          <span className="sp-type inline-block align-bottom">
            <span className="text-[#34d3a6]">lesson</span>.<span className="text-[#f5b544]">play</span>();
          </span>
          <span className="sp-caret ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-white" />
        </div>

        <div className="mt-6 flex items-center gap-2.5">
          {STEPS.map(({ icon: Icon, label, last }, i) => (
            <span
              key={label}
              className={`sp-step inline-flex items-center gap-1.5 rounded-2xl border px-3.5 py-2 text-sm font-medium backdrop-blur ${
                last ? 'border-white bg-white text-brand shadow-lg shadow-black/20' : 'border-white/25 bg-white/12 text-white'
              }`}
              style={{ animationDelay: `${1.35 + i * 0.28}s` }}
            >
              <Icon className="size-4" />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* lesson timeline: the play-head runs while the app loads */}
      <div dir="ltr" className="absolute inset-x-8 bottom-[max(2.5rem,calc(env(safe-area-inset-bottom)+1.5rem))]">
        <div className="relative h-1.5 rounded-full bg-white/20">
          <div className="sp-bar absolute inset-y-0 left-0 rounded-full bg-white">
            <span className="absolute top-1/2 -right-1.5 size-3.5 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_4px_rgba(255,255,255,0.25)]" />
          </div>
          <span className="absolute top-1/2 left-[34%] size-2 -translate-y-1/2 rounded-full bg-[#f5b544]" />
          <span className="absolute top-1/2 left-[68%] size-2 -translate-y-1/2 rounded-full bg-[#34d3a6]" />
        </div>
      </div>
    </div>
  );
}
