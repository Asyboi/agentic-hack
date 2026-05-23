"use client";

import { useState } from "react";
import type { ResearchResult } from "@/lib/schemas/research";
import styles from "./research-demo.module.css";

const DEFAULT_TASK =
  "Find 20 project-management tools under $50/user, with current pricing, free-trial links, and a one-line why each fits a 50-person startup. Put everything in our CRM.";

function decisionClass(decision: string): string {
  if (decision === "blocked") return styles.badgeBlocked;
  if (decision === "allowed") return styles.badgeAllowed;
  return styles.badgeModify;
}

export function ResearchDemo() {
  const [task, setTask] = useState(DEFAULT_TASK);
  const [maxVendors, setMaxVendors] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

  const run = async () => {
    const trimmed = task.trim();
    if (trimmed.length < 10) {
      setError("Task must be at least 10 characters.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setElapsed(null);
    const started = Date.now();

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: "marketplace-buyer-agent",
          task: trimmed,
          max_vendors: maxVendors,
        }),
      });

      const json = await res.json();
      setElapsed((Date.now() - started) / 1000);

      if (!res.ok) {
        throw new Error(
          typeof json.message === "string"
            ? json.message
            : json.error ?? `HTTP ${res.status}`
        );
      }

      setResult(json as ResearchResult);
    } catch (e) {
      setElapsed((Date.now() - started) / 1000);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.shell}>
      <p className={styles.eyebrow}>Marketplace research</p>
      <p className={styles.lead}>
        Same flow as <code>npm run demo:research</code>: your task → LLM planner →
        policy checks (Nimble + Senso + rules) → vendor packet. Can take several
        minutes.
      </p>

      <div className={styles.form}>
        <textarea
          className={styles.textarea}
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Describe what the buyer agent should research…"
          disabled={loading}
        />
        <div className={styles.row}>
          <label className={styles.label}>
            max vendors
            <input
              type="number"
              className={styles.inputNum}
              min={1}
              max={20}
              value={maxVendors}
              onChange={(e) =>
                setMaxVendors(
                  Math.min(20, Math.max(1, Number(e.target.value) || 5))
                )
              }
              disabled={loading}
            />
          </label>
          <button
            type="button"
            className={styles.runBtn}
            onClick={run}
            disabled={loading}
          >
            {loading ? "Running research…" : "Run POST /api/research"}
          </button>
        </div>
        <p className={styles.hint}>
          Uses server env: <code>POLICYGUARD_PLANNER</code>,{" "}
          <code>POLICYGUARD_DEMO_MODE</code>, API keys from{" "}
          <code>.env.local</code>.
        </p>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {result && (
        <div className={styles.panel}>
          <p className={styles.summary}>{result.summary}</p>
          <p className={styles.meta}>
            {result.research_id} · planner: {result.planner_mode ?? "?"}
            {result.planner_fallback ? " (fallback)" : ""}
            {elapsed != null ? ` · ${elapsed.toFixed(1)}s` : ""}
          </p>

          <p className={styles.eyebrow}>Planned steps</p>
          <ul className={styles.list}>
            {result.evaluations.map((ev) => (
              <li key={ev.label}>
                {ev.label} →{" "}
                <span className={decisionClass(ev.verdict.decision)}>
                  {ev.verdict.decision}
                </span>
              </li>
            ))}
          </ul>

          {result.vendors.length > 0 && (
            <>
              <p className={styles.eyebrow} style={{ marginTop: "1rem" }}>
                Vendors
              </p>
              <ul className={styles.list}>
                {result.vendors.map((v) => (
                  <li key={v.name}>
                    {v.name} · {v.price_per_user} · collected:{" "}
                    {String(v.collected)}
                    {v.collection_source ? ` (${v.collection_source})` : ""}
                  </li>
                ))}
              </ul>
            </>
          )}

          <p className={styles.eyebrow} style={{ marginTop: "1rem" }}>
            Aggregate instructions
          </p>
          <pre
            style={{
              fontSize: "0.8rem",
              overflow: "auto",
              margin: 0,
              color: "var(--muted)",
            }}
          >
            {JSON.stringify(result.machine_instruction_aggregate, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
