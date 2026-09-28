import { BrowserWindow } from 'electron';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { assertString, handle } from './util';
import type { TermStartResult } from '../types';

/**
 * Integrated terminal. The shell is a real child process owned by the MAIN process; the renderer
 * can only start/write/kill through this narrow IPC. (Piped stdio rather than a PTY, so there is no
 * native module to rebuild; full-screen TUIs like vim won't work. node-pty can be swapped in later.)
 */
let proc: ChildProcessWithoutNullStreams | null = null;
let kind: 'powershell' | 'cmd' | 'posix' = 'posix';

function defaultShell(): string {
  return process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash';
}
function promptCmd(): string {
  if (kind === 'powershell') return 'Write-Host -NoNewline ("PS " + $PWD.Path + "> ")';
  if (kind === 'cmd') return '';
  return `printf '%s$ ' "$PWD"`;
}

export function registerTerminalHandlers(getWin: () => BrowserWindow | null): void {
  const send = (channel: string, payload: unknown) => getWin()?.webContents.send(channel, payload);

  handle('term:start', (cwd: unknown, shell: unknown): TermStartResult => {
    if (proc) { proc.kill(); proc = null; }
    let dir = typeof cwd === 'string' && path.isAbsolute(cwd) && fs.existsSync(cwd) ? cwd : os.homedir();
    const sh = typeof shell === 'string' && shell.trim() ? assertString(shell.trim(), 260) : defaultShell();
    if (/[\0\r\n]/.test(sh)) throw new Error('Invalid shell.');
    const base = path.basename(sh).toLowerCase();
    kind = base.includes('powershell') || base.startsWith('pwsh') ? 'powershell' : base.startsWith('cmd') ? 'cmd' : 'posix';
    const args = kind === 'powershell' ? ['-NoLogo', '-NoProfile', '-Command', '-'] : kind === 'cmd' ? ['/Q', '/K'] : [];
    const child = spawn(sh, args, { cwd: dir, env: process.env, windowsHide: true });
    proc = child;
    child.stdout.on('data', (d: Buffer) => send('term:data', d.toString('utf8')));
    child.stderr.on('data', (d: Buffer) => send('term:data', d.toString('utf8')));
    child.on('error', (e) => { send('term:data', `\r\n[failed to start shell: ${e.message}]\r\n`); if (proc === child) proc = null; send('term:exit', -1); });
    child.on('exit', (code) => { if (proc === child) { proc = null; send('term:exit', code ?? 0); } });
    if (promptCmd()) child.stdin.write(promptCmd() + '\n');
    return { shell: sh, cwd: dir };
  });

  handle('term:input', (line: unknown): void => {
    if (!proc) throw new Error('The terminal is not running.');
    const text = assertString(line, 10000);
    proc.stdin.write(text + '\n' + (promptCmd() ? promptCmd() + '\n' : ''));
  });

  handle('term:kill', (): void => { if (proc) { proc.kill(); proc = null; } });
}

export function killTerminal(): void { if (proc) { proc.kill(); proc = null; } }
