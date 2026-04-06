import sql from "@/lib/database/client";

let ensureUserAddressSchemaPromise: Promise<void> | null = null;

export function ensureUserAddressSchema() {
  if (!ensureUserAddressSchemaPromise) {
    ensureUserAddressSchemaPromise = (async () => {
      await sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS hca_addresses JSONB NOT NULL DEFAULT '[]'::jsonb
      `;
      await sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS selected_address_index INTEGER NOT NULL DEFAULT 0
      `;
      await sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS ambassador_region TEXT
      `;
    })().catch((error) => {
      ensureUserAddressSchemaPromise = null;
      throw error;
    });
  }

  return ensureUserAddressSchemaPromise;
}
