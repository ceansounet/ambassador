"use client";

import { useSyncExternalStore } from "react";

// The region scope shared by the priority dashboard and the header selector that
// drives it. It persists across visits (and syncs across tabs) via localStorage;
// useSyncExternalStore keeps it hydration-safe — the server snapshot is the
// default, then the client re-reads the stored value right after hydration.
export type Scope = "all" | "us" | "other";

const SCOPE_STORAGE_KEY = "admin:priority:scope";

function readScope(): Scope {
  try {
    const stored = window.localStorage.getItem(SCOPE_STORAGE_KEY);
    if (stored === "us" || stored === "all" || stored === "other") {
      return stored;
    }
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
  return "us";
}

function getScopeServerSnapshot(): Scope {
  return "us";
}

function subscribeScope(onChange: () => void) {
  window.addEventListener(SCOPE_STORAGE_KEY, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SCOPE_STORAGE_KEY, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function usePriorityScope(): Scope {
  return useSyncExternalStore<Scope>(subscribeScope, readScope, getScopeServerSnapshot);
}

export function setPriorityScope(next: Scope) {
  try {
    window.localStorage.setItem(SCOPE_STORAGE_KEY, next);
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
  window.dispatchEvent(new Event(SCOPE_STORAGE_KEY));
}
