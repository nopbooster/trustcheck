import { serve } from "@hono/node-server";
import Anthropic from "@anthropic-ai/sdk";
import { loadRiskyToolsConfig } from "@trustcheck/core";
import { ApprovalManager } from "./approvals";
import { createApp } from "./app";
import { config } from "./config";
import { createDb } from "./db";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set. Copy apps/server/.env.example to apps/server/.env and fill it in.");
  process.exit(1);
}

const approvals = new ApprovalManager(config.approvalTimeoutMs);

const app = createApp(
  {
    client: new Anthropic(),
    model: config.model,
    db: createDb(config.databasePath),
    demoDir: config.demoDir,
    riskyTools: loadRiskyToolsConfig(config.riskyToolsPath),
    requestApproval: approvals.handler,
    approvalTimeoutMs: config.approvalTimeoutMs + 1000, // backstop only; the manager owns the timeout
  },
  approvals,
);

serve({ fetch: app.fetch, port: config.port }, ({ port }) => {
  console.log(`TrustCheck server listening on http://localhost:${port} (model ${config.model})`);
});
