import { isUserAdmin } from "@/lib/admin";
import { getSafeRedirectPath, isSameOriginRequest } from "@/lib/http";
import { ensureSchema } from "@/lib/ensure-schema";
import { getSession } from "@/lib/session";
import sql from "@/lib/db";

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

  const [deleted] = await sql`
    DELETE FROM applications
    WHERE id = ${id}
    RETURNING id
  `;

  if (!deleted) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  return Response.redirect(
    new URL(
      getSafeRedirectPath(formData.get("redirectTo"), "/admin/applications"),
      request.url,
    ),
  );
}
