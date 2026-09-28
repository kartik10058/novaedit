import { app } from 'electron';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { assertString, handle } from './util';

// Only these keys may be read/written, so the renderer can never choose an arbitrary file name.
const KEYS = new Set(['settings', 'recent', 'session']);
const fileFor = (key: string) => path.join(app.getPath('userData'), `${key}.json`);
function assertKey(k: unknown): string {
  const key = assertString(k, 32);
  if (!KEYS.has(key)) throw new Error('Unknown storage key.');
  return key;
}

export function registerSettingsHandlers(): void {
  handle('store:read', async (k: unknown): Promise<unknown> => {
    try { return JSON.parse(await fsp.readFile(fileFor(assertKey(k)), 'utf8')); } catch { return null; }
  });
  handle('store:write', async (k: unknown, value: unknown): Promise<void> => {
    const file = fileFor(assertKey(k));
    const json = JSON.stringify(value);
    if (json.length > 1_000_000) throw new Error('Data too large.');
    const tmp = file + '.tmp';
    await fsp.writeFile(tmp, json, 'utf8');
    await fsp.rename(tmp, file); // atomic replace: a crash mid-write can't corrupt settings
  });
}
