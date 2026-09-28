import { activeTab, getState, isDirty, patch } from '../stores/app';
import { useSettings } from '../stores/settings';
import type { DirEntry, RecentItem, Tab } from '../types';
import { detectLanguage } from '../utils/languages';
import { basename, dirname, isInside } from '../utils/paths';
import { api, errMsg } from './api';
import { askChoice, askInput, showError } from './dialogs';
import { getEditor } from './editorRef';
import { formatJson, getFormatter, minifyJson } from './formatters';

let uidCounter = 0;
let untitledCounter = 0;
const newUid = () => `t${++uidCounter}`;
const settings = () => useSettings.getState().settings;
export const setStatus = (status: string) => patch({ status });

/* ------------------------------ tabs ------------------------------ */
function upsertTab(tab: Tab) { patch((s) => ({ tabs: [...s.tabs, tab], activeUid: tab.uid, mainView: 'editor' })); }
export const updateTab = (uid: string, p: Partial<Tab>) => patch((s) => ({ tabs: s.tabs.map((t) => (t.uid === uid ? { ...t, ...p } : t)) }));
export function activateTab(uid: string) { patch({ activeUid: uid, mainView: 'editor' }); }

export function newFile() {
  untitledCounter++;
  upsertTab({ uid: newUid(), path: null, name: `Untitled-${untitledCounter}`, language: 'plaintext', content: '', savedContent: '',
    mtimeMs: 0, missing: false, pendingEol: settings().eol, mdView: 'editor' });
}

export async function openFile(path: string, at?: { line: number; col: number; length: number }) {
  const existing = getState().tabs.find((t) => t.path === path);
  if (existing) activateTab(existing.uid);
  else {
    try {
      const { content, mtimeMs } = await api.readFile(path);
      const name = basename(path);
      upsertTab({ uid: newUid(), path, name, language: detectLanguage(name), content, savedContent: content, mtimeMs, missing: false,
        mdView: name.toLowerCase().endsWith('.md') ? 'split' : 'editor' });
      api.watch(path).catch(() => undefined);
      addRecent({ path, kind: 'file' });
    } catch (e) { await showError('Unable to open file.', errMsg(e)); return; }
  }
  const uid = getState().activeUid;
  if (at && uid) patch({ reveal: { uid, ...at, nonce: Date.now() } });
}

export async function openFileDialog() {
  try { for (const p of await api.openFileDialog()) await openFile(p); } catch (e) { await showError('Unable to open file.', errMsg(e)); }
}

/* ------------------------------ save ------------------------------ */
export async function saveTab(uid: string, forceAs = false): Promise<boolean> {
  const tab = getState().tabs.find((t) => t.uid === uid);
  if (!tab) return true;
  try {
    let path = tab.path;
    if (!path || forceAs) {
      const dir = getState().workspace;
      const picked = await api.saveFileDialog(path ?? (dir ? `${dir}/${tab.name}` : tab.name));
      if (!picked) return false; // user cancelled
      path = picked;
    }
    const mtimeMs = await api.writeFile(path, tab.content);
    const name = basename(path);
    if (tab.path !== path) {
      if (tab.path) api.unwatch(tab.path).catch(() => undefined);
      api.watch(path).catch(() => undefined);
      addRecent({ path, kind: 'file' });
    }
    updateTab(uid, { path, name, mtimeMs, missing: false, savedContent: tab.content,
      language: tab.path === path ? tab.language : detectLanguage(name) });
    if (dirname(path) && getState().workspace && isInside(dirname(path), path)) void refreshDir(dirname(path));
    setStatus(`Saved ${name}`);
    return true;
  } catch (e) {
    await showError('Unable to save file.', `${errMsg(e)}\n\nThe file may have been moved or deleted.`);
    return false;
  }
}
export async function saveActive(forceAs = false) { const t = activeTab(getState()); if (t) await saveTab(t.uid, forceAs); }
export async function saveAll() {
  for (const t of getState().tabs) if (isDirty(t) && (t.path || t.content)) if (!(await saveTab(t.uid))) return;
}

/* ------------------------------ close ------------------------------ */
/** Resolves true if the tab may close (saved / discarded), false if the user cancelled. */
async function confirmTab(tab: Tab): Promise<boolean> {
  if (!isDirty(tab) || (tab.path === null && tab.content === '')) return true;
  const c = await askChoice(`Save changes to ${tab.name}?`, ['Save', "Don't Save", 'Cancel'], 'Your changes will be lost if you don\'t save them.');
  if (c === 0) return saveTab(tab.uid);
  return c === 1;
}
export async function closeTabs(uids: string[]): Promise<boolean> {
  for (const uid of uids) {
    const tab = getState().tabs.find((t) => t.uid === uid);
    if (!tab) continue;
    if (!(await confirmTab(tab))) return false;
    if (tab.path) { api.unwatch(tab.path).catch(() => undefined); patch((s) => ({ closedPaths: [tab.path as string, ...s.closedPaths].slice(0, 20) })); }
    patch((s) => {
      const idx = s.tabs.findIndex((t) => t.uid === uid);
      const tabs = s.tabs.filter((t) => t.uid !== uid);
      const activeUid = s.activeUid === uid ? tabs[Math.min(idx, tabs.length - 1)]?.uid ?? null : s.activeUid;
      return { tabs, activeUid };
    });
  }
  return true;
}
export const closeTab = (uid: string) => closeTabs([uid]);
export const closeOthers = (uid: string) => closeTabs(getState().tabs.filter((t) => t.uid !== uid).map((t) => t.uid));
export function closeToRight(uid: string) {
  const tabs = getState().tabs; const i = tabs.findIndex((t) => t.uid === uid);
  return closeTabs(tabs.slice(i + 1).map((t) => t.uid));
}
export const closeAll = () => closeTabs(getState().tabs.map((t) => t.uid));
export async function reopenClosed() {
  const [p, ...rest] = getState().closedPaths;
  if (!p) return setStatus('No recently closed tabs');
  patch({ closedPaths: rest });
  await openFile(p);
}
export function reorderTabs(from: string, to: string) {
  patch((s) => {
    const tabs = [...s.tabs]; const a = tabs.findIndex((t) => t.uid === from); const b = tabs.findIndex((t) => t.uid === to);
    if (a < 0 || b < 0 || a === b) return {};
    const [moved] = tabs.splice(a, 1); tabs.splice(b, 0, moved);
    return { tabs };
  });
}

/* ------------------------------ recent ------------------------------ */
export function addRecent(item: RecentItem) {
  const recent = [item, ...getState().recent.filter((r) => r.path !== item.path)].slice(0, 15);
  patch({ recent }); api.writeStore('recent', recent).catch(() => undefined);
}
export function removeRecent(path: string) {
  const recent = getState().recent.filter((r) => r.path !== path);
  patch({ recent }); api.writeStore('recent', recent).catch(() => undefined);
}

/* ------------------------------ workspace / explorer ------------------------------ */
export async function refreshDir(dir: string) {
  try { const entries = await api.readDir(dir); patch((s) => ({ children: { ...s.children, [dir]: entries } })); }
  catch (e) { setStatus(`Cannot read folder: ${errMsg(e)}`); }
}
export async function refreshTree() {
  const s = getState();
  if (!s.workspace) return;
  const dirs = [s.workspace, ...Object.keys(s.expanded).filter((d) => s.expanded[d])];
  await Promise.all(dirs.map(refreshDir));
  setStatus('Explorer refreshed');
}
export async function toggleDir(dir: string) {
  const open = !getState().expanded[dir];
  patch((s) => ({ expanded: { ...s.expanded, [dir]: open } }));
  if (open && !getState().children[dir]) await refreshDir(dir);
}
export async function openWorkspace(path: string) {
  if (getState().tabs.length && !(await closeAll())) return; // unsaved changes prompt; cancel aborts
  patch({ workspace: path, children: {}, expanded: {}, sidebarOpen: true, sidebarView: 'explorer' });
  await refreshDir(path);
  addRecent({ path, kind: 'folder' });
  useSettings.getState().update({ showSidebar: true });
}
export async function openFolderDialog() {
  try { const p = await api.openFolderDialog(); if (p) await openWorkspace(p); } catch (e) { await showError('Unable to open folder.', errMsg(e)); }
}
export async function openRecent(item: RecentItem) {
  const st = await api.stat(item.path).catch(() => null);
  if (!st?.exists) { await showError('Unavailable', `${item.path} no longer exists.`); return; }
  if (item.kind === 'folder') await openWorkspace(item.path); else await openFile(item.path);
}

async function run(title: string, fn: () => Promise<void>) { try { await fn(); } catch (e) { await showError(title, errMsg(e)); } }

export const createFileIn = (dir: string) => run('Unable to create file.', async () => {
  const name = await askInput('New file name', '', 'example.txt'); if (!name) return;
  const p = await api.joinPath(dir, name); await api.createFile(p);
  await refreshDir(dir); patch((s) => ({ expanded: { ...s.expanded, [dir]: true } })); await openFile(p);
});
export const createFolderIn = (dir: string) => run('Unable to create folder.', async () => {
  const name = await askInput('New folder name', '', 'folder'); if (!name) return;
  await api.createFolder(await api.joinPath(dir, name));
  await refreshDir(dir); patch((s) => ({ expanded: { ...s.expanded, [dir]: true } }));
});
export const renameEntry = (e: DirEntry) => run('Unable to rename.', async () => {
  const name = await askInput('Rename', e.name); if (!name || name === e.name) return;
  const dest = await api.joinPath(dirname(e.path), name);
  await api.rename(e.path, dest);
  // keep open tabs pointing at the moved files
  for (const t of getState().tabs) if (t.path && isInside(e.path, t.path)) {
    const np = dest + t.path.slice(e.path.length);
    api.unwatch(t.path).catch(() => undefined); api.watch(np).catch(() => undefined);
    updateTab(t.uid, { path: np, name: basename(np), language: detectLanguage(basename(np)) });
  }
  patch((s) => ({ expanded: Object.fromEntries(Object.entries(s.expanded).filter(([k]) => !isInside(e.path, k))) }));
  await refreshDir(dirname(e.path));
});
export const deleteEntry = (e: DirEntry) => run('Unable to delete.', async () => {
  if (useSettings.getState().settings.confirmDelete) {
    const c = await askChoice(`Delete ${e.name}?`, ['Move to Trash', 'Cancel'], 'It will be moved to the Recycle Bin / Trash.');
    if (c !== 0) return;
  }
  await api.remove(e.path);
  for (const t of getState().tabs) if (t.path && isInside(e.path, t.path)) updateTab(t.uid, { missing: true });
  await refreshDir(dirname(e.path));
});
export const duplicateEntry = (e: DirEntry) => run('Unable to duplicate.', async () => {
  await api.duplicate(e.path); await refreshDir(dirname(e.path));
});

/* ------------------------------ external changes ------------------------------ */
export async function handleExternalChange(path: string) {
  const tab = getState().tabs.find((t) => t.path === path);
  if (!tab || tab.promptOpen) return;
  const st = await api.stat(path).catch(() => null);
  if (!st) return;
  if (!st.exists) { updateTab(tab.uid, { missing: true }); setStatus(`${tab.name} was deleted or moved`); return; }
  if (st.mtimeMs === tab.mtimeMs && !tab.missing) return; // our own save
  updateTab(tab.uid, { promptOpen: true });
  const c = await askChoice('This file has changed outside NovaEdit.', ['Reload', 'Keep Current'], `${tab.name}`);
  if (c === 0) {
    try { const r = await api.readFile(path); updateTab(tab.uid, { content: r.content, savedContent: r.content, mtimeMs: r.mtimeMs, missing: false, promptOpen: false }); return; }
    catch (e) { await showError('Unable to reload file.', errMsg(e)); }
  }
  updateTab(tab.uid, { mtimeMs: st.mtimeMs, promptOpen: false }); // keep current; don't re-prompt for this version
}

/* ------------------------------ editor commands ------------------------------ */
export function runEditorAction(id: string) {
  const ed = getEditor(); if (!ed) return;
  ed.focus(); ed.getAction(id)?.run();
}
export function clipboard(cmd: 'cut' | 'copy' | 'paste') {
  const ed = getEditor(); if (!ed) return; ed.focus();
  if (cmd === 'paste') navigator.clipboard.readText().then((t) => ed.trigger('menu', 'type', { text: t })).catch(() => undefined);
  else document.execCommand(cmd);
}
export function setLanguage(language: string) {
  const t = activeTab(getState()); if (t) updateTab(t.uid, { language });
}
export function replaceAllText(text: string) {
  const ed = getEditor(); const model = ed?.getModel(); if (!ed || !model) return;
  ed.executeEdits('nova', [{ range: model.getFullModelRange(), text }]); // keeps undo history
}
export async function formatDocument() {
  const t = activeTab(getState()); const ed = getEditor(); if (!t || !ed) return;
  const model = ed.getModel(); if (!model) return;
  const opts = { tabSize: model.getOptions().tabSize, insertSpaces: model.getOptions().insertSpaces };
  const f = getFormatter(t.language);
  if (f) {
    try { replaceAllText(await f.format(t.content, opts)); setStatus('Document formatted'); }
    catch (e) { await showError('Unable to format document.', errMsg(e)); }
  } else {
    const action = ed.getAction('editor.action.formatDocument');
    if (action && action.isSupported()) { await action.run(); setStatus('Document formatted'); }
    else setStatus(`No formatter available for ${t.language}`);
  }
}
async function jsonTool(kind: 'format' | 'minify' | 'validate') {
  const t = activeTab(getState()); if (!t) return;
  if (t.language !== 'json') { setStatus('JSON tools work on JSON files'); return; }
  try {
    if (kind === 'validate') { JSON.parse(t.content); setStatus('Valid JSON ✓'); return; }
    const tabSize = getEditor()?.getModel()?.getOptions().tabSize ?? 2;
    replaceAllText(kind === 'format' ? formatJson(t.content, { tabSize, insertSpaces: true }) : minifyJson(t.content));
    setStatus(kind === 'format' ? 'JSON formatted' : 'JSON minified');
  } catch (e) { await showError('Invalid JSON', errMsg(e)); }
}
export const formatJsonDoc = () => jsonTool('format');
export const minifyJsonDoc = () => jsonTool('minify');
export const validateJsonDoc = () => jsonTool('validate');

/* ------------------------------ terminal ------------------------------ */
export async function startTerminal() {
  try {
    const r = await api.termStart(getState().workspace, settings().shell);
    patch((s) => ({ term: { output: `Shell: ${r.shell}\nDirectory: ${r.cwd}\n`, running: true, shell: r.shell }, panelOpen: s.panelOpen }));
  } catch (e) { await showError('Unable to start terminal.', errMsg(e)); }
}
export async function toggleTerminal() {
  const s = getState();
  if (s.panelOpen) return patch({ panelOpen: false });
  patch({ panelOpen: true });
  if (!s.term.running) await startTerminal();
}
export function newTerminal() { patch({ panelOpen: true }); return startTerminal(); }
export async function killTerminal() { await api.termKill().catch(() => undefined); patch((s) => ({ term: { ...s.term, running: false } })); }
