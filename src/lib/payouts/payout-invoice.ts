import "server-only";

import { createInvoicePdf, type Invoice, type InvoicePayment } from "@/lib/payouts/pdf";

// The full, joined payout shape returned by getAdminPayout (ambassador identity,
// address, banking details and amount). Referenced as a type only.
type PayoutDetails = Awaited<ReturnType<typeof import("@/lib/payouts/service").getAdminPayout>>;

function buildAddressLines(address: PayoutDetails["ambassador"]["address"]): string[] {
  const street = [address.line1, address.line2].filter(Boolean).join(", ");
  const region = [
    [address.city, address.state, address.country].filter(Boolean).join(", "),
    address.postalCode,
  ]
    .filter(Boolean)
    .join(" - ");
  return [street, region].filter((line) => line.length > 0);
}

function buildPayment(payout: PayoutDetails): InvoicePayment {
  if (payout.bankTransferMethod === "wise") {
    if (!payout.iban) {
      throw new Error("Payout is missing an IBAN for a Wise transfer.");
    }
    return { method: "wise", bankName: payout.bankingInstitutionName, iban: payout.iban };
  }

  if (!payout.accountNumber || !payout.routingNumber) {
    throw new Error("Payout is missing account/routing numbers for an ACH transfer.");
  }
  return {
    method: "ach",
    bankName: payout.bankingInstitutionName,
    accountNumber: payout.accountNumber,
    routingNumber: payout.routingNumber,
  };
}

/** Map a payout (as returned by getAdminPayout) onto the invoice SDK input. */
export function buildPayoutInvoice(payout: PayoutDetails): Invoice {
  return {
    number: payout.id,
    issued: new Date(payout.submittedAt),
    from: {
      name: payout.ambassador.legalName ?? payout.ambassador.displayName,
      addressLines: buildAddressLines(payout.ambassador.address),
      email: payout.ambassador.email ?? undefined,
    },
    service: {
      description: "Honorarium for Stardance Ambassador volunteering",
      amountCents: payout.amountCents,
    },
    payment: buildPayment(payout),
  };
}

/** Render a payout invoice PDF from the joined payout details. */
export function renderPayoutInvoicePdf(payout: PayoutDetails) {
  return createInvoicePdf(buildPayoutInvoice(payout));
}
