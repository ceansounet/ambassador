import { revalidatePath } from "next/cache";

import { clearCachedWarehouseStats } from "@/lib/admin/warehouse-stats-cache";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { isSameOriginRequest } from "@/lib/http";
import { checkRateLimit, getRateLimitKey, rateLimitResponse } from "@/lib/rate-limit";
import { getSession } from "@/lib/session";
import {
  ORDER_STATUS_CANCELLED,
  ORDER_STATUS_PENDING,
} from "@/lib/shop";

type CancelOrderRow = {
  id: string;
  user_id: string;
  status: string;
  dispatch_at: string | null;
};

export async function POST(
  request: Request,
  context: RouteContext<"/api/shirt/orders/[id]/cancel">,
) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const session = await getSession();
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit({
    scope: "shirt-orders-cancel",
    key: getRateLimitKey(session.sub),
    limit: 60,
  });
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  await ensureSchema();
  const { id } = await context.params;

  const result = await sql.begin(async (transaction) => {
    const order = (await transaction<CancelOrderRow[]>`
      SELECT id, user_id, status, dispatch_at
      FROM orders
      WHERE id = ${id}
      LIMIT 1
      FOR UPDATE
    `).at(0) ?? null;

    if (order === null) {
      return { ok: false as const, status: 404, error: "not_found" };
    }

    if (order.user_id !== session.sub) {
      return { ok: false as const, status: 403, error: "forbidden" };
    }

    if (order.status !== ORDER_STATUS_PENDING) {
      return { ok: false as const, status: 409, error: "not_cancellable" };
    }

    if (order.dispatch_at === null) {
      return { ok: false as const, status: 409, error: "embargo_expired" };
    }

    const dispatchAt = new Date(order.dispatch_at);
    if (Number.isNaN(dispatchAt.getTime()) || dispatchAt.getTime() <= Date.now()) {
      return { ok: false as const, status: 409, error: "embargo_expired" };
    }

    await transaction`
      UPDATE orders
      SET status = ${ORDER_STATUS_CANCELLED},
          note = 'Cancelled automatically requested by ambassador',
          updated_at = NOW()
      WHERE id = ${id} AND status = ${ORDER_STATUS_PENDING}
    `;

    return { ok: true as const, userId: order.user_id };
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  clearCachedWarehouseStats();
  revalidatePath("/dashboard");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath(`/admin/users/${result.userId}`);

  return Response.json({ ok: true });
}
