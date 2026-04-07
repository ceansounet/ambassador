import path from "node:path";

import shift from "postgres-shift";

import sql from "@/lib/database/client";

export async function migrate() {
  await shift({
    sql,
    path: path.join(process.cwd(), "migrations"),
  });
}
