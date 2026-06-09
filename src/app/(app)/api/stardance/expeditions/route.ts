import { listPublicExpeditions } from "@/lib/expeditions";
import { requireStardanceDataKey } from "@/lib/stardance-data-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = requireStardanceDataKey(request);
  if (denied) {
    return denied;
  }

  try {
    return Response.json({ expeditions: await listPublicExpeditions() });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to load expeditions." }, { status: 502 });
  }
}
