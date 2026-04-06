import {
  createPosterGroupForUser,
  listPosterDataForUser,
} from "@/lib/posters/service";
import { posterErrorResponse, requirePosterSession } from "@/lib/posters/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requirePosterSession();
    const data = await listPosterDataForUser(session.sub);
    return Response.json({ groups: data.groups });
  } catch (error) {
    return posterErrorResponse(error, "Failed to load poster groups.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requirePosterSession();
    const body = (await request.json()) as {
      campaignSlug?: string;
      count?: number;
      name?: string;
      charset?: string;
      posterType?: string;
    };

    const result = await createPosterGroupForUser({
      userId: session.sub,
      campaignSlug: body.campaignSlug,
      count: body.count ?? 1,
      name: body.name,
      charset: body.charset,
      posterType: body.posterType,
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    return posterErrorResponse(error, "Failed to create poster group.");
  }
}
