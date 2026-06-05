import type { Metadata } from "next";

import { DashboardViewToggle } from "@/components/admin/dashboard-view-toggle";
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
  const activeRange: ActivityRange =
    query.range === "7d" ||
    query.range === "14d" ||
    query.range === "30d" ||
    query.range === "90d"
      ? query.range
      : "14d";

  await ensureSchema();

  return (
    <div>
      <DashboardViewToggle />
      {activeView === "detailed" ? (
        <DetailedView activeRange={activeRange} />
      ) : (
        <PriorityView />
      )}
    </div>
  );
}
