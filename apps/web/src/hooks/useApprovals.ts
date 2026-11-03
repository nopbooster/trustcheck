import { useEffect, useReducer, useState } from "react";
import { approvalsReducer } from "../lib/approvals";
import type { PendingApproval } from "../lib/types";

/** Subscribes to the server's SSE stream and keeps the list of waiting questions. */
export function useApprovals() {
  const [pending, dispatch] = useReducer(approvalsReducer, []);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const source = new EventSource("/api/events");
    source.onopen = () => {
      setConnected(true);
      dispatch({ type: "reset" }); // the server replays what is still waiting
    };
    source.onerror = () => setConnected(false);
    source.addEventListener("approval_requested", (e) => {
      dispatch({ type: "requested", approval: JSON.parse((e as MessageEvent<string>).data) as PendingApproval });
    });
    source.addEventListener("approval_resolved", (e) => {
      dispatch({ type: "resolved", id: (JSON.parse((e as MessageEvent<string>).data) as { id: string }).id });
    });
    return () => source.close();
  }, []);

  return { pending, connected, remove: (id: string) => dispatch({ type: "resolved", id }) };
}

/** Re-renders every `ms` so countdowns stay fresh. */
export function useNow(ms = 500): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
