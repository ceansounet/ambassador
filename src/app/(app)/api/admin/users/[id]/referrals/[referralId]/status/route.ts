import { revalidatePath } from "next/cache";

import { logAdminActionEvent } from "@/lib/admin-action-events";
import { isUserAdmin } from "@/lib/applications/review";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { getSafeRedirectUrl, isSameOriginRequest } from "@/lib/http";
import {
  assertReferralUnlockedForReview,
  PayoutRequestError,
} from "@/lib/payouts/service";
import { getActorSession } from "@/lib/session";

export const runtime = "nodejs";

const ALLOWED_STATUSES = new Set([
  "unverified",
  "pending",
  "verified",
  "rejected",
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; referralId: string }> },
) {
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

  const { id, referralId } = await params;
  const formData = await request.formData();
  const rawStatus = formData.get("status");
  const status = typeof rawStatus === "string" ? rawStatus.trim() : "";

  if (!ALLOWED_STATUSES.has(status)) {
    return Response.json({ error: "invalid_status" }, { status: 400 });
  }

  // Referrals locked in a payout are only reviewable from that payout's
  // screen (which sends its payoutId along), never from the user page.
  const viaPayoutId = formData.get("payoutId");
  try {
    await assertReferralUnlockedForReview(
      referralId,
      typeof viaPayoutId === "string" && viaPayoutId !== "" ? viaPayoutId : null,
    );
  } catch (error) {
    if (error instanceof PayoutRequestError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const [referral] = await sql<
    { id: string; user_id: string; verification_status: string }[]
  >`
    UPDATE stardance_referrals
    SET verification_status = ${status}
    WHERE id = ${referralId} AND user_id = ${id} AND verification_status <> 'rsvp'
    RETURNING id, user_id, verification_status
  `;

  if (!referral) {
    const [existing] = await sql<{ verification_status: string }[]>`
      SELECT verification_status
      FROM stardance_referrals
      WHERE id = ${referralId} AND user_id = ${id}
      LIMIT 1
    `;

    if (existing?.verification_status === "rsvp") {
      return Response.json({ error: "cannot_modify_rsvp" }, { status: 400 });
    }

    return Response.json({ error: "not_found" }, { status: 404 });
  }

  await logAdminActionEvent({
    actorUserId: session.sub,
    targetUserId: referral.user_id,
    action: "referral_status_updated_by_admin",
    metadata: {
      referralId: referral.id,
      nextStatus: status,
    },
  });

  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/admin/audit-log");

  return Response.redirect(
    getSafeRedirectUrl(request, formData.get("redirectTo"), `/admin/users/${id}#referrals`),
  );
}
