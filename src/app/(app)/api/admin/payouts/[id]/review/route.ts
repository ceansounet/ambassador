import { revalidatePath } from "next/cache";

import { logAdminActionEvent } from "@/lib/admin-action-events";
import { getSafeRedirectUrl, isSameOriginRequest } from "@/lib/http";
import { payoutErrorResponse, requireAdminActorSession } from "@/lib/payouts/http";
import {
  parseAdminComment,
  PAYOUT_STATUS_APPROVED,
  PAYOUT_STATUS_REJECTED,
  retroRejectPayout,
  reviewPayout,
  updatePayoutTransferLink,
} from "@/lib/payouts/service";

export const runtime = "nodejs";

// Form-driven review actions for the admin payout screen. `action` is one of
// approve | reject | comment for pending payouts, or retro_reject |
// update_transfer_link for already-approved ones; the page redirects back to
// itself afterwards.
export async function POST(
  request: Request,
  context: RouteContext<"/api/admin/payouts/[id]/review">,
) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const session = await requireAdminActorSession();
    const { id } = await context.params;
    const formData = await request.formData();

    const action = formData.get("action");
    const adminComment = parseAdminComment(formData.get("adminComment"));
    const publicComment = parseAdminComment(formData.get("publicComment"));

    let payout;

    if (action === "retro_reject") {
      const reverse = formData.get("mode") === "reverse";
      payout = await retroRejectPayout({
        payoutId: id,
        adminUserId: session.sub,
        reverse,
        adminComment,
        publicComment,
      });

      await logAdminActionEvent({
        actorUserId: session.sub,
        targetUserId: payout.userId,
        action: "payout_retro_rejected",
        metadata: { payoutId: id, amountCents: payout.amountCents, reversed: reverse },
      });
    } else if (action === "update_transfer_link") {
      const updated = await updatePayoutTransferLink({
        payoutId: id,
        transferLink: formData.get("transferLink"),
      });
      payout = updated.payout;

      await logAdminActionEvent({
        actorUserId: session.sub,
        targetUserId: payout.userId,
        action: "payout_transfer_link_updated",
        metadata: {
          payoutId: id,
          previousTransferLink: updated.previousTransferLink,
          transferLink: payout.transferLink,
        },
      });
    } else {
      const status =
        action === "approve"
          ? PAYOUT_STATUS_APPROVED
          : action === "reject"
            ? PAYOUT_STATUS_REJECTED
            : null;

      const forfeit = status === PAYOUT_STATUS_REJECTED && formData.get("mode") === "freeze";

      payout = await reviewPayout({
        payoutId: id,
        adminUserId: session.sub,
        status,
        transferLink: formData.get("transferLink"),
        adminComment,
        publicComment,
        rejectMode: forfeit ? "freeze" : "reverse",
      });

      if (status !== null) {
        await logAdminActionEvent({
          actorUserId: session.sub,
          targetUserId: payout.userId,
          action: "payout_reviewed",
          metadata: {
            payoutId: id,
            status,
            amountCents: payout.amountCents,
            ...(status === PAYOUT_STATUS_REJECTED ? { forfeited: forfeit } : {}),
          },
        });
      }
    }

    revalidatePath("/admin/payouts");
    revalidatePath(`/admin/payouts/${id}`);
    revalidatePath(`/admin/users/${payout.userId}`);
    revalidatePath("/dashboard");
    revalidatePath("/payouts");

    return Response.redirect(
      getSafeRedirectUrl(request, formData.get("redirectTo"), `/admin/payouts/${id}`),
    );
  } catch (error) {
    return payoutErrorResponse(error);
  }
}
