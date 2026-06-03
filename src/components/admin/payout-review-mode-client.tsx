"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

const SKIPPED_PAYOUTS_STORAGE_KEY = "admin-review-skipped-payouts";

/**
 * Queue navigation for the payout review screen, mirroring the application
 * review UI: skip a pending payout (or move on from a finalized one) and land
 * on the next oldest pending payout.
 */
export function PayoutReviewModeClient({
  payoutId,
  isPending,
  children,
}: {
  payoutId: string;
  isPending: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [showSkipHint, setShowSkipHint] = useState(false);

  const readSkippedPayoutIds = useCallback(() => {
    if (typeof window === "undefined") {
      return [] as string[];
    }

    try {
      const rawValue = window.sessionStorage.getItem(SKIPPED_PAYOUTS_STORAGE_KEY);
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

  const writeSkippedPayoutIds = useCallback((payoutIds: string[]) => {
    if (typeof window === "undefined") {
      return;
    }

    const uniqueIds = Array.from(
      new Set(payoutIds.map((value) => value.trim()).filter((value) => value !== "")),
    );

    if (uniqueIds.length === 0) {
      window.sessionStorage.removeItem(SKIPPED_PAYOUTS_STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(SKIPPED_PAYOUTS_STORAGE_KEY, JSON.stringify(uniqueIds));
  }, []);

  const goToNextPayout = useCallback(
    async (excludeIds: string[]) => {
      setIsAdvancing(true);

      try {
        const params = new URLSearchParams();
        excludeIds.forEach((excludeId) => {
          params.append("exclude", excludeId);
        });

        const query = params.toString();
        const response = await fetch(
          query === ""
            ? "/api/admin/payouts/next-review"
            : `/api/admin/payouts/next-review?${query}`,
        );
        const data = await response.json();
        if (data.id) {
          router.push(`/admin/payouts/${data.id}`);
          return;
        }

        alert("No more payouts to review.");
        router.push("/admin/payouts");
      } catch {
        setIsAdvancing(false);
      }
    },
    [router],
  );

  const handleAdvance = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      // Moving on from a finalized payout needs no confirmation; skipping a
      // pending one does (unless shift is held).
      if (isPending && !event.shiftKey) {
        if (!window.confirm("Are you sure?")) {
          return;
        }
      }

      const skippedIds = isPending
        ? Array.from(new Set([...readSkippedPayoutIds(), payoutId]))
        : readSkippedPayoutIds();
      if (isPending) {
        writeSkippedPayoutIds(skippedIds);
      }
      void goToNextPayout(skippedIds);
    },
    [goToNextPayout, isPending, payoutId, readSkippedPayoutIds, writeSkippedPayoutIds],
  );

  const label = isPending ? "Skip" : "Next payout";

  return (
    <div className="space-y-4">
      {children}

      <div className="flex justify-end pt-2">
        <div className="relative flex items-center justify-end">
          <button
            type="button"
            data-slot="open-link"
            onClick={handleAdvance}
            onMouseEnter={() => setShowSkipHint(true)}
            onMouseLeave={() => setShowSkipHint(false)}
            onFocus={() => setShowSkipHint(true)}
            onBlur={() => setShowSkipHint(false)}
            disabled={isAdvancing}
            title={isPending ? "Hold Shift to skip confirmation" : undefined}
            className="ui-open-link inline-flex items-center gap-1 font-body text-lg leading-none disabled:opacity-50"
          >
            {isAdvancing ? "Loading..." : label} <span aria-hidden="true">→</span>
          </button>
          {isPending && showSkipHint ? (
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
