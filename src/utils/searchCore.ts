import type { FileMatches, SearchOptions } from '../types';

export function buildRegex(query: string, o: SearchOptions): RegExp {
  let src = o.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (o.wholeWord) src = `\\b(?:${src})\\b`;
  return new RegExp(src, o.caseSensitive ? 'g' : 'gi');
}
/** Search one in-memory document (used for "current file" scope). */
export function searchText(path: string, text: string, o: SearchOptions, query: string): FileMatches {
  const re = buildRegex(query, o);
  const matches: FileMatches['matches'] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length && matches.length < 2000; i++) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(lines[i])) !== null) {
      if (m[0].length === 0) { re.lastIndex++; continue; }
      matches.push({ line: i + 1, col: m.index + 1, length: m[0].length, text: lines[i].slice(0, 300) });
    }
  }
  return { path, matches };
}
export function replaceAll(text: string, query: string, replacement: string, o: SearchOptions): { text: string; count: number } {
  const re = buildRegex(query, o);
  const rep = o.regex ? replacement : replacement.replace(/\$/g, '$$$$');
  let count = 0;
  text.replace(re, (m) => { count++; return m; });
  const out = count ? text.replace(re, rep) : text;
  return { text: out, count };
}
