import { describe, expect, it } from "vitest";
import { ATTACK_PROMPT, itemsFromResponse } from "./chat";
import type { ChatResponse, ToolCall } from "./types";

const call = (tool: string): ToolCall => ({
  tool, args: {}, decision: "ALLOW", userResponse: null, outcome: "executed", reasons: [], output: "x",
});

describe("itemsFromResponse", () => {
  it("shows tool calls in order, then the reply", () => {
    const res: ChatResponse = { conversationId: "c", reply: "Done.", toolCalls: [call("fetch_page"), call("send_email")] };
    const items = itemsFromResponse(res);
    expect(items.map((i) => i.kind)).toEqual(["tool", "tool", "assistant"]);
    expect(new Set(items.map((i) => i.id)).size).toBe(3);
  });

  it("skips an empty reply", () => {
    expect(itemsFromResponse({ conversationId: "c", reply: "  ", toolCalls: [] })).toEqual([]);
  });

  it("has an attack prompt that names the poisoned page", () => {
    expect(ATTACK_PROMPT).toContain("offer.html");
  });
});
