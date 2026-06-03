import { findHcbTransactionsByAmount } from "@/lib/hcb/transparency";
import { payoutErrorResponse, requireAdminActorSession } from "@/lib/payouts/http";
import { getAdminPayout } from "@/lib/payouts/service";

export const runtime = "nodejs";

// Best-effort sanity check for the approve modal: does HCB's public ledger
// show a transaction matching this payout's amount? Purely informational.
// Approval never blocks on it.
export async function GET(
  _request: Request,
  context: RouteContext<"/api/admin/payouts/[id]/transfer-check">,
) {
  try {
    await requireAdminActorSession();
    const { id } = await context.params;
    const payout = await getAdminPayout(id);
    const matches = await findHcbTransactionsByAmount(payout.amountCents);

    return Response.json({ available: matches !== null, matches: matches ?? [] });
  } catch (error) {
    return payoutErrorResponse(error);
  }
}
