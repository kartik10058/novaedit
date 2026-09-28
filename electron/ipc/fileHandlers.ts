import { BrowserWindow, dialog, shell } from 'electron';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { assertPath, assertString, handle } from './util';
import type { ReadResult, StatResult } from '../types';

const MAX_FILE_BYTES = 50 * 1024 * 1024;

async function exists(p: string): Promise<boolean> {
  try { await fsp.access(p); return true; } catch { return false; }
}
function fail(code: string): never { throw Object.assign(new Error(code), { code }); }

export function registerFileHandlers(getWin: () => BrowserWindow | null): void {
  handle('file:read', async (p: unknown): Promise<ReadResult> => {
    const fp = assertPath(p);
    const st = await fsp.stat(fp);
    if (st.isDirectory()) fail('EISDIR');
    if (st.size > MAX_FILE_BYTES) throw new Error('File is too large to open (limit 50 MB).');
    const buf = await fsp.readFile(fp);
    if (buf.subarray(0, 8000).includes(0)) throw new Error('This looks like a binary file and cannot be opened as text.');
    let content = buf.toString('utf8');
    if (content.charCodeAt(0) === 0xfeff) content = content.slice(1); // strip BOM
    return { content, mtimeMs: st.mtimeMs };
  });

  handle('file:write', async (p: unknown, content: unknown): Promise<number> => {
    const fp = assertPath(p);
    await fsp.writeFile(fp, assertString(content, 200 * 1024 * 1024), 'utf8');
    return (await fsp.stat(fp)).mtimeMs;
  });

  handle('file:stat', async (p: unknown): Promise<StatResult> => {
    try { const st = await fsp.stat(assertPath(p)); return { exists: true, isDir: st.isDirectory(), mtimeMs: st.mtimeMs }; }
    catch { return { exists: false, isDir: false, mtimeMs: 0 }; }
  });

  handle('file:existsMany', async (ps: unknown): Promise<boolean[]> => {
    if (!Array.isArray(ps) || ps.length > 200) throw new Error('Invalid argument.');
    return Promise.all(ps.map(async (p) => { try { return await exists(assertPath(p)); } catch { return false; } }));
  });

  handle('file:openDialog', async (): Promise<string[]> => {
    const win = getWin();
    const opts = { properties: ['openFile', 'multiSelections'] as Array<'openFile' | 'multiSelections'> };
    const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
    return r.canceled ? [] : r.filePaths;
  });

  handle('file:saveDialog', async (defaultPath: unknown): Promise<string | null> => {
    const win = getWin();
    const opts = { defaultPath: typeof defaultPath === 'string' ? defaultPath : undefined };
    const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts);
    return r.canceled || !r.filePath ? null : r.filePath;
  });

  handle('file:create', async (p: unknown): Promise<void> => {
    await fsp.writeFile(assertPath(p), '', { flag: 'wx' }); // 'wx' fails if it already exists
  });

  handle('fs:rename', async (from: unknown, to: unknown): Promise<void> => {
    const a = assertPath(from), b = assertPath(to);
    if (a !== b && (await exists(b))) fail('EEXIST'); // fs.rename would silently overwrite on POSIX
    await fsp.rename(a, b);
  });

  // Deleting moves to the OS trash/recycle bin so it is recoverable.
  handle('fs:delete', async (p: unknown): Promise<void> => { await shell.trashItem(assertPath(p)); });

  handle('file:duplicate', async (p: unknown): Promise<string> => {
    const src = assertPath(p);
    const { dir, name, ext } = path.parse(src);
    for (let i = 0; i < 1000; i++) {
      const dest = path.join(dir, `${name} copy${i ? ' ' + (i + 1) : ''}${ext}`);
      if (!(await exists(dest))) { await fsp.copyFile(src, dest, fs.constants.COPYFILE_EXCL); return dest; }
    }
    throw new Error('Could not find a free name for the copy.');
  });

  // External-change detection: poll mtime (robust against editors that replace files atomically).
  const watched = new Set<string>();
  handle('file:watch', (p: unknown): void => {
    const fp = assertPath(p);
    if (watched.has(fp)) return;
    watched.add(fp);
    fs.watchFile(fp, { interval: 1000, persistent: false }, (cur, prev) => {
      if (cur.mtimeMs !== prev.mtimeMs || cur.size !== prev.size) getWin()?.webContents.send('file:changed', fp);
    });
  });
  handle('file:unwatch', (p: unknown): void => {
    const fp = assertPath(p);
    if (watched.delete(fp)) fs.unwatchFile(fp);
  });
}
