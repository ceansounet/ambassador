import { ensureSchema } from "@/lib/database/ensure-schema";
import sql from "@/lib/database/client";
import { readHcaAccessToken } from "@/lib/hca-access-token";
import { cacheHackClubAddresses } from "@/lib/hca-addresses";
import { isSameOriginRequest } from "@/lib/http";
import { getSession } from "@/lib/session";
import { fetchHackClubAddresses } from "@/lib/auth";
import { normalizeHackClubAddresses } from "@/lib/settings";

type UserTokenRow = {
  hca_access_token: string | null;
};

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const session = await getSession();
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  await ensureSchema();

  const user = (await sql<UserTokenRow[]>`
    SELECT hca_access_token
    FROM users
    WHERE id = ${session.sub}
    LIMIT 1
  `).at(0) ?? null;

  if (user === null) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const hcaAccessToken = readHcaAccessToken(user.hca_access_token ?? null);

  if (hcaAccessToken === null || hcaAccessToken === "") {
    return Response.json({ error: "reauth_required" }, { status: 401 });
  }

  try {
    const addresses = await cacheHackClubAddresses(
      session.sub,
      normalizeHackClubAddresses(await fetchHackClubAddresses(hcaAccessToken)),
    );

    return Response.json({
      ok: true,
      addressCount: addresses.length,
    });
  } catch (error) {
    console.error("Failed to refresh Hack Club Auth addresses", {
      userId: session.sub,
      error,
    });

    return Response.json({ error: "refresh_failed" }, { status: 502 });
  }
}
