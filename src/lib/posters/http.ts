import { getRequestIp } from "@/lib/http";
import { getSession } from "@/lib/session";

export { getRequestIp };
const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;

export class PosterRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PosterRequestError";
  }
}

export async function requirePosterSession() {
  const session = await getSession();

  if (!session) {
    throw new PosterRequestError("Unauthorized", 401);
  }

  return session;
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function posterErrorResponse(
  error: unknown,
  fallbackMessage: string,
  fallbackStatus = 400,
) {
  if (error instanceof PosterRequestError) {
    return jsonError(error.message, error.status);
  }

  if (error instanceof Error) {
    console.error(error);
  }

  return jsonError(fallbackMessage, fallbackStatus);
}

export function validateImageUpload(file: File) {
  if (file.size <= 0) {
    return { message: "An image file is required.", status: 400 };
  }

  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return { message: "Image file is too large.", status: 413 };
  }

  if (!file.type.startsWith("image/")) {
    return { message: "Only image uploads are allowed.", status: 400 };
  }

  return null;
}
