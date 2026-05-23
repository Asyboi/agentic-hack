export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>PolicyGuard API</h1>
      <p>
        Agent Policy Firewall — machine-enforceable runtime decisions for web-acting agents.
      </p>
      <pre style={{ background: "#111", color: "#eee", padding: "1rem", borderRadius: 8 }}>
        {`POST /api/evaluate
Content-Type: application/json

{
  "agent_id": "sales-prospecting-agent",
  "target": { "name": "LinkedIn", "policy_content_id": "..." },
  "intended_action": { "action_type": "collect_profiles", ... }
}`}
      </pre>
      <p>
        Demo harness: <code>npm run demo</code>
      </p>
    </main>
  );
}
