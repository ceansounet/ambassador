import { revalidatePath } from "next/cache";

import { isUserAdmin } from "@/lib/applications/review";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { getSafeRedirectPath, isSameOriginRequest } from "@/lib/http";
import { getSession } from "@/lib/session";
import {
  ORDER_STATUS_APPROVED,
  ORDER_STATUS_CANCELLED,
  ORDER_STATUS_FAILED,
  ORDER_STATUS_PENDING,
  ORDER_STATUS_REJECTED,
} from "@/lib/shop";
import { sendWarehouseSku, WarehouseApiError } from "@/lib/warehouse";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const session = await getSession();
  if (!session) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  await ensureSchema();
  if (!(await isUserAdmin(session.sub))) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const formData = await request.formData();

  const [order] = await sql`
    SELECT o.id, o.user_id, o.status, o.sku, o.variant, o.address, o.warehouse_order_id,
           u.email, u.display_name
    FROM orders o
    JOIN users u ON u.id = o.user_id
    WHERE o.id = ${id}
    LIMIT 1
  `;
  if (!order) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const [latestOrder] = await sql`
    SELECT id
    FROM orders
    WHERE user_id = ${order.user_id}
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `;

  if (latestOrder?.id !== order.id) {
    return Response.json({ error: "historical_order" }, { status: 409 });
  }
  if (
    order.status !== ORDER_STATUS_PENDING &&
    order.status !== ORDER_STATUS_REJECTED &&
    order.status !== ORDER_STATUS_FAILED &&
    order.status !== ORDER_STATUS_CANCELLED &&
    order.status !== ORDER_STATUS_APPROVED
  ) {
    return Response.json({ error: "invalid_order_status" }, { status: 409 });
  }
  if (!order.sku || !order.address) {
    return Response.json({ error: "invalid_order" }, { status: 400 });
  }

  try {
    if (order.warehouse_order_id) {
      await sql`
        UPDATE orders
        SET status = ${ORDER_STATUS_APPROVED},
            note = NULL,
            internal_fail_reason = NULL,
            reviewed_at = NOW(),
            reviewed_by = ${session.sub},
            updated_at = NOW()
        WHERE id = ${id}
      `;
    } else {
      const result = await sendWarehouseSku({
        sku: order.sku,
        quantity: 1,
        name: order.display_name,
        email: order.email,
        orderNumber: order.id,
        address: order.address,
        userFacingTitle: `Hack Club Ambassador shirt (${order.variant ?? ""})`.trim(),
        tags: ["Ambassadors"],
        metadata: {
          ambassador_order_id: order.id,
          ambassador_user_id: order.user_id,
        },
      });

      await sql`
        UPDATE orders
        SET status = ${ORDER_STATUS_APPROVED},
            warehouse_order_id = ${result.id ?? null},
            warehouse_status = ${result.status ?? null},
            warehouse_payload = CAST(${JSON.stringify(result)} AS JSONB),
            note = NULL,
            internal_fail_reason = NULL,
            reviewed_at = NOW(),
            reviewed_by = ${session.sub},
            updated_at = NOW()
        WHERE id = ${id}
      `;
    }
  } catch (error) {
    const message =
      error instanceof WarehouseApiError
        ? `Warehouse ${error.status}: ${typeof error.body === "string" ? error.body : JSON.stringify(error.body)}`
        : error instanceof Error
          ? error.message
          : "unknown error";

    await sql`
      UPDATE orders
      SET status = ${ORDER_STATUS_FAILED},
          warehouse_status = 'error',
          note = NULL,
          internal_fail_reason = ${message},
          reviewed_at = NOW(),
          reviewed_by = ${session.sub},
          updated_at = NOW()
      WHERE id = ${id}
    `;

    revalidatePath(`/admin/orders/${id}`);
    revalidatePath("/admin/orders");
    revalidatePath(`/admin/users/${order.user_id}`);
    revalidatePath("/dashboard");

    return Response.redirect(
      new URL(
        getSafeRedirectPath(formData.get("redirectTo"), `/admin/orders`),
        request.url,
      ),
    );
  }

  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/users/${order.user_id}`);
  revalidatePath("/dashboard");

  return Response.redirect(
    new URL(
      getSafeRedirectPath(formData.get("redirectTo"), `/admin/orders`),
      request.url,
    ),
  );
}
