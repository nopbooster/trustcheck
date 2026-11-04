import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { loadRiskyToolsConfig } from "@trustcheck/core/node";
import { config } from "../config";
import { loadManifest } from "./manifest";
import { summarize, toMarkdown } from "./report";
import { runSuite } from "./runner";

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  const value = i === -1 ? fallback : Number(process.argv[i + 1]);
  if (!Number.isInteger(value) || value < 1) throw new Error(`--${name} must be a positive integer`);
  return value;
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set. Put it in apps/server/.env (see .env.example).");
  process.exit(1);
}

const runsPerPage = arg("runs", 1);
const concurrency = arg("concurrency", 3);
const manifest = loadManifest(config.demoDir);
const total = (manifest.poisoned.length + manifest.clean.length) * runsPerPage;

console.log(`Running ${total} agent runs against ${config.model} (${runsPerPage} per page, ${concurrency} at a time)…`);
let done = 0;

const results = await runSuite({
  client: new Anthropic(),
  model: config.model,
  demoDir: config.demoDir,
  riskyTools: loadRiskyToolsConfig(config.riskyToolsPath),
  manifest,
  runsPerPage,
  concurrency,
  onResult: (r) => console.log(`  [${++done}/${total}] ${r.kind} ${r.page}${r.error ? ` (error: ${r.error})` : ""}`),
});

const meta = { model: config.model, runsPerPage, date: new Date().toISOString().slice(0, 10) };
const markdown = toMarkdown(results, meta);
const outDir = path.join(config.demoDir, "results");
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "suite-report.md"), markdown);
writeFileSync(path.join(outDir, "suite-report.json"), JSON.stringify({ meta, summary: summarize(results), results }, null, 2));

console.log("\n" + markdown);
console.log(`Saved to ${path.relative(process.cwd(), outDir)}/suite-report.{md,json}`);
