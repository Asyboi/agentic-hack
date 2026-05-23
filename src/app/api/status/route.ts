import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    demo_mode: process.env.POLICYGUARD_DEMO_MODE === "true",
    senso_configured: Boolean(process.env.SENSO_API_KEY?.trim()),
    nimble_configured: Boolean(process.env.NIMBLE_API_KEY?.trim()),
    anthropic_configured: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    planner:
      process.env.POLICYGUARD_PLANNER?.trim().toLowerCase() === "llm"
        ? "llm"
        : "fixed",
  });
}
