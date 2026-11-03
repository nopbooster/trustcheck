import { describe, expect, it } from "vitest";
import { ContextTracker } from "./index";

describe("ContextTracker", () => {
  it("tags user messages as trusted and tool results as untrusted", () => {
    const t = new ContextTracker();
    const u = t.addUserMessage("hello");
    const r = t.addToolResult("fetch_page", "page text");
    expect(u).toMatchObject({ source: "user", trusted: true });
    expect(r).toMatchObject({ source: "tool", toolName: "fetch_page", trusted: false });
    expect(u.id).not.toBe(r.id);
  });

  it("remembers the arguments of the tool call", () => {
    const t = new ContextTracker();
    const r = t.addToolResult("fetch_page", "text", { name: "offer.html" });
    expect(r.toolArgs).toEqual({ name: "offer.html" });
  });

  it("separates trusted and untrusted text", () => {
    const t = new ContextTracker();
    t.addUserMessage("one");
    t.addToolResult("read_file", "two");
    t.addUserMessage("three");
    expect(t.trustedText()).toBe("one\nthree");
    expect(t.untrustedText()).toBe("two");
  });

  it("starts empty", () => {
    const t = new ContextTracker();
    expect(t.trustedText()).toBe("");
    expect(t.untrustedText()).toBe("");
  });
});
