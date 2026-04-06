import {
  jsonError,
  posterErrorResponse,
  requirePosterSession,
  validateImageUpload,
} from "@/lib/posters/http";
import { scanAnyUserPoster } from "@/lib/posters/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await requirePosterSession();
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

    const result = await scanAnyUserPoster({
      userId: session.sub,
      file,
      locationDescription: typeof locationDescription === "string" ? locationDescription : null,
    });

    return Response.json(result);
  } catch (error) {
    return posterErrorResponse(error, "Failed to scan poster.");
  }
}
