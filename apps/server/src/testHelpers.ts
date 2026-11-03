import path from "node:path";
import { fileURLToPath } from "node:url";
import type Anthropic from "@anthropic-ai/sdk";
import { parseRiskyToolsConfig } from "@trustcheck/core";
import type { AgentDeps, ModelClient } from "./agent";
import { denyAll } from "./approvals";
import { createDb } from "./db";

export const demoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../demo");

export function toolUse(id: string, name: string, input: Record<string, unknown>) {
  return { type: "tool_use", id, name, input } as const;
}

type Turn = { content: object[]; stop_reason: "tool_use" | "end_turn" };

/** A fake model that plays back scripted turns and records every request it receives. */
export function scriptedClient(turns: Turn[]) {
  const requests: Anthropic.MessageCreateParamsNonStreaming[] = [];
  let i = 0;
  const client: ModelClient = {
    messages: {
      async create(params) {
        requests.push(structuredClone(params));
        const turn = turns[i++];
        if (!turn) throw new Error("script ran out of turns");
        return { id: `msg_${i}`, role: "assistant", ...turn } as unknown as Anthropic.Message;
      },
    },
  };
  return { client, requests };
}

export function testDeps(client: ModelClient, overrides: Partial<AgentDeps> = {}): AgentDeps {
  return {
    client,
    model: "test-model",
    db: createDb(":memory:"),
    demoDir,
    riskyTools: parseRiskyToolsConfig("send_email: { check: [to] }"),
    requestApproval: denyAll,
    ...overrides,
  };
}
