import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cx } from './ui.jsx';

export default function Markdown({ children, className }) {
  return (
    <div
      className={cx(
        'prose prose-sm max-w-none [--tw-prose-body:var(--color-ink)] [--tw-prose-headings:var(--color-ink)] [--tw-prose-bold:var(--color-ink)] [--tw-prose-bullets:var(--color-muted)] [--tw-prose-links:var(--color-brand)] prose-headings:font-semibold prose-a:text-brand prose-code:before:content-none prose-code:after:content-none prose-pre:rounded-xl prose-pre:border prose-pre:border-slate-800 prose-pre:bg-[#0b1018]',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children || ''}</ReactMarkdown>
    </div>
  );
}
