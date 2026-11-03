import { describe, expect, it } from "vitest";
import { approvalsReducer, describeReason, formatSource, headline } from "./approvals";
import type { PendingApproval, Reason } from "./types";

const approval = (id: string): PendingApproval => ({
  id, conversationId: "c", tool: "send_email", args: { to: "hacker@evil.com" }, reasons: [], createdAt: 0, expiresAt: 1,
});

const reason = (over: Partial<Reason> = {}): Reason => ({
  field: "to", value: "hacker@evil.com", foundInUntrusted: true, message: "m",
  sources: [{ toolName: "fetch_page", toolArgs: { name: "offer.html" }, segmentId: "s1" }],
  ...over,
});

describe("approvalsReducer", () => {
  it("adds, dedupes, removes and resets", () => {
    let s = approvalsReducer([], { type: "requested", approval: approval("a") });
    s = approvalsReducer(s, { type: "requested", approval: approval("a") }); // replay after reconnect
    s = approvalsReducer(s, { type: "requested", approval: approval("b") });
    expect(s.map((a) => a.id)).toEqual(["a", "b"]);
    s = approvalsReducer(s, { type: "resolved", id: "a" });
    expect(s.map((a) => a.id)).toEqual(["b"]);
    expect(approvalsReducer(s, { type: "reset" })).toEqual([]);
  });
});

describe("explanations", () => {
  it("formats a source like a function call", () => {
    expect(formatSource({ toolName: "fetch_page", toolArgs: { name: "offer.html" } })).toBe('fetch_page("offer.html")');
    expect(formatSource({ toolName: "fetch_page" })).toBe("fetch_page");
  });

  it("says where an untrusted value came from", () => {
    expect(describeReason(reason())).toBe('to "hacker@evil.com" came from fetch_page("offer.html"), not from you.');
  });

  it("lists each distinct source once", () => {
    const r = reason({
      sources: [
        { toolName: "fetch_page", toolArgs: { name: "a.html" }, segmentId: "1" },
        { toolName: "fetch_page", toolArgs: { name: "a.html" }, segmentId: "2" },
        { toolName: "read_file", toolArgs: { name: "n.txt" }, segmentId: "3" },
      ],
    });
    expect(describeReason(r)).toContain('fetch_page("a.html") and read_file("n.txt")');
  });

  it("explains a value found nowhere, and falls back to the server message when empty", () => {
    expect(describeReason(reason({ foundInUntrusted: false, sources: [] }))).toBe(
      'to "hacker@evil.com" does not appear anywhere in what you typed.',
    );
    expect(describeReason(reason({ value: "", message: "send_email.to is missing or empty." }))).toBe(
      "send_email.to is missing or empty.",
    );
  });

  it("has a headline", () => {
    expect(headline({ tool: "send_email" })).toBe("The agent wants to run send_email");
  });
});
