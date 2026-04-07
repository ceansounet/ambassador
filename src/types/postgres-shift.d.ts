declare module "postgres-shift" {
  import type postgres from "postgres";

  export default function shift(options: {
    sql: postgres.Sql;
    path?: string;
    before?: ((migration: { path: string; migration_id: number; name: string }) => void) | null;
    after?: ((migration: { path: string; migration_id: number; name: string }) => void) | null;
  }): Promise<void>;
}
