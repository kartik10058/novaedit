import { useEffect, useRef } from 'react';
import { activeTab, getState, patch, useApp } from '../../stores/app';
import type { SearchState } from '../../types';
import { api, errMsg } from '../../services/api';
import { askChoice, showError } from '../../services/dialogs';
import * as A from '../../services/actions';
import { relativeTo } from '../../utils/paths';
import { replaceAll, searchText } from '../../utils/searchCore';
import { getEditor } from '../../services/editorRef';

const set = (p: Partial<SearchState>) => patch((s) => ({ search: { ...s.search, ...p } }));
let seq = 0;

async function runSearch() {
  const my = ++seq;
  const { search, workspace } = getState();
  if (!search.query) return set({ results: [], total: 0, truncated: false, error: null, searched: false, running: false });
  set({ running: true, error: null });
  try {
    if (search.scope === 'file') {
      const t = activeTab(getState());
      const r = t ? searchText(t.path ?? t.name, t.content, search.opts, search.query) : { path: '', matches: [] };
      if (my === seq) set({ results: r.matches.length ? [r] : [], total: r.matches.length, truncated: false, running: false, searched: true });
    } else {
      if (!workspace) throw new Error('Open a folder to search the workspace.');
      const r = await api.searchText(workspace, search.query, search.opts);
      if (my === seq) set({ results: r.files, total: r.total, truncated: r.truncated, running: false, searched: true });
    }
  } catch (e) { if (my === seq) set({ error: errMsg(e), results: [], total: 0, running: false }); }
}

async function replaceEverywhere() {
  const { search, workspace } = getState();
  if (!search.query) return;
  try {
    if (search.scope === 'file') {
      const t = activeTab(getState()); const ed = getEditor(); const model = ed?.getModel();
      if (!t || !ed || !model) return;
      const r = replaceAll(t.content, search.query, search.replace, search.opts);
      if (r.count) { ed.executeEdits('nova-replace', [{ range: model.getFullModelRange(), text: r.text }]); A.setStatus(`Replaced ${r.count} occurrence(s)`); }
    } else {
      if (!workspace) throw new Error('Open a folder to replace across the workspace.');
      const c = await askChoice(`Replace ${search.total} match(es) in the workspace?`, ['Replace All', 'Cancel'], 'This modifies files on disk.');
      if (c !== 0) return;
      const r = await api.replaceText(workspace, search.query, search.replace, search.opts);
      // refresh open, unmodified tabs so they show the new content
      for (const t of getState().tabs) {
        if (!t.path || t.content !== t.savedContent) continue;
        try { const f = await api.readFile(t.path); A.updateTab(t.uid, { content: f.content, savedContent: f.content, mtimeMs: f.mtimeMs }); } catch { /* skip */ }
      }
      A.setStatus(`Replaced ${r.replacements} occurrence(s) in ${r.files} file(s)`);
    }
  } catch (e) { await showError('Unable to replace.', errMsg(e)); }
  void runSearch();
}

export function SearchPanel() {
  const s = useApp((x) => x.search);
  const workspace = useApp((x) => x.workspace);
  const activeUid = useApp((x) => x.activeUid);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; if (!s.query) return; }
    const id = setTimeout(() => void runSearch(), 300); // debounced
    return () => clearTimeout(id);
  }, [s.query, s.opts, s.scope, workspace, s.scope === 'file' ? activeUid : null]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (k: 'caseSensitive' | 'wholeWord' | 'regex') => set({ opts: { ...s.opts, [k]: !s.opts[k] } });
  const open = (path: string, line: number, col: number, length: number) => {
    if (s.scope === 'file') { const uid = getState().activeUid; if (uid) { A.activateTab(uid); patch({ reveal: { uid, line, col, length, nonce: Date.now() } }); } }
    else void A.openFile(path, { line, col, length });
  };
  return (
    <div className="search">
      <div className="pane-title"><span>SEARCH</span></div>
      <div className="search-form">
        <input className="input" placeholder="Search" value={s.query} autoFocus onChange={(e) => set({ query: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') void runSearch(); }} />
        <div className="toggles">
          <button className={s.opts.caseSensitive ? 'tgl on' : 'tgl'} title="Match Case" onClick={() => toggle('caseSensitive')}>Aa</button>
          <button className={s.opts.wholeWord ? 'tgl on' : 'tgl'} title="Whole Word" onClick={() => toggle('wholeWord')}>ab</button>
          <button className={s.opts.regex ? 'tgl on' : 'tgl'} title="Regular Expression" onClick={() => toggle('regex')}>.*</button>
          <select className="input sm" value={s.scope} onChange={(e) => set({ scope: e.target.value as 'workspace' | 'file' })}>
            <option value="workspace">Workspace</option><option value="file">Current file</option>
          </select>
        </div>
        <input className="input" placeholder="Replace" value={s.replace} onChange={(e) => set({ replace: e.target.value })} />
        <button className="btn" disabled={!s.query || !s.total} onClick={() => void replaceEverywhere()}>Replace All</button>
      </div>
      <div className="search-summary">
        {s.running ? 'Searching…' : s.error ? <span className="err">{s.error}</span> : s.searched ? `${s.total} result(s) in ${s.results.length} file(s)${s.truncated ? ' (truncated)' : ''}` : ''}
      </div>
      <div className="results">
        {s.results.map((f) => (
          <div key={f.path}>
            <div className="res-file" title={f.path}>{workspace && s.scope === 'workspace' ? relativeTo(workspace, f.path) : f.path}<span className="badge">{f.matches.length}</span></div>
            {f.matches.map((m, i) => (
              <div key={i} className="res-line" onClick={() => open(f.path, m.line, m.col, m.length)}>
                <span className="ln">Line {m.line}:</span> {m.text.trim()}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
