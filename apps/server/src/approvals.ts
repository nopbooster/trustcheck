import { randomUUID } from "node:crypto";
import type { Reason } from "@trustcheck/core";

export interface ApprovalRequest {
  conversationId: string;
  tool: string;
  args: Record<string, unknown>;
  reasons: Reason[];
}

export type ApprovalAnswer = "approved" | "denied" | "timeout";

/** Asks the user and resolves with their answer. */
export type ApprovalHandler = (req: ApprovalRequest) => Promise<ApprovalAnswer>;

/** What the browser sees for each question. */
export interface PendingApproval extends ApprovalRequest {
  id: string;
  createdAt: number;
  expiresAt: number;
}

export type ApprovalEvent =
  | { type: "approval_requested"; approval: PendingApproval }
  | { type: "approval_resolved"; id: string; conversationId: string; answer: ApprovalAnswer };

type Listener = (event: ApprovalEvent) => void;

interface Entry {
  approval: PendingApproval;
  resolve: (answer: ApprovalAnswer) => void;
  timer: NodeJS.Timeout;
}

/**
 * Holds approvals that are waiting for the user. The agent awaits `handler`;
 * the HTTP layer calls `decide()` and streams events to the browser.
 * Nobody answering in time means "timeout" (treated as deny by the agent).
 */
export class ApprovalManager {
  private pending = new Map<string, Entry>();
  private listeners = new Set<Listener>();

  constructor(private timeoutMs = 60_000) {}

  readonly handler: ApprovalHandler = (req) =>
    new Promise<ApprovalAnswer>((resolve) => {
      const now = Date.now();
      const approval: PendingApproval = { ...req, id: randomUUID(), createdAt: now, expiresAt: now + this.timeoutMs };
      const timer = setTimeout(() => this.settle(approval.id, "timeout"), this.timeoutMs);
      this.pending.set(approval.id, { approval, resolve, timer });
      this.emit({ type: "approval_requested", approval });
    });

  /** Returns false if the id is unknown or was already answered/expired. */
  decide(id: string, decision: "approve" | "deny"): boolean {
    return this.settle(id, decision === "approve" ? "approved" : "denied");
  }

  listPending(): PendingApproval[] {
    return [...this.pending.values()].map((e) => e.approval);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private settle(id: string, answer: ApprovalAnswer): boolean {
    const entry = this.pending.get(id);
    if (!entry) return false;
    clearTimeout(entry.timer);
    this.pending.delete(id);
    entry.resolve(answer);
    this.emit({ type: "approval_resolved", id, conversationId: entry.approval.conversationId, answer });
    return true;
  }

  private emit(event: ApprovalEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // a broken subscriber must never block an approval
      }
    }
  }
}

/** Milestone 3 behaviour, still handy in tests: nobody to ask, so deny. */
export const denyAll: ApprovalHandler = async () => "denied";

/** Safety net around any handler: errors and (backstop) timeouts become denials. */
export async function askUser(
  handler: ApprovalHandler,
  req: ApprovalRequest,
  timeoutMs = 60_000,
): Promise<ApprovalAnswer> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const timeout = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), timeoutMs);
    });
    return await Promise.race([handler(req), timeout]);
  } catch {
    return "denied";
  } finally {
    clearTimeout(timer);
  }
}
