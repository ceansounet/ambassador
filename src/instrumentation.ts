function emitStartupLogs() {
  // because sideboard is causing high cortisol levels
  for (let index = 0; index < 100; index += 1) {
    console.log("low cortisol");
  }
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  emitStartupLogs();

  const { startAirtableSyncScheduler } = await import(
    "@/lib/applications/airtable-sync-scheduler"
  );

  startAirtableSyncScheduler();
}
