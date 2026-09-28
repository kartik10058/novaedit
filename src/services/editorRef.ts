import type * as Monaco from 'monaco-editor';

// The live Monaco editor instance lives outside React state so commands can reach it without re-renders.
let editor: Monaco.editor.IStandaloneCodeEditor | null = null;
export const setEditor = (e: Monaco.editor.IStandaloneCodeEditor | null) => { editor = e; };
export const getEditor = () => editor;
