/**
 * Preload bridge (runs sandboxed, with contextIsolation). This is the ONLY surface the renderer gets:
 * a fixed list of functions, each mapping to one validated IPC channel. No require/process/fs/child_process
 * is exposed. Event subscriptions return an unsubscribe function so listeners are always cleaned up.
 */
import { contextBridge, ipcRenderer } from 'electron';
import type { DirEntry, ReadResult, ReplaceResponse, Result, SearchOptions, SearchResponse, StatResult, TermStartResult } from './types';

const call = <T>(channel: string, ...args: unknown[]): Promise<Result<T>> => ipcRenderer.invoke(channel, ...args);
const on = <T>(channel: string, cb: (payload: T) => void): (() => void) => {
  const listener = (_e: unknown, payload: T) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

const api = {
  platform: process.platform,
  // files
  readFile: (p: string) => call<ReadResult>('file:read', p),
  writeFile: (p: string, content: string) => call<number>('file:write', p, content),
  stat: (p: string) => call<StatResult>('file:stat', p),
  existsMany: (ps: string[]) => call<boolean[]>('file:existsMany', ps),
  openFileDialog: () => call<string[]>('file:openDialog'),
  saveFileDialog: (defaultPath?: string) => call<string | null>('file:saveDialog', defaultPath),
  createFile: (p: string) => call<void>('file:create', p),
  rename: (from: string, to: string) => call<void>('fs:rename', from, to),
  remove: (p: string) => call<void>('fs:delete', p),
  duplicate: (p: string) => call<string>('file:duplicate', p),
  watch: (p: string) => call<void>('file:watch', p),
  unwatch: (p: string) => call<void>('file:unwatch', p),
  onFileChanged: (cb: (p: string) => void) => on<string>('file:changed', cb),
  // folders
  openFolderDialog: () => call<string | null>('folder:openDialog'),
  readDir: (p: string) => call<DirEntry[]>('folder:read', p),
  createFolder: (p: string) => call<void>('folder:create', p),
  joinPath: (dir: string, name: string) => call<string>('path:join', dir, name),
  // search
  listFiles: (root: string) => call<string[]>('search:files', root),
  searchText: (root: string, q: string, o: SearchOptions) => call<SearchResponse>('search:text', root, q, o),
  replaceText: (root: string, q: string, r: string, o: SearchOptions) => call<ReplaceResponse>('search:replace', root, q, r, o),
  // terminal
  termStart: (cwd: string | null, shell: string) => call<TermStartResult>('term:start', cwd, shell),
  termInput: (line: string) => call<void>('term:input', line),
  termKill: () => call<void>('term:kill'),
  onTermData: (cb: (d: string) => void) => on<string>('term:data', cb),
  onTermExit: (cb: (code: number) => void) => on<number>('term:exit', cb),
  // persistence
  readStore: (key: string) => call<unknown>('store:read', key),
  writeStore: (key: string, value: unknown) => call<void>('store:write', key, value),
  // window / app
  closeWindow: () => call<void>('win:close'),
  confirmClose: () => call<void>('win:confirmClose'),
  openExternal: (url: string) => call<void>('app:openExternal', url),
  appVersion: () => call<string>('app:version'),
  onCloseRequested: (cb: () => void) => on<void>('app:closeRequested', cb),
};

contextBridge.exposeInMainWorld('nova', api);
export type NovaRawAPI = typeof api;
