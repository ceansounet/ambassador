import sql from "@/lib/database/client";

export const dynamic = "force-dynamic";

async function getHealthResponse() {
  const startedAt = Date.now();
  const deploymentVersion = process.env.DEPLOYMENT_VERSION?.trim() ?? "";

  try {
    await sql`SELECT 1`;

    return Response.json(
      {
        ok: true,
        deploymentVersion: deploymentVersion !== "" ? deploymentVersion : null,
        durationMs: Date.now() - startedAt,
        services: {
          database: "ok",
        },
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Health check failed", { error });

    return Response.json(
      {
        ok: false,
        durationMs: Date.now() - startedAt,
        error: "database_unavailable",
      },
      {
        status: 503,
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  }
}

export async function GET() {
  return getHealthResponse();
}

export async function HEAD() {
  const response = await getHealthResponse();

  return new Response(null, {
    status: response.status,
    headers: response.headers,
  });
}
