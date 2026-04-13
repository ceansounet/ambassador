import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  await ensureSchema();

  const [application] = await sql`
    SELECT id, status, name, date_of_birth, created_at
    FROM applications WHERE user_id = ${session.sub}
    ORDER BY created_at DESC LIMIT 1
  `;

  return Response.json({ application: application ?? null });
}

export async function POST() {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  await ensureSchema();

  return Response.json({ error: "deprecated" }, { status: 410 });
}
