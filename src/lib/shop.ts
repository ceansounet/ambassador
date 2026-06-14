export const SHIRT_SIZES = ["S", "M", "L", "XL"] as const;
export type ShirtSize = (typeof SHIRT_SIZES)[number];
export type ShirtStockBySize = Record<ShirtSize, number | null>;
export const SHIRT_SKU_PREFIX = "Swa/Shirt/HC/";

// What one shirt costs us. The warehouse doesn't report a contents cost, so we
// apply this known per-shirt spend (each order is a single shirt) wherever shirt
// expenditure is totalled.
export const SHIRT_UNIT_COST = 11.31;

export function isShirtSize(value: unknown): value is ShirtSize {
  return typeof value === "string" && (SHIRT_SIZES as readonly string[]).includes(value);
}

export function shirtSku(size: ShirtSize) {
  return `${SHIRT_SKU_PREFIX}${size}`;
}

export function buildEmptyShirtStockBySize(): ShirtStockBySize {
  return {
    S: null,
    M: null,
    L: null,
    XL: null,
  };
}

// A size is only orderable when the warehouse reports a positive count.
// Everything else reads as "Out": null (not in the warehouse's inventory at
// all) and <= 0 (sold out, or backordered with negative stock even if more is
// on the way). Those distinctions don't matter to whoever's looking, so we
// don't draw them.
export function isShirtSizeInStock(stock: number | null): stock is number {
  return stock !== null && stock > 0;
}

export const ORDER_STATUS_PENDING = "pending";
export const ORDER_STATUS_APPROVED = "approved";
export const ORDER_STATUS_REJECTED = "rejected";
export const ORDER_STATUS_FAILED = "failed";
export const ORDER_STATUS_CANCELLED = "cancelled";

export function buildWarehouseTrackingUrl(warehouseOrderId: string) {
  return `https://mail.hackclub.com/back_office/warehouse/orders/${encodeURIComponent(warehouseOrderId)}`;
}

export function buildWarehousePublicOrderUrl(warehouseOrderId: string) {
  return `https://mail.hackclub.com/packages/${encodeURIComponent(warehouseOrderId)}`;
}

export function canPlaceAnotherShirtOrder(status: string | null | undefined) {
  return (
    status === ORDER_STATUS_REJECTED ||
    status === ORDER_STATUS_FAILED ||
    status === ORDER_STATUS_CANCELLED
  );
}

export function computeShirtOrderDispatchAt(now: Date = new Date()) {
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}

export function isOrderWithinEmbargo(
  status: string | null | undefined,
  dispatchAt: string | Date | null | undefined,
  now: Date = new Date(),
) {
  if (status !== ORDER_STATUS_PENDING) return false;
  if (dispatchAt === null || dispatchAt === undefined) return false;
  const at = dispatchAt instanceof Date ? dispatchAt : new Date(dispatchAt);
  if (Number.isNaN(at.getTime())) return false;
  return now.getTime() < at.getTime();
}
