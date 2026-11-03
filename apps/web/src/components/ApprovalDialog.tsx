import { useState } from "react";
import { useNow } from "../hooks/useApprovals";
import { decideApproval } from "../lib/api";
import { describeReason, headline } from "../lib/approvals";
import type { PendingApproval } from "../lib/types";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";

interface Props {
  pending: PendingApproval[];
  onAnswered: (id: string) => void;
}

/** Cannot be dismissed: the user must pick Approve or Deny (or let it time out = deny). */
export function ApprovalDialog({ pending, onAnswered }: Props) {
  const current = pending[0];
  const now = useNow();
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);

  async function answer(decision: "approve" | "deny") {
    if (!current) return;
    setSending(true);
    setError(undefined);
    try {
      await decideApproval(current.id, decision);
    } catch (err) {
      // 404 means it was answered elsewhere or already expired: nothing left to ask
      if (!(err instanceof Error) || !/no such pending/i.test(err.message)) {
        setError(err instanceof Error ? err.message : "Could not send your answer.");
        setSending(false);
        return;
      }
    }
    onAnswered(current.id);
    setSending(false);
  }

  const secondsLeft = current ? Math.max(0, Math.ceil((current.expiresAt - now) / 1000)) : 0;

  return (
    <Dialog open={Boolean(current)}>
      {current && (
        <DialogContent
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            document.getElementById("deny-button")?.focus(); // the safe choice is the default
          }}
        >
          <DialogTitle>{headline(current)}</DialogTitle>
          <DialogDescription className="mt-1">Check this before it runs.</DialogDescription>

          <dl className="mt-4 rounded-md bg-slate-50 p-3 font-mono text-xs text-slate-800">
            {Object.entries(current.args).map(([key, value]) => (
              <div key={key} className="flex gap-2">
                <dt className="shrink-0 text-slate-500">{key}:</dt>
                <dd className="break-all">{typeof value === "string" ? value : JSON.stringify(value)}</dd>
              </div>
            ))}
          </dl>

          <ul className="mt-4 space-y-2 text-sm text-slate-800">
            {current.reasons.map((r) => (
              <li key={r.field} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                {describeReason(r)}
              </li>
            ))}
          </ul>

          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

          <div className="mt-5 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              Auto-denies in {secondsLeft}s{pending.length > 1 ? ` · ${pending.length - 1} more waiting` : ""}
            </span>
            <div className="flex gap-2">
              <Button id="deny-button" disabled={sending} onClick={() => void answer("deny")}>
                Deny
              </Button>
              <Button variant="outline" disabled={sending} onClick={() => void answer("approve")}>
                Approve
              </Button>
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
