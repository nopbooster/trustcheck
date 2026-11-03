import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** One row per tool call the model attempted. */
export const toolLogs = sqliteTable("tool_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: text("conversation_id").notNull(),
  tool: text("tool").notNull(),
  args: text("args").notNull(), // JSON
  decision: text("decision").notNull(), // ALLOW | ASK_USER (from core.check)
  reasons: text("reasons").notNull(), // JSON
  userResponse: text("user_response"), // approved | denied | timeout | null when no question was asked
  outcome: text("outcome").notNull(), // executed | blocked | error
  createdAt: integer("created_at").notNull(),
});

/** The fake send_email tool writes here instead of sending anything. */
export const sentEmails = sqliteTable("sent_emails", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: text("conversation_id").notNull(),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  createdAt: integer("created_at").notNull(),
});
