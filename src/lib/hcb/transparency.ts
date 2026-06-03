import "server-only";

// HCB's public Transparency API (read-only, no auth). Share links like
// hcb.hackclub.com/hcb/<hashid> use HcbCode hashids that the API can't
// resolve, so the closest verification for a pasted transfer link is matching
// the payout amount against the org's recent ledger. Only works while the
// payout org has Transparency Mode enabled.
const HCB_API_BASE = "https://hcb.hackclub.com/api/v3";

export type HcbAmountMatch = {
  date: string;
  memo: string | null;
  type: string;
  pending: boolean;
};

/**
 * Best-effort: recent org transactions whose absolute amount equals
 * `amountCents`. Returns `null` when the lookup isn't possible (no
 * `HCB_PAYOUT_ORG_SLUG` configured, org not transparent, network failure) so
 * callers can tell "couldn't check" apart from "checked, found nothing".
 */
export async function findHcbTransactionsByAmount(
  amountCents: number,
): Promise<HcbAmountMatch[] | null> {
  const orgSlug = process.env.HCB_PAYOUT_ORG_SLUG?.trim();
  if (!orgSlug || amountCents <= 0) {
    return null;
  }

  try {
    const response = await fetch(
      `${HCB_API_BASE}/organizations/${encodeURIComponent(orgSlug)}/transactions?per_page=100`,
      { cache: "no-store", signal: AbortSignal.timeout(5_000) },
    );

    if (!response.ok) {
      return null;
    }

    const transactions = (await response.json()) as Array<{
      amount_cents?: number;
      date?: string;
      memo?: string | null;
      type?: string;
      pending?: boolean;
    }>;

    if (!Array.isArray(transactions)) {
      return null;
    }

    return transactions
      .filter((txn) => Math.abs(Number(txn.amount_cents)) === amountCents)
      .slice(0, 5)
      .map((txn) => ({
        date: txn.date ?? "",
        memo: txn.memo ?? null,
        type: txn.type ?? "transaction",
        pending: txn.pending === true,
      }));
  } catch {
    return null;
  }
}
