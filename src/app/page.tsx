export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>PolicyGuard API</h1>
      <p>
        Agent Policy Firewall — machine-enforceable runtime decisions for web-acting agents.
      </p>
      <pre style={{ background: "#111", color: "#eee", padding: "1rem", borderRadius: 8 }}>
        {`POST /api/evaluate     — one action, one target → verdict
POST /api/research     — marketplace task → plan → many verdicts → vendor packet

# Single action
{ "agent_id": "...", "target": {...}, "intended_action": {...} }

# Full task (orchestrator)
{ "agent_id": "marketplace-buyer", "task": "Find 20 PM tools...", "max_vendors": 5 }`}
      </pre>
      <p>
        Demos: <code>npm run demo</code> · <code>npm run demo:research</code> ·{" "}
        <a href="/api/stats">/api/stats</a>
      </p>
      <p style={{ fontSize: 14, color: "#666" }}>
        Demo mode uses canned verdicts for reliability. Set{" "}
        <code>POLICYGUARD_DEMO_MODE=false</code> + <code>SENSO_API_KEY</code> for live Senso + LLM.
      </p>
    </main>
  );
}
