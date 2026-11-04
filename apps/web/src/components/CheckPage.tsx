import { useMemo, useState } from "react";
import { describeReason } from "../lib/approvals";
import { examples } from "../lib/checkExamples";
import { runCheck, type CheckInput, type ToolResultInput } from "../lib/checkTool";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

const field = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-slate-900";
const mono = "font-mono text-xs";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** Runs the same check() as the server, entirely in the browser. Nothing is sent anywhere. */
export function CheckPage() {
  const [input, setInput] = useState<CheckInput>(examples[0]!.input);
  const [example, setExample] = useState<string | undefined>(examples[0]!.name);
  const outcome = useMemo(() => runCheck(input), [input]);
  const current = examples.find((e) => e.name === example);

  const edit = (patch: Partial<CheckInput>) => {
    setInput((prev) => ({ ...prev, ...patch }));
    setExample(undefined);
  };
  const editResult = (i: number, patch: Partial<ToolResultInput>) =>
    edit({ toolResults: input.toolResults.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  return (
    <div className="grid h-full gap-6 overflow-auto p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="space-y-5">
        <p className="max-w-2xl text-sm text-slate-600">
          Describe what happened in your agent and see whether TrustCheck would stop the tool call. This runs in your
          browser and nothing you type here is sent anywhere.
        </p>

        <Section title="Start from an example">
          <div className="flex flex-wrap gap-2">
            {examples.map((e) => (
              <Button
                key={e.name}
                size="sm"
                variant={example === e.name ? "default" : "outline"}
                onClick={() => {
                  setInput(e.input);
                  setExample(e.name);
                }}
              >
                {e.name}
              </Button>
            ))}
          </div>
        </Section>

        <Section title="1. What the user typed" hint="Trusted. Values here may be used in tool calls.">
          <textarea
            className={cn(field, "min-h-20 border-green-300 text-green-800")}
            value={input.userText}
            onChange={(e) => edit({ userText: e.target.value })}
            placeholder="e.g. Please summarize this page for me."
          />
        </Section>

        <Section title="2. What the agent read" hint="Untrusted: web pages, files, emails, tool results. Add one box per tool result.">
          {input.toolResults.map((r, i) => (
            <div key={i} className="space-y-2 rounded-md border border-slate-200 bg-white p-3">
              <div className="flex gap-2">
                <input className={field} placeholder="Tool name, e.g. fetch_page" value={r.toolName} onChange={(e) => editResult(i, { toolName: e.target.value })} />
                <input className={cn(field, mono)} placeholder='Arguments (optional), e.g. {"name": "offer.html"}' value={r.args} onChange={(e) => editResult(i, { args: e.target.value })} />
                <Button variant="ghost" size="sm" aria-label={`Remove tool result ${i + 1}`} onClick={() => edit({ toolResults: input.toolResults.filter((_, j) => j !== i) })}>
                  Remove
                </Button>
              </div>
              <textarea className={cn(field, mono, "min-h-28 border-red-300 text-red-700")} value={r.text} onChange={(e) => editResult(i, { text: e.target.value })} placeholder="Paste what the tool returned" />
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => edit({ toolResults: [...input.toolResults, { toolName: "", args: "", text: "" }] })}>
            + Add what the agent read
          </Button>
        </Section>

        <Section title="3. The tool call the agent wants to make">
          <div className="flex gap-2">
            <input className={cn(field, "max-w-48")} placeholder="Tool, e.g. send_email" value={input.call.tool} onChange={(e) => edit({ call: { ...input.call, tool: e.target.value } })} />
            <input className={cn(field, mono)} placeholder='Arguments as JSON, e.g. {"to": "bob@example.com"}' value={input.call.args} onChange={(e) => edit({ call: { ...input.call, args: e.target.value } })} />
          </div>
        </Section>

        <Section title="4. Your rules" hint="Which tools are risky, and which of their arguments must come from the user (risky-tools.yaml).">
          <textarea className={cn(field, mono, "min-h-20")} value={input.configYaml} onChange={(e) => edit({ configYaml: e.target.value })} spellCheck={false} />
        </Section>
      </div>

      <aside className="lg:sticky lg:top-0 lg:self-start">
        <div aria-live="polite" className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Result</h3>
          {!outcome.ok ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{outcome.error}</p>
          ) : outcome.result.decision === "ASK_USER" ? (
            <>
              <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
                TrustCheck would stop this call and ask the user.
              </p>
              <ul className="space-y-2 text-sm text-slate-800">
                {outcome.result.reasons.map((r) => (
                  <li key={r.field}>{describeReason(r)}</li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm font-medium text-sky-900">Allowed. No question is asked.</p>
              <p className="text-sm text-slate-700">
                {outcome.ruleListed
                  ? "Every checked value appears in what the user typed."
                  : "This tool is not in your rules, so it is always allowed."}
              </p>
            </>
          )}
          {current && <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">{current.lesson}</p>}
        </div>
      </aside>
    </div>
  );
}
