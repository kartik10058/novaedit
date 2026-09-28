# NovaEdit

**Your code. Your workspace.** A local desktop text/code editor: Electron + React + TypeScript + Vite + Monaco (bundled, works offline).

## Requirements
- Node.js 20+ and npm
- Windows 10/11 (primary target). macOS/Linux work for dev and packaging (`package:mac`, `package:linux`).

## Install & run
```bash
npm install
npm run dev        # Vite + Electron with hot reload
npm run build      # typecheck + build renderer (dist/) + compile Electron (dist-electron/)
npm run package    # build + Windows installer -> release/NovaEdit Setup.exe
```
Build the Windows installer on Windows (electron-builder needs the Windows toolchain for NSIS).

## Features
Explorer (lazy tree, new/rename/delete/duplicate/refresh), tabs (drag reorder, dirty dot, close others/right/all, reopen closed),
Monaco editor (folding, multi-cursor, minimap, find/replace), 21 languages with auto-detect + status-bar picker,
global search/replace (case / whole word / regex, click to jump), command palette (`Ctrl+Shift+P`), quick open (`Ctrl+P`),
3 themes (Dark, Light, Midnight), settings page (persisted), auto save (off / after delay / on focus change),
recent files/folders (unavailable entries can be removed), session restore, integrated terminal,
Markdown live preview, JSON format/minify/validate, pluggable formatter registry,
external-change detection (Reload / Keep Current), unsaved-changes prompts on tab close, workspace switch and app exit.

## Shortcuts
`Ctrl+N/O/S`, `Ctrl+Shift+S` Save As, `Ctrl+W` close tab, `Ctrl+Shift+W` close window, `Ctrl+P` quick open,
`Ctrl+Shift+P` palette, `Ctrl+F` find, `Ctrl+H` replace, `Ctrl+Shift+F` global search, `Ctrl+B` sidebar, `Ctrl+J` bottom panel.
Global shortcuts are one map in `src/App.tsx` + `src/services/commands.ts` (easy to make user-configurable).

## Architecture
```
electron/   main.ts (window, CSP, close guard) · preload.ts (the only bridge) · types.ts (shared types)
  ipc/      fileHandlers · folderHandlers · searchHandlers · terminalHandlers · settingsHandlers · util (validation, errors)
src/
  stores/     zustand: app.ts (tabs, workspace, tree, search, terminal…) · settings.ts (persisted)
  services/   actions.ts (all behaviour) · commands.ts (palette/menu registry) · api.ts (unwraps IPC results)
              formatters.ts (per-language formatter registry) · monacoSetup.ts (local workers + themes) · dialogs.ts
  components/ Editor · Explorer · Tabs · Terminal · Search · CommandPalette · Settings · StatusBar · Common
```
Flow: `React → window.nova (preload) → ipcMain handler (validates input) → Node fs / child_process`.

### Security
`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. The renderer never sees `require`, `process`, `fs` or `child_process`.
Every IPC argument is validated (absolute paths, string sizes, whitelisted store keys, http/https/mailto only for external links).
Navigation and new windows are blocked; a CSP is applied in the packaged app; Markdown is sanitized with DOMPurify. Deletes go to the OS trash.

### Adding a formatter (Prettier, Black, gofmt…)
Add an IPC handler that runs the tool in the main process, then `registerFormatter({ id, languages, format })` in `src/services/formatters.ts`.

## Troubleshooting
- **Electron binary missing** after install: run `npm install electron --force` (or unset `ELECTRON_SKIP_BINARY_DOWNLOAD`).
- **Port 5173 in use**: stop the other Vite server; the port is fixed so Electron can find it.
- **Blank window in dev**: check the detached DevTools console; make sure `npm run dev` (not just `vite`) was used.
- **Terminal**: uses piped stdio (no native modules). Interactive full-screen programs (vim, htop) are not supported; swap in `node-pty` in `terminalHandlers.ts` if needed.
- **Installer**: `NovaEdit Setup.exe` is created in `release/`. Windows SmartScreen may warn for unsigned builds.
