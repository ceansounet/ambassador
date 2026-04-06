import { redirect } from "next/navigation";

import sql from "@/lib/db";
import { ensureSchema } from "@/lib/ensure-schema";
import { getSafeRedirectPath } from "@/lib/http";
import { clearSession, createToken, getSession, setSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = await getSession();
  const url = new URL(request.url);
  const nextPath = getSafeRedirectPath(url.searchParams.get("next"), "/settings");

  if (!session) {
    redirect("/api/auth/login");
  }

  await ensureSchema();
  const [user] = await sql`
    SELECT is_admin FROM users WHERE id = ${session.sub} LIMIT 1
  `;

  if (!user) {
    await clearSession();
    redirect("/api/auth/login");
  }

  const token = await createToken({
    sub: session.sub,
    email: session.email,
    displayName: session.displayName,
    slackId: session.slackId,
    isAdmin: Boolean(user.is_admin),
  });

  await setSession(token);
  redirect(nextPath);
}
