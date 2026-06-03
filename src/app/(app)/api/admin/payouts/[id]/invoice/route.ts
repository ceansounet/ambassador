import { payoutErrorResponse, requireAdminActorSession } from "@/lib/payouts/http";
import { renderPayoutInvoicePdf } from "@/lib/payouts/payout-invoice";
import { getAdminPayout } from "@/lib/payouts/service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/admin/payouts/[id]/invoice">,
) {
  try {
    await requireAdminActorSession();
    const { id } = await context.params;
    const payout = await getAdminPayout(id);
    const pdf = await renderPayoutInvoicePdf(payout);

    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="hcb-transfer-payout-${payout.id}.pdf"`,
      },
    });
  } catch (error) {
    return payoutErrorResponse(error, "invoice_error");
  }
}
