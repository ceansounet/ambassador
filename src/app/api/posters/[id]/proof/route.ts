import {
  jsonError,
  posterErrorResponse,
  requirePosterSession,
  validateImageUpload,
} from "@/lib/posters/http";
import { submitPosterProof } from "@/lib/posters/service";

export const runtime = "nodejs";

export async function POST(request: Request, context: RouteContext<"/api/posters/[id]/proof">) {
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

    const result = await submitPosterProof({
      userId: session.sub,
      posterId: id,
      file,
      locationDescription: typeof locationDescription === "string" ? locationDescription : null,
    });

    return Response.json(result);
  } catch (error) {
    return posterErrorResponse(error, "Failed to submit proof.");
  }
}
