import { timingSafeEqual } from "node:crypto";

import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { optionalEnv } from "@/lib/env";
import { getOfficeGrantCost } from "@/lib/hcb/office-grant-cost";
import { POSTER_PAYOUT_CENTS, REFERRAL_PAYOUT_CENTS } from "@/lib/payouts/service";
import { SHIRT_SIZES, shirtSku } from "@/lib/shop";
import { WarehouseApiClient } from "@/lib/warehouse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACCESS_KEY_ENV = "STARDANCE_DATA_ACCESS_KEY";

/** The presented key, from a header (preferred) or a `?key=` query param. */
function presentedKey(request: Request): string | null {
  const direct = request.headers.get("x-stardance-data-access-key")?.trim();
  if (direct) {
    return direct;
  }

  const auth = request.headers.get("authorization")?.trim();
  if (auth) {
    return auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : auth;
  }

  const queryKey = new URL(request.url).searchParams.get("key")?.trim();
  return queryKey ? queryKey : null;
}

function keysMatch(provided: string, expected: string) {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

type CostRow = {
  poster_count: number;
  referral_count: number;
  admin_payout_cents: number;
  positive_adjustment_cents: number;
};

/** Cents to a plain dollar string: no symbol, no thousands separator. */
function usd(cents: number) {
  return (cents / 100).toFixed(2);
}

export async function GET(request: Request) {
  const expectedKey = optionalEnv(ACCESS_KEY_ENV);
  if (!expectedKey) {
    return Response.json(
      { error: "not_configured", detail: `${ACCESS_KEY_ENV} is not set` },
      { status: 503 },
    );
  }

  const provided = presentedKey(request);
  if (!provided || !keysMatch(provided, expectedKey)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  await ensureSchema();

  const forceRefresh = new URL(request.url).searchParams.get("refresh") === "1";
  const shirtSkus = SHIRT_SIZES.map((size) => shirtSku(size));
  const warnings: string[] = [];

  const [costRows, warehouseOrders, linkedRows, grantResult] = await Promise.all([
    sql<CostRow[]>`
      SELECT
        (SELECT COUNT(*) FROM posters
          WHERE verification_status = 'success')::int AS poster_count,
        (SELECT COUNT(*) FROM stardance_referrals
          WHERE verification_status = 'verified')::int AS referral_count,
        (SELECT COALESCE(SUM(amount_cents), 0) FROM payouts
          WHERE created_by_admin_id IS NOT NULL
            AND status = 'approved')::int AS admin_payout_cents,
        (SELECT COALESCE(SUM(amount_cents), 0) FROM payout_balance_events
          WHERE reason = 'manual_adjustment'
            AND amount_cents > 0)::int AS positive_adjustment_cents
    `,
    new WarehouseApiClient().listOrders().catch(() => null),
    sql<{ warehouse_order_id: string }[]>`
      SELECT warehouse_order_id
      FROM orders
      WHERE warehouse_order_id IS NOT NULL
        AND sku = ANY(${shirtSkus}::text[])
    `,
    getOfficeGrantCost({ forceRefresh }).then(
      (data) => ({ ok: true as const, data }),
      (error: unknown) => ({ ok: false as const, error }),
    ),
  ]);

  const costs = costRows.at(0) ?? {
    poster_count: 0,
    referral_count: 0,
    admin_payout_cents: 0,
    positive_adjustment_cents: 0,
  };

  // 1. Posters and 2. referrals: each verified item is worth a fixed rate.
  const posterCents = costs.poster_count * POSTER_PAYOUT_CENTS;
  const referralCents = costs.referral_count * REFERRAL_PAYOUT_CENTS;

  // 3. Shirts: what we paid the warehouse to fulfil ambassador shirt orders
  // that actually shipped. Warehouse costs are in dollars, so round to cents.
  let shirtCents = 0;
  if (warehouseOrders === null) {
    warnings.push("shirt_cost_unavailable: warehouse API request failed");
  } else {
    const ambassadorOrderIds = new Set(linkedRows.map((r) => r.warehouse_order_id));
    let shirtDollars = 0;
    for (const order of warehouseOrders) {
      if (
        (order.status === "dispatched" || order.status === "mailed") &&
        ambassadorOrderIds.has(order.id)
      ) {
        shirtDollars +=
          Number(order.contents_cost ?? 0) +
          Number(order.labor_cost ?? 0) +
          Number(order.postage_cost ?? 0);
      }
    }
    shirtCents = Math.round(shirtDollars * 100);
  }

  // 4. Admin spend: admin-created payouts that were paid out, plus positive
  // manual balance adjustments.
  const adminCents = costs.admin_payout_cents + costs.positive_adjustment_cents;

  // 5. Office grants: grant spend out of the campaign's HCB org.
  let grantCents = 0;
  if (grantResult.ok) {
    grantCents = grantResult.data.cents;
    if (grantResult.data.stale) {
      warnings.push("office_grant_cost_stale: served a cached value; HCB was unreachable");
    }
  } else {
    const message =
      grantResult.error instanceof Error
        ? grantResult.error.message
        : "office grant lookup failed";
    warnings.push(`office_grant_cost_unavailable: ${message}`);
  }

  // 6. Total of all five buckets.
  const totalCents = posterCents + referralCents + shirtCents + adminCents + grantCents;

  return Response.json({
    currency: "USD",
    posterCost: usd(posterCents),
    referralCost: usd(referralCents),
    shirtCost: usd(shirtCents),
    adminCost: usd(adminCents),
    officeGrantCost: usd(grantCents),
    total: usd(totalCents),
    warnings,
    complete: warnings.length === 0,
    generatedAt: new Date().toISOString(),
  });
}
