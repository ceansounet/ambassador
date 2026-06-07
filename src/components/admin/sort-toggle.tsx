"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { CalendarArrowDown, CalendarArrowUp } from "lucide-react";

export function SortToggle({
  defaultSort = "oldest",
  storageKey,
}: {
  defaultSort?: "oldest" | "newest";
  storageKey?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentSort = searchParams.get("sort") === "newest"
    ? "newest"
    : searchParams.get("sort") === "oldest"
      ? "oldest"
      : defaultSort;

  // Restore the saved sort preference when the URL doesn't pin one explicitly.
  const restored = useRef(false);
  useEffect(() => {
    if (storageKey === undefined || restored.current) return;
    restored.current = true;
    if (searchParams.get("sort") !== null) return;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if ((stored === "oldest" || stored === "newest") && stored !== defaultSort) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("sort", stored);
        router.replace(`${pathname}?${params.toString()}`);
      }
    } catch {
      // ignore storage errors (private mode, quota, etc.)
    }
  }, [storageKey, defaultSort, searchParams, pathname, router]);
  const isOldest = currentSort === "oldest";
  const SortIcon = isOldest ? CalendarArrowDown : CalendarArrowUp;
  const sortLabel = isOldest
    ? "Sorted oldest to latest. Click to switch to latest to oldest."
    : "Sorted latest to oldest. Click to switch to oldest to latest.";

  return (
    <button
      type="button"
      data-slot="open-link"
      onClick={() => {
        const params = new URLSearchParams(searchParams.toString());
        const nextSort = isOldest ? "newest" : "oldest";
        if (nextSort === defaultSort) {
          params.delete("sort");
        } else {
          params.set("sort", nextSort);
        }
        params.delete("page");
        if (storageKey !== undefined) {
          try {
            window.localStorage.setItem(storageKey, nextSort);
          } catch {
            // ignore
          }
        }
        startTransition(() => {
          router.replace(`${pathname}?${params.toString()}`);
        });
      }}
      className={`ui-open-link inline-flex h-8 shrink-0 items-center justify-center px-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--acceptance)]/30 ${isPending ? "opacity-60" : ""}`}
      title={sortLabel}
      aria-label={sortLabel}
    >
      <SortIcon aria-hidden="true" size={18} strokeWidth={1.75} />
    </button>
  );
}
