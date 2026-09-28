import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { getState, patch, useApp } from './stores/app';
import { useSettings } from './stores/settings';
import { api } from './services/api';
import * as A from './services/actions';
import { commandById } from './services/commands';
import { MenuBar } from './components/Common/MenuBar';
import { Explorer } from './components/Explorer/Explorer';
import { SearchPanel } from './components/Search/SearchPanel';
import { TabBar } from './components/Tabs/TabBar';
import { EditorPane } from './components/Editor/EditorPane';
import { Welcome } from './components/Common/Welcome';
import { TerminalPanel } from './components/Terminal/TerminalPanel';
import { StatusBar } from './components/StatusBar/StatusBar';
import { CommandPalette } from './components/CommandPalette/CommandPalette';
import { SettingsPage } from './components/Settings/SettingsPage';
import { DialogHost } from './components/Common/DialogHost';
import type { RecentItem } from './types';

let sessionFrozen = false; // true while the app is closing, so a half-closed tab list never overwrites the saved session
async function persistSession() {
  const s = getState();
  const active = s.tabs.find((t) => t.uid === s.activeUid)?.path ?? null;
  await api.writeStore('session', { workspace: s.workspace, files: s.tabs.map((t) => t.path).filter(Boolean), active }).catch(() => undefined);
}

export default function App() {
  const settings = useSettings((s) => s.settings);
  const loaded = useSettings((s) => s.loaded);
  const { sidebarOpen, sidebarView, sidebarWidth, panelOpen, mainView, status } = useApp(useShallow((s) => ({
    sidebarOpen: s.sidebarOpen, sidebarView: s.sidebarView, sidebarWidth: s.sidebarWidth, panelOpen: s.panelOpen, mainView: s.mainView, status: s.status,
  })));
  const hasTab = useApp((s) => s.activeUid !== null);
  const tabs = useApp((s) => s.tabs);
  const activeUid = useApp((s) => s.activeUid);

  /* ---- startup: settings, recent files, previous session ---- */
  useEffect(() => {
    void (async () => {
      await useSettings.getState().load();
      const recent = (await api.readStore('recent').catch(() => null)) as RecentItem[] | null;
      if (Array.isArray(recent)) patch({ recent: recent.filter((r) => typeof r?.path === 'string').slice(0, 15) });
      if (!useSettings.getState().settings.restoreSession) return;
      const sess = (await api.readStore('session').catch(() => null)) as { workspace?: string | null; files?: string[]; active?: string | null } | null;
      if (!sess) return;
      if (sess.workspace && (await api.stat(sess.workspace).catch(() => null))?.exists) await A.openWorkspace(sess.workspace);
      const files = Array.isArray(sess.files) ? sess.files.filter((f) => typeof f === 'string') : [];
      const ok = files.length ? await api.existsMany(files).catch(() => []) : [];
      for (let i = 0; i < files.length; i++) if (ok[i]) await A.openFile(files[i]);
      const act = getState().tabs.find((t) => t.path === sess.active);
      if (act) A.activateTab(act.uid);
    })();
  }, []);

  /* ---- theme ---- */
  useEffect(() => { document.documentElement.dataset.theme = settings.theme; }, [settings.theme]);

  /* ---- global keyboard shortcuts (capture phase so Monaco can't swallow them) ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      const map: Record<string, string> = e.shiftKey
        ? { s: 'file.saveAs', w: 'file.closeWindow', p: 'view.palette', f: 'search.global' }
        : { n: 'file.new', o: 'file.open', s: 'file.save', w: 'file.close', p: 'view.quickOpen', b: 'view.sidebar', j: 'view.panel' };
      const id = map[k];
      if (!id) return;
      e.preventDefault(); e.stopPropagation();
      void commandById(id).run();
      if (id === 'view.panel' && getState().panelOpen && !getState().term.running) void A.startTerminal();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  /* ---- IPC event subscriptions (all cleaned up on unmount) ---- */
  useEffect(() => {
    const offs = [
      api.onFileChanged((p) => void A.handleExternalChange(p)),
      api.onTermData((d) => {
        const clean = d.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '');
        patch((s) => ({ term: { ...s.term, output: (s.term.output + clean).slice(-200000) } }));
      }),
      api.onTermExit((code) => patch((s) => ({ term: { ...s.term, running: false, output: s.term.output + `\n[process exited with code ${code}]\n` } }))),
      api.onCloseRequested(async () => {
        sessionFrozen = true; await persistSession();
        if (await A.closeTabs(getState().tabs.map((t) => t.uid))) await api.confirmClose();
        else { sessionFrozen = false; void persistSession(); }
      }),
    ];
    const onErr = (e: ErrorEvent) => A.setStatus(`Error: ${e.message}`);
    const onRej = (e: PromiseRejectionEvent) => A.setStatus(`Error: ${e.reason instanceof Error ? e.reason.message : String(e.reason)}`);
    window.addEventListener('error', onErr); window.addEventListener('unhandledrejection', onRej);
    return () => { offs.forEach((off) => off()); window.removeEventListener('error', onErr); window.removeEventListener('unhandledrejection', onRej); };
  }, []);

  /* ---- persist session (debounced) ---- */
  useEffect(() => {
    if (!loaded) return;
    const id = setTimeout(() => { if (!sessionFrozen) void persistSession(); }, 600);
    return () => clearTimeout(id);
  }, [tabs.length, activeUid, loaded, useApp.getState().workspace]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- auto save ---- */
  useEffect(() => { // After Delay (debounced: the timer restarts on every keystroke)
    if (settings.autoSave !== 'afterDelay') return;
    const dirty = tabs.filter((t) => t.path && !t.missing && !t.promptOpen && t.content !== t.savedContent);
    if (!dirty.length) return;
    const id = setTimeout(() => dirty.forEach((t) => void A.saveTab(t.uid)), settings.autoSaveDelay);
    return () => clearTimeout(id);
  }, [tabs, settings.autoSave, settings.autoSaveDelay]);
  const prevActive = useRef<string | null>(null);
  useEffect(() => { // When Focus Changes: switching tabs or leaving the window
    if (settings.autoSave !== 'onFocusChange') { prevActive.current = activeUid; return; }
    const prev = getState().tabs.find((t) => t.uid === prevActive.current);
    if (prev?.path && !prev.missing && prev.content !== prev.savedContent) void A.saveTab(prev.uid);
    prevActive.current = activeUid;
  }, [activeUid, settings.autoSave]);
  useEffect(() => {
    if (settings.autoSave !== 'onFocusChange') return;
    const onBlur = () => getState().tabs.forEach((t) => { if (t.path && !t.missing && !t.promptOpen && t.content !== t.savedContent) void A.saveTab(t.uid); });
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [settings.autoSave]);

  /* ---- transient status messages fade back to "Ready" ---- */
  useEffect(() => {
    if (status === 'Ready') return;
    const id = setTimeout(() => { if (getState().status === status) patch({ status: 'Ready' }); }, 5000);
    return () => clearTimeout(id);
  }, [status]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const move = (ev: MouseEvent) => patch({ sidebarWidth: Math.max(180, Math.min(600, ev.clientX - (settings.showActivityBar ? 44 : 0))) });
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  };
  const pickView = (v: 'explorer' | 'search') => patch(sidebarOpen && sidebarView === v ? { sidebarOpen: false } : { sidebarOpen: true, sidebarView: v });

  if (!loaded) return <div className="app" />;
  const showSidebar = sidebarOpen && settings.showSidebar;
  return (
    <div className="app">
      <MenuBar />
      <div className="main">
        {settings.showActivityBar && (
          <nav className="activity">
            <button className={showSidebar && sidebarView === 'explorer' ? 'act active' : 'act'} title="Explorer" onClick={() => pickView('explorer')}>📁</button>
            <button className={showSidebar && sidebarView === 'search' ? 'act active' : 'act'} title="Search (Ctrl+Shift+F)" onClick={() => pickView('search')}>🔍</button>
            <span className="grow" />
            <button className={mainView === 'settings' ? 'act active' : 'act'} title="Settings" onClick={() => patch({ mainView: mainView === 'settings' ? 'editor' : 'settings' })}>⚙️</button>
          </nav>
        )}
        {showSidebar && (
          <>
            <aside className="sidebar" style={{ width: sidebarWidth }}>{sidebarView === 'explorer' ? <Explorer /> : <SearchPanel />}</aside>
            <div className="resizer" onMouseDown={startResize} />
          </>
        )}
        <section className="center">
          {mainView === 'settings' ? <SettingsPage /> : (
            <>
              <TabBar />
              <div className="content">{hasTab ? <EditorPane /> : <Welcome />}</div>
            </>
          )}
          {panelOpen && <div className="panel"><TerminalPanel /></div>}
        </section>
      </div>
      {settings.showStatusBar && <StatusBar />}
      <CommandPalette />
      <DialogHost />
    </div>
  );
}
