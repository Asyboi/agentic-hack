import { runResearchOrchestrator } from "@/lib/research-orchestrator";
import type { ResearchProgressEvent } from "@/lib/research-progress";
import { researchRequestSchema } from "@/lib/schemas/research";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/research/stream
 * Same orchestrator as /api/research, but streams progress as SSE for the live UI.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "Invalid JSON body" })}\n\n`,
      { status: 400, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const parsed = researchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      `data: ${JSON.stringify({
        type: "error",
        message: "Invalid request",
        details: parsed.error.flatten(),
      })}\n\n`,
      { status: 400, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ResearchProgressEvent | { type: "error"; message: string }) => {
        const payload = `data: ${JSON.stringify({
          ...event,
          ts: new Date().toISOString(),
        })}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      send({ type: "phase", message: "Research run started. Streaming progress…" });

      try {
        await runResearchOrchestrator(parsed.data, send);
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
