import { isUserAdmin, setApplicationTshirtShipped } from "@/lib/admin";
import { ensureSchema } from "@/lib/ensure-schema";
import { getSafeRedirectPath, isSameOriginRequest } from "@/lib/http";
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
  const value = formData.get("shipped");
  const shipped = value === "true";
  const updatedApplication = await setApplicationTshirtShipped(id, shipped);

  if (!updatedApplication) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  return Response.redirect(
    new URL(
      getSafeRedirectPath(formData.get("redirectTo"), `/admin/applications/${id}`),
      request.url,
    ),
  );
}
