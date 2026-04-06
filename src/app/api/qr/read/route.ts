import {
  jsonError,
  posterErrorResponse,
  requirePosterSession,
  validateImageUpload,
} from "@/lib/posters/http";
import { readPosterQrCodes } from "@/lib/posters/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requirePosterSession();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonError("An image file is required.");
    }

    const fileValidation = validateImageUpload(file);
    if (fileValidation) {
      return jsonError(fileValidation.message, fileValidation.status);
    }

    const results = await readPosterQrCodes(file);
    return Response.json({ results, count: results.length });
  } catch (error) {
    return posterErrorResponse(error, "Failed to read QR codes.");
  }
}
