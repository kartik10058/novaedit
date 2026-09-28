import { useEffect, useMemo, useRef, useState } from 'react';
import { getState, patch, useApp } from '../../stores/app';
import { useSettings } from '../../stores/settings';
import { commands } from '../../services/commands';
import { api } from '../../services/api';
import * as A from '../../services/actions';
import { LANGUAGES } from '../../utils/languages';
import { basename, relativeTo } from '../../utils/paths';
import type { ThemeName } from '../../types';

interface Item { key: string; label: string; hint?: string; run: () => void | Promise<void> }

const fuzzy = (q: string, text: string): number => {
  if (!q) return 1;
  const t = text.toLowerCase(); const s = q.toLowerCase();
  const idx = t.indexOf(s);
  if (idx >= 0) return 1000 - idx;
  let i = 0; for (const ch of t) if (ch === s[i]) i++;
  return i === s.length ? 1 : 0;
};

export function CommandPalette() {
  const mode = useApp((s) => s.palette);
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const [files, setFiles] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const close = () => patch({ palette: null });

  useEffect(() => {
    if (!mode) return;
    setQuery(mode === 'commands' ? '>' : ''); setSel(0);
    setTimeout(() => inputRef.current?.focus(), 0);
    const ws = getState().workspace;
    if (mode === 'files' && ws) api.listFiles(ws).then(setFiles).catch(() => setFiles([]));
  }, [mode]);

  const items = useMemo<Item[]>(() => {
    if (!mode) return [];
    const st = getState();
    const asCommands = mode === 'commands' || (mode === 'files' && query.startsWith('>'));
    const q = asCommands ? query.replace(/^>\s*/, '') : query;
    let list: Item[];
    if (asCommands) list = commands.map((c) => ({ key: c.id, label: c.title, hint: c.shortcut, run: c.run }));
    else if (mode === 'files') list = files.map((f) => ({ key: f, label: basename(f), hint: st.workspace ? relativeTo(st.workspace, f) : f, run: () => A.openFile(f) }));
    else if (mode === 'recent') list = st.recent.map((r) => ({ key: r.path, label: (r.kind === 'folder' ? '📁 ' : '📄 ') + basename(r.path), hint: r.path, run: () => A.openRecent(r) }));
    else if (mode === 'language') list = LANGUAGES.map((l) => ({ key: l.id, label: l.label, run: () => A.setLanguage(l.id) }));
    else list = (['dark', 'light', 'midnight'] as ThemeName[]).map((t) => ({ key: t, label: t[0].toUpperCase() + t.slice(1), run: () => useSettings.getState().update({ theme: t }) }));
    return list.map((i) => ({ i, score: fuzzy(q, i.label + ' ' + (i.hint ?? '')) })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 60).map((x) => x.i);
  }, [mode, query, files]);

  if (!mode) return null;
  const choose = (i?: Item) => { close(); if (i) void i.run(); };
  return (
    <div className="backdrop top" onMouseDown={close}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()}>
        <input ref={inputRef} className="palette-input" value={query} placeholder={mode === 'commands' ? 'Type a command' : mode === 'files' ? 'Search files by name (type > for commands)' : 'Type to filter'}
          onChange={(e) => { setQuery(e.target.value); setSel(0); }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close();
            else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((v) => Math.min(v + 1, items.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((v) => Math.max(v - 1, 0)); }
            else if (e.key === 'Enter') choose(items[sel]);
          }} />
        <div className="palette-list">
          {items.map((it, i) => (
            <div key={it.key} className={i === sel ? 'pal-item active' : 'pal-item'} onMouseEnter={() => setSel(i)} onClick={() => choose(it)}>
              <span className="ellipsis">{it.label}</span><span className="kbd ellipsis">{it.hint}</span>
            </div>
          ))}
          {!items.length && <div className="hint">{mode === 'files' && !getState().workspace ? 'Open a folder to use Quick Open.' : 'No results'}</div>}
        </div>
      </div>
    </div>
  );
}
