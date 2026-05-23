import { NextResponse } from "next/server";
import { evaluateRequestSchema } from "@/lib/schemas/evaluate-request";
import { verdictSchema } from "@/lib/schemas/verdict";
import { logDecision } from "@/lib/clickhouse";
import { runEvaluatePipeline } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/evaluate
 * PolicyGuard runtime decision API.
 * x402 paywall: Aslan wraps this route or upstream gateway.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = evaluateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const demoKey = req.headers.get("x-demo-scenario") ?? undefined;

  try {
    const { verdict, meta } = await runEvaluatePipeline(parsed.data, {
      demoKey: demoKey as "linkedin_scrape" | "pricing_read" | "email_crm" | undefined,
    });

    const validated = verdictSchema.parse(verdict);
    await logDecision(parsed.data, validated);

    return NextResponse.json({ ...validated, pipeline: meta });
  } catch (e) {
    console.error("[evaluate]", e);
    return NextResponse.json(
      { error: "Evaluation failed", message: String(e) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    service: "PolicyGuard",
    endpoint: "POST /api/evaluate",
    demo: "npm run demo",
  });
}
