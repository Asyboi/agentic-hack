import { AgentLive } from "@/components/agent-live";
import { PolicyGuardDemo } from "@/components/policyguard-demo";

export default function Home() {
  return (
    <main style={{ paddingBottom: "4rem" }}>
      <header
        style={{
          maxWidth: 1040,
          margin: "0 auto",
          padding: "3rem 1.5rem 1.5rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "1rem",
            marginBottom: "0.5rem",
          }}
        >
          <span
            style={{
              fontFamily:
                "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
              fontSize: "0.7rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#c8ff00",
            }}
          >
            PolicyGuard
          </span>
          <span
            style={{
              fontFamily:
                "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
              fontSize: "0.7rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#54545c",
            }}
          >
            agentic engineering hackathon · may 2026
          </span>
        </div>
        <h1
          style={{
            fontSize: "clamp(2rem, 4.5vw, 3rem)",
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            margin: "0 0 0.75rem",
            color: "#f5f5f7",
            fontWeight: 600,
            maxWidth: "20ch",
          }}
        >
          A compliance layer for the agentic web.
        </h1>
        <p
          style={{
            color: "#8a8a93",
            margin: 0,
            fontSize: "1.05rem",
            lineHeight: 1.55,
            maxWidth: "60ch",
          }}
        >
          AI agents take real actions every minute — scraping, posting,
          transacting. PolicyGuard is a paid HTTP API the agent calls before it
          acts, returning a structured verdict grounded in the live policy text.
        </p>
      </header>

      <div
        style={{
          maxWidth: 1040,
          margin: "0 auto",
          padding: "0 1.5rem",
        }}
      >
        <AgentLive />
      </div>

      <details
        style={{
          maxWidth: 1040,
          margin: "0 auto 2rem",
          padding: "0 1.5rem",
        }}
      >
        <summary
          style={{
            cursor: "pointer",
            fontFamily:
              "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
            fontSize: "0.78rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#8a8a93",
            padding: "0.85rem 0",
            borderTop: "1px solid #1f1f24",
            borderBottom: "1px solid #1f1f24",
            marginBottom: "1.5rem",
            listStyle: "none",
          }}
        >
          ▸ Developer playground — call /evaluate directly with any site
        </summary>
        <PolicyGuardDemo />
      </details>
    </main>
  );
}
