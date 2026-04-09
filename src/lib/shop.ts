import type { HackClubAddress } from "@/lib/settings";

export const SHIRT_SIZES = ["S", "M", "L", "XL"] as const;
export type ShirtSize = (typeof SHIRT_SIZES)[number];
export const SHIRT_SKU_PREFIX = "Swa/Shirt/HC/";

export function isShirtSize(value: unknown): value is ShirtSize {
  return typeof value === "string" && (SHIRT_SIZES as readonly string[]).includes(value);
}

export function shirtSku(size: ShirtSize) {
  return `${SHIRT_SKU_PREFIX}${size}`;
}

export const ORDER_STATUS_PENDING = "pending";
export const ORDER_STATUS_APPROVED = "approved";
export const ORDER_STATUS_REJECTED = "rejected";
export const ORDER_STATUS_FAILED = "failed";
export const ORDER_STATUS_CANCELLED = "cancelled";

export type OrderStatus =
  | typeof ORDER_STATUS_PENDING
  | typeof ORDER_STATUS_APPROVED
  | typeof ORDER_STATUS_REJECTED
  | typeof ORDER_STATUS_FAILED
  | typeof ORDER_STATUS_CANCELLED;

export type ShopOrderRow = {
  id: string;
  user_id: string;
  status: OrderStatus | string;
  sku: string | null;
  variant: string | null;
  quantity: number;
  address: HackClubAddress | null;
  warehouse_order_id: string | null;
  warehouse_status: string | null;
  note: string | null;
  internal_fail_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
};

export function buildWarehouseTrackingUrl(warehouseOrderId: string) {
  return `https://mail.hackclub.com/warehouse_orders/${encodeURIComponent(warehouseOrderId)}`;
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
