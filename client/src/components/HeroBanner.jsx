import { cx } from './ui.jsx';

// Code lines of the "live lesson": [x offset, width, colour] segments per line.
const P = 'var(--color-brand)';
const M = '#34d3a6';
const A = '#f5b544';
const W = '#8f9bc4';
const LINES = [
  [[0, 34, P], [42, 70, W]],
  [[14, 52, M], [74, 40, W], [122, 28, A]],
  [[14, 30, P], [52, 86, W]],
  [[28, 64, A], [100, 46, M]],
  [[14, 22, P], [44, 58, W]],
];

export function Illustration() {
  let delay = 0;
  return (
    <svg viewBox="0 0 480 270" className="h-full w-full" role="img" aria-label="درس برمجة حي: كود بيتكتب وشريط تشغيل وتحدي">
      <defs>
        <linearGradient id="hb-win" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1f3b" />
          <stop offset="1" stopColor="#12152b" />
        </linearGradient>
        <linearGradient id="hb-glow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6c4cf6" stopOpacity="0.28" />
          <stop offset="1" stopColor="#34d3a6" stopOpacity="0.22" />
        </linearGradient>
        <filter id="hb-shadow" filterUnits="userSpaceOnUse" x="-40" y="-40" width="560" height="360" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#3b2fa0" floodOpacity="0.28" />
        </filter>
      </defs>

      <ellipse cx="240" cy="140" rx="214" ry="118" fill="url(#hb-glow)" />

      {/* floating symbol tiles */}
      <g className="hb-float" style={{ animationDelay: '-1s' }}>
        <rect x="26" y="52" width="58" height="58" rx="16" fill="#fff" filter="url(#hb-shadow)" />
        <text x="55" y="89" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontWeight="700" fontSize="22" fill="var(--color-brand)">
          {'</>'}
        </text>
      </g>
      <g className="hb-float" style={{ animationDelay: '-3s' }}>
        <rect x="402" y="26" width="48" height="48" rx="14" fill="#fff" filter="url(#hb-shadow)" />
        <text x="426" y="58" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontWeight="700" fontSize="20" fill="#e49a1b">
          {'{ }'}
        </text>
      </g>

      {/* editor window */}
      <g filter="url(#hb-shadow)">
        <rect x="92" y="40" width="296" height="176" rx="18" fill="url(#hb-win)" />
      </g>
      <circle cx="116" cy="62" r="5" fill="#ff6b81" />
      <circle cx="132" cy="62" r="5" fill="#f5b544" />
      <circle cx="148" cy="62" r="5" fill="#34d3a6" />
      <rect x="248" y="56" width="120" height="12" rx="6" fill="#ffffff" opacity="0.07" />

      {LINES.map((segments, i) => (
        <g key={i} transform={`translate(112 ${92 + i * 20})`}>
          <text x="-14" y="8" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#5b6490">
            {i + 1}
          </text>
          {segments.map(([x, w, color], j) => {
            const d = (delay += 0.45);
            return <rect key={j} className="hb-bar" x={x + 8} y="0" width={w} height="9" rx="4.5" fill={color} style={{ animationDelay: `${d}s` }} />;
          })}
        </g>
      ))}
      <rect className="hb-cursor" x="226" y="172" width="3" height="13" rx="1.5" fill="#fff" />

      {/* lesson timeline: play-head running over the recording */}
      <g transform="translate(112 196)">
        <circle cx="8" cy="0" r="9" fill="var(--color-brand)" />
        <path d="M5.5 -4.5 12 0 5.5 4.5z" fill="#fff" />
        <rect x="26" y="-2.5" width="180" height="5" rx="2.5" fill="#ffffff" opacity="0.14" />
        <rect className="hb-progress" x="26" y="-2.5" width="180" height="5" rx="2.5" fill="var(--color-brand)" />
        <circle className="hb-knob" cx="26" cy="0" r="6" fill="#fff" />
        <circle cx="96" cy="0" r="3.5" fill="#f5b544" />
        <circle cx="150" cy="0" r="3.5" fill="#34d3a6" />
      </g>

      {/* voice waveform card */}
      <g className="hb-float" style={{ animationDelay: '-2s' }}>
        <rect x="326" y="120" width="116" height="62" rx="16" fill="#fff" filter="url(#hb-shadow)" />
        <circle cx="348" cy="151" r="11" fill="#6c4cf61f" />
        <rect x="344" y="145" width="8" height="12" rx="4" fill="var(--color-brand)" />
        <path d="M341 153a7 7 0 0 0 14 0" fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} className="hb-eq" x={368 + i * 12} y="136" width="6" height="30" rx="3" fill={i % 2 ? M : P} style={{ animationDelay: `${i * 0.13}s`, animationDuration: `${0.9 + (i % 3) * 0.25}s` }} />
        ))}
      </g>

      {/* challenge passed */}
      <g className="hb-pop">
        <g filter="url(#hb-shadow)">
          <rect x="38" y="160" width="130" height="46" rx="14" fill="#fff" />
        </g>
        <circle cx="62" cy="183" r="12" fill="#34d3a6" />
        <path d="m56 183 4.5 4.5L69 178.5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="82" y="172" width="64" height="8" rx="4" fill="#1c2040" opacity="0.8" />
        <rect x="82" y="187" width="44" height="7" rx="3.5" fill="#8f9bc4" opacity="0.7" />
      </g>

      {/* sparkles */}
      {[
        [78, 28, 0],
        [452, 120, 1.1],
        [300, 20, 2],
        [24, 142, 0.6],
      ].map(([x, y, d], i) => (
        <path key={i} className="hb-twinkle" style={{ animationDelay: `${d}s` }} d={`M${x} ${y - 7}l2 5 5 2-5 2-2 5-2-5-5-2 5-2z`} fill="#f5b544" />
      ))}
    </svg>
  );
}

/* Page banner: greeting + quick facts on the start side, an animated "live coding lesson" scene on the other. */
export default function HeroBanner({ title, subtitle, chips = [], children, className }) {
  return (
    <section
      className={cx(
        'relative mb-5 overflow-hidden rounded-3xl border border-white/70 bg-gradient-to-br from-white via-[#f3f1ff] to-[#e6e9ff] shadow-float md:mb-6',
        className,
      )}
    >
      <div className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full bg-brand/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 left-1/3 size-64 rounded-full bg-mint/15 blur-3xl" />
      <div className="relative grid items-center gap-2 px-5 pt-6 pb-2 sm:px-8 md:grid-cols-[minmax(0,1fr)_minmax(260px,400px)] md:gap-6 md:py-7 lg:grid-cols-[minmax(0,1fr)_minmax(320px,470px)] lg:py-8">
        <div className="min-w-0 space-y-3">
          <h1 className="text-2xl leading-snug font-bold tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {chips.map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/80 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur">
                  {Icon && <Icon className="size-3.5 text-brand" />}
                  {label}
                </span>
              ))}
            </div>
          )}
          {children && <div className="flex flex-wrap gap-2 pt-1">{children}</div>}
        </div>
        <div className="mx-auto aspect-[480/270] w-full max-w-[420px] md:max-w-none">
          <Illustration />
        </div>
      </div>
    </section>
  );
}
