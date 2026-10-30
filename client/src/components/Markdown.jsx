import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cx } from './ui.jsx';

export default function Markdown({ children, className }) {
  return (
    <div
      className={cx(
        // Generated text can hold long links, code lines and wide tables: wrap words, scroll code/tables, never widen the page.
        'prose prose-sm min-w-0 max-w-none [overflow-wrap:anywhere] prose-img:max-w-full prose-pre:max-w-full prose-pre:overflow-x-auto prose-table:block prose-table:max-w-full prose-table:overflow-x-auto [--tw-prose-body:var(--color-ink)] [--tw-prose-headings:var(--color-ink)] [--tw-prose-bold:var(--color-ink)] [--tw-prose-bullets:var(--color-muted)] [--tw-prose-links:var(--color-brand)] prose-headings:font-semibold prose-a:text-brand prose-code:before:content-none prose-code:after:content-none prose-pre:rounded-xl prose-pre:border prose-pre:border-slate-800 prose-pre:bg-[#0b1018]',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children || ''}</ReactMarkdown>
    </div>
  );
}
