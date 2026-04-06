import {
  createSinglePosterForUser,
  listPosterDataForUser,
} from "@/lib/posters/service";
import { posterErrorResponse, requirePosterSession } from "@/lib/posters/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requirePosterSession();
    const data = await listPosterDataForUser(session.sub);
    return Response.json(data);
  } catch (error) {
    return posterErrorResponse(error, "Failed to load posters.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requirePosterSession();
    const body = (await request.json()) as {
      campaignSlug?: string;
      posterType?: string;
      charset?: string;
    };

    const poster = await createSinglePosterForUser({
      userId: session.sub,
      campaignSlug: body.campaignSlug,
      posterType: body.posterType,
      charset: body.charset,
    });

    return Response.json({ poster }, { status: 201 });
  } catch (error) {
    return posterErrorResponse(error, "Failed to create poster.");
  }
}
