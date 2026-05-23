import { isUserAdmin } from "@/lib/applications/review";
import {
  getCachedWarehouseStats,
  setCachedWarehouseStats,
  type CachedWarehouseStats,
} from "@/lib/admin/warehouse-stats-cache";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { isSameOriginRequest } from "@/lib/http";
import { getActorSession } from "@/lib/session";
import { buildEmptyShirtStockBySize, shirtSku } from "@/lib/shop";
import { loadAvailableShirtStockBySize } from "@/lib/shirt/stock";
import { WarehouseApiClient } from "@/lib/warehouse";

type LinkedOrderRow = {
  warehouse_order_id: string;
};

const SENT_TO_WAREHOUSE_STATUSES = new Set(["dispatched", "mailed"]);
const AMBASSADOR_SHIRT_SKUS = [
  shirtSku("S"),
  shirtSku("M"),
  shirtSku("L"),
  shirtSku("XL"),
] as const;

export async function GET(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const session = await getActorSession();
  if (!session) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  await ensureSchema();
  if (!(await isUserAdmin(session.sub))) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const cachedStats = getCachedWarehouseStats();
  if (cachedStats !== null) {
    return Response.json(cachedStats);
  }

  const [warehouseOrders, linkedOrderRows, stockBySize] = await Promise.all([
    new WarehouseApiClient().listOrders(),
    sql<LinkedOrderRow[]>`
      SELECT warehouse_order_id
      FROM orders
      WHERE warehouse_order_id IS NOT NULL
        AND sku = ANY(${AMBASSADOR_SHIRT_SKUS}::text[])
    `,
    loadAvailableShirtStockBySize().catch(() => buildEmptyShirtStockBySize()),
  ]);

  const ambassadorOrderIds = new Set(
    linkedOrderRows.map((r) => r.warehouse_order_id),
  );

  let contentsCost = 0;
  let laborCost = 0;
  let postageCost = 0;
  let sentCount = 0;

  for (const order of warehouseOrders) {
    if (SENT_TO_WAREHOUSE_STATUSES.has(order.status) && ambassadorOrderIds.has(order.id)) {
      contentsCost += Number(order.contents_cost ?? 0);
      laborCost += Number(order.labor_cost ?? 0);
      postageCost += Number(order.postage_cost ?? 0);
      sentCount++;
    }
  }

  const data: CachedWarehouseStats = {
    expenditure: {
      contents: contentsCost,
      labor: laborCost,
      postage: postageCost,
      total: contentsCost + laborCost + postageCost,
    },
    sentOrders: sentCount,
    stockBySize,
  };

  setCachedWarehouseStats(data);

  return Response.json(data);
}
