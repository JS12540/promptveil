import { protect, redact } from '../core/index.ts';
import type { Review } from '../contracts/index.ts';

let tokens = new Map<string, string>();
let idleTimer: ReturnType<typeof setTimeout>;
self.onmessage = ({ data }: MessageEvent<{ text?: string; strict?: boolean; decisions?: Review; redact?: boolean; config?: boolean; restore?: string; clear?: boolean }>) => {
  const { text, strict, decisions, restore, clear } = data;
  clearTimeout(idleTimer);
  if (clear) { tokens.clear(); return; }
  idleTimer = setTimeout(() => tokens.clear(), 15 * 60_000);
  if (typeof idleTimer === 'object') idleTimer.unref();
  if (restore !== undefined) {
    const originals = new Map([...tokens].map(([key, token]) => [token, key.slice(key.indexOf(': ') + 2)]));
    self.postMessage({ restored: restore.replace(/\[PV_[A-Z_]+_[a-f0-9-]{36}\]/g, token => originals.get(token) ?? token) });
    return;
  }
  if (tokens.size > 1000) tokens = new Map();
  try { self.postMessage(data.redact ? redact(text ?? '', { config: data.config, tokens }) : protect(text ?? '', { strict, decisions, tokens })); }
  catch { self.postMessage({ status: 'error', findings: [] }); }
};
