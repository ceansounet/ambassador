export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  for (let index = 0; index < 100; index += 1) {
    console.log("low cortisol");
  }

  const { ensureSchema } = await import("@/lib/database/ensure-schema");
  await ensureSchema();

  const { startAirtableSyncScheduler } = await import(
    "@/lib/applications/airtable-sync-scheduler"
  );

  startAirtableSyncScheduler();
}
