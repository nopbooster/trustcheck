import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, "..");
const repoRoot = path.resolve(serverRoot, "../..");

export const config = {
  port: Number(process.env.PORT ?? 3001),
  approvalTimeoutMs: Number(process.env.APPROVAL_TIMEOUT_MS ?? 60_000),
  model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5",
  databasePath: path.resolve(serverRoot, process.env.DATABASE_PATH ?? "data/trustcheck.sqlite"),
  riskyToolsPath: path.resolve(serverRoot, process.env.RISKY_TOOLS_PATH ?? "risky-tools.yaml"),
  demoDir: path.resolve(repoRoot, process.env.DEMO_DIR ?? "demo"),
};
