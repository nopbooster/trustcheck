import { check, ContextTracker, parseRiskyToolsConfig, type CheckResult } from "@trustcheck/core";

export interface ToolResultInput {
  toolName: string;
  /** JSON object text, optional */
  args: string;
  text: string;
}

export interface CheckInput {
  /** Everything the user typed (trusted). */
  userText: string;
  /** Text the agent read (untrusted). */
  toolResults: ToolResultInput[];
  /** The tool call the agent wants to make. */
  call: { tool: string; args: string };
  /** risky-tools.yaml */
  configYaml: string;
}

export type CheckOutcome =
  | { ok: true; result: CheckResult; /** is the tool named in the rules at all? */ ruleListed: boolean }
  | { ok: false; error: string };

function parseArgs(label: string, raw: string): Record<string, unknown> {
  if (raw.trim() === "") return {};
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(`${label} is not valid JSON. Example: {"to": "bob@example.com"}`);
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object. Example: {"to": "bob@example.com"}`);
  }
  return value as Record<string, unknown>;
}

/** Zod errors are long JSON blobs; show one short line per problem instead. */
function readable(err: unknown): string {
  if (typeof err === "object" && err !== null && "issues" in err && Array.isArray(err.issues)) {
    const issues = err.issues as { path: PropertyKey[]; message: string }[];
    return `Rules problem: ${issues.map((i) => `${i.path.map(String).join(".") || "(top level)"}: ${i.message}`).join("; ")}`;
  }
  return err instanceof Error ? err.message : "Something went wrong.";
}

/** Runs the same check() the server runs, on text the visitor typed. Pure, so it can run in the browser. */
export function runCheck(input: CheckInput): CheckOutcome {
  try {
    const tool = input.call.tool.trim();
    if (tool === "") throw new Error("Enter the name of the tool the agent wants to call.");

    let config;
    try {
      config = parseRiskyToolsConfig(input.configYaml);
    } catch (err) {
      throw new Error(err instanceof Error && !("issues" in err) ? `Rules are not valid YAML: ${err.message}` : readable(err));
    }

    const tracker = new ContextTracker();
    if (input.userText.trim() !== "") tracker.addUserMessage(input.userText);
    input.toolResults.forEach((r, i) => {
      if (r.text.trim() === "") return;
      const name = r.toolName.trim() || "tool";
      tracker.addToolResult(name, r.text, parseArgs(`Tool result ${i + 1} arguments`, r.args));
    });

    const result = check(tool, parseArgs("Tool call arguments", input.call.args), tracker, config);
    return { ok: true, result, ruleListed: Object.hasOwn(config, tool) };
  } catch (err) {
    return { ok: false, error: readable(err) };
  }
}
