import type Anthropic from "@anthropic-ai/sdk";
import { check, type CheckResult, type RiskyToolsConfig } from "@trustcheck/core";
import { askUser, type ApprovalHandler } from "./approvals";
import type { Conversation } from "./conversations";
import type { Db } from "./db";
import { logDecision } from "./logger";
import { executeTool, toolDefinitions } from "./tools";

/** The only part of the Anthropic client the agent needs (easy to fake in tests). */
export interface ModelClient {
  messages: {
    create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
  };
}

export interface AgentDeps {
  client: ModelClient;
  model: string;
  db: Db;
  demoDir: string;
  riskyTools: RiskyToolsConfig;
  requestApproval: ApprovalHandler;
  approvalTimeoutMs?: number;
}

export interface ToolCallSummary {
  tool: string;
  args: Record<string, unknown>;
  decision: "ALLOW" | "ASK_USER";
  userResponse: "approved" | "denied" | "timeout" | null;
  outcome: "executed" | "blocked" | "error";
  reasons: CheckResult["reasons"];
  /** What the tool returned (untrusted if executed), or the reason it was blocked / failed. */
  output: string;
}

export interface AgentResult {
  reply: string;
  toolCalls: ToolCallSummary[];
}

const MAX_STEPS = 10;

// Deliberately plain: the demo must show TrustCheck stopping attacks, not the prompt.
const SYSTEM_PROMPT = "You are a helpful assistant. You can fetch pages, read files and send emails using your tools.";

export async function runAgent(deps: AgentDeps, convo: Conversation, userText: string): Promise<AgentResult> {
  const startLength = convo.messages.length;
  const toolCalls: ToolCallSummary[] = [];

  convo.tracker.addUserMessage(userText); // the only trusted text
  convo.messages.push({ role: "user", content: userText });

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const res = await deps.client.messages.create({
        model: deps.model,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        tools: toolDefinitions,
        messages: convo.messages,
      });
      convo.messages.push({ role: "assistant", content: res.content });

      if (res.stop_reason === "refusal") {
        return { reply: "(The model declined to answer this request.)", toolCalls };
      }
      if (res.stop_reason !== "tool_use") {
        return { reply: textOf(res.content), toolCalls };
      }

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of res.content) {
        if (block.type !== "tool_use") continue;
        const { result, summary } = await handleToolUse(deps, convo, block);
        toolCalls.push(summary);
        results.push(result);
      }
      convo.messages.push({ role: "user", content: results });
    }
    return { reply: "(Stopped: too many tool steps.)", toolCalls };
  } catch (err) {
    convo.messages.length = startLength; // never leave a tool_use without its tool_result
    throw err;
  }
}

async function handleToolUse(deps: AgentDeps, convo: Conversation, block: Anthropic.ToolUseBlock) {
  const args = (typeof block.input === "object" && block.input !== null ? block.input : {}) as Record<string, unknown>;

  // 1. Check BEFORE anything runs. A checker error counts as ASK_USER.
  let verdict: CheckResult;
  try {
    verdict = check(block.name, args, convo.tracker, deps.riskyTools);
  } catch (err) {
    verdict = {
      decision: "ASK_USER",
      reasons: [{
        field: "(checker)", value: "", foundInUntrusted: false, sources: [],
        message: `Checker error: ${err instanceof Error ? err.message : String(err)}`,
      }],
    };
  }

  // 2. Ask the user when needed. Anything but an explicit approval is a denial.
  let userResponse: ToolCallSummary["userResponse"] = null;
  if (verdict.decision === "ASK_USER") {
    userResponse = await askUser(
      deps.requestApproval,
      { conversationId: convo.id, tool: block.name, args, reasons: verdict.reasons },
      deps.approvalTimeoutMs,
    );
  }
  const allowed = verdict.decision === "ALLOW" || userResponse === "approved";

  // 3. Run it, or refuse.
  let outcome: ToolCallSummary["outcome"];
  let text: string;
  if (!allowed) {
    outcome = "blocked";
    text = `Blocked: the user did not approve this ${block.name} call (${userResponse}).`;
  } else {
    try {
      text = executeTool(block.name, args, { db: deps.db, demoDir: deps.demoDir, conversationId: convo.id });
      outcome = "executed";
      convo.tracker.addToolResult(block.name, text, args); // everything a tool returns is untrusted
    } catch (err) {
      outcome = "error";
      text = `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  logDecision(deps.db, {
    conversationId: convo.id, tool: block.name, args,
    decision: verdict.decision, reasons: verdict.reasons, userResponse, outcome,
  });

  return {
    result: { type: "tool_result" as const, tool_use_id: block.id, content: text, is_error: outcome !== "executed" },
    summary: { tool: block.name, args, decision: verdict.decision, userResponse, outcome, reasons: verdict.reasons, output: text },
  };
}

function textOf(content: Anthropic.ContentBlock[]): string {
  return content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");
}
