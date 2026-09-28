import { useEffect, useRef, useState } from 'react';
import { patch, useApp } from '../../stores/app';

/** Renders whichever modal dialog (input / choice / error) is currently requested via services/dialogs.ts. */
export function DialogHost() {
  const dialog = useApp((s) => s.dialog);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (dialog?.kind === 'input') { setValue(dialog.value); setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 0); }
  }, [dialog]);
  if (!dialog) return null;
  const close = () => patch({ dialog: null });
  const finish = () => {
    if (dialog.kind === 'input') dialog.resolve(null); else if (dialog.kind === 'choice') dialog.resolve(-1); else dialog.resolve();
    close();
  };
  return (
    <div className="backdrop" onMouseDown={finish}>
      <div className="dialog" role="dialog" aria-modal onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); finish(); } }}>
        {dialog.kind === 'input' && (
          <>
            <div className="dialog-title">{dialog.title}</div>
            <input ref={inputRef} className="input" value={value} placeholder={dialog.placeholder} onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { dialog.resolve(value.trim() || null); close(); } }} />
            <div className="dialog-actions">
              <button className="btn" onClick={finish}>Cancel</button>
              <button className="btn primary" onClick={() => { dialog.resolve(value.trim() || null); close(); }}>OK</button>
            </div>
          </>
        )}
        {dialog.kind === 'choice' && (
          <>
            <div className="dialog-title">{dialog.title}</div>
            {dialog.detail && <div className="dialog-body">{dialog.detail}</div>}
            <div className="dialog-actions">
              {dialog.buttons.map((b, i) => (
                <button key={b} autoFocus={i === 0} className={i === 0 ? 'btn primary' : 'btn'} onClick={() => { dialog.resolve(i); close(); }}>{b}</button>
              ))}
            </div>
          </>
        )}
        {dialog.kind === 'error' && (
          <>
            <div className="dialog-title">{dialog.title}</div>
            <div className="dialog-body"><b>Reason:</b><br />{dialog.reason}</div>
            <div className="dialog-actions"><button autoFocus className="btn primary" onClick={finish}>OK</button></div>
          </>
        )}
      </div>
    </div>
  );
}
