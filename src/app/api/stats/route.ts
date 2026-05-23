import { NextResponse } from "next/server";
import { getDecisionStats, isClickHouseConfigured } from "@/lib/clickhouse";

export const runtime = "nodejs";

/** GET /api/stats — decision counts for demo dashboard */
export async function GET() {
  const stats = await getDecisionStats();
  return NextResponse.json({
    mode: process.env.POLICYGUARD_DEMO_MODE === "true" ? "demo" : "live",
    clickhouse: isClickHouseConfigured(),
    senso: Boolean(process.env.SENSO_API_KEY),
    ...stats,
  });
}
