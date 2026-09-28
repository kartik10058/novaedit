import { useEffect, useRef, useState } from 'react';
import { commandById } from '../../services/commands';
import { Logo } from './Logo';

type Item = string | '-';
const MENUS: { label: string; items: Item[] }[] = [
  { label: 'File', items: ['file.new', 'file.open', 'file.openFolder', 'file.openRecent', '-', 'file.save', 'file.saveAs', 'file.saveAll', '-', 'file.close', 'file.closeAll', 'file.reopen', '-', 'file.closeWindow'] },
  { label: 'Edit', items: ['edit.undo', 'edit.redo', '-', 'edit.cut', 'edit.copy', 'edit.paste', 'edit.selectAll', '-', 'edit.find', 'edit.replace', '-', 'edit.format', 'json.format', 'json.minify', 'json.validate'] },
  { label: 'View', items: ['view.palette', 'view.quickOpen', '-', 'view.sidebar', 'view.panel', '-', 'view.wordWrap', 'view.minimap', 'view.language', 'view.theme', '-', 'view.settings'] },
  { label: 'Search', items: ['edit.find', 'edit.replace', 'search.global'] },
  { label: 'Terminal', items: ['terminal.new', 'view.terminal', 'terminal.kill'] },
  { label: 'Help', items: ['help.about', 'view.palette'] },
];

export function MenuBar() {
  const [open, setOpen] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(null); };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, []);
  return (
    <div className="menubar" ref={ref}>
      <div className="brand"><Logo size={18} /> NovaEdit</div>
      {MENUS.map((m, i) => (
        <div key={m.label} className="menu-root">
          <button className={open === i ? 'menu-btn active' : 'menu-btn'} onClick={() => setOpen(open === i ? null : i)} onMouseEnter={() => open !== null && setOpen(i)}>{m.label}</button>
          {open === i && (
            <div className="menu-drop">
              {m.items.map((id, k) => {
                if (id === '-') return <div key={k} className="menu-sep" />;
                const c = commandById(id);
                return (
                  <button key={k} className="menu-item" onClick={() => { setOpen(null); void c.run(); }}>
                    <span>{c.title}</span><span className="kbd">{c.shortcut ?? ''}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
