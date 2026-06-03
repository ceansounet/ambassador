import { revalidatePath } from "next/cache";

import { logAdminActionEvent } from "@/lib/admin-action-events";
import { isUserAdmin } from "@/lib/applications/review";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { isSameOriginRequest } from "@/lib/http";
import {
  addUserFeatureFlagOverride,
  isSafeguardKey,
  removeUserFeatureFlagOverride,
} from "@/lib/safeguards";
import { getActorSession } from "@/lib/session";

type UserLookupRow = { id: string; display_name: string; email: string | null };
type UserSearchRow = {
  id: string;
  display_name: string;
  email: string | null;
  slack_id: string | null;
};

async function resolveUser(identifier: string): Promise<UserLookupRow | null> {
  const trimmed = identifier.trim();
  if (trimmed === "") return null;

  const lowered = trimmed.toLowerCase();
  const row = (await sql<UserLookupRow[]>`
    SELECT id, display_name, email
    FROM users
    WHERE id = ${trimmed} OR LOWER(email) = ${lowered}
    LIMIT 1
  `).at(0);

  return row ?? null;
}

export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  if (query === "") {
    return Response.json({ candidates: [] });
  }

  const filter = `%${query.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
  const rows = await sql<UserSearchRow[]>`
    SELECT id, display_name, email, slack_id
    FROM users
    WHERE display_name ILIKE ${filter}
       OR email ILIKE ${filter}
       OR slack_id ILIKE ${filter}
       OR slack_name ILIKE ${filter}
    ORDER BY display_name ASC
    LIMIT 8
  `;

  return Response.json({
    candidates: rows.map((row) => ({
      userId: row.id,
      displayName: row.display_name,
      email: row.email,
      slackId: row.slack_id,
    })),
  });
}

export async function POST(request: Request) {
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

  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  if (!isSafeguardKey(payload.flagKey) || typeof payload.identifier !== "string") {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const user = await resolveUser(payload.identifier);
  if (user === null) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const created = await addUserFeatureFlagOverride({
    userId: user.id,
    flagKey: payload.flagKey,
    createdByUserId: session.sub,
  });

  if (!created) {
    return Response.json({ error: "already_exists", userId: user.id }, { status: 409 });
  }

  await logAdminActionEvent({
    actorUserId: session.sub,
    targetUserId: user.id,
    action: "user_feature_flag_override_updated",
    metadata: {
      flagKey: payload.flagKey,
      nextOverrideEnabled: true,
    },
  });

  revalidatePath("/admin/safeguards");
  revalidatePath(`/admin/users/${user.id}`);
  revalidatePath("/posters");
  revalidatePath("/referrals");
  revalidatePath("/dashboard");

  return Response.json({
    override: {
      userId: user.id,
      displayName: user.display_name,
      email: user.email,
    },
  });
}

export async function DELETE(request: Request) {
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

  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  if (!isSafeguardKey(payload.flagKey) || typeof payload.userId !== "string") {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const removed = await removeUserFeatureFlagOverride({
    userId: payload.userId,
    flagKey: payload.flagKey,
  });

  if (removed) {
    await logAdminActionEvent({
      actorUserId: session.sub,
      targetUserId: payload.userId,
      action: "user_feature_flag_override_updated",
      metadata: {
        flagKey: payload.flagKey,
        nextOverrideEnabled: false,
      },
    });
  }

  revalidatePath("/admin/safeguards");
  revalidatePath(`/admin/users/${payload.userId}`);
  revalidatePath("/posters");
  revalidatePath("/referrals");
  revalidatePath("/dashboard");

  return Response.json({ removed });
}
