import { getPosterGroupForUserOrThrow } from "@/lib/posters/service";
import { posterErrorResponse, requirePosterSession } from "@/lib/posters/http";

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext<"/api/poster-groups/[id]">) {
  try {
    const session = await requirePosterSession();
    const { id } = await context.params;
    const data = await getPosterGroupForUserOrThrow(session.sub, id);
    return Response.json(data);
  } catch (error) {
    return posterErrorResponse(error, "Failed to load poster group.", 404);
  }
}
