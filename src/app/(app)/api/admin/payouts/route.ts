import { revalidatePath } from "next/cache";

import { logAdminActionEvent } from "@/lib/admin-action-events";
import { getSafeRedirectUrl, isSameOriginRequest } from "@/lib/http";
import { readJsonOrForm, payoutErrorResponse, requireAdminActorSession } from "@/lib/payouts/http";
import {
  createManualPayout,
  findUserIdByIdOrEmail,
  listAdminPayouts,
  parseAdminComment,
  parseBalanceAdjustmentCents,
  parseBalanceAdjustmentUsd,
  parseBankInfo,
} from "@/lib/payouts/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdminActorSession();
    const status = new URL(request.url).searchParams.get("status");
    return Response.json(await listAdminPayouts(status));
  } catch (error) {
    return payoutErrorResponse(error);
  }
}

// Create a *manual* payout: a one-off, fixed-amount payment to an ambassador
// that has nothing to do with their balance: no line items, no ledger debit.
// It lands in the same pending review queue and is approved with an HCB
// transfer link like any other payout.
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const session = await requireAdminActorSession();
    const { data, isForm } = await readJsonOrForm(request);

    const userId = await findUserIdByIdOrEmail(data.user ?? data.userId);
    if (userId === null) {
      return Response.json({ error: "user_not_found" }, { status: 404 });
    }

    const amountCents =
      data.amountUsd !== undefined && data.amountUsd !== null && data.amountUsd !== ""
        ? parseBalanceAdjustmentUsd(data.amountUsd)
        : parseBalanceAdjustmentCents(data.amountCents);

    const payout = await createManualPayout({
      userId,
      adminUserId: session.sub,
      amountCents,
      bankInfo: parseBankInfo(data),
      internalNote: parseAdminComment(data.internalNote),
    });

    await logAdminActionEvent({
      actorUserId: session.sub,
      targetUserId: userId,
      action: "payout_manual_created",
      metadata: { payoutId: payout.id, amountCents: payout.amountCents },
    });

    revalidatePath("/admin/payouts");
    revalidatePath(`/admin/users/${userId}`);
    revalidatePath("/dashboard");
    revalidatePath("/payouts");

    if (isForm) {
      return Response.redirect(
        getSafeRedirectUrl(request, `/admin/payouts/${payout.id}`, "/admin/payouts"),
      );
    }

    return Response.json({ payout }, { status: 201 });
  } catch (error) {
    return payoutErrorResponse(error);
  }
}
