import type { NovaRawAPI } from '../../electron/preload';
import type { Result } from '../../electron/types';

type Unwrapped = {
  [K in keyof NovaRawAPI]: NovaRawAPI[K] extends (...a: infer A) => Promise<Result<infer T>> ? (...a: A) => Promise<T> : NovaRawAPI[K];
};

/**
 * Renderer-side wrapper around the preload bridge: converts { ok:false, error } results into thrown Errors
 * so callers can use try/catch. Event subscriptions ("on*") are passed through untouched.
 */
export const api = new Proxy(window.nova, {
  get(target, key: string) {
    const v = (target as unknown as Record<string, unknown>)[key];
    if (typeof v !== 'function' || key.startsWith('on')) return v;
    return async (...args: unknown[]) => {
      const r = await (v as (...a: unknown[]) => Promise<Result<unknown>>)(...args);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    };
  },
}) as unknown as Unwrapped;

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
