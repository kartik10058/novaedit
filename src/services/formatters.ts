/**
 * Formatting abstraction. A Formatter turns text into formatted text. Register one per language;
 * languages without a registered formatter fall back to Monaco's built-in provider (JS/TS/CSS/HTML/JSON).
 * External tools (Prettier, Black, clang-format, gofmt, rustfmt) can be added later by registering a formatter
 * whose format() calls a new IPC channel that spawns the tool in the main process — nothing else changes.
 */
export interface FormatOptions { tabSize: number; insertSpaces: boolean }
export interface Formatter { id: string; languages: string[]; format(text: string, opts: FormatOptions): Promise<string> | string }

const registry = new Map<string, Formatter>();
export const registerFormatter = (f: Formatter) => f.languages.forEach((l) => registry.set(l, f));
export const getFormatter = (language: string) => registry.get(language);

export function formatJson(text: string, o: FormatOptions): string {
  return JSON.stringify(JSON.parse(text), null, o.insertSpaces ? o.tabSize : '\t') + '\n';
}
export const minifyJson = (text: string): string => JSON.stringify(JSON.parse(text));

registerFormatter({ id: 'builtin-json', languages: ['json'], format: formatJson });
