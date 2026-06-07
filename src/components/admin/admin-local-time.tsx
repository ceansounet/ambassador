"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// Visit timestamps are stored in UTC and these pages are server-rendered, so the
// raw figure carries no timezone the admin can read at a glance. This shows the
// admin's own browser timezone (with its short name, e.g. "PST") once hydrated,
// falling back to the server-formatted value on the server and first client
// render. useSyncExternalStore keeps that swap hydration-safe.
export function AdminLocalDateTime({
  value,
  locale,
  fallback,
}: {
  value: string;
  locale: string;
  fallback: string;
}) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  if (!hydrated) return <>{fallback}</>;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <>{fallback}</>;

  return (
    <>
      {date.toLocaleString(locale, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      })}
    </>
  );
}
