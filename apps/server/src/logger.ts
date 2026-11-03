import { desc } from "drizzle-orm";
import type { Reason } from "@trustcheck/core";
import type { Db } from "./db";
import { toolLogs } from "./db/schema";

export interface DecisionEntry {
  conversationId: string;
  tool: string;
  args: unknown;
  decision: "ALLOW" | "ASK_USER";
  reasons: Reason[];
  userResponse: "approved" | "denied" | "timeout" | null;
  outcome: "executed" | "blocked" | "error";
}

export function logDecision(db: Db, entry: DecisionEntry): void {
  db.insert(toolLogs)
    .values({
      conversationId: entry.conversationId,
      tool: entry.tool,
      args: JSON.stringify(entry.args),
      decision: entry.decision,
      reasons: JSON.stringify(entry.reasons),
      userResponse: entry.userResponse,
      outcome: entry.outcome,
      createdAt: Date.now(),
    })
    .run();
}

export function listLogs(db: Db, limit = 100) {
  return db
    .select()
    .from(toolLogs)
    .orderBy(desc(toolLogs.id))
    .limit(limit)
    .all()
    .map((row) => ({
      ...row,
      args: JSON.parse(row.args) as unknown,
      reasons: JSON.parse(row.reasons) as unknown,
    }));
}
