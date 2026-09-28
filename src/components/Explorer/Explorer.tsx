import { memo, useEffect, useState } from 'react';
import { activeTab, useApp } from '../../stores/app';
import type { DirEntry } from '../../types';
import * as A from '../../services/actions';
import { basename } from '../../utils/paths';

interface Menu { x: number; y: number; entry: DirEntry | null }

const TreeNode = memo(function TreeNode({ entry, depth, onMenu }: { entry: DirEntry; depth: number; onMenu: (e: React.MouseEvent, en: DirEntry) => void }) {
  const open = useApp((s) => !!s.expanded[entry.path]);
  const kids = useApp((s) => s.children[entry.path]);
  const active = useApp((s) => activeTab(s)?.path === entry.path);
  return (
    <>
      <div className={active ? 'row active' : 'row'} style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => (entry.isDir ? void A.toggleDir(entry.path) : void A.openFile(entry.path))}
        onContextMenu={(e) => onMenu(e, entry)} title={entry.path}>
        <span className="twisty">{entry.isDir ? (open ? '▾' : '▸') : ''}</span>
        <span className="ficon">{entry.isDir ? '📁' : '📄'}</span>
        <span className="label">{entry.name}</span>
      </div>
      {entry.isDir && open && kids?.map((k) => <TreeNode key={k.path} entry={k} depth={depth + 1} onMenu={onMenu} />)}
    </>
  );
});

export function Explorer() {
  const workspace = useApp((s) => s.workspace);
  const roots = useApp((s) => (s.workspace ? s.children[s.workspace] : undefined));
  const [menu, setMenu] = useState<Menu | null>(null);
  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, []);

  if (!workspace) {
    return (
      <div className="pane-empty">
        <p>You have not opened a folder yet.</p>
        <button className="btn primary" onClick={() => void A.openFolderDialog()}>Open Folder</button>
      </div>
    );
  }
  const onMenu = (e: React.MouseEvent, entry: DirEntry | null) => { e.preventDefault(); e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY, entry }); };
  const target = menu?.entry ? (menu.entry.isDir ? menu.entry.path : menu.entry.path.replace(/[\\/][^\\/]*$/, '')) : workspace;
  return (
    <div className="explorer" onContextMenu={(e) => onMenu(e, null)}>
      <div className="pane-title">
        <span className="ellipsis" title={workspace}>{basename(workspace).toUpperCase()}</span>
        <span className="pane-actions">
          <button title="New File" onClick={() => void A.createFileIn(workspace)}>＋📄</button>
          <button title="New Folder" onClick={() => void A.createFolderIn(workspace)}>＋📁</button>
          <button title="Refresh" onClick={() => void A.refreshTree()}>⟳</button>
        </span>
      </div>
      <div className="tree">
        {roots?.map((e) => <TreeNode key={e.path} entry={e} depth={0} onMenu={onMenu} />)}
        {roots?.length === 0 && <div className="hint">This folder is empty.</div>}
      </div>
      {menu && (
        <div className="ctx" style={{ left: menu.x, top: menu.y }} onMouseDown={(e) => e.stopPropagation()}>
          <button onClick={() => { setMenu(null); void A.createFileIn(target); }}>New File</button>
          <button onClick={() => { setMenu(null); void A.createFolderIn(target); }}>New Folder</button>
          {menu.entry && <>
            <div className="menu-sep" />
            <button onClick={() => { const en = menu.entry as DirEntry; setMenu(null); void A.renameEntry(en); }}>Rename</button>
            {!menu.entry.isDir && <button onClick={() => { const en = menu.entry as DirEntry; setMenu(null); void A.duplicateEntry(en); }}>Duplicate</button>}
            <button onClick={() => { const en = menu.entry as DirEntry; setMenu(null); void A.deleteEntry(en); }}>Delete</button>
          </>}
          <div className="menu-sep" />
          <button onClick={() => { setMenu(null); void A.refreshTree(); }}>Refresh</button>
        </div>
      )}
    </div>
  );
}
