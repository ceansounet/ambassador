import { syncAirtableApplicationsToPostgres } from "@/lib/application-sync";
import { ensureSchema } from "@/lib/ensure-schema";

function isAuthorized(request: Request) {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return false;

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  await ensureSchema();
  const result = await syncAirtableApplicationsToPostgres();

  return Response.json({ ok: true, ...result });
}
