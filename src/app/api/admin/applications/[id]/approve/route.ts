import {
  getLatestApplicationForApplicationId,
  isUserAdmin,
  reviewApplication,
} from "@/lib/admin";
import { getSafeRedirectPath, isSameOriginRequest } from "@/lib/http";
import { APPLICATION_STATUS_ACCEPTED } from "@/lib/applications";
import { ensureSchema } from "@/lib/ensure-schema";
import { getSession } from "@/lib/session";

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
  const target = await getLatestApplicationForApplicationId(id);

  if (!target) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  await reviewApplication(target.id, {
    status: APPLICATION_STATUS_ACCEPTED,
    reviewedBy: session.sub,
  });

  return Response.redirect(
    new URL(
      getSafeRedirectPath(formData.get("redirectTo"), `/admin/applications/${target.id}`),
      request.url,
    ),
  );
}
