import { create } from 'zustand';
import type { DialogState, DirEntry, PaletteMode, RecentItem, Reveal, SearchState, Tab } from '../types';

export interface AppState {
  tabs: Tab[]; activeUid: string | null; closedPaths: string[];
  workspace: string | null;
  children: Record<string, DirEntry[]>; expanded: Record<string, boolean>;
  recent: RecentItem[];
  sidebarView: 'explorer' | 'search'; sidebarOpen: boolean; panelOpen: boolean; mainView: 'editor' | 'settings'; sidebarWidth: number;
  palette: PaletteMode | null;
  dialog: DialogState | null;
  cursor: { line: number; col: number; eol: 'LF' | 'CRLF'; tabSize: number; insertSpaces: boolean };
  status: string;
  reveal: Reveal | null;
  search: SearchState;
  term: { output: string; running: boolean; shell: string };
}

export const useApp = create<AppState>(() => ({
  tabs: [], activeUid: null, closedPaths: [], workspace: null, children: {}, expanded: {}, recent: [],
  sidebarView: 'explorer', sidebarOpen: true, panelOpen: false, mainView: 'editor', sidebarWidth: 270,
  palette: null, dialog: null,
  cursor: { line: 1, col: 1, eol: 'LF', tabSize: 4, insertSpaces: true },
  status: 'Ready', reveal: null,
  search: { query: '', replace: '', opts: { caseSensitive: false, wholeWord: false, regex: false }, scope: 'workspace',
    results: [], total: 0, truncated: false, running: false, error: null, searched: false },
  term: { output: '', running: false, shell: '' },
}));

export const getState = () => useApp.getState();
export const patch = (p: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => useApp.setState(p);
export const isDirty = (t: Tab) => t.content !== t.savedContent || (t.path === null && t.content.length > 0) || t.missing;
export const activeTab = (s: AppState) => s.tabs.find((t) => t.uid === s.activeUid) ?? null;
