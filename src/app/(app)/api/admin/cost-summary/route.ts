import { isUserAdmin } from "@/lib/applications/review";
import {
  getCachedCostSummary,
  setCachedCostSummary,
} from "@/lib/admin/cost-summary-cache";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { isSameOriginRequest } from "@/lib/http";
import { getActorSession } from "@/lib/session";
import { computeCostSummary } from "@/lib/stats/cost-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const session = await getActorSession();
  if (!session) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  await ensureSchema();
  if (!(await isUserAdmin(session.sub))) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const summary = getCachedCostSummary() ?? (await computeCostSummary());
  if (getCachedCostSummary() === null) {
    setCachedCostSummary(summary);
  }

  return Response.json({
    totalCents: summary.totalCents,
    totalCentsUS: summary.totalCentsUS,
    averageCostCents: summary.averageCostCents,
    averageCostCentsUS: summary.averageCostCentsUS,
    complete: summary.complete,
  });
}
