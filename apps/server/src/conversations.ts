import { randomUUID } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { ContextTracker } from "@trustcheck/core";

export interface Conversation {
  id: string;
  tracker: ContextTracker;
  messages: Anthropic.MessageParam[];
}

/** In-memory for the demo. */
export class ConversationStore {
  private items = new Map<string, Conversation>();

  create(): Conversation {
    const convo: Conversation = { id: randomUUID(), tracker: new ContextTracker(), messages: [] };
    this.items.set(convo.id, convo);
    return convo;
  }

  get(id: string): Conversation | undefined {
    return this.items.get(id);
  }
}
