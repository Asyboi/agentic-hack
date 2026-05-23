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
        Demos: <code>npm run demo</code> (3 compliance actions) ·{" "}
        <code>npm run demo:research</code> (PM tools marketplace task)
      </p>
    </main>
  );
}
