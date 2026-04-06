import { getPosterForUserOrThrow } from "@/lib/posters/service";
import { posterErrorResponse, requirePosterSession } from "@/lib/posters/http";

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext<"/api/posters/[id]">) {
  try {
    const session = await requirePosterSession();
    const { id } = await context.params;
    const poster = await getPosterForUserOrThrow(session.sub, id);
    return Response.json({ poster });
  } catch (error) {
    return posterErrorResponse(error, "Failed to load poster.", 404);
  }
}
