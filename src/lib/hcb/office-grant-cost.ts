import "server-only";

import { optionalEnv } from "@/lib/env";

// The Stardance marketing campaign org on HCB. Its grant spend lives in the
// public Transparency API (read-only, no auth):
// https://hcb.hackclub.com/stardance-marketing-campaign/transactions
const HCB_API_BASE = "https://hcb.hackclub.com/api/v3";
const DEFAULT_ORG_SLUG = "stardance-marketing-campaign";
const CACHE_TTL_MS = 60 * 60 * 1000; // refresh hourly
const PER_PAGE = 100;
const MAX_PAGES = 50; // backstop against a runaway pagination loop
const FETCH_TIMEOUT_MS = 10_000;

// Topups are sometimes booked as a plain transfer ("Topup of grant to Jane")
// instead of a card_grant, so we recognise them by memo.
const GRANT_TOPUP_MEMO = /top\s?up of grant/i;

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

function getOrgSlug() {
  return optionalEnv("STARDANCE_HCB_ORG_SLUG") ?? DEFAULT_ORG_SLUG;
}

/**
 * Money the campaign has put toward ambassador grants. Counts only outgoing
 * (negative) transactions, so a grant that was later cancelled still counts:
 * its original disbursement is negative here, and the refund comes back as a
 * separate positive transfer we ignore.
 * - card_grant: office grants, plus topups booked as card grants
 * - transfer with a "Topup of grant to ..." memo: topups booked as transfers
 * - reimbursed_expense: reimbursements paid to ambassadors (hcb_email users)
 * Marketing card charges, Wise/ACH payouts, and incoming funding are excluded.
 */
function isOfficeGrantSpend(txn: HcbTransaction) {
  const amountCents = Number(txn.amount_cents);
  if (!Number.isFinite(amountCents) || amountCents >= 0) {
    return false;
  }

  if (txn.type === "card_grant" || txn.type === "reimbursed_expense") {
    return true;
  }

  return txn.type === "transfer" && GRANT_TOPUP_MEMO.test(txn.memo ?? "");
}

async function fetchOfficeGrantCost(): Promise<OfficeGrantCost> {
  const slug = encodeURIComponent(getOrgSlug());
  let cents = 0;
  let grantCount = 0;
  let totalPages = 1;
  let page = 1;

  while (page <= totalPages && page <= MAX_PAGES) {
    const response = await fetch(
      `${HCB_API_BASE}/organizations/${slug}/transactions?per_page=${PER_PAGE}&page=${page}`,
      { cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
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

  return {
    cents,
    grantCount,
    fetchedAt: new Date().toISOString(),
    stale: false,
  };
}

/**
 * Total office-grant spend in cents, cached for an hour. Pass forceRefresh to
 * bypass the cache. If HCB is unreachable a previously cached value is returned
 * with stale=true; with no cache at all the error propagates to the caller.
 */
export async function getOfficeGrantCost(
  options: { forceRefresh?: boolean } = {},
): Promise<OfficeGrantCost> {
  if (!options.forceRefresh && cached !== null && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  try {
    const data = await fetchOfficeGrantCost();
    cached = { data, expiresAt: Date.now() + CACHE_TTL_MS };
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
