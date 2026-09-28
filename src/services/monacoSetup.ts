import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';
import editorWorker from 'monaco-editor/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/language/typescript/ts.worker?worker';

// Everything is bundled locally: no CDN, works fully offline.
(self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
  getWorker(_id: string, label: string) {
    if (label === 'json') return new jsonWorker();
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
    if (label === 'typescript' || label === 'javascript') return new tsWorker();
    return new editorWorker();
  },
};
loader.config({ monaco });

monaco.editor.defineTheme('nova-dark', { base: 'vs-dark', inherit: true, rules: [], colors: {
  'editor.background': '#1e1f26', 'editor.lineHighlightBackground': '#262833', 'editorGutter.background': '#1e1f26' } });
monaco.editor.defineTheme('nova-light', { base: 'vs', inherit: true, rules: [], colors: {
  'editor.background': '#ffffff', 'editor.lineHighlightBackground': '#f1f5f9' } });
monaco.editor.defineTheme('nova-midnight', { base: 'vs-dark', inherit: true, rules: [], colors: {
  'editor.background': '#0b1220', 'editor.lineHighlightBackground': '#111c33', 'editorGutter.background': '#0b1220',
  'editorLineNumber.foreground': '#3b4a6b', 'editorLineNumber.activeForeground': '#8aa4d6' } });

export { monaco };
