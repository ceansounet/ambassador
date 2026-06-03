import type postgres from "postgres";

import sql from "@/lib/database/client";
import {
  buildEmptyShirtStockBySize,
  ORDER_STATUS_PENDING,
  SHIRT_SIZES,
  shirtSku,
  type ShirtSize,
  type ShirtStockBySize,
} from "@/lib/shop";
import { loadShirtStockBySize } from "@/lib/warehouse";

type QueryClient = postgres.Sql | postgres.TransactionSql;

type PendingShirtOrderCountRow = {
  sku: string;
  quantity: number;
};

async function countPendingShirtOrdersBySize(
  query: QueryClient = sql,
): Promise<Record<ShirtSize, number>> {
  const pendingBySize: Record<ShirtSize, number> = {
    S: 0,
    M: 0,
    L: 0,
    XL: 0,
  };

  const rows = await query<PendingShirtOrderCountRow[]>`
    SELECT sku, COALESCE(SUM(quantity), 0)::int AS quantity
    FROM orders
    WHERE status = ${ORDER_STATUS_PENDING}
      AND sku = ANY(${SHIRT_SIZES.map((size) => shirtSku(size))}::text[])
    GROUP BY sku
  `;

  for (const row of rows) {
    const size = SHIRT_SIZES.find((candidate) => shirtSku(candidate) === row.sku);
    if (size !== undefined) {
      pendingBySize[size] = row.quantity;
    }
  }

  return pendingBySize;
}

function deductPendingOrdersFromShirtStock(
  stockBySize: ShirtStockBySize,
  pendingBySize: Record<ShirtSize, number>,
): ShirtStockBySize {
  const adjustedStockBySize = buildEmptyShirtStockBySize();

  for (const size of SHIRT_SIZES) {
    const stock = stockBySize[size];
    adjustedStockBySize[size] =
      stock === null ? null : Math.max(0, stock - pendingBySize[size]);
  }

  return adjustedStockBySize;
}

export async function loadAvailableShirtStockBySize(
  query: QueryClient = sql,
): Promise<ShirtStockBySize> {
  const [stockBySize, pendingBySize] = await Promise.all([
    loadShirtStockBySize(),
    countPendingShirtOrdersBySize(query),
  ]);

  return deductPendingOrdersFromShirtStock(stockBySize, pendingBySize);
}
