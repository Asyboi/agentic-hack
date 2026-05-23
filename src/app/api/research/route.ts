import { NextResponse } from "next/server";
import { runResearchOrchestrator } from "@/lib/research-orchestrator";
import {
  researchRequestSchema,
  researchResultSchema,
} from "@/lib/schemas/research";

export const runtime = "nodejs";
/** Live research runs 8 sequential Nimble+Senso steps; allow several minutes locally. */
export const maxDuration = 300;

/**
 * POST /api/research
 * Marketplace-style task in → plan actions → policy-check each → vendor packet out.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = researchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await runResearchOrchestrator(parsed.data);
    const validated = researchResultSchema.parse(result);
    return NextResponse.json(validated);
  } catch (e) {
    console.error("[research]", e);
    return NextResponse.json(
      { error: "Research failed", message: String(e) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    service: "PolicyGuard Research",
    endpoint: "POST /api/research",
    example_body: {
      agent_id: "marketplace-buyer-agent",
      task: "Find 20 project-management tools under $50/user, with current pricing, free-trial links, and a one-line why each fits a 50-person startup. Put everything in our CRM.",
      max_vendors: 5,
    },
    demo: "npm run demo:research",
  });
}
