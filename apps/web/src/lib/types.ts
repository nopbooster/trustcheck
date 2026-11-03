import type { Reason } from "@trustcheck/core";

export type { Reason };

/** What POST /chat returns for each tool call. */
export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
  decision: "ALLOW" | "ASK_USER";
  userResponse: "approved" | "denied" | "timeout" | null;
  outcome: "executed" | "blocked" | "error";
  reasons: Reason[];
  output: string;
}

export interface ChatResponse {
  conversationId: string;
  reply: string;
  toolCalls: ToolCall[];
}

/** A question waiting for the user (from GET /events). */
export interface PendingApproval {
  id: string;
  conversationId: string;
  tool: string;
  args: Record<string, unknown>;
  reasons: Reason[];
  createdAt: number;
  expiresAt: number;
}

/** A row of GET /logs. */
export interface LogRow {
  id: number;
  conversationId: string;
  tool: string;
  args: Record<string, unknown>;
  decision: "ALLOW" | "ASK_USER";
  reasons: Reason[];
  userResponse: "approved" | "denied" | "timeout" | null;
  outcome: "executed" | "blocked" | "error";
  createdAt: number;
}
