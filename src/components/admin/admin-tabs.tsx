"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

export function AdminTabs() {
  const t = useTranslations("admin.tabs");
  const pathname = usePathname();
  const tabs = [
    { href: "/admin", label: t("dashboard") },
    { href: "/admin/users", label: t("users") },
    { href: "/admin/applications", label: t("applications") },
    { href: "/admin/orders", label: t("orders") },
  ];

  return (
    <div className="mb-8 flex items-center gap-6 border-b border-white pb-4">
      {tabs.map((tab) => {
        const active =
          tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              active
                ? "text-lg font-bold text-white"
                : "text-lg text-secondary hover:text-white"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
