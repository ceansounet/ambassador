import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { DashboardViewToggle } from "@/components/admin/dashboard-view-toggle";
import type { Scope } from "@/components/admin/priority-scope";
import { PriorityScopeSelect } from "@/components/admin/priority-scope-select";
import { getTranslatedPageMetadata } from "@/i18n/metadata";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { DetailedView, type ActivityRange } from "./detailed-view";
import { PriorityView } from "./priority-view";

export async function generateMetadata(): Promise<Metadata> {
  return getTranslatedPageMetadata("admin.overview.metadata.title");
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; range?: string }>;
}) {
  const query = await searchParams;
  const activeView = query.view === "detailed" ? "detailed" : "priority";
  // The client persists the region scope in localStorage and mirrors it into
  // this cookie, so the server can render the stored preference immediately
  // instead of flashing the US default until hydration re-reads it.
  const storedScope = (await cookies()).get("admin_priority_scope")?.value;
  const initialScope: Scope =
    storedScope === "all" || storedScope === "other" || storedScope === "us" ? storedScope : "us";
  const activeRange: ActivityRange =
    query.range === "7d" ||
    query.range === "14d" ||
    query.range === "30d" ||
    query.range === "90d"
      ? query.range
      : "14d";

  await ensureSchema();

  const t = await getTranslations("admin.overview");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h1 className="text-4xl font-bold leading-[3rem] text-foreground">{t("title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {activeView === "priority" ? <PriorityScopeSelect initialScope={initialScope} /> : null}
          <DashboardViewToggle />
        </div>
      </div>
      {activeView === "detailed" ? (
        <div className="space-y-12">
          <DetailedView activeRange={activeRange} />
          <PriorityView lockScopeAll />
        </div>
      ) : (
        <PriorityView initialScope={initialScope} />
      )}
    </div>
  );
}
