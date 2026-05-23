"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./agent-live.module.css";

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

export function AgentLive() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [prompt, setPrompt] = useState("");
  const sourceRef = useRef<EventSource | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events.length]);

  useEffect(() => {
    return () => {
      sourceRef.current?.close();
    };
  }, []);

  const start = useCallback(() => {
    sourceRef.current?.close();
    setEvents([]);
    setRunning(true);

    const url = prompt.trim()
      ? `/api/agent-run?prompt=${encodeURIComponent(prompt.trim())}`
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

  const stop = useCallback(() => {
    sourceRef.current?.close();
    setRunning(false);
  }, []);

  const verdictCount = events.filter((e) => e.type === "verdict").length;
  const x402Count = events.filter((e) => e.type === "x402_settled").length;
  const status = running ? "live" : events.length > 0 ? "complete" : "idle";
  const isCustom = prompt.trim().length > 0;

  return (
    <section className={styles.shell}>
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <p className={styles.eyebrow}>Live agent — {isCustom ? "custom" : "03"}</p>
          <h2 className={styles.title}>
            An autonomous agent, asking permission first.
          </h2>
          <p className={styles.lead}>
            Claude plans three actions on the open web. Before each, it pays a
            x402 toll and checks PolicyGuard, grounded in real policy text via
            Senso. Then it decides what to do.
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
          placeholder="e.g. I want to scrape Airbnb listings and store prices in a database"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={running}
        />
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
      </div>

      <div className={styles.footer}>
        <span>Claude Sonnet 4 · AI SDK · x402 / Base Sepolia · Senso</span>
        <span>POST /api/agent-run</span>
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
              {event.mode === "mock" ? " · mock mode" : " · on-chain"}
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
