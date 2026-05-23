import { AgentLive } from "@/components/agent-live";
import { PolicyGuardDemo } from "@/components/policyguard-demo";

export default function Home() {
  return (
    <main>
      <div
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: "2rem 1.25rem 0",
        }}
      >
        <AgentLive />
      </div>
      <PolicyGuardDemo />
    </main>
  );
}
