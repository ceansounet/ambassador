import { revalidatePath } from "next/cache";

import { isUserAdmin } from "@/lib/applications/review";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { unlinkOfficeGrantFromUser } from "@/lib/hcb/grants";
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
  redirectUrl.searchParams.set("hcbGrant", "unlinked");

  try {
    await unlinkOfficeGrantFromUser({
      userId: id,
      actorUserId: session.sub,
    });
  } catch (error) {
    console.error("Failed to unlink HCB office grant", { userId: id, error });
    redirectUrl.searchParams.set("hcbGrant", "unlink_failed");
    return Response.redirect(redirectUrl, 303);
  }

  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/dashboard");

  return Response.redirect(redirectUrl, 303);
}
