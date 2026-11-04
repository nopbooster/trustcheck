import { describe, expect, it } from "vitest";
import { examples } from "./checkExamples";
import { runCheck, type CheckInput } from "./checkTool";

const base: CheckInput = {
  userText: "hi",
  toolResults: [],
  call: { tool: "send_email", args: '{"to":"a@b.com"}' },
  configYaml: "send_email: { check: [to] }",
};

describe("examples", () => {
  it.each(examples)("$name gives $expect", ({ input, expect: want }) => {
    const out = runCheck(input);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.result.decision).toBe(want);
  });

  it("tells apart 'allowed because the user typed it' from 'allowed because the tool is not in the rules'", () => {
    const safe = runCheck(examples[1]!.input);
    const unlisted = runCheck(examples[3]!.input);
    expect(safe.ok && safe.ruleListed).toBe(true);
    expect(unlisted.ok && unlisted.ruleListed).toBe(false);
  });

  it("the attack example names the page the address came from", () => {
    const out = runCheck(examples[0]!.input);
    if (!out.ok) throw new Error(out.error);
    expect(out.result.reasons[0]!.sources[0]).toMatchObject({ toolName: "fetch_page", toolArgs: { name: "offer.html" } });
  });
});

describe("runCheck input errors", () => {
  const error = (over: Partial<CheckInput>) => {
    const out = runCheck({ ...base, ...over });
    return out.ok ? null : out.error;
  };

  it("needs a tool name", () => {
    expect(error({ call: { tool: " ", args: "" } })).toContain("name of the tool");
  });

  it("explains bad JSON arguments", () => {
    expect(error({ call: { tool: "send_email", args: "{to: bob}" } })).toContain("not valid JSON");
    expect(error({ call: { tool: "send_email", args: "[1,2]" } })).toContain("must be a JSON object");
    expect(error({ toolResults: [{ toolName: "x", args: "nope", text: "t" }] })).toContain("Tool result 1");
  });

  it("explains bad rules in one short line", () => {
    expect(error({ configYaml: "send_email: { check: to }" })).toMatch(/^Rules problem: send_email\.check/);
    expect(error({ configYaml: "a: [unclosed" })).toContain("not valid YAML");
  });

  it("treats empty arguments as missing, which asks", () => {
    const out = runCheck({ ...base, call: { tool: "send_email", args: "" } });
    expect(out.ok && out.result.decision).toBe("ASK_USER");
  });

  it("ignores blank tool results and an empty user message", () => {
    const out = runCheck({ ...base, userText: "", toolResults: [{ toolName: "", args: "", text: "  " }] });
    expect(out.ok && out.result.decision).toBe("ASK_USER");
  });
});
