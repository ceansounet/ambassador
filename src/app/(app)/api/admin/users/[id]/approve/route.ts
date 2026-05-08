import { revalidatePath } from "next/cache";

import {
  DuplicateReviewDecisionError,
  getLatestApplicationForUser,
  isUserAdmin,
  reviewLatestApplicationForUser,
} from "@/lib/applications/review";
import { requestOfficeGrantProvisioningForUser } from "@/lib/hcb/grants";
import { getSafeRedirectUrl, isSameOriginRequest } from "@/lib/http";
import { APPLICATION_STATUS_ACCEPTED } from "@/lib/applications/status";
import { ensureSchema } from "@/lib/database/ensure-schema";
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
  const shouldProvisionGrant = formData.get("provisionGrant") === "true";
  const target = await getLatestApplicationForUser(id);

  if (!target) {
    return Response.json({ error: "no_application" }, { status: 404 });
  }

  try {
    await reviewLatestApplicationForUser(id, {
      status: APPLICATION_STATUS_ACCEPTED,
      reviewedBy: session.sub,
    });
  } catch (error) {
    if (error instanceof DuplicateReviewDecisionError) {
      return Response.json({ error: "already_in_status" }, { status: 409 });
    }

    throw error;
  }

  let grantStatus: string | null = null;

  if (shouldProvisionGrant) {
    try {
      grantStatus = await requestOfficeGrantProvisioningForUser({
        userId: id,
        actorUserId: session.sub,
      });
    } catch (error) {
      console.error("Failed to request office grant provisioning during override approval", {
        userId: id,
        error,
      });
      grantStatus = "provision_failed";
    }
  }

  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/dashboard");

  const redirectUrl = getSafeRedirectUrl(
    request,
    formData.get("redirectTo"),
    `/admin/users/${id}`,
  );

  if (grantStatus !== null) {
    redirectUrl.searchParams.set("hcbGrant", grantStatus);
  }

  return Response.redirect(redirectUrl);
}
