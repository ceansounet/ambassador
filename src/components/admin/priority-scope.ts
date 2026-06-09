"use client";

import { useEffect, useSyncExternalStore } from "react";

// The region scope shared by the priority dashboard and the header selector that
// drives it. It persists in localStorage (which also syncs it across tabs) and
// is mirrored into a cookie so the server can render the stored scope straight
// away instead of flashing the default; useSyncExternalStore keeps hydration
// safe by rendering the cookie-derived server snapshot until the client re-reads
// the stored value.
export type Scope = "all" | "us" | "other";

const SCOPE_STORAGE_KEY = "admin:priority:scope";

function parseScope(value: string | null | undefined): Scope | null {
  return value === "us" || value === "all" || value === "other" ? value : null;
}

function readCookieScope(): Scope | null {
  const match = document.cookie.match(/(?:^|;\s*)admin_priority_scope=(us|all|other)(?:;|$)/);
  return match === null ? null : (match[1] as Scope);
}

function writeCookieScope(next: Scope) {
  document.cookie = `admin_priority_scope=${next}; path=/; max-age=31536000; samesite=lax`;
}

function readScope(): Scope {
  try {
    const stored = parseScope(window.localStorage.getItem(SCOPE_STORAGE_KEY));
    if (stored !== null) {
      return stored;
    }
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
  return readCookieScope() ?? "us";
}

function subscribeScope(onChange: () => void) {
  window.addEventListener(SCOPE_STORAGE_KEY, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SCOPE_STORAGE_KEY, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function usePriorityScope(serverScope: Scope = "us"): Scope {
  const scope = useSyncExternalStore<Scope>(subscribeScope, readScope, () => serverScope);
  // Self-heal visitors whose preference predates the cookie mirror: copy the
  // localStorage value over so their next server render starts on it.
  useEffect(() => {
    if (readCookieScope() === null) {
      writeCookieScope(readScope());
    }
  }, []);
  return scope;
}

export function setPriorityScope(next: Scope) {
  try {
    window.localStorage.setItem(SCOPE_STORAGE_KEY, next);
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
  writeCookieScope(next);
  window.dispatchEvent(new Event(SCOPE_STORAGE_KEY));
}
