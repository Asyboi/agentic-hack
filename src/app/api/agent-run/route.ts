import { runAgent, type AgentEvent } from "@/lib/agent";

export const runtime = "nodejs";
export const maxDuration = 120;

function originFromRequest(req: Request): string {
  const explicit = process.env.POLICYGUARD_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function GET(req: Request) {
  const baseUrl = originFromRequest(req);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AgentEvent) => {
        const payload = `data: ${JSON.stringify({
          ...event,
          ts: new Date().toISOString(),
        })}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      send({
        type: "thought",
        text: "Agent run started. Streaming events as they happen.",
      });

      try {
        await runAgent(baseUrl, send);
      } catch (e) {
        send({
          type: "error",
          message: e instanceof Error ? e.message : String(e),
        });
      } finally {
        controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
