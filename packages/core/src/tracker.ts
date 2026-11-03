import { randomUUID } from "node:crypto";
import type { Segment } from "./types";

/** Stores every piece of text in a conversation, tagged by where it came from. */
export class ContextTracker {
  private segments: Segment[] = [];

  addUserMessage(text: string): Segment {
    return this.add({ text, source: "user", trusted: true });
  }

  addToolResult(toolName: string, text: string, toolArgs?: Record<string, unknown>): Segment {
    return this.add({ text, source: "tool", toolName, toolArgs, trusted: false });
  }

  getSegments(): readonly Segment[] {
    return this.segments;
  }

  trustedSegments(): Segment[] {
    return this.segments.filter((s) => s.trusted);
  }

  untrustedSegments(): Segment[] {
    return this.segments.filter((s) => !s.trusted);
  }

  trustedText(): string {
    return this.trustedSegments().map((s) => s.text).join("\n");
  }

  untrustedText(): string {
    return this.untrustedSegments().map((s) => s.text).join("\n");
  }

  private add(fields: Omit<Segment, "id" | "createdAt">): Segment {
    const segment: Segment = { id: randomUUID(), createdAt: Date.now(), ...fields };
    this.segments.push(segment);
    return segment;
  }
}
