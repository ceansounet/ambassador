import { migrate } from "@/lib/database/migrate";

let ensureSchemaPromise: Promise<void> | null = null;

export function ensureSchema() {
  if (!ensureSchemaPromise) {
    ensureSchemaPromise = migrate().catch((error) => {
      ensureSchemaPromise = null;
      throw error;
    });
  }

  return ensureSchemaPromise;
}
