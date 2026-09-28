import { getState, patch } from '../stores/app';
import { useSettings } from '../stores/settings';
import type { ThemeName } from '../types';
import * as A from './actions';
import { getEditor } from './editorRef';
import { api } from './api';
import { showError } from './dialogs';

export interface Command { id: string; title: string; shortcut?: string; run: () => void | Promise<void> }
const S = () => useSettings.getState();
const toggleSidebar = () => patch((s) => ({ sidebarOpen: !s.sidebarOpen }));
export const openSearchPanel = () => patch({ sidebarOpen: true, sidebarView: 'search' });
export const openPalette = (mode: 'commands' | 'files' | 'recent' | 'language' | 'theme' = 'commands') => patch({ palette: mode });
const setTheme = (theme: ThemeName) => S().update({ theme });
const closeActive = () => { const u = getState().activeUid; if (u) void A.closeTab(u); };

export const commands: Command[] = [
  { id: 'file.new', title: 'New File', shortcut: 'Ctrl+N', run: A.newFile },
  { id: 'file.open', title: 'Open File', shortcut: 'Ctrl+O', run: A.openFileDialog },
  { id: 'file.openFolder', title: 'Open Folder', run: A.openFolderDialog },
  { id: 'file.openRecent', title: 'Open Recent…', run: () => openPalette('recent') },
  { id: 'file.save', title: 'Save File', shortcut: 'Ctrl+S', run: () => A.saveActive(false) },
  { id: 'file.saveAs', title: 'Save File As…', shortcut: 'Ctrl+Shift+S', run: () => A.saveActive(true) },
  { id: 'file.saveAll', title: 'Save All', run: A.saveAll },
  { id: 'file.close', title: 'Close Tab', shortcut: 'Ctrl+W', run: closeActive },
  { id: 'file.closeAll', title: 'Close All Tabs', run: () => void A.closeAll() },
  { id: 'file.reopen', title: 'Reopen Closed Tab', run: A.reopenClosed },
  { id: 'file.closeWindow', title: 'Close Window', shortcut: 'Ctrl+Shift+W', run: () => void api.closeWindow() },
  { id: 'edit.undo', title: 'Undo', shortcut: 'Ctrl+Z', run: () => A.runEditorAction('undo') },
  { id: 'edit.redo', title: 'Redo', shortcut: 'Ctrl+Y', run: () => A.runEditorAction('redo') },
  { id: 'edit.cut', title: 'Cut', shortcut: 'Ctrl+X', run: () => A.clipboard('cut') },
  { id: 'edit.copy', title: 'Copy', shortcut: 'Ctrl+C', run: () => A.clipboard('copy') },
  { id: 'edit.paste', title: 'Paste', shortcut: 'Ctrl+V', run: () => A.clipboard('paste') },
  { id: 'edit.selectAll', title: 'Select All', shortcut: 'Ctrl+A', run: () => { getEditor()?.focus(); A.runEditorAction('editor.action.selectAll'); } },
  { id: 'edit.find', title: 'Find', shortcut: 'Ctrl+F', run: () => A.runEditorAction('actions.find') },
  { id: 'edit.replace', title: 'Replace', shortcut: 'Ctrl+H', run: () => A.runEditorAction('editor.action.startFindReplace') },
  { id: 'edit.findInSelection', title: 'Find in Selection', run: () => A.runEditorAction('actions.find') },
  { id: 'edit.format', title: 'Format Document', run: A.formatDocument },
  { id: 'search.global', title: 'Search in Files', shortcut: 'Ctrl+Shift+F', run: openSearchPanel },
  { id: 'view.sidebar', title: 'Toggle Sidebar', shortcut: 'Ctrl+B', run: toggleSidebar },
  { id: 'view.panel', title: 'Toggle Bottom Panel', shortcut: 'Ctrl+J', run: () => patch((s) => ({ panelOpen: !s.panelOpen })) },
  { id: 'view.terminal', title: 'Toggle Terminal', run: A.toggleTerminal },
  { id: 'terminal.new', title: 'New Terminal', run: A.newTerminal },
  { id: 'terminal.kill', title: 'Kill Terminal', run: A.killTerminal },
  { id: 'view.quickOpen', title: 'Quick Open File…', shortcut: 'Ctrl+P', run: () => openPalette('files') },
  { id: 'view.palette', title: 'Show Command Palette', shortcut: 'Ctrl+Shift+P', run: () => openPalette('commands') },
  { id: 'view.theme', title: 'Change Theme', run: () => openPalette('theme') },
  { id: 'view.theme.dark', title: 'Theme: Dark', run: () => setTheme('dark') },
  { id: 'view.theme.light', title: 'Theme: Light', run: () => setTheme('light') },
  { id: 'view.theme.midnight', title: 'Theme: Midnight', run: () => setTheme('midnight') },
  { id: 'view.wordWrap', title: 'Toggle Word Wrap', run: () => S().update({ wordWrap: !S().settings.wordWrap }) },
  { id: 'view.minimap', title: 'Toggle Minimap', run: () => S().update({ minimap: !S().settings.minimap }) },
  { id: 'view.language', title: 'Change Language Mode', run: () => openPalette('language') },
  { id: 'view.settings', title: 'Open Settings', run: () => patch({ mainView: 'settings' }) },
  { id: 'json.format', title: 'Format JSON', run: A.formatJsonDoc },
  { id: 'json.minify', title: 'Minify JSON', run: A.minifyJsonDoc },
  { id: 'json.validate', title: 'Validate JSON', run: A.validateJsonDoc },
  { id: 'help.about', title: 'About NovaEdit', run: async () => { await showError('NovaEdit', `Version ${await api.appVersion()}\nYour code. Your workspace.`); } },
];
export const commandById = (id: string) => commands.find((c) => c.id === id) as Command;
