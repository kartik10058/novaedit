import type { NovaRawAPI } from '../../electron/preload';
declare global { interface Window { nova: NovaRawAPI } }
export {};
