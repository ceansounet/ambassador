import { isSameOriginRequest } from "@/lib/http";
import { payoutErrorResponse, requireAdminActorSession } from "@/lib/payouts/http";
import { getNextPendingPayoutId } from "@/lib/payouts/service";

export const runtime = "nodejs";

/** The next oldest pending payout, excluding any skipped ids: the FIFO review queue. */
export async function GET(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    await requireAdminActorSession();

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

    return Response.json({ id: await getNextPendingPayoutId(excludeIds) });
  } catch (error) {
    return payoutErrorResponse(error);
  }
}
