import {
  createPosterGroupForUser,
  listClientPosterDataForUser,
  toClientPosterGroupDetail,
} from "@/lib/posters/service";
import { isSameOriginRequest, posterErrorResponse, requirePosterSession } from "@/lib/posters/http";
import { checkRateLimit, getRateLimitKey, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requirePosterSession();
    const data = await listClientPosterDataForUser(session.sub);
    return Response.json({ groups: data.groups });
  } catch (error) {
    return posterErrorResponse(error, "Failed to load poster groups.", 500);
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const session = await requirePosterSession();
    const rateLimit = await checkRateLimit({
      scope: "poster-create",
      key: getRateLimitKey(session.sub),
      limit: 1_000,
    });

    if (!rateLimit.ok) {
      return rateLimitResponse(rateLimit);
    }

    const body = await request.json();
    const payload: Record<string, unknown> | null =
      typeof body === "object" && body !== null && !Array.isArray(body)
        ? Object.fromEntries(Object.entries(body))
        : null;

    const result = await createPosterGroupForUser({
      userId: session.sub,
      campaignSlug: typeof payload?.campaignSlug === "string" ? payload.campaignSlug : undefined,
      count: typeof payload?.count === "number" && Number.isFinite(payload.count) ? payload.count : 0,
      name: typeof payload?.name === "string" ? payload.name : undefined,
      charset: typeof payload?.charset === "string" ? payload.charset : undefined,
      posterType: typeof payload?.posterType === "string" ? payload.posterType : undefined,
    });

    return Response.json(toClientPosterGroupDetail(result.group, result.posters), {
      status: 201,
    });
  } catch (error) {
    return posterErrorResponse(error, "Failed to create poster group.");
  }
}
