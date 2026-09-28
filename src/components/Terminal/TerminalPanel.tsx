import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../stores/app';
import { api, errMsg } from '../../services/api';
import * as A from '../../services/actions';
import { patch } from '../../stores/app';

export function TerminalPanel() {
  const { output, running } = useApp((s) => s.term);
  const [line, setLine] = useState('');
  const history = useRef<string[]>([]);
  const hIdx = useRef(-1);
  const box = useRef<HTMLPreElement>(null);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [output]);

  const submit = async () => {
    const text = line; setLine(''); hIdx.current = -1;
    if (text.trim()) history.current.unshift(text);
    patch((s) => ({ term: { ...s.term, output: s.term.output + text + '\n' } })); // echo (shell has no tty)
    try { await api.termInput(text); } catch (e) { patch((s) => ({ term: { ...s.term, output: s.term.output + `[${errMsg(e)}]\n` } })); }
  };
  return (
    <div className="terminal" onClick={() => (document.getElementById('term-input') as HTMLInputElement | null)?.focus()}>
      <div className="pane-title">
        <span>TERMINAL</span>
        <span className="pane-actions">
          <button onClick={() => void A.newTerminal()} title="Restart">↻ Restart</button>
          <button onClick={() => void A.killTerminal()} title="Kill">■ Kill</button>
          <button onClick={() => patch((s) => ({ term: { ...s.term, output: '' } }))} title="Clear">Clear</button>
          <button onClick={() => patch({ panelOpen: false })} title="Close panel">×</button>
        </span>
      </div>
      <pre ref={box} className="term-out">{output}</pre>
      <div className="term-in">
        <span>{running ? '›' : '■'}</span>
        <input id="term-input" spellCheck={false} autoComplete="off" disabled={!running} value={line} placeholder={running ? 'Type a command and press Enter' : 'Terminal is not running'}
          onChange={(e) => setLine(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
            else if (e.key === 'ArrowUp') { e.preventDefault(); hIdx.current = Math.min(hIdx.current + 1, history.current.length - 1); setLine(history.current[hIdx.current] ?? ''); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); hIdx.current = Math.max(hIdx.current - 1, -1); setLine(history.current[hIdx.current] ?? ''); }
          }} />
      </div>
    </div>
  );
}
