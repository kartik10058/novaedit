import { BrowserWindow, dialog } from 'electron';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { assertName, assertPath, handle } from './util';
import type { DirEntry } from '../types';

export function registerFolderHandlers(getWin: () => BrowserWindow | null): void {
  handle('folder:openDialog', async (): Promise<string | null> => {
    const win = getWin();
    const opts = { properties: ['openDirectory'] as Array<'openDirectory'> };
    const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
    return r.canceled ? null : r.filePaths[0] ?? null;
  });

  // Lazy: only one directory level is read per call, so huge workspaces are never fully loaded.
  handle('folder:read', async (p: unknown): Promise<DirEntry[]> => {
    const dir = assertPath(p);
    const ents = await fsp.readdir(dir, { withFileTypes: true });
    const out: DirEntry[] = [];
    for (const e of ents) {
      const full = path.join(dir, e.name);
      let isDir = e.isDirectory();
      if (e.isSymbolicLink()) { try { isDir = (await fsp.stat(full)).isDirectory(); } catch { /* broken link */ } }
      out.push({ name: e.name, path: full, isDir });
    }
    return out.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) : a.isDir ? -1 : 1));
  });

  handle('folder:create', async (p: unknown): Promise<void> => { await fsp.mkdir(assertPath(p)); });

  handle('path:join', (dir: unknown, name: unknown): string => path.join(assertPath(dir), assertName(name)));
}
