import type { ResearchResult } from "@/lib/schemas/research";
import type { Verdict } from "@/lib/schemas/verdict";

/** SSE payloads from POST /api/research/stream */
export type ResearchProgressEvent =
  | { type: "phase"; message: string }
  | {
      type: "planned";
      count: number;
      planner_mode: "fixed" | "llm";
      planner_fallback?: boolean;
    }
  | { type: "step_start"; index: number; total: number; label: string }
  | {
      type: "step_done";
      index: number;
      total: number;
      label: string;
      verdict: Verdict;
    }
  | { type: "vendors_start"; count: number }
  | { type: "done"; result: ResearchResult };

export type ResearchProgressEmit = (
  event: ResearchProgressEvent
) => void | Promise<void>;
