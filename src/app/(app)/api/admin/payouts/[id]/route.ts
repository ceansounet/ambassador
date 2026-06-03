import { revalidatePath } from "next/cache";

import { logAdminActionEvent } from "@/lib/admin-action-events";
import { isSameOriginRequest } from "@/lib/http";
import { readJsonObject, payoutErrorResponse, requireAdminActorSession } from "@/lib/payouts/http";
import {
  getAdminPayout,
  parseAdminComment,
  PAYOUT_STATUS_APPROVED,
  PAYOUT_STATUS_REJECTED,
  reviewPayout,
  type PayoutStatus,
} from "@/lib/payouts/service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/admin/payouts/[id]">,
) {
  try {
    await requireAdminActorSession();
    const { id } = await context.params;
    return Response.json({ payout: await getAdminPayout(id) });
  } catch (error) {
    return payoutErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/admin/payouts/[id]">,
) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const session = await requireAdminActorSession();
    const { id } = await context.params;
    const payload = await readJsonObject(request);
    const statusValue = typeof payload.status === "string" ? payload.status : null;
    const status: PayoutStatus | null =
      statusValue === PAYOUT_STATUS_APPROVED || statusValue === PAYOUT_STATUS_REJECTED
        ? statusValue
        : null;

    if (payload.status !== undefined && status === null) {
      return Response.json({ error: "invalid_status" }, { status: 400 });
    }

    const forfeit = status === PAYOUT_STATUS_REJECTED && payload.mode === "freeze";

    const payout = await reviewPayout({
      payoutId: id,
      adminUserId: session.sub,
      status,
      transferLink: payload.transferLink,
      adminComment: parseAdminComment(payload.adminComment ?? payload.comment),
      publicComment: parseAdminComment(payload.publicComment),
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

    revalidatePath("/admin/payouts");
    revalidatePath(`/admin/payouts/${id}`);
    revalidatePath(`/admin/users/${payout.userId}`);
    revalidatePath("/dashboard");

    return Response.json({ payout });
  } catch (error) {
    return payoutErrorResponse(error);
  }
}
