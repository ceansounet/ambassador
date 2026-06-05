import { isUserAdmin } from "@/lib/applications/review";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { isSameOriginRequest } from "@/lib/http";
import { getActorSession } from "@/lib/session";
import { loadTopAmbassadors } from "@/lib/admin/top-ambassadors";

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

  const searchParams = new URL(request.url).searchParams;
  const rangeParam = searchParams.get("range");
  const range = rangeParam === "7d" || rangeParam === "month" ? rangeParam : "all";
  // "all" or an exact ambassador_region value; matched safely as a bound param.
  const region = searchParams.get("region")?.trim() || "all";

  const ambassadors = await loadTopAmbassadors(range, region);

  return Response.json({ range, region, ambassadors });
}
