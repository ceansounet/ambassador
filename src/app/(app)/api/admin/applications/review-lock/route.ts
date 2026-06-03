import { isUserAdmin } from "@/lib/applications/review";
import { isSameOriginRequest } from "@/lib/http";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { getActorSession } from "@/lib/session";
import sql from "@/lib/database/client";

/** Acquire or refresh a lock on an application */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const session = await getActorSession();
  if (!session) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  await ensureSchema();
  if (!(await isUserAdmin(session.sub))) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const applicationId = body.applicationId;

  if (typeof applicationId !== "string" || applicationId.trim() === "") {
    return Response.json({ error: "invalid_application_id" }, { status: 400 });
  }

  // Clear expired locks
  await sql`
    DELETE FROM review_locks
    WHERE locked_at < NOW() - make_interval(secs => ${10}::double precision)
  `;

  // Check if someone else holds the lock
  const existingLock = (await sql<{ locked_by: string; locked_by_name: string | null }[]>`
    SELECT locked_by, locked_by_name
    FROM review_locks
    WHERE application_id = ${applicationId}
      AND locked_by != ${session.sub}
      AND locked_at >= NOW() - make_interval(secs => ${10}::double precision)
    LIMIT 1
  `).at(0);

  if (existingLock) {
    return Response.json({
      locked: true,
      lockedBy: existingLock.locked_by_name ?? "Another admin",
    });
  }

  // Upsert our lock
  await sql`
    INSERT INTO review_locks (application_id, locked_by, locked_by_name, locked_at)
    VALUES (${applicationId}, ${session.sub}, ${session.displayName}, NOW())
    ON CONFLICT (application_id)
    DO UPDATE SET locked_by = ${session.sub}, locked_by_name = ${session.displayName}, locked_at = NOW()
  `;

  return Response.json({ locked: false });
}

/** Release a lock */
export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const session = await getActorSession();
  if (!session) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  await ensureSchema();
  if (!(await isUserAdmin(session.sub))) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const applicationId = body.applicationId;

  if (typeof applicationId !== "string") {
    return Response.json({ error: "invalid_application_id" }, { status: 400 });
  }

  await sql`
    DELETE FROM review_locks
    WHERE application_id = ${applicationId} AND locked_by = ${session.sub}
  `;

  return Response.json({ ok: true });
}
