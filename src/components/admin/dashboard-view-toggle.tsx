"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

export function DashboardViewToggle() {
  const t = useTranslations("admin.overview.views");
  const searchParams = useSearchParams();
  const activeView = searchParams.get("view") === "detailed" ? "detailed" : "priority";

  const options = [
    { value: "priority" as const, label: t("priority"), href: "/admin" },
    { value: "detailed" as const, label: t("detailed"), href: "/admin?view=detailed" },
  ];

  // One segmented control rather than two buttons: a single bordered track split
  // into two halves, the active view filled solid black edge to edge (no inner
  // padding, so the fill reaches the track's rounded corners). Reads as a switch,
  // not a pair of CTAs competing for attention.
  return (
    <div className="inline-flex items-stretch overflow-hidden rounded-xl border border-foreground bg-background">
      {options.map((option, index) => {
        const active = option.value === activeView;

        return (
          <Link
            key={option.value}
            href={option.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center px-4 py-1.5 font-body text-sm font-bold transition-colors",
              index > 0 && "border-l border-foreground",
              active ? "bg-foreground text-white" : "text-foreground hover:bg-foreground/5",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
