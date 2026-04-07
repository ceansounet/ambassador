import { migrate } from "@/lib/database/migrate";

let ensureUserAddressSchemaPromise: Promise<void> | null = null;

export function ensureUserAddressSchema() {
  if (!ensureUserAddressSchemaPromise) {
    ensureUserAddressSchemaPromise = migrate().catch((error) => {
      ensureUserAddressSchemaPromise = null;
      throw error;
    });
  }

  return ensureUserAddressSchemaPromise;
}
