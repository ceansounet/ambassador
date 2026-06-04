import "server-only";

import sql from "@/lib/database/client";
import {
  listHcbOrganizationCardGrants,
  listHcbOrganizationTransactions,
} from "@/lib/hcb/service";

export type OfficeGrantCost = {
  /** Actual spend out of active office grants (amount granted minus what's left). */
  grantCents: number;
  /** The US share of grantCents (grants linked to a United States ambassador). */
  grantCentsUS: number;
  /** Reimbursement (expense) payouts that left the org. */
  reimbursementCents: number;
  grantCount: number;
  reimbursementCount: number;
  fetchedAt: string;
  /** True when HCB couldn't be reached and a previously cached value is served. */
  stale: boolean;
};

// The campaign's HCB org (org_lbu4gX is the slug stardance-marketing-campaign);
// office grants are issued from, and reimbursements are paid out of, this org.
const HCB_CAMPAIGN_ORGANIZATION_ID = "org_lbu4gX";

let cached: { data: OfficeGrantCost; expiresAt: number } | null = null;

async function fetchOfficeGrantCost(): Promise<OfficeGrantCost> {
  const [grants, transactions, usGrantRows] = await Promise.all([
    listHcbOrganizationCardGrants(HCB_CAMPAIGN_ORGANIZATION_ID, { expandBalance: true }),
    listHcbOrganizationTransactions(HCB_CAMPAIGN_ORGANIZATION_ID),
    // Grants linked to a United States ambassador, so spend can be split US vs
    // not. A grant HCB knows about but we haven't linked falls outside this set.
    sql<{ grant_id: string }[]>`
      SELECT grants.grant_id
      FROM user_hcb_grants grants
      JOIN users ON users.id = grants.user_id
      WHERE grants.grant_id IS NOT NULL
        AND users.ambassador_region = 'United States'
    `,
  ]);

  const usGrantIds = new Set(usGrantRows.map((row) => row.grant_id));

  // Actual spend out of office grants: how much each active grant has drawn
  // down (granted amount minus the balance still on the card). Canceled grants
  // are refunded to a zero balance, so amount-minus-balance would read as fully
  // spent; skip them rather than count the refund as spend.
  let grantCents = 0;
  let grantCentsUS = 0;
  let grantCount = 0;
  for (const grant of grants) {
    if (grant.status !== "active" || grant.balanceCents === null) {
      continue;
    }
    const spentCents = grant.amountCents - grant.balanceCents;
    if (spentCents <= 0) {
      continue;
    }
    grantCents += spentCents;
    grantCount += 1;
    if (usGrantIds.has(grant.id)) {
      grantCentsUS += spentCents;
    }
  }

  // Reimbursements: expense payouts out of the org. Outgoing (negative) amounts
  // only; a reversed or declined payout never actually left the org.
  let reimbursementCents = 0;
  let reimbursementCount = 0;
  for (const txn of transactions) {
    if (txn.expensePayoutReportId === null || txn.reversed || txn.declined || txn.amountCents >= 0) {
      continue;
    }
    reimbursementCents += Math.abs(txn.amountCents);
    reimbursementCount += 1;
  }

  return {
    grantCents,
    grantCentsUS,
    reimbursementCents,
    grantCount,
    reimbursementCount,
    fetchedAt: new Date().toISOString(),
    stale: false,
  };
}

/**
 * Office-grant cost in cents from the campaign's HCB org via the authenticated
 * v4 API, cached for an hour. The total is the actual spend out of active
 * grants plus reimbursement payouts. Pass forceRefresh to bypass the cache. If HCB is
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
