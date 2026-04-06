import sql from "@/lib/db";
import { ensureSchema } from "@/lib/ensure-schema";
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

  // Deprecated in favor of the external Fillout -> Airtable -> Postgres sync flow.
  // The old on-site form handling is intentionally left here as comments.
  //
  // const [user] = await sql`
  //   SELECT permanently_rejected_at
  //   FROM users
  //   WHERE id = ${session.sub}
  //   LIMIT 1
  // `;
  //
  // if (user?.permanently_rejected_at) {
  //   return Response.json({ error: "permanently_rejected" }, { status: 403 });
  // }
  //
  // const [existing] = await sql`
  //   SELECT id FROM applications WHERE user_id = ${session.sub} LIMIT 1
  // `;
  // if (existing) {
  //   return Response.json({ error: "already_applied" }, { status: 409 });
  // }
  //
  // const body = await request.json();
  // const ip =
  //   request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  //   request.headers.get("x-real-ip") ??
  //   "unknown";
  //
  // const id = crypto.randomUUID();
  //
  // await sql`
  //   INSERT INTO applications (id, user_id, name, date_of_birth, field_3, field_4, field_5, field_6, submitted_ip)
  //   VALUES (
  //     ${id},
  //     ${session.sub},
  //     ${body.name ?? null},
  //     ${body.dateOfBirth ?? null},
  //     ${body.field3 ?? null},
  //     ${body.field4 ?? null},
  //     ${body.field5 ?? null},
  //     ${body.field6 ?? null},
  //     ${ip}
  //   )
  // `;
  //
  // geocodeIp(ip, "applications", id).catch(() => {});
  //
  // return Response.json({ id, status: "pending" }, { status: 201 });

  return Response.json({ error: "deprecated" }, { status: 410 });
}
