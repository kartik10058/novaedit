import { patch } from '../stores/app';

/** Promise-based modal dialogs (window.prompt/confirm don't exist in Electron renderers). */
export const askInput = (title: string, value = '', placeholder?: string) =>
  new Promise<string | null>((resolve) => patch({ dialog: { kind: 'input', title, value, placeholder, resolve } }));

/** Resolves to the clicked button index, or -1 if dismissed (Escape). */
export const askChoice = (title: string, buttons: string[], detail?: string) =>
  new Promise<number>((resolve) => patch({ dialog: { kind: 'choice', title, detail, buttons, resolve } }));

export const showError = (title: string, reason: string) =>
  new Promise<void>((resolve) => patch({ dialog: { kind: 'error', title, reason, resolve } }));
