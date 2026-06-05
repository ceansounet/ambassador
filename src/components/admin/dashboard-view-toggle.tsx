"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";

export function DashboardViewToggle() {
  const t = useTranslations("admin.overview.views");
  const searchParams = useSearchParams();
  const activeView = searchParams.get("view") === "detailed" ? "detailed" : "priority";

  const options = [
    { value: "priority" as const, label: t("priority"), href: "/admin" },
    { value: "detailed" as const, label: t("detailed"), href: "/admin?view=detailed" },
  ];

  return (
    <div className="mb-8 flex flex-wrap gap-2">
      {options.map((option) => (
        <Button
          key={option.value}
          asChild
          size="app-sm"
          variant="destructive"
          selected={option.value === activeView}
        >
          <Link
            href={option.href}
            aria-current={option.value === activeView ? "page" : undefined}
          >
            {option.label}
          </Link>
        </Button>
      ))}
    </div>
  );
}
