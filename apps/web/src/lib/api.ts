import type { ChatResponse, LogRow } from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

const postJson = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

/** Resolves when the agent is finished (this can wait on an approval). */
export const sendChat = (message: string, conversationId?: string) =>
  request<ChatResponse>("/chat", postJson({ message, conversationId }));

export const getLogs = () => request<LogRow[]>("/logs?limit=200");

export const decideApproval = (id: string, decision: "approve" | "deny") =>
  request<{ id: string }>(`/approvals/${id}`, postJson({ decision }));
