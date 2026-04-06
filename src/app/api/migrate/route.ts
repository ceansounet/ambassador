import { migrate } from "@/lib/migrate";

function isAuthorized(request: Request) {
  const secret = process.env.MIGRATE_SECRET?.trim() || process.env.CRON_SECRET?.trim();

  if (secret) {
    return request.headers.get("authorization") === `Bearer ${secret}`;
  }

  return process.env.NODE_ENV !== "production";
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  await migrate();
  return Response.json({ ok: true });
}
