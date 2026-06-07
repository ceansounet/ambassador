"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export function Pagination({
  totalCount,
  pageSize,
  labels,
}: {
  totalCount: number;
  pageSize: number;
  labels: { previous: string; next: string; of: string };
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPage = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  if (totalPages <= 1) return null;

  const hrefForPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    // Page 1 is the canonical no-param URL, so it drops the query entirely.
    if (page <= 1) params.delete("page");
    else params.set("page", String(page));
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const rangeStart = (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, totalCount);

  // size-9 keeps the chevrons a comfortable tap target on mobile; the box only
  // appears on hover so the resting state stays as quiet as the rest of the UI.
  const arrow = "inline-flex size-9 items-center justify-center rounded-md transition-colors";

  return (
    <div className="flex items-center justify-between gap-4 pt-4 font-body text-sm">
      <span className="text-secondary tabular-nums">
        {rangeStart}–{rangeEnd} {labels.of} {totalCount}
      </span>
      <div className="flex items-center gap-1">
        {currentPage > 1 ? (
          <Link
            href={hrefForPage(currentPage - 1)}
            aria-label={labels.previous}
            className={cn(arrow, "cursor-pointer text-foreground hover:bg-muted")}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
        ) : (
          <span aria-hidden className={cn(arrow, "text-foreground/25")}>
            <ChevronLeft className="size-4" />
          </span>
        )}
        <span className="px-2 text-foreground tabular-nums">
          {currentPage} / {totalPages}
        </span>
        {currentPage < totalPages ? (
          <Link
            href={hrefForPage(currentPage + 1)}
            aria-label={labels.next}
            className={cn(arrow, "cursor-pointer text-foreground hover:bg-muted")}
          >
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : (
          <span aria-hidden className={cn(arrow, "text-foreground/25")}>
            <ChevronRight className="size-4" />
          </span>
        )}
      </div>
    </div>
  );
}
