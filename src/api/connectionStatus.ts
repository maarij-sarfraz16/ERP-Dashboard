// A tiny module-level store so the shell can show one clear "cannot reach the
// backend" screen, no matter which hook hit the failure first. Kept outside
// React so `frappeClient` can write to it without importing React state.

import { useSyncExternalStore } from "react";

export interface ConnectionState {
  ok: boolean;
  message: string;
  hint: string;
}

const HEALTHY: ConnectionState = { ok: true, message: "", hint: "" };

let state: ConnectionState = HEALTHY;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function reportConnectionState(
  next: { ok: true } | { ok: false; message: string; hint: string },
): void {
  if (next.ok) {
    if (state.ok) return;
    state = HEALTHY;
  } else {
    if (!state.ok && state.message === next.message) return;
    state = { ok: false, message: next.message, hint: next.hint };
  }
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ConnectionState {
  return state;
}

/** Reactive view of whether the Frappe backend is currently reachable. */
export function useConnectionState(): ConnectionState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
