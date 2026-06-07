import {
  createSinglePosterForUser,
  listClientPosterDataForUser,
  toClientPosterListItem,
} from "@/lib/posters/service";
import { isSameOriginRequest, posterErrorResponse, requirePosterSession } from "@/lib/posters/http";
import { checkRateLimit, getRateLimitKey, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requirePosterSession();
    const data = await listClientPosterDataForUser(session.sub);
    return Response.json(data);
  } catch (error) {
    return posterErrorResponse(error, "Failed to load posters.", 500);
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

    const poster = await createSinglePosterForUser({
      userId: session.sub,
      campaignSlug: typeof payload?.campaignSlug === "string" ? payload.campaignSlug : undefined,
      posterType: typeof payload?.posterType === "string" ? payload.posterType : undefined,
      charset: typeof payload?.charset === "string" ? payload.charset : undefined,
      name: typeof payload?.name === "string" ? payload.name : undefined,
    });

    return Response.json({ poster: toClientPosterListItem(poster) }, { status: 201 });
  } catch (error) {
    return posterErrorResponse(error, "Failed to create poster.");
  }
}
