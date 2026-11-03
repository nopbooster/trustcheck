import { readFileSync } from "node:fs";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Db } from "../db";
import { sentEmails } from "../db/schema";
import { resolveDemoFile } from "./safePath";

export interface ToolContext {
  db: Db;
  demoDir: string;
  conversationId: string;
}

export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: "fetch_page",
    description: "Fetch a web page by file name (e.g. 'about.html'). Demo only: no real internet.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string", description: "Page file name" } },
      required: ["name"],
    },
  },
  {
    name: "read_file",
    description: "Read a sample file by name (e.g. 'notes.txt').",
    input_schema: {
      type: "object",
      properties: { name: { type: "string", description: "File name" } },
      required: ["name"],
    },
  },
  {
    name: "send_email",
    description: "Send an email.",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address" },
        subject: { type: "string" },
        body: { type: "string" },
      },
      required: ["to", "subject", "body"],
    },
  },
];

const nameArgs = z.object({ name: z.string() });
const emailArgs = z.object({ to: z.string(), subject: z.string(), body: z.string() });

/** Runs a tool and returns its text output. Throws on bad arguments or missing files. */
export function executeTool(tool: string, input: unknown, ctx: ToolContext): string {
  switch (tool) {
    case "fetch_page": {
      const { name } = nameArgs.parse(input);
      const file = resolveDemoFile(name, [
        path.join(ctx.demoDir, "poisoned-pages"),
        path.join(ctx.demoDir, "clean-pages"),
      ]);
      if (!file) throw new Error(`Page not found: ${name}`);
      return readFileSync(file, "utf8");
    }
    case "read_file": {
      const { name } = nameArgs.parse(input);
      const file = resolveDemoFile(name, [path.join(ctx.demoDir, "sample-files")]);
      if (!file) throw new Error(`File not found: ${name}`);
      return readFileSync(file, "utf8");
    }
    case "send_email": {
      const { to, subject, body } = emailArgs.parse(input);
      // FAKE: nothing is sent. The email is only recorded in the database.
      ctx.db
        .insert(sentEmails)
        .values({ conversationId: ctx.conversationId, to, subject, body, createdAt: Date.now() })
        .run();
      return `Email to ${to} was sent.`;
    }
    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}
