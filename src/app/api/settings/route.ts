import sql from "@/lib/db";
import {
  normalizeHackClubAddresses,
  SUPPORTED_AMBASSADOR_REGIONS,
} from "@/lib/settings";
import { isSameOriginRequest } from "@/lib/http";
import { getSession } from "@/lib/session";
import { ensureUserAddressSchema } from "@/lib/user-address-schema";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const session = await getSession();
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  await ensureUserAddressSchema();

  const body = (await request.json().catch(() => null)) as {
    selectedAddressIndex?: number;
    ambassadorRegion?: string;
  } | null;

  if (!body || typeof body !== "object") {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const updates: string[] = [];

  if (body.selectedAddressIndex != null) {
    if (
      !Number.isSafeInteger(body.selectedAddressIndex) ||
      body.selectedAddressIndex < 0
    ) {
      return Response.json({ error: "invalid_address_index" }, { status: 400 });
    }

    const [user] = await sql`
      SELECT hca_addresses FROM users WHERE id = ${session.sub}
    `;
    const addresses = normalizeHackClubAddresses(user?.hca_addresses);

    if (body.selectedAddressIndex >= addresses.length) {
      return Response.json({ error: "invalid_address_index" }, { status: 400 });
    }

    updates.push("address");
    await sql`
      UPDATE users SET selected_address_index = ${body.selectedAddressIndex}, updated_at = NOW()
      WHERE id = ${session.sub}
    `;
  }

  if (typeof body.ambassadorRegion === "string") {
    const ambassadorRegion = body.ambassadorRegion.trim();

    if (
      !SUPPORTED_AMBASSADOR_REGIONS.includes(
        ambassadorRegion as (typeof SUPPORTED_AMBASSADOR_REGIONS)[number],
      )
    ) {
      return Response.json({ error: "invalid_region" }, { status: 400 });
    }

    updates.push("region");
    await sql`
      UPDATE users SET ambassador_region = ${ambassadorRegion}, updated_at = NOW()
      WHERE id = ${session.sub}
    `;
  }

  return Response.json({ ok: true, updated: updates });
}
