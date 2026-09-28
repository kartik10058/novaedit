import type { DirEntry, FileMatches, SearchOptions } from '../../electron/types';

export type ThemeName = 'dark' | 'light' | 'midnight';
export type AutoSave = 'off' | 'afterDelay' | 'onFocusChange';
export type Eol = 'LF' | 'CRLF';
export type MdView = 'editor' | 'split' | 'preview';

export interface Settings {
  theme: ThemeName;
  fontSize: number; fontFamily: string; tabSize: number; insertSpaces: boolean;
  wordWrap: boolean; minimap: boolean; lineNumbers: boolean; bracketPairColorization: boolean; smoothScrolling: boolean;
  autoSave: AutoSave; autoSaveDelay: number;
  showSidebar: boolean; showStatusBar: boolean; showActivityBar: boolean;
  restoreSession: boolean; confirmDelete: boolean; encoding: 'utf8'; eol: Eol;
  shell: string; // empty = platform default
}

export interface Tab {
  uid: string;
  path: string | null;       // null = untitled
  name: string;
  language: string;
  content: string;
  savedContent: string;
  mtimeMs: number;
  missing: boolean;          // file deleted/moved on disk
  pendingEol?: Eol;          // applied to the Monaco model on first mount (new files)
  mdView: MdView;
  promptOpen?: boolean;      // external-change prompt currently showing
}

export interface RecentItem { path: string; kind: 'file' | 'folder' }
export interface Reveal { uid: string; line: number; col: number; length: number; nonce: number }
export type PaletteMode = 'commands' | 'files' | 'recent' | 'language' | 'theme';

export type DialogState =
  | { kind: 'input'; title: string; value: string; placeholder?: string; resolve: (v: string | null) => void }
  | { kind: 'choice'; title: string; detail?: string; buttons: string[]; resolve: (i: number) => void }
  | { kind: 'error'; title: string; reason: string; resolve: () => void };

export interface SearchState {
  query: string; replace: string; opts: SearchOptions; scope: 'workspace' | 'file';
  results: FileMatches[]; total: number; truncated: boolean; running: boolean; error: string | null; searched: boolean;
}
export type { DirEntry, FileMatches, SearchOptions };
