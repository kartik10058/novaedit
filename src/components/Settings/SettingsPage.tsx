import type { ReactNode } from 'react';
import { patch } from '../../stores/app';
import { useSettings } from '../../stores/settings';
import type { Settings } from '../../types';

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="set-row"><span><b>{label}</b>{hint && <small>{hint}</small>}</span><span>{children}</span></label>;
}

export function SettingsPage() {
  const { settings: s, update } = useSettings();
  const bool = (k: keyof Settings, label: string, hint?: string) => (
    <Row label={label} hint={hint}><input type="checkbox" checked={s[k] as boolean} onChange={(e) => update({ [k]: e.target.checked } as Partial<Settings>)} /></Row>
  );
  const num = (k: keyof Settings, label: string, min: number, max: number, step = 1) => (
    <Row label={label}><input className="input sm" type="number" min={min} max={max} step={step} value={s[k] as number}
      onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v >= min && v <= max) update({ [k]: v } as Partial<Settings>); }} /></Row>
  );
  return (
    <div className="settings">
      <div className="settings-head"><h2>Settings</h2><button className="btn" onClick={() => patch({ mainView: 'editor' })}>Close</button></div>

      <h3>Appearance</h3>
      <Row label="Theme" hint="Settings → Appearance → Theme">
        <select className="input" value={s.theme} onChange={(e) => update({ theme: e.target.value as Settings['theme'] })}>
          <option value="dark">Dark</option><option value="light">Light</option><option value="midnight">Midnight</option>
        </select>
      </Row>
      {bool('showSidebar', 'Sidebar visibility')}
      {bool('showStatusBar', 'Status bar visibility')}
      {bool('showActivityBar', 'Activity bar visibility')}

      <h3>Editor</h3>
      {num('fontSize', 'Font size', 8, 40)}
      <Row label="Font family"><input className="input wide" value={s.fontFamily} onChange={(e) => update({ fontFamily: e.target.value })} /></Row>
      {num('tabSize', 'Tab size', 1, 16)}
      {bool('insertSpaces', 'Insert spaces', 'Use spaces instead of tab characters')}
      {bool('wordWrap', 'Word wrap')}
      {bool('minimap', 'Minimap')}
      {bool('lineNumbers', 'Line numbers')}
      {bool('bracketPairColorization', 'Bracket pair colorization')}
      {bool('smoothScrolling', 'Smooth scrolling')}

      <h3>Files</h3>
      <Row label="Auto save" hint="Never overwrites files when Off">
        <select className="input" value={s.autoSave} onChange={(e) => update({ autoSave: e.target.value as Settings['autoSave'] })}>
          <option value="off">Off</option><option value="afterDelay">After Delay</option><option value="onFocusChange">When Focus Changes</option>
        </select>
      </Row>
      {num('autoSaveDelay', 'Auto save delay (ms)', 200, 60000, 100)}
      {bool('restoreSession', 'Restore previous session')}
      {bool('confirmDelete', 'Confirm before deleting')}
      <Row label="Encoding" hint="Files are read and written as UTF-8"><select className="input" value="utf8" disabled><option value="utf8">UTF-8</option></select></Row>
      <Row label="Default line ending" hint="For new files">
        <select className="input" value={s.eol} onChange={(e) => update({ eol: e.target.value as Settings['eol'] })}><option value="LF">LF</option><option value="CRLF">CRLF</option></select>
      </Row>

      <h3>Terminal</h3>
      <Row label="Shell" hint="Empty = PowerShell on Windows, $SHELL elsewhere. Applies to the next terminal."><input className="input wide" value={s.shell} placeholder="e.g. C:\Program Files\Git\bin\bash.exe" onChange={(e) => update({ shell: e.target.value })} /></Row>
    </div>
  );
}
