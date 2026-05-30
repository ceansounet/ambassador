import { isUserAdmin } from "@/lib/applications/review";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { readPosterProofFile } from "@/lib/posters/storage";
import { getActorSession } from "@/lib/session";

export const runtime = "nodejs";

type PosterProofRow = {
  proof_path: string | null;
  proof_content_type: string | null;
  proof_original_name: string | null;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; posterId: string }> },
) {
  const session = await getActorSession();
  if (!session) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  await ensureSchema();
  if (!(await isUserAdmin(session.sub))) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const { id, posterId } = await params;

  const [poster] = await sql<PosterProofRow[]>`
    SELECT proof_path, proof_content_type, proof_original_name
    FROM posters
    WHERE id = ${posterId} AND user_id = ${id}
    LIMIT 1
  `;

  if (!poster || !poster.proof_path) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const buffer = await readPosterProofFile(poster.proof_path);
  const body = new Uint8Array(buffer);

  return new Response(body, {
    headers: {
      "Content-Type": poster.proof_content_type ?? "application/octet-stream",
      "Cache-Control": "private, max-age=60",
      ...(poster.proof_original_name
        ? { "Content-Disposition": `inline; filename="${poster.proof_original_name.replace(/"/g, "")}"` }
        : {}),
    },
  });
}
