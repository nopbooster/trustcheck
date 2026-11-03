import { describeReason, formatSource } from "../lib/approvals";
import type { ToolCall } from "../lib/types";
import { Badge } from "./ui/badge";

const responseText = {
  approved: "You approved this call.",
  denied: "You denied this call.",
  timeout: "No answer in time, so it was denied.",
} as const;

/** One tool call, shown inline in the chat. Text a tool returned is red (untrusted). */
export function ToolCallCard({ call }: { call: ToolCall }) {
  const fromTool = call.outcome === "executed"; // only real tool output is untrusted text
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">Tool call</span>
        <code className="font-mono text-slate-900">{formatSource({ toolName: call.tool, toolArgs: call.args })}</code>
        <Badge variant={call.decision === "ALLOW" ? "info" : "warn"}>
          {call.decision === "ALLOW" ? "allowed" : "needed approval"}
        </Badge>
        <Badge variant={call.outcome === "executed" ? "neutral" : "warn"}>{call.outcome}</Badge>
      </div>

      {call.decision === "ASK_USER" && (
        <ul className="mt-2 space-y-1 text-slate-700">
          {call.reasons.map((r) => (
            <li key={r.field}>{describeReason(r)}</li>
          ))}
          {call.userResponse && <li className="font-medium">{responseText[call.userResponse]}</li>}
        </ul>
      )}

      {call.output && (
        <pre
          className={
            fromTool
              ? "mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700"
              : "mt-2 whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs italic text-slate-600"
          }
          title={fromTool ? "Untrusted: this text came from a tool, not from you" : undefined}
        >
          {call.output}
        </pre>
      )}
    </div>
  );
}
