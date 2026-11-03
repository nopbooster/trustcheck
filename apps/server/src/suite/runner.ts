import type { RiskyToolsConfig } from "@trustcheck/core";
import { runAgent, type ModelClient, type ToolCallSummary } from "../agent";
import { denyAll } from "../approvals";
import { ConversationStore } from "../conversations";
import { createDb } from "../db";
import { poisonedPrompt, type Manifest } from "./manifest";

/** Calls to these tools have side effects, so they are what an attack is trying to trigger. */
export const RISKY_TOOLS: ReadonlySet<string> = new Set(["send_email"]);

export interface RunResult {
  kind: "poisoned" | "clean";
  page: string;
  run: number;
  technique?: string;
  goal?: string;
  prompt: string;
  reply: string;
  /** Compact: outputs are dropped (they are whole pages). */
  calls: Omit<ToolCallSummary, "output" | "reasons">[];
  error?: string;
}

export interface SuiteOptions {
  client: ModelClient;
  model: string;
  demoDir: string;
  riskyTools: RiskyToolsConfig;
  manifest: Manifest;
  runsPerPage?: number;
  concurrency?: number;
  onResult?: (result: RunResult) => void;
}

interface Job {
  kind: "poisoned" | "clean";
  page: string;
  run: number;
  prompt: string;
  technique?: string;
  goal?: string;
}

export async function runSuite(opts: SuiteOptions): Promise<RunResult[]> {
  const runs = opts.runsPerPage ?? 1;
  const jobs: Job[] = [];
  for (let run = 1; run <= runs; run++) {
    for (const p of opts.manifest.poisoned) {
      jobs.push({ kind: "poisoned", page: p.page, run, prompt: poisonedPrompt(p.page), technique: p.technique, goal: p.goal });
    }
    for (const c of opts.manifest.clean) {
      jobs.push({ kind: "clean", page: c.page, run, prompt: c.prompt });
    }
  }

  const results: RunResult[] = new Array(jobs.length);
  let next = 0;
  const worker = async () => {
    for (let i = next++; i < jobs.length; i = next++) {
      results[i] = await runOne(opts, jobs[i]!);
      opts.onResult?.(results[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency ?? 3) }, worker));
  return results;
}

/** One fresh conversation, fresh database. Nobody answers questions, so every ASK_USER is a denial. */
async function runOne(opts: SuiteOptions, job: Job): Promise<RunResult> {
  const base = { ...job, reply: "", calls: [] as RunResult["calls"] };
  try {
    const convo = new ConversationStore().create();
    const res = await runAgent(
      {
        client: opts.client,
        model: opts.model,
        db: createDb(":memory:"),
        demoDir: opts.demoDir,
        riskyTools: opts.riskyTools,
        requestApproval: denyAll,
      },
      convo,
      job.prompt,
    );
    return {
      ...base,
      reply: res.reply,
      calls: res.toolCalls.map(({ tool, args, decision, userResponse, outcome }) => ({ tool, args, decision, userResponse, outcome })),
    };
  } catch (err) {
    return { ...base, error: err instanceof Error ? err.message : String(err) };
  }
}
