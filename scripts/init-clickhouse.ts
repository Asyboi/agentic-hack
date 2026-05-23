/**
 * Run clickhouse-init.sql against CLICKHOUSE_URL (optional setup).
 * Usage: CLICKHOUSE_URL=https://... npm run clickhouse:init
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@clickhouse/client";

async function main() {
  const url = process.env.CLICKHOUSE_URL;
  if (!url) {
    console.error("Set CLICKHOUSE_URL");
    process.exit(1);
  }

  const sql = readFileSync(
    join(process.cwd(), "scripts/clickhouse-init.sql"),
    "utf8"
  );

  const client = createClient({
    url,
    username: process.env.CLICKHOUSE_USER ?? "default",
    password: process.env.CLICKHOUSE_PASSWORD ?? "",
  });

  for (const statement of sql.split(";").map((s) => s.trim()).filter(Boolean)) {
    await client.command({ query: statement });
    console.log("OK:", statement.split("\n")[0].slice(0, 60), "…");
  }

  console.log("\nClickHouse ready. Table: policyguard.decisions");
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
