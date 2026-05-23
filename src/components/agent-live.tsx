"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ResearchResult } from "@/lib/schemas/research";
import type { ResearchProgressEvent } from "@/lib/research-progress";
import styles from "./agent-live.module.css";

type RunMode = "policy" | "research";

type AgentEvent =
  | { type: "thought"; text: string; ts?: string }
  | {
      type: "action";
      tool: string;
      input: Record<string, unknown>;
      ts?: string;
    }
  | {
      type: "x402_attempt";
      url: string;
      wallet: string;
      ts?: string;
    }
  | {
      type: "x402_settled";
      mode: "live" | "mock";
      manifest?: {
        asset?: string;
        network?: string;
        price?: string;
        payTo?: string;
      };
      ts?: string;
    }
  | { type: "x402_skipped"; reason: string; ts?: string }
  | {
      type: "verdict";
      scenario: string;
      verdict: {
        decision: "allowed" | "blocked" | "modify_recommended";
        risk_level: string;
        reason: string;
        matched_rules: string[];
        machine_instruction: {
          proceed: boolean;
          requires_human_review: boolean;
          safe_alternative?: string;
        };
        citation: {
          source_url: string;
        };
      };
      ts?: string;
    }
  | { type: "summary"; text: string; ts?: string }
  | { type: "error"; message: string; ts?: string };

const SCENARIO_LABEL: Record<string, string> = {
  linkedin_scrape: "linkedin.com / scrape profiles",
  pricing_read: "openai.com / read pricing",
  email_crm: "company about-pages / store emails",
};

function decisionBadge(decision: string): string {
  if (decision === "blocked") return styles.badgeBlocked;
  if (decision === "allowed") return styles.badgeAllowed;
  return styles.badgeModify;
}

function decisionLabel(decision: string): string {
  if (decision === "modify_recommended") return "MODIFY";
  return decision.toUpperCase();
}

function progressToAgentEvents(event: ResearchProgressEvent): AgentEvent[] {
  switch (event.type) {
    case "phase":
      return [{ type: "thought", text: event.message }];
    case "planned":
      return [
        {
          type: "thought",
          text: `Planner (${event.planner_mode}${event.planner_fallback ? ", fixed fallback" : ""}) → ${event.count} steps to policy-check.`,
        },
      ];
    case "step_start":
      return [
        {
          type: "action",
          tool: "research_step",
          input: {
            target: `${event.index}/${event.total}`,
            action: event.label,
          },
        },
      ];
    case "step_done":
      return [
        {
          type: "verdict",
          scenario: event.label,
          verdict: event.verdict,
        },
      ];
    case "vendors_start":
      return [
        {
          type: "thought",
          text: `Collecting pricing for up to ${event.count} vendor domains (when policy allows)…`,
        },
      ];
    case "done":
      return [{ type: "summary", text: event.result.summary }];
    default:
      return [];
  }
}

export function AgentLive() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [runMode, setRunMode] = useState<RunMode>("policy");
  const [maxVendors, setMaxVendors] = useState(5);
  const [researchResult, setResearchResult] = useState<ResearchResult | null>(
    null
  );
  const sourceRef = useRef<EventSource | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events.length]);

  useEffect(() => {
    return () => {
      sourceRef.current?.close();
      abortRef.current?.abort();
    };
  }, []);

  const startAgentRun = useCallback((userPrompt?: string) => {
    const url = userPrompt
      ? `/api/agent-run?prompt=${encodeURIComponent(userPrompt)}`
      : "/api/agent-run";
    const es = new EventSource(url);
    sourceRef.current = es;

    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as AgentEvent;
        setEvents((prev) => [...prev, event]);
      } catch {
        /* ignore malformed */
      }
    };

    es.addEventListener("done", () => {
      setRunning(false);
      es.close();
    });

    es.onerror = () => {
      setRunning(false);
      es.close();
    };
  }, []);

  const startResearchStream = useCallback(
    async (task: string) => {
      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const res = await fetch("/api/research/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent_id: "marketplace-buyer-agent",
            task,
            max_vendors: maxVendors,
          }),
          signal: ac.signal,
        });

        if (!res.ok || !res.body) {
          const text = await res.text();
          setEvents((prev) => [
            ...prev,
            {
              type: "error",
              message: text || `Research stream failed (${res.status})`,
            },
          ]);
          setRunning(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const dataLine = part
              .split("\n")
              .find((l) => l.startsWith("data: "));
            if (!dataLine) continue;

            try {
              const raw = JSON.parse(dataLine.slice(6)) as
                | ResearchProgressEvent
                | { type: "error"; message: string };

              if (raw.type === "error") {
                setEvents((prev) => [
                  ...prev,
                  { type: "error", message: raw.message },
                ]);
                continue;
              }

              if (raw.type === "done") {
                setResearchResult(raw.result);
              }

              const mapped = progressToAgentEvents(raw);
              if (mapped.length > 0) {
                setEvents((prev) => [...prev, ...mapped]);
              }
            } catch {
              /* ignore malformed */
            }
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setEvents((prev) => [
            ...prev,
            {
              type: "error",
              message: e instanceof Error ? e.message : String(e),
            },
          ]);
        }
      } finally {
        setRunning(false);
        abortRef.current = null;
      }
    },
    [maxVendors]
  );

  const start = useCallback(() => {
    sourceRef.current?.close();
    abortRef.current?.abort();
    setEvents([]);
    setResearchResult(null);
    setRunning(true);

    const trimmed = prompt.trim();

    if (!trimmed) {
      startAgentRun();
      return;
    }

    if (runMode === "research") {
      if (trimmed.length < 10) {
        setEvents([
          {
            type: "error",
            message: "Research task must be at least 10 characters.",
          },
        ]);
        setRunning(false);
        return;
      }
      void startResearchStream(trimmed);
      return;
    }

    startAgentRun(trimmed);
  }, [prompt, runMode, startAgentRun, startResearchStream]);

  const stop = useCallback(() => {
    sourceRef.current?.close();
    abortRef.current?.abort();
    setRunning(false);
  }, []);

  const verdictCount = events.filter((e) => e.type === "verdict").length;
  const x402Count = events.filter((e) => e.type === "x402_settled").length;
  const status = running ? "live" : events.length > 0 ? "complete" : "idle";
  const isCustom = prompt.trim().length > 0;
  const isResearch = isCustom && runMode === "research";

  return (
    <section className={styles.shell}>
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <p className={styles.eyebrow}>
            Live agent —{" "}
            {!isCustom ? "03" : isResearch ? "marketplace research" : "custom"}
          </p>
          <h2 className={styles.title}>
            An autonomous agent, asking permission first.
          </h2>
          <p className={styles.lead}>
            {!isCustom
              ? "Claude plans three actions on the open web. Before each, it pays a x402 toll and checks PolicyGuard, grounded in real policy text via Senso."
              : isResearch
                ? "Your task runs through POST /api/research: LLM planner → policy-check each step (Nimble + Senso + rules) → vendor packet. Progress streams here; can take several minutes."
                : "Describe one action on a site. Claude checks PolicyGuard once via /api/evaluate before deciding whether to proceed."}
          </p>
        </div>
        <div className={styles.controls}>
          {!running ? (
            <button className={styles.runBtn} onClick={start}>
              {events.length > 0 ? "Run again" : "Run agent"}
            </button>
          ) : (
            <button className={styles.stopBtn} onClick={stop}>
              Stop
            </button>
          )}
        </div>
      </div>

      <div className={styles.promptRow}>
        <label className={styles.promptLabel} htmlFor="agent-prompt">
          Describe an action — leave blank for the 3-scenario demo
        </label>
        <textarea
          id="agent-prompt"
          className={styles.promptArea}
          rows={2}
          placeholder={
            runMode === "research"
              ? "e.g. Find 20 PM tools under $50/user with pricing and trial links for a 50-person startup"
              : "e.g. Find HIPAA-compliant note apps under $15/user"
          }
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={running}
        />
        {isCustom && (
          <div className={styles.modeRow}>
            <span className={styles.modeLabel}>When filled in, run as</span>
            <label className={styles.modeOption}>
              <input
                type="radio"
                name="agent-run-mode"
                checked={runMode === "policy"}
                onChange={() => setRunMode("policy")}
                disabled={running}
              />
              Single-site policy check
            </label>
            <label className={styles.modeOption}>
              <input
                type="radio"
                name="agent-run-mode"
                checked={runMode === "research"}
                onChange={() => setRunMode("research")}
                disabled={running}
              />
              Marketplace research
            </label>
            {runMode === "research" && (
              <label className={styles.modeVendors}>
                max vendors
                <input
                  type="number"
                  className={styles.modeVendorsInput}
                  min={1}
                  max={20}
                  value={maxVendors}
                  onChange={(e) =>
                    setMaxVendors(
                      Math.min(20, Math.max(1, Number(e.target.value) || 5))
                    )
                  }
                  disabled={running}
                />
              </label>
            )}
          </div>
        )}
      </div>

      <div className={styles.stateBar}>
        <span className={styles.statePill}>
          <span
            className={`${styles.stateDot} ${
              running ? styles.stateDotLive : ""
            }`}
          />
          status / {status}
        </span>
        <span className={styles.statePill}>
          x402 settled / {x402Count.toString().padStart(2, "0")}
        </span>
        <span className={styles.statePill}>
          verdicts / {verdictCount.toString().padStart(2, "0")}
          {!isCustom && " of 03"}
          {isResearch && running && " · streaming"}
        </span>
      </div>

      <div className={styles.feed} ref={feedRef} aria-live="polite">
        {events.length === 0 && !running && (
          <div className={styles.empty}>
            Click <span className={styles.kbd}>Run agent</span> to start.
            <br />
            Events stream live: agent reasoning, tool calls, x402 settlement,
            and grounded verdicts.
          </div>
        )}

        {events.map((e, i) => (
          <EventRow key={i} event={e} />
        ))}

        {researchResult && researchResult.vendors.length > 0 && (
          <div className={styles.researchPanel}>
            <p className={styles.researchPanelTitle}>
              Vendors ({researchResult.research_id})
            </p>
            <ul className={styles.researchVendorList}>
              {researchResult.vendors.map((v) => (
                <li key={v.name}>
                  {v.name} · {v.price_per_user}
                  {v.collected ? " · collected" : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <span>Claude Sonnet 4 · AI SDK · x402 / Base Sepolia · Senso</span>
        <span>
          {isResearch
            ? "POST /api/research/stream"
            : "GET /api/agent-run (SSE)"}
        </span>
      </div>
    </section>
  );
}

function EventRow({ event }: { event: AgentEvent }) {
  switch (event.type) {
    case "thought":
      return (
        <div className={styles.row}>
          <span className={`${styles.label} ${styles.labelAgent}`}>agent</span>
          <div className={styles.body}>
            <p className={styles.bodyText}>{event.text}</p>
          </div>
        </div>
      );

    case "action": {
      const detail = `${event.input.target ?? ""} · ${event.input.action ?? ""}`;
      return (
        <div className={styles.row}>
          <span className={`${styles.label} ${styles.labelTool}`}>tool</span>
          <div className={styles.body}>
            <span className={styles.toolName}>{event.tool}()</span>
            <span className={styles.toolArgs}>{detail}</span>
          </div>
        </div>
      );
    }

    case "x402_attempt":
      return (
        <div className={styles.row}>
          <span className={`${styles.label} ${styles.labelX402}`}>x402</span>
          <div className={styles.body}>
            <div className={styles.x402Headline}>
              <span className={styles.x402Amount}>$0.001 USDC</span>
              <span className={styles.x402Network}>base-sepolia</span>
            </div>
            <p className={styles.x402Wallet}>
              wallet <code>{event.wallet}</code> → <code>{event.url}</code>
            </p>
          </div>
        </div>
      );

    case "x402_settled":
      return (
        <div className={styles.row}>
          <span className={`${styles.label} ${styles.labelX402}`}>x402</span>
          <div className={styles.body}>
            <span className={styles.x402Settled}>
              <span className={styles.x402SettledMark} />
              settled
            </span>
          </div>
        </div>
      );

    case "x402_skipped":
      return (
        <div className={styles.row}>
          <span className={`${styles.label} ${styles.labelX402}`}>x402</span>
          <div className={styles.body}>
            <p className={styles.bodyDim}>skipped — {event.reason}</p>
          </div>
        </div>
      );

    case "verdict": {
      const v = event.verdict;
      const scenarioLabel =
        SCENARIO_LABEL[event.scenario] ?? event.scenario;
      return (
        <div className={styles.row}>
          <span className={`${styles.label} ${styles.labelVerdict}`}>
            verdict
          </span>
          <div className={styles.body}>
            <div className={styles.verdictBox}>
              <div className={styles.verdictHeader}>
                <span className={styles.scenarioName}>{scenarioLabel}</span>
                <span className={`${styles.badge} ${decisionBadge(v.decision)}`}>
                  {decisionLabel(v.decision)}
                </span>
                <span className={styles.risk}>risk · {v.risk_level}</span>
              </div>
              <p className={styles.verdictReason}>{v.reason}</p>
              {v.matched_rules.length > 0 && (
                <div className={styles.rules}>
                  {v.matched_rules.map((r) => (
                    <code key={r} className={styles.rule}>
                      {r}
                    </code>
                  ))}
                </div>
              )}
              {v.machine_instruction.safe_alternative && (
                <p className={styles.alt}>
                  <strong>safe alt</strong>
                  {v.machine_instruction.safe_alternative}
                </p>
              )}
              <a
                className={styles.cite}
                href={v.citation.source_url}
                target="_blank"
                rel="noreferrer"
              >
                source — {v.citation.source_url}
              </a>
            </div>
          </div>
        </div>
      );
    }

    case "summary":
      return (
        <div className={styles.row}>
          <span className={`${styles.label} ${styles.labelVerdict}`}>
            summary
          </span>
          <div className={styles.body}>
            <div className={styles.summaryBox}>
              <p className={styles.summaryLabel}>agent decision log</p>
              <p className={styles.summaryText}>{event.text}</p>
            </div>
          </div>
        </div>
      );

    case "error":
      return (
        <div className={styles.row}>
          <span className={`${styles.label} ${styles.labelError}`}>error</span>
          <div className={styles.body}>
            <div className={styles.errorBox}>{event.message}</div>
          </div>
        </div>
      );
  }
}
