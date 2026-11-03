import { describe, expect, it } from "vitest";
import { ApprovalManager, type ApprovalEvent, type ApprovalRequest } from "./approvals";

const req: ApprovalRequest = {
  conversationId: "c1",
  tool: "send_email",
  args: { to: "hacker@evil.com" },
  reasons: [],
};

describe("ApprovalManager", () => {
  it("waits for a decision, then resolves and emits both events", async () => {
    const m = new ApprovalManager(5_000);
    const events: ApprovalEvent[] = [];
    m.subscribe((e) => events.push(e));

    const answer = m.handler(req);
    const [pending] = m.listPending();
    expect(pending).toMatchObject({ tool: "send_email", conversationId: "c1" });
    expect(events[0]).toMatchObject({ type: "approval_requested" });

    expect(m.decide(pending!.id, "approve")).toBe(true);
    await expect(answer).resolves.toBe("approved");
    expect(m.listPending()).toEqual([]);
    expect(events[1]).toEqual({ type: "approval_resolved", id: pending!.id, conversationId: "c1", answer: "approved" });
  });

  it("resolves 'denied' on deny", async () => {
    const m = new ApprovalManager(5_000);
    const answer = m.handler(req);
    m.decide(m.listPending()[0]!.id, "deny");
    await expect(answer).resolves.toBe("denied");
  });

  it("resolves 'timeout' when nobody answers, and cleans up", async () => {
    const m = new ApprovalManager(20);
    const events: ApprovalEvent[] = [];
    m.subscribe((e) => events.push(e));

    const answer = m.handler(req);
    const id = m.listPending()[0]!.id;
    await expect(answer).resolves.toBe("timeout");

    expect(m.listPending()).toEqual([]);
    expect(m.decide(id, "approve")).toBe(false); // too late
    expect(events.at(-1)).toMatchObject({ type: "approval_resolved", answer: "timeout" });
  });

  it("only accepts the first decision", async () => {
    const m = new ApprovalManager(5_000);
    const answer = m.handler(req);
    const id = m.listPending()[0]!.id;
    expect(m.decide(id, "deny")).toBe(true);
    expect(m.decide(id, "approve")).toBe(false);
    await expect(answer).resolves.toBe("denied");
  });

  it("rejects unknown ids and survives a throwing subscriber", async () => {
    const m = new ApprovalManager(5_000);
    expect(m.decide("nope", "approve")).toBe(false);
    m.subscribe(() => {
      throw new Error("bad subscriber");
    });
    const answer = m.handler(req);
    m.decide(m.listPending()[0]!.id, "approve");
    await expect(answer).resolves.toBe("approved");
  });
});
