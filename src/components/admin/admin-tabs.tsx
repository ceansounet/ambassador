"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

export function AdminTabs() {
  const t = useTranslations("admin.tabs");
  const pathname = usePathname();

  return (
    <div className="mb-8 flex items-center gap-4 overflow-x-auto border-b border-foreground pb-4 sm:gap-6">
      {[
        { href: "/admin", label: t("dashboard") },
        { href: "/admin/audit-log", label: t("audit-log") },
        { href: "/admin/safeguards", label: t("flags") },
        { href: "/admin/users", label: t("users") },
        { href: "/admin/orders", label: t("orders") },
        // Tabs are ordered by label length; "Payouts" slots between
        // "Orders" and "Applications".
        { href: "/admin/payouts", label: t("payouts") },
        { href: "/admin/applications", label: t("applications") },
      ].map((tab) => {
        const active =
          tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              active
                ? "shrink-0 whitespace-nowrap text-lg font-bold text-foreground"
                : "shrink-0 whitespace-nowrap text-lg text-muted-foreground hover:text-foreground"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
