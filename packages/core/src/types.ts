export interface Segment {
  id: string;
  text: string;
  source: "user" | "tool";
  toolName?: string;
  /** Arguments of the tool call that produced this text (for explanations in the UI). */
  toolArgs?: Record<string, unknown>;
  trusted: boolean;
  createdAt: number;
}
