import { revalidatePath } from "next/cache";

import { logAdminActionEvent } from "@/lib/admin-action-events";
import { getSafeRedirectUrl, isSameOriginRequest } from "@/lib/http";
import {
  readJsonOrForm,
  payoutErrorResponse,
  requireAdminActorSession,
} from "@/lib/payouts/http";
import {
  adjustUserBalance,
  parseAdminComment,
  parseBalanceAdjustmentCents,
  parseBalanceAdjustmentUsd,
  parseRequiredReason,
} from "@/lib/payouts/service";

export const runtime = "nodejs";

// Manual balance adjustment. Used both by the admin UI (form post, redirects
// back) and programmatically for meetup payouts (JSON, returns the new balance).
export async function POST(
  request: Request,
  context: RouteContext<"/api/admin/users/[id]/balance">,
) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const session = await requireAdminActorSession();
    const { id } = await context.params;
    const { data, isForm } = await readJsonOrForm(request);

    // The admin UI posts dollars; programmatic callers (meetup script) send cents.
    const amountCents =
      data.amountUsd !== undefined && data.amountUsd !== null && data.amountUsd !== ""
        ? parseBalanceAdjustmentUsd(data.amountUsd)
        : parseBalanceAdjustmentCents(data.amountCents);
    const note = parseRequiredReason(data.note ?? data.reason, "reason");
    const publicNote = parseAdminComment(data.publicNote);

    const result = await adjustUserBalance({
      userId: id,
      adminUserId: session.sub,
      amountCents,
      note,
      publicNote,
      payoutId: typeof data.payoutId === "string" && data.payoutId !== "" ? data.payoutId : null,
    });

    await logAdminActionEvent({
      actorUserId: session.sub,
      targetUserId: id,
      action: "payout_balance_adjusted",
      metadata: {
        amountCents,
        balanceAfterCents: result.balanceCents,
        reason: note,
        publicNote: publicNote ?? null,
      },
    });

    revalidatePath(`/admin/users/${id}`);
    revalidatePath("/admin/payouts");
    revalidatePath("/dashboard");
    revalidatePath("/payouts");

    if (isForm) {
      return Response.redirect(
        getSafeRedirectUrl(request, data.redirectTo as string, `/admin/users/${id}#balance`),
      );
    }

    return Response.json(result);
  } catch (error) {
    return payoutErrorResponse(error);
  }
}
