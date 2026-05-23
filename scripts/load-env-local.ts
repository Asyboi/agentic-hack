import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Later lines in the same file override earlier ones (fixes duplicate empty NIMBLE_API_KEY=). */
function loadEnvFile(filename: string): void {
  const path = join(process.cwd(), filename);
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

/** Load `.env` then `.env.local` for tsx scripts (Next.js loads these for `npm run dev`). */
export function loadEnvLocal(): void {
  loadEnvFile(".env");
  loadEnvFile(".env.local");
}
