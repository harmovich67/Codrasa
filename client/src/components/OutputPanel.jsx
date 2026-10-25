import { useEffect, useState } from 'react';
import { Terminal, Eye } from 'lucide-react';
import { cx } from './ui.jsx';

const LINE_TONE = { log: 'text-slate-200', warn: 'text-amber-300', error: 'text-rose-300' };

function HtmlPreview({ code }) {
  const [doc, setDoc] = useState(code);
  useEffect(() => {
    const t = setTimeout(() => setDoc(code), 300);
    return () => clearTimeout(t);
  }, [code]);
  return <iframe title="preview" sandbox="allow-scripts allow-modals allow-forms" srcDoc={doc} className="h-full w-full rounded-b-xl bg-white" />;
}

/* `html` → live preview of the given markup, otherwise a console of `lines`. */
export default function OutputPanel({ lines, html, label, ms, className, empty = 'اضغط تشغيل (Ctrl+Enter) لرؤية الناتج' }) {
  const isHtml = html !== undefined;
  return (
    <div className={cx('flex min-h-0 flex-col rounded-xl border border-slate-800 bg-[#0b1018]', className)}>
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          {isHtml ? <Eye className="size-3.5" /> : <Terminal className="size-3.5" />}
          {label || (isHtml ? 'المعاينة' : 'الناتج')}
        </span>
        {ms != null && <span className="font-mono">{ms}ms</span>}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {isHtml ? (
          <HtmlPreview code={html} />
        ) : lines?.length ? (
          <pre dir="ltr" className="space-y-0.5 p-3 text-left font-mono text-[13px] leading-relaxed whitespace-pre-wrap">
            {lines.map((l, i) => (
              <div key={i} className={LINE_TONE[l.type] || LINE_TONE.log}>
                {l.text}
              </div>
            ))}
          </pre>
        ) : (
          <p className="p-3 text-xs text-slate-500">{empty}</p>
        )}
      </div>
    </div>
  );
}
