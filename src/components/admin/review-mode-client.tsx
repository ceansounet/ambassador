"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const SKIPPED_APPLICATIONS_STORAGE_KEY = "admin-review-skipped-applications";

export function ReviewModeClient({
  applicationId,
  children,
}: {
  applicationId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [lockWarning, setLockWarning] = useState<string | null>(null);
  const [isSkipping, setIsSkipping] = useState(false);
  const [showSkipHint, setShowSkipHint] = useState(false);
  const lockInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const lockWarningRef = useRef<string | null>(null);

  const readSkippedApplicationIds = useCallback(() => {
    if (typeof window === "undefined") {
      return [] as string[];
    }

    try {
      const rawValue = window.sessionStorage.getItem(SKIPPED_APPLICATIONS_STORAGE_KEY);
      if (rawValue === null) {
        return [] as string[];
      }

      const parsed = JSON.parse(rawValue) as unknown;
      if (!Array.isArray(parsed)) {
        return [] as string[];
      }

      return parsed
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => value !== "");
    } catch {
      return [] as string[];
    }
  }, []);

  const writeSkippedApplicationIds = useCallback((applicationIds: string[]) => {
    if (typeof window === "undefined") {
      return;
    }

    const uniqueIds = Array.from(new Set(applicationIds.map((value) => value.trim()).filter((value) => value !== "")));

    if (uniqueIds.length === 0) {
      window.sessionStorage.removeItem(SKIPPED_APPLICATIONS_STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(SKIPPED_APPLICATIONS_STORAGE_KEY, JSON.stringify(uniqueIds));
  }, []);

  const goToNextApplication = useCallback(
    async (excludeIds: string[]) => {
      setIsSkipping(true);

      try {
        const params = new URLSearchParams();
        excludeIds.forEach((excludeId) => {
          params.append("exclude", excludeId);
        });

        const query = params.toString();
        const response = await fetch(
          query === ""
            ? "/api/admin/applications/next-review"
            : `/api/admin/applications/next-review?${query}`,
        );
        const data = await response.json();
        if (data.id) {
          router.push(`/admin/applications/review/${data.id}`);
          return;
        }

        alert("No more applications to review.");
        router.push("/admin/applications");
      } catch {
        setIsSkipping(false);
      }
    },
    [router],
  );

  useEffect(() => {
    let cancelled = false;

    async function acquireLock() {
      try {
        const response = await fetch("/api/admin/applications/review-lock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicationId }),
        });
        const data = await response.json();
        if (cancelled) return;
        const newWarning = data.locked ? data.lockedBy : null;
        if (newWarning !== lockWarningRef.current) {
          lockWarningRef.current = newWarning;
          setLockWarning(newWarning);
        }
      } catch {
        // Silently fail - lock will expire
      }
    }

    acquireLock();
    lockInterval.current = setInterval(acquireLock, 7000);

    return () => {
      cancelled = true;
      if (lockInterval.current) clearInterval(lockInterval.current);
      fetch("/api/admin/applications/review-lock", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      }).catch(() => {});
    };
  }, [applicationId]);

  const handleSkip = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      // If shift is held, skip confirmation
      if (!event.shiftKey) {
        if (!window.confirm("Are you sure?")) {
          return;
        }
      }

      const skippedIds = Array.from(new Set([...readSkippedApplicationIds(), applicationId]));
      writeSkippedApplicationIds(skippedIds);
      void goToNextApplication(skippedIds);
    },
    [applicationId, goToNextApplication, readSkippedApplicationIds, writeSkippedApplicationIds],
  );

  return (
    <div className="space-y-4">
      {/* Lock warning */}
      {lockWarning && (
        <div className="border border-[var(--primary)]/40 bg-[var(--primary)]/10 p-4">
          <p className="font-body text-sm text-foreground">
            <span className="font-bold text-[var(--primary)]">Warning:</span>{" "}
            {lockWarning} is also viewing this application.
          </p>
        </div>
      )}

      {/* Content */}
      {children}

      {/* Skip button */}
      <div className="flex justify-end pt-2">
        <div className="relative flex items-center justify-end">
          <button
            type="button"
            data-slot="open-link"
            onClick={handleSkip}
            onMouseEnter={() => setShowSkipHint(true)}
            onMouseLeave={() => setShowSkipHint(false)}
            onFocus={() => setShowSkipHint(true)}
            onBlur={() => setShowSkipHint(false)}
            disabled={isSkipping}
            title="Hold Shift to skip confirmation"
            className="ui-open-link inline-flex items-center gap-1 font-body text-lg leading-none disabled:opacity-50"
          >
            {isSkipping ? "Skipping..." : "Skip"} <span aria-hidden="true">→</span>
          </button>
          {showSkipHint ? (
            <span
              className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-56 -translate-x-1/2 !rounded-none px-3 py-2 font-body text-xs"
              style={{ backgroundColor: "#000", color: "#fff" }}
            >
              Hold Shift to skip confirmation
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
