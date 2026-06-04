import "server-only";

type HcbTransaction = {
  amount_cents?: number;
  type?: string;
  memo?: string | null;
};

export type OfficeGrantCost = {
  cents: number;
  grantCount: number;
  fetchedAt: string;
  /** True when HCB couldn't be reached and a previously cached value is served. */
  stale: boolean;
};

let cached: { data: OfficeGrantCost; expiresAt: number } | null = null;

// Outgoing (negative) grant spend only, so a later-cancelled grant still counts
// (its refund returns as a separate positive transfer we ignore). card_grant and
// reimbursed_expense are grants/reimbursements; topups are sometimes booked as a
// plain transfer with a "Topup of grant to ..." memo.
function isOfficeGrantSpend(txn: HcbTransaction) {
  const amountCents = Number(txn.amount_cents);
  if (!Number.isFinite(amountCents) || amountCents >= 0) {
    return false;
  }

  if (txn.type === "card_grant" || txn.type === "reimbursed_expense") {
    return true;
  }

  return txn.type === "transfer" && /top\s?up of grant/i.test(txn.memo ?? "");
}

async function fetchOfficeGrantCost(): Promise<OfficeGrantCost> {
  let cents = 0;
  let grantCount = 0;
  let totalPages = 1;
  let page = 1;

  while (page <= totalPages && page <= 50) {
    const response = await fetch(
      `https://hcb.hackclub.com/api/v3/organizations/stardance-marketing-campaign/transactions?per_page=100&page=${page}`,
      { cache: "no-store", signal: AbortSignal.timeout(10_000) },
    );

    if (!response.ok) {
      throw new Error(`HCB transactions request failed (${response.status})`);
    }

    const headerPages = Number(response.headers.get("x-total-pages"));
    if (Number.isFinite(headerPages) && headerPages >= 1) {
      totalPages = headerPages;
    }

    const transactions: unknown = await response.json();
    if (!Array.isArray(transactions)) {
      throw new Error("Unexpected HCB transactions payload");
    }

    for (const txn of transactions as HcbTransaction[]) {
      if (isOfficeGrantSpend(txn)) {
        cents += Math.abs(Number(txn.amount_cents));
        grantCount += 1;
      }
    }

    page += 1;
  }

  return { cents, grantCount, fetchedAt: new Date().toISOString(), stale: false };
}

/**
 * Total office-grant spend in cents from the campaign's HCB Transparency feed,
 * cached for an hour. Pass forceRefresh to bypass the cache. If HCB is
 * unreachable a previously cached value is returned with stale=true; with no
 * cache at all the error propagates to the caller.
 */
export async function getOfficeGrantCost(
  options: { forceRefresh?: boolean } = {},
): Promise<OfficeGrantCost> {
  if (!options.forceRefresh && cached !== null && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  try {
    const data = await fetchOfficeGrantCost();
    cached = { data, expiresAt: Date.now() + 60 * 60 * 1000 };
    return data;
  } catch (error) {
    if (cached !== null) {
      return { ...cached.data, stale: true };
    }
    throw error;
  }
}

/** Drop the cached value so the next read re-fetches (e.g. after a new grant). */
export function clearOfficeGrantCostCache() {
  cached = null;
}
