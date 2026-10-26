// Turns web addresses in plain text (notes) into links that open in a new tab.
import type { ReactNode } from 'react';

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;
/** Punctuation that usually ends the sentence rather than the address, e.g. "see example.com/a." */
const TRAILING = /[.,;:!?'")\]]+$/;

export function Linkify({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const url = m[0].replace(TRAILING, '');
    const start = m.index;
    parts.push(text.slice(last, start));
    parts.push(
      <a key={start} href={url.startsWith('www.') ? `https://${url}` : url} target="_blank" rel="noopener noreferrer" className="note-link">
        {url}
      </a>,
    );
    last = start + url.length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}
