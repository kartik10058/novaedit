import { create } from 'zustand';
import type { Settings } from '../types';
import { api } from '../services/api';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark', fontSize: 14, fontFamily: "Consolas, 'Cascadia Code', 'Courier New', monospace", tabSize: 4, insertSpaces: true,
  wordWrap: false, minimap: true, lineNumbers: true, bracketPairColorization: true, smoothScrolling: true,
  autoSave: 'off', autoSaveDelay: 1000, showSidebar: true, showStatusBar: true, showActivityBar: true,
  restoreSession: true, confirmDelete: true, encoding: 'utf8', eol: 'LF', shell: '',
};

interface SettingsStore { settings: Settings; loaded: boolean; load(): Promise<void>; update(patch: Partial<Settings>): void }
let timer: ReturnType<typeof setTimeout> | undefined;

export const useSettings = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  async load() {
    try {
      const saved = (await api.readStore('settings')) as Partial<Settings> | null;
      set({ settings: { ...DEFAULT_SETTINGS, ...(saved ?? {}) }, loaded: true });
    } catch { set({ loaded: true }); }
  },
  update(patch) {
    set({ settings: { ...get().settings, ...patch } });
    clearTimeout(timer); // debounce disk writes
    timer = setTimeout(() => { api.writeStore('settings', get().settings).catch(() => undefined); }, 300);
  },
}));
