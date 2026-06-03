import { isUserAdmin } from "@/lib/applications/review";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { refreshHackatimeTrustLevel } from "@/lib/hackatime";
import { isSameOriginRequest } from "@/lib/http";
import { getActorSession } from "@/lib/session";

export async function POST(
  request: Request,
  context: RouteContext<"/api/admin/hackatime/[slackId]/trust">,
) {
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

  const { slackId } = await context.params;

  try {
    const trust = await refreshHackatimeTrustLevel(slackId);

    return Response.json({
      trustLevel: trust.trustLevel,
      fetchedAt: trust.fetchedAt,
    });
  } catch (error) {
    console.error("Failed to refresh Hackatime trust level", {
      slackId,
      error,
    });

    return Response.json({ error: "refresh_failed" }, { status: 502 });
  }
}
