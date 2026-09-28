import { activeTab, patch, useApp } from '../../stores/app';
import { getEditor } from '../../services/editorRef';
import { languageLabel } from '../../utils/languages';

export function StatusBar() {
  const tab = useApp(activeTab);
  const c = useApp((s) => s.cursor);
  const status = useApp((s) => s.status);
  const toggleEol = () => { const m = getEditor()?.getModel(); if (m) { m.setEOL(m.getEOL() === '\r\n' ? 0 : 1); } };
  return (
    <div className="statusbar">
      <div className="sb-left">
        {tab ? <>
          <span>Ln {c.line}, Col {c.col}</span>
          <span>{c.insertSpaces ? 'Spaces' : 'Tab Size'}: {c.tabSize}</span>
          <span>UTF-8</span>
          <button onClick={toggleEol} title="Toggle line ending">{c.eol}</button>
          <button onClick={() => patch({ palette: 'language' })} title="Change language mode">{languageLabel(tab.language)}</button>
        </> : <span>NovaEdit</span>}
      </div>
      <div className="sb-right">{status}</div>
    </div>
  );
}
