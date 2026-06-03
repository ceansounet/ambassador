import { revalidatePath } from "next/cache";

import { getSafeRedirectUrl, isSameOriginRequest } from "@/lib/http";
import { readJsonOrForm, payoutErrorResponse, requireAdminActorSession } from "@/lib/payouts/http";
import { addPayoutNote } from "@/lib/payouts/service";

export const runtime = "nodejs";

// Append an internal note to a payout (any status). Notes are admin-only and
// never shown to the ambassador.
export async function POST(
  request: Request,
  context: RouteContext<"/api/admin/payouts/[id]/notes">,
) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const session = await requireAdminActorSession();
    const { id } = await context.params;
    const { data, isForm } = await readJsonOrForm(request);

    const note = await addPayoutNote({
      payoutId: id,
      authorUserId: session.sub,
      note: typeof data.note === "string" ? data.note : "",
    });

    revalidatePath(`/admin/payouts/${id}`);

    if (isForm) {
      return Response.redirect(
        getSafeRedirectUrl(request, data.redirectTo as string | null, `/admin/payouts/${id}`),
      );
    }

    return Response.json({ note }, { status: 201 });
  } catch (error) {
    return payoutErrorResponse(error);
  }
}
