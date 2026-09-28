// Types shared by main, preload and renderer (type-only: no runtime code).
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };
export interface DirEntry { name: string; path: string; isDir: boolean }
export interface ReadResult { content: string; mtimeMs: number }
export interface StatResult { exists: boolean; isDir: boolean; mtimeMs: number }
export interface SearchOptions { caseSensitive: boolean; wholeWord: boolean; regex: boolean }
export interface LineMatch { line: number; col: number; length: number; text: string }
export interface FileMatches { path: string; matches: LineMatch[] }
export interface SearchResponse { files: FileMatches[]; total: number; truncated: boolean }
export interface ReplaceResponse { files: number; replacements: number }
export interface TermStartResult { shell: string; cwd: string }
