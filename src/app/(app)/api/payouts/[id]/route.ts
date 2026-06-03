import { payoutErrorResponse, requirePayoutSession } from "@/lib/payouts/http";
import { getPayoutForUser } from "@/lib/payouts/service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/payouts/[id]">,
) {
  try {
    const session = await requirePayoutSession();
    const { id } = await context.params;
    return Response.json({ payout: await getPayoutForUser(session.sub, id) });
  } catch (error) {
    return payoutErrorResponse(error);
  }
}
