import { findExpeditionsForPerson } from "@/lib/expeditions";
import { requireStardanceDataKey } from "@/lib/stardance-data-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = requireStardanceDataKey(request);
  if (denied) {
    return denied;
  }

  const params = new URL(request.url).searchParams;
  const email = params.get("email");
  const slackId = params.get("slack_id");

  if (!email?.trim() && !slackId?.trim()) {
    return Response.json({ error: "email or slack_id is required" }, { status: 400 });
  }

  try {
    return Response.json({
      expeditions: await findExpeditionsForPerson({ email, slackId }),
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to load expeditions." }, { status: 502 });
  }
}
