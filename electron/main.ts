import { app, BrowserWindow, Menu, session, shell } from 'electron';
import * as path from 'path';
import { handle, assertString } from './ipc/util';
import { registerFileHandlers } from './ipc/fileHandlers';
import { registerFolderHandlers } from './ipc/folderHandlers';
import { registerSearchHandlers } from './ipc/searchHandlers';
import { registerSettingsHandlers } from './ipc/settingsHandlers';
import { registerTerminalHandlers, killTerminal } from './ipc/terminalHandlers';

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
let win: BrowserWindow | null = null;
let forceClose = false; // set once the renderer has confirmed unsaved changes are resolved

function createWindow(): void {
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 720, minHeight: 480,
    title: 'NovaEdit', backgroundColor: '#1e1e1e', show: false, autoHideMenuBar: true,
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // renderer JS cannot touch Electron/preload internals
      nodeIntegration: false,   // no require() in the renderer
      sandbox: true,            // renderer + preload run in a Chromium sandbox
      webSecurity: true,
      spellcheck: false,
    },
  });
  win.once('ready-to-show', () => win?.show());
  win.setMenuBarVisibility(false);

  // Never navigate away from the app or open new windows; external links go to the OS browser (validated).
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => {
    if (!(DEV_URL && url.startsWith(DEV_URL)) && !url.startsWith('file://')) e.preventDefault();
  });

  // Ask the renderer to resolve unsaved changes before the window actually closes.
  win.on('close', (e) => {
    if (forceClose || !win) return;
    e.preventDefault();
    win.webContents.send('app:closeRequested');
  });
  win.webContents.on('render-process-gone', () => { forceClose = true; }); // never trap the user in a dead window
  win.on('closed', () => { win = null; });

  if (DEV_URL) { void win.loadURL(DEV_URL); win.webContents.openDevTools({ mode: 'detach' }); }
  else void win.loadFile(path.join(__dirname, '../dist/index.html'));
}

app.whenReady().then(() => {
  // Content-Security-Policy for the packaged app (dev needs Vite's inline HMR scripts).
  if (app.isPackaged) {
    session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
      cb({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: file:; font-src 'self' data:; worker-src 'self' blob:; connect-src 'self'",
      ] } });
    });
  }
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]));
  } else Menu.setApplicationMenu(null); // the menu bar is drawn by React

  const getWin = () => win;
  registerFileHandlers(getWin);
  registerFolderHandlers(getWin);
  registerSearchHandlers();
  registerSettingsHandlers();
  registerTerminalHandlers(getWin);

  handle('win:close', () => { win?.close(); });                 // goes through the 'close' guard above
  handle('win:confirmClose', () => { forceClose = true; win?.close(); });
  handle('app:version', () => app.getVersion());
  handle('app:openExternal', async (url: unknown) => {
    const u = new URL(assertString(url, 2048));
    if (!['http:', 'https:', 'mailto:'].includes(u.protocol)) throw new Error('Blocked URL scheme.');
    await shell.openExternal(u.toString());
  });

  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

if (!app.requestSingleInstanceLock()) app.quit();
else app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

app.on('before-quit', () => { forceClose = true; killTerminal(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
