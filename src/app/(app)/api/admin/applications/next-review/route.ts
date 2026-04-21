import { isUserAdmin } from "@/lib/applications/review";
import { isSameOriginRequest } from "@/lib/http";
import { APPLICATION_STATUS_PENDING_REVIEW } from "@/lib/applications/status";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { getActorSession } from "@/lib/session";
import sql from "@/lib/database/client";

const LOCK_TTL_SECONDS = 10;

/** Get the next oldest pending-review application that is not locked by someone else */
export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const excludeIds = Array.from(
    new Set(
      url.searchParams
        .getAll("exclude")
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter((value) => value !== ""),
    ),
  );

  // Clear expired locks
  await sql`
    DELETE FROM review_locks
    WHERE locked_at < NOW() - make_interval(secs => ${LOCK_TTL_SECONDS}::double precision)
  `;

  // Find the oldest pending-review application that:
  // 1. Is the latest application for the user
  // 2. Is not locked by someone else
  const nextApplication = (await sql<{ id: string }[]>`
    SELECT a.id
    FROM applications a
    LEFT JOIN LATERAL (
      SELECT id
      FROM applications
      WHERE (a.user_id IS NOT NULL AND user_id = a.user_id)
         OR (a.user_id IS NULL AND a.applicant_email IS NOT NULL AND user_id IS NULL AND LOWER(applicant_email) = LOWER(a.applicant_email))
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    ) latest ON true
    LEFT JOIN review_locks rl ON rl.application_id = a.id
      AND rl.locked_by != ${session.sub}
      AND rl.locked_at >= NOW() - make_interval(secs => ${LOCK_TTL_SECONDS}::double precision)
    WHERE a.status = ${APPLICATION_STATUS_PENDING_REVIEW}
      AND a.review_on_hold IS NOT TRUE
      AND COALESCE(latest.id, a.id) = a.id
      AND rl.application_id IS NULL
      AND NOT (a.id = ANY(${excludeIds}))
    ORDER BY a.created_at ASC
    LIMIT 1
  `).at(0);

  if (!nextApplication) {
    return Response.json({ id: null });
  }

  return Response.json({ id: nextApplication.id });
}
