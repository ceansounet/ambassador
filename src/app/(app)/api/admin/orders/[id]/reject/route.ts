import { revalidatePath } from "next/cache";

import { isUserAdmin } from "@/lib/applications/review";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { getSafeRedirectPath, isSameOriginRequest } from "@/lib/http";
import { getSession } from "@/lib/session";
import { ORDER_STATUS_REJECTED } from "@/lib/shop";

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
  const note = (formData.get("note") as string | null)?.trim() || null;

  const [order] = await sql`
    SELECT id, user_id FROM orders WHERE id = ${id} LIMIT 1
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
