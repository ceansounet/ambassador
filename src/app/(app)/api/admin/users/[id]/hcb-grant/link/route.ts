import { revalidatePath } from "next/cache";

import { isUserAdmin } from "@/lib/applications/review";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { linkOfficeGrantToUser } from "@/lib/hcb/grants";
import { getSafeRedirectUrl, isSameOriginRequest } from "@/lib/http";
import { getActorSession } from "@/lib/session";

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
  const redirectUrl = getSafeRedirectUrl(
    request,
    formData.get("redirectTo"),
    `/admin/users/${id}#office-grant`,
  );
  redirectUrl.searchParams.set("hcbGrant", "linked");
  const rawGrantId = formData.get("grantId");
  const grantId = typeof rawGrantId === "string" ? rawGrantId.trim() : "";

  if (grantId === "") {
    redirectUrl.searchParams.set("hcbGrant", "invalid");
    return Response.redirect(redirectUrl, 303);
  }

  const userExists = (await sql<Array<{ id: string }>>`
    SELECT id
    FROM users
    WHERE id = ${id}
    LIMIT 1
  `).at(0) ?? null;

  if (userExists === null) {
    redirectUrl.searchParams.set("hcbGrant", "not_found");
    return Response.redirect(redirectUrl, 303);
  }

  try {
    await linkOfficeGrantToUser({
      userId: id,
      grantId,
      actorUserId: session.sub,
    });
  } catch (error) {
    console.error("Failed to manually link HCB office grant", { userId: id, error });
    redirectUrl.searchParams.set("hcbGrant", "link_failed");
    return Response.redirect(redirectUrl, 303);
  }

  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/dashboard");

  return Response.redirect(redirectUrl, 303);
}
