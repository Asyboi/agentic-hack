"use client";

import { useCallback, useEffect, useState } from "react";
import { buildCustomSiteRequest, EXAMPLE_SITES } from "@/lib/custom-site";
import {
  CITED_MD_CORPUS_HUB,
  CITED_MD_LIVE_ARTICLES,
  isValidCitedMdArticleUrl,
} from "@/lib/cited-md-corpus";
import { DEMO_REQUESTS } from "@/lib/demo-fixtures";
import type { PipelineMeta } from "@/lib/pipeline";
import type { EvaluateRequest } from "@/lib/schemas/evaluate-request";
import type { Verdict } from "@/lib/schemas/verdict";
import styles from "./policyguard-demo.module.css";

type ScenarioId = keyof typeof DEMO_REQUESTS;

const SCENARIOS: {
  id: ScenarioId;
  title: string;
  subtitle: string;
}[] = [
  {
    id: "linkedin_scrape",
    title: "Scrape LinkedIn profiles",
    subtitle: "Bulk automation · stores PII · no official API",
  },
  {
    id: "pricing_read",
    title: "Read OpenAI pricing",
    subtitle: "Public page · once · no PII",
  },
  {
    id: "email_crm",
    title: "Store emails in CRM",
    subtitle: "Bulk extract · HubSpot · commercial use",
  },
];

function badgeClass(decision: Verdict["decision"]): string {
  if (decision === "blocked") return styles.badgeBlocked;
  if (decision === "allowed") return styles.badgeAllowed;
  return styles.badgeModify;
}

function decisionLabel(decision: Verdict["decision"]): string {
  if (decision === "modify_recommended") return "Modify recommended";
  return decision;
}

const POLICY_OPTIONS: { id: ScenarioId; label: string }[] = [
  { id: "linkedin_scrape", label: "LinkedIn ToS" },
  { id: "pricing_read", label: "OpenAI terms" },
  { id: "email_crm", label: "Stripe privacy" },
];

export function PolicyGuardDemo() {
  const [active, setActive] = useState<ScenarioId | null>(null);
  const [loading, setLoading] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customAction, setCustomAction] = useState(
    "Scrape 100 LinkedIn profiles for software engineers"
  );
  const [customPolicy, setCustomPolicy] = useState<ScenarioId>("linkedin_scrape");
  const [siteName, setSiteName] = useState("Instagram");
  const [policyUrl, setPolicyUrl] = useState<string>(EXAMPLE_SITES[0].policyUrl);
  const [pipelineMeta, setPipelineMeta] = useState<PipelineMeta | null>(null);
  const [serverStatus, setServerStatus] = useState<{
    demo_mode: boolean;
    senso_configured: boolean;
    nimble_configured: boolean;
  } | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setServerStatus)
      .catch(() => setServerStatus(null));
  }, []);

  const evaluate = useCallback(
    async (body: EvaluateRequest, scenarioKey?: ScenarioId) => {
      setLoading(true);
      setError(null);
      setVerdict(null);
      setPipelineMeta(null);

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (scenarioKey && serverStatus?.demo_mode) {
          headers["x-demo-scenario"] = scenarioKey;
        }

        const res = await fetch("/api/evaluate", {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            typeof data.message === "string"
              ? data.message
              : data.error ?? `HTTP ${res.status}`
          );
        }

        const v = (data.decision ? data : null) as Verdict | null;
        if (!v?.decision) {
          throw new Error("Invalid verdict response");
        }
        setVerdict(v);
        if (data.pipeline) {
          setPipelineMeta(data.pipeline as PipelineMeta);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [serverStatus?.demo_mode]
  );

  const runScenario = useCallback(
    async (id: ScenarioId) => {
      setActive(id);
      const base = DEMO_REQUESTS[id];
      setCustomAction(
        base.intended_action.description ??
          `${base.intended_action.action_type} on ${base.target.name}`
      );
      setCustomPolicy(id);
      await evaluate(DEMO_REQUESTS[id], id);
    },
    [evaluate]
  );

  const runCustom = useCallback(async () => {
    const trimmed = customAction.trim();
    if (!trimmed) {
      setError("Type a proposed action in the box below.");
      return;
    }

    setActive(null);
    const template = DEMO_REQUESTS[customPolicy];
    const body: EvaluateRequest = {
      ...template,
      intended_action: {
        ...template.intended_action,
        description: trimmed,
      },
    };

    await evaluate(body, customPolicy);
  }, [customAction, customPolicy, evaluate]);

  const runAnySite = useCallback(async () => {
    const action = customAction.trim();
    const url = policyUrl.trim();
    if (!action) {
      setError("Describe the agent action.");
      return;
    }
    if (!url.startsWith("http")) {
      setError("Policy URL must start with https://");
      return;
    }

    setActive(null);
    const body = buildCustomSiteRequest(siteName, url, action);
    await evaluate(body);
  }, [customAction, policyUrl, siteName, evaluate]);

  const loadExample = (id: (typeof EXAMPLE_SITES)[number]["id"]) => {
    const ex = EXAMPLE_SITES.find((e) => e.id === id);
    if (!ex) return;
    setSiteName(ex.name);
    setPolicyUrl(ex.policyUrl);
    setCustomAction(ex.action);
  };

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Agentic Engineering Hackathon · May 2026</p>
        <h1 className={styles.title}>PolicyGuard</h1>
        <p className={styles.lead}>
          Compliance API for AI agents on the open web. Click a preset scenario
          or type your own action below, then run evaluate.
        </p>
        <p className={styles.hint}>
          Presets use pre-loaded <strong>Senso KB</strong> (LinkedIn, OpenAI,
          Stripe). <strong>Any website</strong> uses <strong>Nimble</strong> to
          fetch the policy URL live (Instagram, Calm, etc.). Restart{" "}
          <code>npm run dev</code> after changing <code>.env</code>.
        </p>
        {serverStatus && (
          <div className={styles.statusBar}>
            <span
              className={`${styles.statusPill} ${
                serverStatus.demo_mode ? styles.statusPillWarn : styles.statusPillOn
              }`}
            >
              demo_mode: {String(serverStatus.demo_mode)}
            </span>
            <span
              className={`${styles.statusPill} ${
                serverStatus.senso_configured ? styles.statusPillOn : ""
              }`}
            >
              senso
            </span>
            <span
              className={`${styles.statusPill} ${
                serverStatus.nimble_configured ? styles.statusPillOn : ""
              }`}
            >
              nimble
            </span>
          </div>
        )}
        <div className={styles.links}>
          <a
            href="https://policyguard-site.vercel.app"
            target="_blank"
            rel="noreferrer"
          >
            Marketing site
          </a>
          <a
            href="https://geo.senso.ai"
            target="_blank"
            rel="noreferrer"
          >
            Senso KB
          </a>
          <a href={CITED_MD_CORPUS_HUB} target="_blank" rel="noreferrer">
            cited.md corpus (live)
          </a>
          <a href="/api/evaluate" target="_blank" rel="noreferrer">
            API (GET)
          </a>
        </div>
        <p className={styles.corpusNote}>
          Senso org <code>policy-guard-3480</code> has{" "}
          {CITED_MD_LIVE_ARTICLES.length} GEO articles on cited.md (not{" "}
          <code>/policy-guard-3480/…</code> paths). Live{" "}
          <code>POST /evaluate</code> can publish new verdicts as{" "}
          <code>/article/…</code> when publish succeeds.
        </p>
      </header>

      <form
        className={styles.custom}
        onSubmit={(e) => {
          e.preventDefault();
          void runAnySite();
        }}
      >
        <p className={styles.customLabel}>Any website (Nimble live fetch)</p>
        <div className={styles.chips}>
          {EXAMPLE_SITES.map((ex) => (
            <button
              key={ex.id}
              type="button"
              className={styles.chip}
              disabled={loading}
              onClick={() => loadExample(ex.id)}
            >
              {ex.name}
            </button>
          ))}
        </div>
        <div className={styles.formStack}>
          <input
            className={styles.input}
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            placeholder="Site name (e.g. Instagram, Calm, Aurie)"
            disabled={loading}
          />
          <input
            className={styles.input}
            value={policyUrl}
            onChange={(e) => setPolicyUrl(e.target.value)}
            placeholder="Policy URL (terms, privacy, robots.txt…)"
            disabled={loading}
          />
          <textarea
            id="custom-action"
            className={styles.textarea}
            value={customAction}
            onChange={(e) => setCustomAction(e.target.value)}
            placeholder="What does the agent want to do on this site?"
            disabled={loading}
            aria-label="Proposed agent action"
          />
        </div>
        <button type="submit" className={styles.runBtn} disabled={loading}>
          Evaluate (Nimble + rules)
        </button>
      </form>

      <form
        className={styles.custom}
        onSubmit={(e) => {
          e.preventDefault();
          void runCustom();
        }}
      >
        <p className={styles.customLabel}>Senso KB presets (3 hackathon policies)</p>
        <div className={styles.customRow}>
          <textarea
            className={styles.textarea}
            value={customAction}
            onChange={(e) => setCustomAction(e.target.value)}
            disabled={loading}
            aria-label="Action for Senso preset"
          />
          <select
            className={styles.select}
            value={customPolicy}
            onChange={(e) => setCustomPolicy(e.target.value as ScenarioId)}
            disabled={loading}
            aria-label="Senso policy"
          >
            {POLICY_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={styles.runBtn} disabled={loading}>
          Evaluate with Senso search
        </button>
      </form>

      <p className={styles.customLabel}>One-click presets</p>
      <div className={styles.scenarios}>
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`${styles.scenarioBtn} ${
              active === s.id ? styles.scenarioBtnActive : ""
            }`}
            disabled={loading}
            onClick={() => runScenario(s.id)}
          >
            <p className={styles.scenarioTitle}>{s.title}</p>
            <p className={styles.scenarioSub}>{s.subtitle}</p>
          </button>
        ))}
      </div>

      <section className={styles.panel} aria-live="polite">
        {loading && (
          <div className={styles.panelLoading}>
            <div className={styles.spinner} aria-hidden />
            <span>Evaluating… (may take 15–45s for Nimble fetch)</span>
          </div>
        )}

        {!loading && error && (
          <div className={styles.error}>
            <strong>Evaluation failed.</strong> {error}
            <br />
            <br />
            Is <code>npm run dev</code> running on this machine?
          </div>
        )}

        {!loading && !error && !verdict && (
          <div className={styles.panelEmpty}>
            Click a scenario above to call <code>POST /api/evaluate</code>
          </div>
        )}

        {!loading && !error && verdict && (
          <div className={styles.panelBody}>
            {pipelineMeta && (
              <>
                <p className={styles.pipelineTag}>
                  Pipeline: {pipelineMeta.mode}
                  {pipelineMeta.demo_mode ? " · DEMO FIXTURES ON" : ""}
                  {pipelineMeta.nimble_pages_fetched > 0
                    ? ` · nimble pages: ${pipelineMeta.nimble_pages_fetched}`
                    : ""}
                  {pipelineMeta.senso_chunks > 0
                    ? ` · senso chunks: ${pipelineMeta.senso_chunks}`
                    : ""}
                </p>
                {pipelineMeta.nimble_errors?.length > 0 && (
                  <p className={styles.pipelineTag} style={{ color: "#c0392b" }}>
                    nimble failed:{" "}
                    {pipelineMeta.nimble_errors.join(" | ")}
                  </p>
                )}
              </>
            )}
            <div className={styles.verdictRow}>
              <span
                className={`${styles.badge} ${badgeClass(verdict.decision)}`}
              >
                {decisionLabel(verdict.decision)}
              </span>
              <span className={styles.risk}>Risk: {verdict.risk_level}</span>
              {verdict.decision_id && (
                <span className={styles.risk}>{verdict.decision_id}</span>
              )}
            </div>

            <p className={styles.reason}>{verdict.reason}</p>

            <p className={styles.sectionLabel}>Machine instruction</p>
            <div className={styles.flags}>
              <span
                className={`${styles.flag} ${
                  verdict.machine_instruction.proceed ? styles.flagOn : ""
                }`}
              >
                proceed: {String(verdict.machine_instruction.proceed)}
              </span>
              <span
                className={`${styles.flag} ${
                  verdict.machine_instruction.disable_target_action
                    ? styles.flagOn
                    : ""
                }`}
              >
                disable_target_action:{" "}
                {String(verdict.machine_instruction.disable_target_action)}
              </span>
              <span
                className={`${styles.flag} ${
                  verdict.machine_instruction.requires_human_review
                    ? styles.flagOn
                    : ""
                }`}
              >
                requires_human_review:{" "}
                {String(verdict.machine_instruction.requires_human_review)}
              </span>
            </div>

            {verdict.machine_instruction.safe_alternative && (
              <>
                <p className={styles.sectionLabel}>Safe alternative</p>
                <p className={styles.reason}>
                  {verdict.machine_instruction.safe_alternative}
                </p>
              </>
            )}

            {verdict.matched_rules.length > 0 && (
              <>
                <p className={styles.sectionLabel}>Matched rules</p>
                <div className={styles.rules}>
                  {verdict.matched_rules.map((r) => (
                    <code key={r} className={styles.rule}>
                      {r}
                    </code>
                  ))}
                </div>
              </>
            )}

            <p className={styles.sectionLabel}>Citation</p>
            <blockquote className={styles.quote}>
              “{verdict.citation.quoted_text}”
              <cite>
                <a
                  href={verdict.citation.source_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {verdict.citation.source_url}
                </a>
              </cite>
            </blockquote>

            {isValidCitedMdArticleUrl(verdict.cited_md_url) && (
              <a
                className={styles.citedLink}
                href={verdict.cited_md_url}
                target="_blank"
                rel="noreferrer"
              >
                Published on cited.md →
              </a>
            )}
            {serverStatus?.demo_mode && (
              <p className={styles.corpusHint}>
                Demo mode skips Senso publish. Open the live corpus:{" "}
                {CITED_MD_LIVE_ARTICLES.map((a, i) => (
                  <span key={a.url}>
                    {i > 0 ? " · " : null}
                    <a href={a.url} target="_blank" rel="noreferrer">
                      {a.title}
                    </a>
                  </span>
                ))}
              </p>
            )}
          </div>
        )}
      </section>

      <p className={styles.footer}>
        Pipeline: Nimble fetch → Senso context search → LLM verdict → ClickHouse
        log → cited.md. Set <code>POLICYGUARD_DEMO_MODE=false</code> in{" "}
        <code>.env</code> for live Senso path.
      </p>
    </div>
  );
}
