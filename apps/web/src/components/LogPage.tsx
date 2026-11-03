import { useCallback, useEffect, useState } from "react";
import { getLogs } from "../lib/api";
import type { LogRow } from "../lib/types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

const responseLabel = { approved: "approved", denied: "denied", timeout: "timed out" } as const;

export function LogPage({ active, version }: { active: boolean; version: number }) {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    try {
      setRows(await getLogs());
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the log.");
    }
  }, []);

  // refresh when opened, after each chat turn, and every 3s while visible
  useEffect(() => {
    if (!active) return;
    void load();
    const t = setInterval(() => void load(), 3000);
    return () => clearInterval(t);
  }, [active, version, load]);

  return (
    <div className="h-full overflow-auto p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Every tool decision</h2>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          Refresh
        </Button>
      </div>
      {error && <p className="mb-3 text-sm text-red-700">{error}</p>}

      {rows.length === 0 ? (
        <p className="mt-16 text-center text-sm text-slate-500">No tool calls yet. Chat with the agent first.</p>
      ) : (
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              {["Time", "Tool", "Arguments", "Decision", "Your answer", "Outcome", "Why"].map((h) => (
                <th key={h} className="border-b border-slate-200 px-2 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 align-top">
                <td className="whitespace-nowrap px-2 py-2 text-slate-500">{new Date(row.createdAt).toLocaleTimeString()}</td>
                <td className="px-2 py-2 font-mono">{row.tool}</td>
                <td className="max-w-[240px] break-all px-2 py-2 font-mono text-xs text-slate-700">{JSON.stringify(row.args)}</td>
                <td className="px-2 py-2">
                  <Badge variant={row.decision === "ALLOW" ? "info" : "warn"}>{row.decision}</Badge>
                </td>
                <td className="px-2 py-2">{row.userResponse ? responseLabel[row.userResponse] : "–"}</td>
                <td className="px-2 py-2">
                  <Badge variant={row.outcome === "executed" ? "neutral" : "warn"}>{row.outcome}</Badge>
                </td>
                <td className="px-2 py-2 text-xs text-slate-600">{row.reasons.map((r) => r.message).join(" ") || "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
