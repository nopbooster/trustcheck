import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { runAgent, type AgentDeps } from "./agent";
import type { ApprovalManager } from "./approvals";
import { ConversationStore } from "./conversations";
import { listLogs } from "./logger";

const chatBody = z.object({
  message: z.string().min(1),
  conversationId: z.string().optional(),
});

const decisionBody = z.object({ decision: z.enum(["approve", "deny"]) });

const HEARTBEAT_MS = 15_000;

export function createApp(deps: AgentDeps, approvals: ApprovalManager) {
  const app = new Hono();
  const conversations = new ConversationStore();

  app.get("/health", (c) => c.json({ ok: true }));

  // Blocks until the agent is done. If a risky call needs approval, the agent
  // waits here while the browser answers through /events and /approvals/:id.
  app.post("/chat", async (c) => {
    const parsed = chatBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Body must be { message: string, conversationId?: string }" }, 400);

    const { message, conversationId } = parsed.data;
    const convo = conversationId ? conversations.get(conversationId) : conversations.create();
    if (!convo) return c.json({ error: "Unknown conversationId" }, 404);

    try {
      const result = await runAgent(deps, convo, message);
      return c.json({ conversationId: convo.id, ...result });
    } catch (err) {
      console.error("chat failed:", err instanceof Error ? err.message : err);
      return c.json({ error: "The agent failed. Check the server log." }, 500);
    }
  });

  // Server-Sent Events: approval_requested / approval_resolved.
  // Optional ?conversationId= filter. Questions already waiting are replayed on connect.
  app.get("/events", (c) => {
    const only = c.req.query("conversationId");
    return streamSSE(c, async (stream) => {
      let open = true;
      const send = (event: string, data: unknown) => {
        if (open) void stream.writeSSE({ event, data: JSON.stringify(data) }).catch(() => (open = false));
      };
      const wanted = (conversationId: string) => !only || only === conversationId;

      const unsubscribe = approvals.subscribe((e) => {
        if (e.type === "approval_requested" && wanted(e.approval.conversationId)) send(e.type, e.approval);
        if (e.type === "approval_resolved" && wanted(e.conversationId)) send(e.type, e);
      });
      stream.onAbort(() => {
        open = false;
        unsubscribe();
      });

      // Sent at once so proxies (like Vite's) flush the headers and the browser's EventSource opens now,
      // not at the first heartbeat 15s later.
      await stream.writeSSE({ event: "ready", data: "{}" });

      for (const a of approvals.listPending()) if (wanted(a.conversationId)) send("approval_requested", a);

      while (open) {
        await stream.sleep(HEARTBEAT_MS);
        if (open) await stream.writeSSE({ event: "ping", data: "" }).catch(() => (open = false));
      }
    });
  });

  app.get("/approvals", (c) => c.json(approvals.listPending()));

  app.post("/approvals/:id", async (c) => {
    const parsed = decisionBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Body must be { decision: "approve" | "deny" }' }, 400);

    const id = c.req.param("id");
    if (!approvals.decide(id, parsed.data.decision)) {
      return c.json({ error: "No such pending approval (unknown, already answered, or expired)" }, 404);
    }
    return c.json({ id, decision: parsed.data.decision });
  });

  app.get("/logs", (c) => {
    const limit = Math.min(Number(c.req.query("limit") ?? 100) || 100, 500);
    return c.json(listLogs(deps.db, limit));
  });

  return app;
}
