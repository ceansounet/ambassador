import {
  jsonError,
  posterErrorResponse,
  requirePosterSession,
  validateImageUpload,
} from "@/lib/posters/http";
import { scanPosterGroupProof } from "@/lib/posters/service";

export const runtime = "nodejs";

export async function POST(request: Request, context: RouteContext<"/api/poster-groups/[id]/scan">) {
  try {
    const session = await requirePosterSession();
    const { id } = await context.params;
    const formData = await request.formData();
    const file = formData.get("proof");
    const locationDescription = formData.get("locationDescription");

    if (!(file instanceof File)) {
      return jsonError("A proof image is required.");
    }

    const fileValidation = validateImageUpload(file);
    if (fileValidation) {
      return jsonError(fileValidation.message, fileValidation.status);
    }

    const result = await scanPosterGroupProof({
      userId: session.sub,
      groupId: id,
      file,
      locationDescription: typeof locationDescription === "string" ? locationDescription : null,
    });

    return Response.json(result);
  } catch (error) {
    return posterErrorResponse(error, "Failed to scan poster group proof.");
  }
}
