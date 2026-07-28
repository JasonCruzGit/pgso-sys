import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
  ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }) => <h3 className="mb-2 mt-1 text-base font-bold text-slate-900">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-2 mt-1 text-sm font-bold text-slate-900">{children}</h3>,
  h3: ({ children }) => <h4 className="mb-1.5 mt-1 text-sm font-semibold text-slate-800">{children}</h4>,
  code: ({ children, className }) => {
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return (
        <pre className="my-2 overflow-x-auto rounded-lg bg-slate-800 p-3 text-xs text-slate-100">
          <code>{children}</code>
        </pre>
      );
    }
    return (
      <code className="rounded bg-slate-200/80 px-1 py-0.5 text-xs font-medium text-slate-800">
        {children}
      </code>
    );
  },
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="table-zebra min-w-full text-left text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-slate-200 bg-slate-50">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => (
    <th className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700">{children}</th>
  ),
  td: ({ children }) => (
    <td className="max-w-[180px] px-3 py-2 align-top text-slate-600 whitespace-normal">{children}</td>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-4 border-palawan-400 pl-3 text-slate-600 italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-slate-200" />,
  a: ({ href, children }) => (
    <a href={href} className="font-medium text-palawan-700 underline hover:text-palawan-800" target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
};

interface AiMessageContentProps {
  content: string;
  role: 'user' | 'assistant';
}

export default function AiMessageContent({ content, role }: AiMessageContentProps) {
  if (role === 'user') {
    return <p className="whitespace-pre-wrap leading-relaxed">{content}</p>;
  }

  return (
    <div className="ai-markdown text-sm leading-relaxed text-slate-800">
      <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </Markdown>
    </div>
  );
}
