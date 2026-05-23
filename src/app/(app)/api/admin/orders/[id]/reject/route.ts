import { revalidatePath } from "next/cache";

import { clearCachedWarehouseStats } from "@/lib/admin/warehouse-stats-cache";
import { isUserAdmin } from "@/lib/applications/review";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { getSafeRedirectUrl, isSameOriginRequest } from "@/lib/http";
import { getActorSession } from "@/lib/session";
import { ORDER_STATUS_REJECTED } from "@/lib/shop";

type OrderRow = {
  id: string;
  user_id: string;
};

type OrderIdRow = {
  id: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params;
  const formData = await request.formData();
  const rawNote = formData.get("note");
  const note = typeof rawNote === "string" ? rawNote.trim() || null : null;

  const order = (await sql<OrderRow[]>`
    SELECT id, user_id FROM orders WHERE id = ${id} LIMIT 1
  `).at(0) ?? null;
  if (order === null) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const latestOrder = (await sql<OrderIdRow[]>`
    SELECT id
    FROM orders
    WHERE user_id = ${order.user_id}
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).at(0) ?? null;

  if (latestOrder?.id !== order.id) {
    return Response.json({ error: "historical_order" }, { status: 409 });
  }

  await sql`
    UPDATE orders
    SET status = ${ORDER_STATUS_REJECTED},
        note = ${note},
        internal_fail_reason = NULL,
        reviewed_at = NOW(),
        reviewed_by = ${session.sub},
        updated_at = NOW()
    WHERE id = ${id}
  `;

  clearCachedWarehouseStats();
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/users/${order.user_id}`);
  revalidatePath("/dashboard");

  return Response.redirect(getSafeRedirectUrl(request, formData.get("redirectTo"), `/admin/orders`));
}
