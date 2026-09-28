import { useEffect, useState } from 'react';
import { useApp } from '../../stores/app';
import * as A from '../../services/actions';
import { api } from '../../services/api';
import { basename } from '../../utils/paths';
import { Logo } from './Logo';

export function Welcome() {
  const recent = useApp((s) => s.recent);
  const [avail, setAvail] = useState<boolean[]>([]);
  useEffect(() => { if (recent.length) api.existsMany(recent.map((r) => r.path)).then(setAvail).catch(() => setAvail([])); }, [recent]);
  return (
    <div className="welcome">
      <Logo size={84} />
      <h1>NovaEdit</h1>
      <p className="tag">Your code. Your workspace.</p>
      <div className="w-actions">
        <button className="btn primary" onClick={A.newFile}>New File</button>
        <button className="btn" onClick={() => void A.openFileDialog()}>Open File</button>
        <button className="btn" onClick={() => void A.openFolderDialog()}>Open Folder</button>
      </div>
      {recent.length > 0 && (
        <div className="w-recent">
          <h4>Recent</h4>
          {recent.map((r, i) => {
            const ok = avail[i] !== false;
            return (
              <div key={r.path} className={ok ? 'w-item' : 'w-item gone'}>
                <button className="link" title={r.path} onClick={() => void A.openRecent(r)} disabled={!ok}>{r.kind === 'folder' ? '📁' : '📄'} {basename(r.path)}</button>
                {!ok && <span className="unavail">unavailable</span>}
                {!ok && <button className="link" onClick={() => A.removeRecent(r.path)}>Remove</button>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
