import { fetchHackClubAddresses } from "@/lib/auth";
import { isAcceptedApplicationStatus } from "@/lib/applications/status";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { isSameOriginRequest } from "@/lib/http";
import { getSession } from "@/lib/session";
import {
  canPlaceAnotherShirtOrder,
  isShirtSize,
  ORDER_STATUS_PENDING,
  SHIRT_SKU_PREFIX,
  shirtSku,
} from "@/lib/shop";
import { isCompleteHackClubAddress, type HackClubAddress } from "@/lib/settings";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const session = await getSession();
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  await ensureSchema();

  const body = (await request.json().catch(() => null)) as {
    size?: string;
    addressIndex?: number;
  } | null;

  if (!body || !isShirtSize(body.size)) {
    return Response.json({ error: "invalid_size" }, { status: 400 });
  }

  const [user] = await sql`
    SELECT id, shirt_enabled, hca_access_token
    FROM users
    WHERE id = ${session.sub}
  `;
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!user.shirt_enabled) {
    return Response.json({ error: "shirt_unavailable" }, { status: 403 });
  }

  const [latestApp] = await sql`
    SELECT status
    FROM applications
    WHERE user_id = ${session.sub}
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `;
  if (!latestApp || !isAcceptedApplicationStatus(latestApp.status)) {
    return Response.json({ error: "not_ambassador" }, { status: 403 });
  }

  if (!user.hca_access_token) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let addresses: HackClubAddress[] = [];
  try {
    addresses = await fetchHackClubAddresses(user.hca_access_token);
  } catch (error) {
    console.error("Failed to load live Hack Club Auth addresses for shirt order", {
      userId: session.sub,
      error,
    });
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  addresses = addresses.filter(isCompleteHackClubAddress);

  if (addresses.length === 0) {
    return Response.json({ error: "no_address" }, { status: 400 });
  }

  const requestedIndex =
    Number.isInteger(body.addressIndex) && (body.addressIndex as number) >= 0
      ? (body.addressIndex as number)
      : 0;
  const addressIndex = Math.min(Math.max(requestedIndex, 0), addresses.length - 1);
  const address = addresses[addressIndex];

  const [latestOrder] = await sql`
    SELECT id, status
    FROM orders
    WHERE user_id = ${session.sub} AND sku LIKE ${`${SHIRT_SKU_PREFIX}%`}
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `;
  if (latestOrder && !canPlaceAnotherShirtOrder(latestOrder.status)) {
    return Response.json({ error: "already_ordered" }, { status: 409 });
  }

  const id = crypto.randomUUID();
  const sku = shirtSku(body.size);

  await sql`
    INSERT INTO orders (id, user_id, status, sku, variant, quantity, address, details)
    VALUES (
      ${id},
      ${session.sub},
      ${ORDER_STATUS_PENDING},
      ${sku},
      ${body.size},
      1,
      CAST(${JSON.stringify(address)} AS JSONB),
      CAST(${JSON.stringify({ type: "ambassador-shirt" })} AS JSONB)
    )
  `;

  return Response.json({ ok: true, id });
}
