/**
 * Run clickhouse-init.sql against CLICKHOUSE_URL (reads .env.local).
 * Usage: npm run clickhouse:init
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@clickhouse/client";
import { loadEnvLocal } from "./load-env-local";

loadEnvLocal();

async function main() {
  const url = process.env.CLICKHOUSE_URL?.trim();
  if (!url) {
    console.error(
      "Missing CLICKHOUSE_URL.\n" +
        "Add to .env.local (from ClickHouse Cloud → Connect):\n" +
        "  CLICKHOUSE_URL=https://xxxx.clickhouse.cloud:8443\n" +
        "  CLICKHOUSE_USER=default\n" +
        "  CLICKHOUSE_PASSWORD=...\n" +
        "  CLICKHOUSE_DATABASE=policyguard"
    );
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
