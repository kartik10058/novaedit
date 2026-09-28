import { ipcMain } from 'electron';
import * as path from 'path';
import type { Result } from '../types';

/** Turn low-level fs errors into messages that make sense to a user. */
export function explain(err: unknown): string {
  const e = err as NodeJS.ErrnoException;
  switch (e?.code) {
    case 'EACCES': case 'EPERM': return 'Permission denied.';
    case 'ENOENT': return 'The file or folder does not exist. It may have been moved or deleted.';
    case 'EEXIST': return 'A file or folder with that name already exists.';
    case 'EISDIR': return 'The path is a folder, not a file.';
    case 'ENOTDIR': return 'A part of the path is not a folder.';
    case 'ENOTEMPTY': return 'The folder is not empty.';
    case 'EBUSY': return 'The file is in use by another program.';
    case 'ENOSPC': return 'There is no space left on the device.';
    case 'EMFILE': return 'Too many files are open.';
  }
  return err instanceof Error ? err.message : String(err);
}

/**
 * Register an IPC handler. Every handler is wrapped so that a thrown error is
 * returned to the renderer as { ok: false, error } instead of crashing anything.
 * All arguments come from the renderer and are UNTRUSTED: validate them with the
 * assert* helpers below before use.
 */
export function handle<A extends unknown[], T>(channel: string, fn: (...args: A) => Promise<T> | T): void {
  ipcMain.handle(channel, async (_e, ...args): Promise<Result<T>> => {
    try { return { ok: true, data: await fn(...(args as A)) }; }
    catch (err) { return { ok: false, error: explain(err) }; }
  });
}

export function assertPath(p: unknown): string {
  if (typeof p !== 'string' || !p || p.length > 4096 || p.includes('\0') || !path.isAbsolute(p)) {
    throw new Error('Invalid path.');
  }
  return path.normalize(p);
}
export function assertName(n: unknown): string {
  if (typeof n !== 'string' || !n.trim() || n.length > 255 || /[\\/\0]/.test(n) || n === '.' || n === '..') {
    throw new Error('Invalid name. Names cannot contain slashes.');
  }
  return n.trim();
}
export function assertString(v: unknown, max = 1_000_000): string {
  if (typeof v !== 'string' || v.length > max) throw new Error('Invalid argument.');
  return v;
}
