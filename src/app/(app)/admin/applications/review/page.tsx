import { redirect } from "next/navigation";

import { isUserAdmin } from "@/lib/applications/review";
import { APPLICATION_STATUS_PENDING_REVIEW } from "@/lib/applications/status";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { getActorSession } from "@/lib/session";
import sql from "@/lib/database/client";

/** Entry point: redirects to the oldest unlocked pending-review application */
export default async function ReviewModeEntryPage() {
  const session = await getActorSession();
  if (!session) redirect("/admin/applications");

  await ensureSchema();
  if (!(await isUserAdmin(session.sub))) redirect("/admin/applications");

  // Clear expired locks
  await sql`
    DELETE FROM review_locks
    WHERE locked_at < NOW() - make_interval(secs => ${10}::double precision)
  `;

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
      AND rl.locked_at >= NOW() - make_interval(secs => ${10}::double precision)
    WHERE a.status = ${APPLICATION_STATUS_PENDING_REVIEW}
      AND a.review_on_hold IS NOT TRUE
      AND COALESCE(latest.id, a.id) = a.id
      AND rl.application_id IS NULL
    ORDER BY a.created_at ASC
    LIMIT 1
  `).at(0);

  if (!nextApplication) {
    redirect("/admin/applications");
  }

  redirect(`/admin/applications/review/${nextApplication.id}`);
}
