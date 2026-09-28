import { useEffect, useMemo, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { activeTab, getState, patch, useApp } from '../../stores/app';
import { useSettings } from '../../stores/settings';
import { setEditor, getEditor } from '../../services/editorRef';
import { updateTab } from '../../services/actions';
import { MarkdownPreview } from './MarkdownPreview';
import type { MdView } from '../../types';

function syncCursor() {
  const ed = getEditor(); const pos = ed?.getPosition(); const model = ed?.getModel();
  if (!ed || !pos || !model) return;
  const o = model.getOptions();
  const next = { line: pos.lineNumber, col: pos.column, eol: (model.getEOL() === '\r\n' ? 'CRLF' : 'LF') as 'LF' | 'CRLF', tabSize: o.tabSize, insertSpaces: o.insertSpaces };
  const c = getState().cursor;
  if (c.line !== next.line || c.col !== next.col || c.eol !== next.eol || c.tabSize !== next.tabSize || c.insertSpaces !== next.insertSpaces) patch({ cursor: next });
}

export function EditorPane() {
  const tab = useApp(activeTab);
  const reveal = useApp((s) => s.reveal);
  const s = useSettings((x) => x.settings);
  const [ready, setReady] = useState(false);

  const options = useMemo<Monaco.editor.IStandaloneEditorConstructionOptions>(() => ({
    fontSize: s.fontSize, fontFamily: s.fontFamily, tabSize: s.tabSize, insertSpaces: s.insertSpaces,
    wordWrap: s.wordWrap ? 'on' : 'off', minimap: { enabled: s.minimap }, lineNumbers: s.lineNumbers ? 'on' : 'off',
    bracketPairColorization: { enabled: s.bracketPairColorization }, smoothScrolling: s.smoothScrolling,
    cursorSmoothCaretAnimation: s.smoothScrolling ? 'on' : 'off',
    renderLineHighlight: 'all', folding: true, matchBrackets: 'always', autoClosingBrackets: 'always', autoIndent: 'full',
    multiCursorModifier: 'alt', automaticLayout: true, scrollBeyondLastLine: false, mouseWheelZoom: true,
  }), [s.fontSize, s.fontFamily, s.tabSize, s.insertSpaces, s.wordWrap, s.minimap, s.lineNumbers, s.bracketPairColorization, s.smoothScrolling]);

  const onMount: OnMount = (editor) => {
    setEditor(editor);
    editor.onDidChangeCursorPosition(syncCursor);
    editor.onDidChangeModel(syncCursor);
    editor.onDidChangeModelOptions(syncCursor);
    setReady(true);
    syncCursor();
  };
  useEffect(() => () => { setEditor(null); }, []);

  // New files adopt the default line ending; then sync status bar + focus on tab switch.
  useEffect(() => {
    if (!ready || !tab) return;
    const model = getEditor()?.getModel();
    if (tab.pendingEol && model) { model.setEOL(tab.pendingEol === 'CRLF' ? 1 : 0); updateTab(tab.uid, { pendingEol: undefined }); }
    syncCursor(); getEditor()?.focus();
  }, [ready, tab?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Jump to a search result / line.
  useEffect(() => {
    if (!ready || !reveal || !tab || reveal.uid !== tab.uid) return;
    const raf = requestAnimationFrame(() => {
      const ed = getEditor(); if (!ed) return;
      const range = { startLineNumber: reveal.line, startColumn: reveal.col, endLineNumber: reveal.line, endColumn: reveal.col + reveal.length };
      ed.setSelection(range); ed.revealRangeInCenter(range); ed.focus();
      patch({ reveal: null });
    });
    return () => cancelAnimationFrame(raf);
  }, [ready, reveal, tab?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!tab) return null;
  const isMd = tab.language === 'markdown';
  const view: MdView = isMd ? tab.mdView : 'editor';
  const setView = (v: MdView) => updateTab(tab.uid, { mdView: v });
  return (
    <div className="editor-wrap">
      {isMd && (
        <div className="md-toolbar">
          {(['editor', 'split', 'preview'] as MdView[]).map((v) => (
            <button key={v} className={view === v ? 'seg active' : 'seg'} onClick={() => setView(v)}>{v === 'editor' ? 'Editor' : v === 'split' ? 'Editor | Preview' : 'Preview'}</button>
          ))}
        </div>
      )}
      {tab.missing && <div className="banner">This file no longer exists on disk. Save to recreate it.</div>}
      <div className="editor-split">
        <div className="editor-host" style={{ display: view === 'preview' ? 'none' : 'block' }}>
          <Editor height="100%" theme={`nova-${s.theme}`} path={`inmemory://nova/${tab.uid}`} language={tab.language} value={tab.content}
            options={options} onMount={onMount} onChange={(v) => updateTab(tab.uid, { content: v ?? '' })} loading={<div className="hint">Loading editor…</div>} />
        </div>
        {view !== 'editor' && <div className="preview-host"><MarkdownPreview source={tab.content} /></div>}
      </div>
    </div>
  );
}
