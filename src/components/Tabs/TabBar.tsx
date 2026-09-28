import { memo, useEffect, useState } from 'react';
import { isDirty, useApp } from '../../stores/app';
import type { Tab } from '../../types';
import * as A from '../../services/actions';

const TabItem = memo(function TabItem({ tab, active, onMenu, dragOver, setDragOver }: {
  tab: Tab; active: boolean; onMenu: (e: React.MouseEvent, uid: string) => void; dragOver: string | null; setDragOver: (u: string | null) => void;
}) {
  const dirty = isDirty(tab) && !(tab.path === null && tab.content === '');
  return (
    <div className={`tab${active ? ' active' : ''}${dragOver === tab.uid ? ' dragover' : ''}${tab.missing ? ' missing' : ''}`}
      draggable title={tab.path ?? tab.name}
      onClick={() => A.activateTab(tab.uid)}
      onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); void A.closeTab(tab.uid); } }}
      onContextMenu={(e) => onMenu(e, tab.uid)}
      onDragStart={(e) => { e.dataTransfer.setData('text/nova-tab', tab.uid); e.dataTransfer.effectAllowed = 'move'; }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(tab.uid); }}
      onDragLeave={() => setDragOver(null)}
      onDrop={(e) => { e.preventDefault(); setDragOver(null); A.reorderTabs(e.dataTransfer.getData('text/nova-tab'), tab.uid); }}>
      <span className="tab-name">{tab.name}</span>
      <button className={dirty ? 'tab-close dirty' : 'tab-close'} aria-label="Close tab" onClick={(e) => { e.stopPropagation(); void A.closeTab(tab.uid); }}>
        <span className="dot">●</span><span className="x">×</span>
      </button>
    </div>
  );
});

export function TabBar() {
  const tabs = useApp((s) => s.tabs);
  const activeUid = useApp((s) => s.activeUid);
  const [menu, setMenu] = useState<{ x: number; y: number; uid: string } | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, []);
  if (!tabs.length) return null;
  return (
    <div className="tabbar">
      {tabs.map((t) => (
        <TabItem key={t.uid} tab={t} active={t.uid === activeUid} dragOver={dragOver} setDragOver={setDragOver}
          onMenu={(e, uid) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, uid }); }} />
      ))}
      {menu && (
        <div className="ctx" style={{ left: menu.x, top: menu.y }} onMouseDown={(e) => e.stopPropagation()}>
          <button onClick={() => { setMenu(null); void A.closeTab(menu.uid); }}>Close</button>
          <button onClick={() => { setMenu(null); void A.closeOthers(menu.uid); }}>Close Others</button>
          <button onClick={() => { setMenu(null); void A.closeToRight(menu.uid); }}>Close to the Right</button>
          <button onClick={() => { setMenu(null); void A.closeAll(); }}>Close All</button>
          <div className="menu-sep" />
          <button onClick={() => { setMenu(null); void A.reopenClosed(); }}>Reopen Closed Tab</button>
        </div>
      )}
    </div>
  );
}
