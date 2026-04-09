import { getRequestIp, isSameOriginRequest } from "@/lib/http";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { getSession } from "@/lib/session";

export { getRequestIp, isSameOriginRequest };
const MAX_IMAGE_UPLOAD_BYTES = 10485760;

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

  await ensureSchema();
  const [user] = await sql<{ posters_enabled: boolean | null }[]>`
    SELECT posters_enabled
    FROM users
    WHERE id = ${session.sub}
    LIMIT 1
  `;

  if (!user) {
    throw new PosterRequestError("Unauthorized", 401);
  }

  if (!user.posters_enabled) {
    throw new PosterRequestError("Coming soon!", 403);
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

export type ParsedProofLocation = {
  locationDescription: string;
  latitude: number;
  longitude: number;
  locationAccuracy: number | null;
};

function parseFiniteNumber(raw: FormDataEntryValue | null) {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function parseProofLocationFromFormData(formData: FormData): ParsedProofLocation {
  const rawDescription = formData.get("locationDescription");
  const locationDescription = typeof rawDescription === "string" ? rawDescription.trim() : "";
  if (!locationDescription) {
    throw new PosterRequestError("Location description is required.", 400);
  }

  const latitude = parseFiniteNumber(formData.get("latitude"));
  const longitude = parseFiniteNumber(formData.get("longitude"));
  if (latitude === null || longitude === null) {
    throw new PosterRequestError("Precise location is required. Please allow location access.", 400);
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new PosterRequestError("Received invalid coordinates.", 400);
  }

  const locationAccuracy = parseFiniteNumber(formData.get("locationAccuracy"));

  return {
    locationDescription,
    latitude,
    longitude,
    locationAccuracy,
  };
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
