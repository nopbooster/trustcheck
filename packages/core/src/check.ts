import type { RiskyToolsConfig } from "./config";
import { appearsIn, stringifyValue } from "./normalize";
import type { ContextTracker } from "./tracker";

export interface Reason {
  field: string;
  value: string;
  /** true if the value was found in untrusted text */
  foundInUntrusted: boolean;
  /** tool results the value was found in (for the UI explanation) */
  sources: { toolName: string; toolArgs?: Record<string, unknown>; segmentId: string }[];
  message: string;
}

export interface CheckResult {
  decision: "ALLOW" | "ASK_USER";
  reasons: Reason[];
}

export function check(
  toolName: string,
  args: Record<string, unknown>,
  tracker: ContextTracker,
  config: RiskyToolsConfig,
): CheckResult {
  const rule = Object.hasOwn(config, toolName) ? config[toolName] : undefined;
  if (!rule) return { decision: "ALLOW", reasons: [] };

  const trusted = tracker.trustedText();
  const reasons: Reason[] = [];

  for (const field of rule.check) {
    const value = stringifyValue(args[field]).trim();

    if (value !== "" && appearsIn(value, trusted)) continue;

    const sources = value === ""
      ? []
      : tracker
          .untrustedSegments()
          .filter((s) => appearsIn(value, s.text))
          .map((s) => ({ toolName: s.toolName ?? "unknown", toolArgs: s.toolArgs, segmentId: s.id }));

    reasons.push({
      field,
      value,
      foundInUntrusted: sources.length > 0,
      sources,
      message: describe(toolName, field, value, sources),
    });
  }

  return { decision: reasons.length > 0 ? "ASK_USER" : "ALLOW", reasons };
}

function describe(
  toolName: string,
  field: string,
  value: string,
  sources: { toolName: string }[],
): string {
  if (value === "") return `${toolName}.${field} is missing or empty.`;
  if (sources.length > 0) {
    const names = [...new Set(sources.map((s) => s.toolName))].join(", ");
    return `${toolName}.${field} "${value}" came from ${names}, not from the user.`;
  }
  return `${toolName}.${field} "${value}" was not found in anything the user typed.`;
}
