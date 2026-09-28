import { useDeferredValue, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { api } from '../../services/api';

/** Live Markdown preview. Output is sanitized with DOMPurify; links open in the OS browser, never in-app. */
export function MarkdownPreview({ source }: { source: string }) {
  const deferred = useDeferredValue(source); // keeps typing responsive on big documents
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(deferred, { async: false, gfm: true }) as string), [deferred]);
  return (
    <div className="md" dangerouslySetInnerHTML={{ __html: html }}
      onClick={(e) => {
        const a = (e.target as HTMLElement).closest('a');
        if (!a) return;
        e.preventDefault();
        const href = a.getAttribute('href') ?? '';
        if (/^(https?:|mailto:)/i.test(href)) void api.openExternal(href).catch(() => undefined);
      }} />
  );
}
