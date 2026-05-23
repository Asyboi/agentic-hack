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
      manifest?: unknown;
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
  const sourceRef = useRef<EventSource | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
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

    const es = new EventSource("/api/agent-run");
    sourceRef.current = es;

    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as AgentEvent;
        setEvents((prev) => [...prev, event]);
      } catch {
        // ignore malformed event
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

  return (
    <section className={styles.shell}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Live demo</p>
          <h2 className={styles.title}>Autonomous Agent</h2>
          <p className={styles.lead}>
            A Claude agent attempts three real-world actions on the open web.
            Before each one it calls PolicyGuard, paying via x402, and decides
            whether to proceed.
          </p>
        </div>
        <div className={styles.controls}>
          {!running ? (
            <button className={styles.runBtn} onClick={start}>
              ▶ Run agent
            </button>
          ) : (
            <button className={styles.stopBtn} onClick={stop}>
              ■ Stop
            </button>
          )}
        </div>
      </div>

      <div className={styles.feed} ref={logRef} aria-live="polite">
        {events.length === 0 && !running && (
          <div className={styles.empty}>
            Click <strong>Run agent</strong> to start. Events stream live —
            agent thoughts, tool calls, x402 payment, and policy verdicts.
          </div>
        )}

        {events.map((e, i) => (
          <EventRow key={i} event={e} />
        ))}

        {running && (
          <div className={styles.running}>
            <span className={styles.spinner} /> agent thinking…
          </div>
        )}
      </div>
    </section>
  );
}

function EventRow({ event }: { event: AgentEvent }) {
  switch (event.type) {
    case "thought":
      return (
        <div className={styles.rowThought}>
          <span className={styles.label}>agent</span>
          <p className={styles.thoughtText}>{event.text}</p>
        </div>
      );

    case "action":
      return (
        <div className={styles.rowAction}>
          <span className={styles.label}>tool</span>
          <div>
            <code className={styles.toolName}>{event.tool}</code>
            <span className={styles.actionDetail}>
              {String(event.input.target ?? "")} —{" "}
              {String(event.input.action ?? "")}
            </span>
          </div>
        </div>
      );

    case "x402_attempt":
      return (
        <div className={styles.rowX402}>
          <span className={styles.label}>x402</span>
          <div>
            <p className={styles.x402Line}>
              <strong>Paying $0.001 toll on Base Sepolia</strong>
            </p>
            <p className={styles.x402Sub}>
              wallet: <code>{event.wallet}</code> →{" "}
              <code>{event.url}</code>
            </p>
          </div>
        </div>
      );

    case "x402_settled":
      return (
        <div className={styles.rowX402Done}>
          <span className={styles.label}>x402</span>
          <p>
            payment {event.mode === "mock" ? "(mock mode)" : "(live)"}{" "}
            <span className={styles.check}>✓</span>
          </p>
        </div>
      );

    case "x402_skipped":
      return (
        <div className={styles.rowX402Skip}>
          <span className={styles.label}>x402</span>
          <p>skipped — {event.reason}</p>
        </div>
      );

    case "verdict": {
      const v = event.verdict;
      return (
        <div className={styles.rowVerdict}>
          <div className={styles.verdictHeader}>
            <span className={styles.label}>verdict</span>
            <span className={`${styles.badge} ${decisionBadge(v.decision)}`}>
              {decisionLabel(v.decision)}
            </span>
            <span className={styles.risk}>risk: {v.risk_level}</span>
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
              <strong>Safe alternative:</strong>{" "}
              {v.machine_instruction.safe_alternative}
            </p>
          )}
          <a
            className={styles.cite}
            href={v.citation.source_url}
            target="_blank"
            rel="noreferrer"
          >
            citation: {v.citation.source_url}
          </a>
        </div>
      );
    }

    case "summary":
      return (
        <div className={styles.rowSummary}>
          <span className={styles.label}>summary</span>
          <p>{event.text}</p>
        </div>
      );

    case "error":
      return (
        <div className={styles.rowError}>
          <span className={styles.label}>error</span>
          <p>{event.message}</p>
        </div>
      );
  }
}
