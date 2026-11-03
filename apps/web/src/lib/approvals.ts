import type { PendingApproval, Reason } from "./types";

export type ApprovalAction =
  | { type: "requested"; approval: PendingApproval }
  | { type: "resolved"; id: string }
  | { type: "reset" };

export function approvalsReducer(state: PendingApproval[], action: ApprovalAction): PendingApproval[] {
  switch (action.type) {
    case "requested":
      return state.some((a) => a.id === action.approval.id) ? state : [...state, action.approval];
    case "resolved":
      return state.filter((a) => a.id !== action.id);
    case "reset":
      return [];
  }
}

/** fetch_page("offer.html") */
export function formatSource(source: { toolName: string; toolArgs?: Record<string, unknown> }): string {
  const values = Object.values(source.toolArgs ?? {});
  return values.length === 0
    ? source.toolName
    : `${source.toolName}(${values.map((v) => JSON.stringify(v)).join(", ")})`;
}

/** One plain-English line per checked argument. */
export function describeReason(reason: Reason): string {
  if (reason.value === "") return reason.message;
  if (reason.foundInUntrusted) {
    const from = [...new Set(reason.sources.map(formatSource))].join(" and ");
    return `${reason.field} "${reason.value}" came from ${from}, not from you.`;
  }
  return `${reason.field} "${reason.value}" does not appear anywhere in what you typed.`;
}

export const headline = (a: Pick<PendingApproval, "tool">) => `The agent wants to run ${a.tool}`;
