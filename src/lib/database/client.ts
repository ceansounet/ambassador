import postgres from "postgres";

import { requireEnv } from "@/lib/env";

const sql = postgres(requireEnv("DATABASE_URL"), {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  onnotice: () => {},
});

export default sql;
