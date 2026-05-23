import { anthropic } from "@ai-sdk/anthropic";
import { generateText, tool } from "ai";
import { z } from "zod";
import { wrapFetchWithPayment, createSigner } from "x402-fetch";
import { generatePrivateKey } from "viem/accounts";
import { DEMO_REQUESTS } from "@/lib/demo-fixtures";
import { buildCustomSiteRequest } from "@/lib/custom-site";
import type { Verdict } from "@/lib/schemas/verdict";

export type AgentEvent =
  | { type: "thought"; text: string }
  | {
      type: "action";
      tool: string;
      input: Record<string, unknown>;
    }
  | {
      type: "x402_attempt";
      url: string;
      wallet: string;
    }
  | {
      type: "x402_settled";
      mode: "live" | "mock";
      manifest?: unknown;
    }
  | {
      type: "x402_skipped";
      reason: string;
    }
  | {
      type: "verdict";
      scenario: string;
      verdict: Verdict;
    }
  | {
      type: "decision";
      scenario: string;
      choice: "proceed" | "block" | "modify";
      reasoning: string;
    }
  | { type: "summary"; text: string }
  | { type: "error"; message: string };

export type AgentEmit = (event: AgentEvent) => void | Promise<void>;

type ScenarioId = keyof typeof DEMO_REQUESTS;

const SCENARIO_HINTS: Record<ScenarioId, string> = {
  linkedin_scrape: "Scrape 100 public LinkedIn profiles matching 'software engineer'.",
  pricing_read: "Read OpenAI's public API pricing page once.",
  email_crm: "Extract emails from 50 company about-pages and store them in HubSpot.",
};

export async function runAgent(
  baseUrl: string,
  emit: AgentEmit,
  userPrompt?: string
): Promise<void> {
  if (userPrompt) {
    await runCustomAgent(baseUrl, emit, userPrompt);
  } else {
    await runDemoAgent(baseUrl, emit);
  }
}

async function runDemoAgent(baseUrl: string, emit: AgentEmit): Promise<void> {
  await emit({
    type: "thought",
    text: `Agent online. Three planned actions on the open web: scrape LinkedIn, read OpenAI pricing, store emails in HubSpot. I will check policy with PolicyGuard before each one.`,
  });

  await demonstrateX402Payment(baseUrl, emit);

  try {
    const result = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      maxSteps: 12,
      system: AGENT_SYSTEM_PROMPT,
      prompt: AGENT_TASK_PROMPT,
      tools: {
        check_policy: tool({
          description:
            "MANDATORY before any action on the open web. Submits the proposed action to the PolicyGuard /evaluate endpoint, which grounds the decision in real policy text via Senso and returns a structured verdict. Pass the scenario_id of the planned action.",
          parameters: z.object({
            scenario_id: z.enum([
              "linkedin_scrape",
              "pricing_read",
              "email_crm",
            ]),
          }),
          execute: async ({ scenario_id }) => {
            const body = DEMO_REQUESTS[scenario_id as ScenarioId];
            await emit({
              type: "action",
              tool: "check_policy",
              input: {
                scenario_id,
                target: body.target.name,
                action: body.intended_action.description ?? body.intended_action.action_type,
              },
            });

            const res = await fetch(`${baseUrl}/api/evaluate`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-demo-scenario": scenario_id,
              },
              body: JSON.stringify(body),
            });

            const json = (await res.json()) as Verdict & {
              error?: string;
              message?: string;
            };

            if (!res.ok || !json.decision) {
              await emit({
                type: "error",
                message: `evaluate failed: ${json.error ?? json.message ?? res.status}`,
              });
              return {
                decision: "blocked" as const,
                reason: `PolicyGuard call failed: ${json.error ?? res.status}`,
                matched_rules: [],
                requires_human_review: true,
              };
            }

            await emit({ type: "verdict", scenario: scenario_id, verdict: json });

            return {
              decision: json.decision,
              risk_level: json.risk_level,
              reason: json.reason,
              matched_rules: json.matched_rules,
              safe_alternative: json.machine_instruction?.safe_alternative,
              requires_human_review: json.machine_instruction?.requires_human_review,
              citation_source: json.citation?.source_url,
            };
          },
        }),
      },
      onStepFinish: async ({ text }) => {
        const trimmed = text?.trim();
        if (trimmed) {
          await emit({ type: "thought", text: trimmed });
        }
      },
    });

    const finalText = result.text?.trim();
    if (finalText) {
      await emit({ type: "summary", text: finalText });
    } else {
      await emit({
        type: "summary",
        text: `Agent finished after ${result.steps?.length ?? 0} steps.`,
      });
    }
  } catch (e) {
    await emit({
      type: "error",
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

async function runCustomAgent(
  baseUrl: string,
  emit: AgentEmit,
  userPrompt: string
): Promise<void> {
  await emit({
    type: "thought",
    text: `Agent online. Checking policy compliance for: "${userPrompt}"`,
  });

  await demonstrateX402Payment(baseUrl, emit);

  try {
    const result = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      maxSteps: 6,
      system: CUSTOM_AGENT_SYSTEM_PROMPT,
      prompt: userPrompt,
      tools: {
        check_policy: tool({
          description:
            "Check whether a described action on a website is compliant with that site's policies. Provide the site name, what you want to do, and the URL of the site's Terms of Service or privacy policy.",
          parameters: z.object({
            site: z.string().describe("The website name, e.g. 'Airbnb', 'LinkedIn'"),
            action_description: z.string().describe("What the agent wants to do on the site"),
            policy_url: z.string().describe("URL of the site's Terms of Service or privacy policy"),
          }),
          execute: async ({ site, action_description, policy_url }) => {
            await emit({
              type: "action",
              tool: "check_policy",
              input: { target: site, action: action_description },
            });

            const body = buildCustomSiteRequest(site, policy_url, action_description);

            const res = await fetch(`${baseUrl}/api/evaluate`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            });

            const json = (await res.json()) as Verdict & {
              error?: string;
              message?: string;
            };

            if (!res.ok || !json.decision) {
              await emit({
                type: "error",
                message: `evaluate failed: ${json.error ?? json.message ?? res.status}`,
              });
              return {
                decision: "blocked" as const,
                reason: `PolicyGuard call failed: ${json.error ?? res.status}`,
                matched_rules: [],
                requires_human_review: true,
              };
            }

            await emit({ type: "verdict", scenario: site, verdict: json });

            return {
              decision: json.decision,
              risk_level: json.risk_level,
              reason: json.reason,
              matched_rules: json.matched_rules,
              safe_alternative: json.machine_instruction?.safe_alternative,
              requires_human_review: json.machine_instruction?.requires_human_review,
              citation_source: json.citation?.source_url,
            };
          },
        }),
      },
      onStepFinish: async ({ text }) => {
        const trimmed = text?.trim();
        if (trimmed) {
          await emit({ type: "thought", text: trimmed });
        }
      },
    });

    const finalText = result.text?.trim();
    if (finalText) {
      await emit({ type: "summary", text: finalText });
    } else {
      await emit({
        type: "summary",
        text: `Agent finished after ${result.steps?.length ?? 0} steps.`,
      });
    }
  } catch (e) {
    await emit({
      type: "error",
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

async function demonstrateX402Payment(
  baseUrl: string,
  emit: AgentEmit
): Promise<void> {
  try {
    const privateKey = generatePrivateKey();
    const signer = await createSigner("base-sepolia", privateKey);
    const walletAddress =
      ((signer as unknown as { account?: { address?: string } }).account
        ?.address as string | undefined) ?? "0x?";

    await emit({
      type: "x402_attempt",
      url: `${baseUrl}/api/paid-demo`,
      wallet: walletAddress,
    });

    const paidFetch = wrapFetchWithPayment(globalThis.fetch, signer);
    const res = await paidFetch(`${baseUrl}/api/paid-demo`, { method: "GET" });
    const data = (await res.json()) as {
      paid?: boolean;
      payment?: unknown;
      x402Version?: number;
      accepts?: unknown[];
    };

    if (data.paid === true) {
      await emit({
        type: "x402_settled",
        mode: "mock",
        manifest: data.payment,
      });
    } else if (data.x402Version && Array.isArray(data.accepts)) {
      await emit({
        type: "x402_settled",
        mode: "live",
        manifest: data.accepts[0],
      });
    } else {
      await emit({
        type: "x402_skipped",
        reason: "unexpected response shape from /api/paid-demo",
      });
    }
  } catch (e) {
    await emit({
      type: "x402_skipped",
      reason: e instanceof Error ? e.message : String(e),
    });
  }
}

const CUSTOM_AGENT_SYSTEM_PROMPT = `You are PolicyGuard Agent, a compliance checker for AI agent actions on the open web.

RULE: Call check_policy exactly once for the action the user described.
- Extract the target site name from their description (e.g. "Airbnb", "LinkedIn", "Twitter").
- Use the site's primary Terms of Service or robots.txt URL as policy_url.
- Use the user's description as action_description.

After the check, state in 2-3 sentences whether you would proceed and why, citing the matched rules if any.`;

const AGENT_SYSTEM_PROMPT = `You are PolicyGuard Agent, an autonomous AI agent operating on the open web.
You can take three kinds of actions: scraping pages, reading pricing, and storing user data.

ABSOLUTE RULE: Before each action, call the check_policy tool with the matching scenario_id.
Then, based on the verdict:
- "allowed": say you will proceed.
- "blocked": say you will NOT proceed, name the matched_rules, and consider the safe_alternative.
- "modify_recommended": say you will pause for human review; reference the safe_alternative.

Reason out loud in short, direct sentences before and after each tool call. No filler.`;

const AGENT_TASK_PROMPT = `Your task today:
1. Plan: scrape 100 LinkedIn profiles (scenario_id = "linkedin_scrape").
2. Plan: read OpenAI's public API pricing page (scenario_id = "pricing_read").
3. Plan: extract emails from company about-pages and store them in HubSpot (scenario_id = "email_crm").

For each, call check_policy first. Decide whether you will proceed.
After all three checks, write a one-paragraph summary of what you would do and what you would not do, and why.`;

export const AGENT_SCENARIO_LIST: ReadonlyArray<{
  id: ScenarioId;
  label: string;
  hint: string;
}> = [
  { id: "linkedin_scrape", label: "Scrape LinkedIn profiles", hint: SCENARIO_HINTS.linkedin_scrape },
  { id: "pricing_read", label: "Read OpenAI pricing", hint: SCENARIO_HINTS.pricing_read },
  { id: "email_crm", label: "Store emails in HubSpot", hint: SCENARIO_HINTS.email_crm },
];
