import * as fsp from 'fs/promises';
import * as path from 'path';
import { assertPath, assertString, handle } from './util';
import type { FileMatches, ReplaceResponse, SearchOptions, SearchResponse } from '../types';

const IGNORE = new Set(['node_modules', '.git', 'dist', 'dist-electron', 'release', '.vite', '__pycache__', '.next', 'out', 'target']);
const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL = 3000, MAX_PER_FILE = 500;

async function* walk(root: string): AsyncGenerator<string> {
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop() as string;
    let ents;
    try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of ents) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (!IGNORE.has(e.name)) stack.push(full); }
      else if (e.isFile()) yield full;
    }
  }
}
async function readText(fp: string): Promise<string | null> {
  try {
    const st = await fsp.stat(fp);
    if (st.size > MAX_TEXT_BYTES) return null;
    const buf = await fsp.readFile(fp);
    return buf.subarray(0, 8000).includes(0) ? null : buf.toString('utf8');
  } catch { return null; }
}
function assertOptions(o: unknown): SearchOptions {
  const x = o as Partial<SearchOptions> | null;
  return { caseSensitive: !!x?.caseSensitive, wholeWord: !!x?.wholeWord, regex: !!x?.regex };
}
function buildRegex(query: string, o: SearchOptions): RegExp {
  let src = o.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (o.wholeWord) src = `\\b(?:${src})\\b`;
  return new RegExp(src, o.caseSensitive ? 'g' : 'gi'); // throws SyntaxError on bad regex -> shown to user
}

export function registerSearchHandlers(): void {
  handle('search:files', async (root: unknown): Promise<string[]> => {
    const out: string[] = [];
    for await (const f of walk(assertPath(root))) { out.push(f); if (out.length >= 5000) break; }
    return out;
  });

  handle('search:text', async (root: unknown, query: unknown, opts: unknown): Promise<SearchResponse> => {
    const dir = assertPath(root), q = assertString(query, 2000), o = assertOptions(opts);
    const re = buildRegex(q, o);
    const files: FileMatches[] = [];
    let total = 0, truncated = false;
    for await (const fp of walk(dir)) {
      const text = await readText(fp);
      if (text === null) continue;
      const matches: FileMatches['matches'] = [];
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length && matches.length < MAX_PER_FILE; i++) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(lines[i])) !== null) {
          if (m[0].length === 0) { re.lastIndex++; continue; }
          matches.push({ line: i + 1, col: m.index + 1, length: m[0].length, text: lines[i].slice(0, 300) });
          if (matches.length >= MAX_PER_FILE) break;
        }
      }
      if (matches.length) { files.push({ path: fp, matches }); total += matches.length; }
      if (total >= MAX_TOTAL) { truncated = true; break; }
    }
    files.sort((a, b) => a.path.localeCompare(b.path));
    return { files, total, truncated };
  });

  handle('search:replace', async (root: unknown, query: unknown, replacement: unknown, opts: unknown): Promise<ReplaceResponse> => {
    const dir = assertPath(root), q = assertString(query, 2000), r = assertString(replacement, 20000), o = assertOptions(opts);
    const re = buildRegex(q, o);
    const rep = o.regex ? r : r.replace(/\$/g, '$$$$'); // literal replacement unless regex mode
    let files = 0, replacements = 0;
    for await (const fp of walk(dir)) {
      const text = await readText(fp);
      if (text === null) continue;
      let count = 0;
      text.replace(re, (m) => { count++; return m; }); // count first, then replace with native $-group support
      re.lastIndex = 0;
      const next = count ? text.replace(re, rep) : text;
      if (count > 0 && next !== text) { await fsp.writeFile(fp, next, 'utf8'); files++; replacements += count; }
    }
    return { files, replacements };
  });
}
