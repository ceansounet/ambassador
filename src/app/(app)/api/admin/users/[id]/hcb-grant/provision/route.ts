import { revalidatePath } from "next/cache";

import { isUserAdmin } from "@/lib/applications/review";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { requestOfficeGrantProvisioningForUser } from "@/lib/hcb/grants";
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
  redirectUrl.searchParams.set("hcbGrant", "queued");

  try {
    const result = await requestOfficeGrantProvisioningForUser({
      userId: id,
      actorUserId: session.sub,
    });
    redirectUrl.searchParams.set("hcbGrant", result);
  } catch (error) {
    console.error("Failed to manually request office grant provisioning", {
      userId: id,
      error,
    });
    redirectUrl.searchParams.set("hcbGrant", "provision_failed");
  }

  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/dashboard");

  return Response.redirect(redirectUrl, 303);
}
