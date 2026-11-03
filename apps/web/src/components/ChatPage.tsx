import { useEffect, useRef, useState, type FormEvent } from "react";
import { sendChat } from "../lib/api";
import { ATTACK_PROMPT, errorItem, itemsFromResponse, userItem, type ChatItem } from "../lib/chat";
import { ToolCallCard } from "./ToolCallCard";
import { Button } from "./ui/button";

export function ChatPage({ onActivity }: { onActivity: () => void }) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [items, busy]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);
    setItems((prev) => [...prev, userItem(message)]);
    try {
      const res = await sendChat(message, conversationId);
      setConversationId(res.conversationId);
      setItems((prev) => [...prev, ...itemsFromResponse(res)]);
    } catch (err) {
      setItems((prev) => [...prev, errorItem(err instanceof Error ? err.message : "Something went wrong.")]);
    } finally {
      setBusy(false);
      onActivity();
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {items.length === 0 && (
          <p className="mx-auto mt-16 max-w-md text-center text-sm text-slate-500">
            Chat with the agent, or press <strong>Try an attack</strong> to make it read a poisoned page and watch
            TrustCheck stop the hidden instruction.
          </p>
        )}

        {items.map((item) =>
          item.kind === "tool" ? (
            <ToolCallCard key={item.id} call={item.call} />
          ) : item.kind === "user" ? (
            <div key={item.id} className="ml-auto max-w-[80%] rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              <div className="mb-0.5 text-xs font-medium text-green-700">You (trusted)</div>
              <p className="whitespace-pre-wrap">{item.text}</p>
            </div>
          ) : item.kind === "assistant" ? (
            <div key={item.id} className="max-w-[80%] rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-900">
              <div className="mb-0.5 text-xs font-medium text-slate-500">Agent</div>
              <p className="whitespace-pre-wrap">{item.text}</p>
            </div>
          ) : (
            <div key={item.id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {item.text}
            </div>
          ),
        )}

        {busy && <p className="text-sm text-slate-500">The agent is working… (it may be waiting for your approval)</p>}
        <div ref={bottom} />
      </div>

      <form onSubmit={onSubmit} className="flex gap-2 border-t border-slate-200 bg-white p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the agent something…"
          className="h-9 flex-1 rounded-md border border-slate-300 px-3 text-sm focus:outline-2 focus:outline-slate-900"
        />
        <Button type="submit" disabled={busy || input.trim() === ""}>
          Send
        </Button>
        <Button type="button" variant="danger" disabled={busy} onClick={() => void send(ATTACK_PROMPT)}>
          Try an attack
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setItems([]);
            setConversationId(undefined);
          }}
        >
          New chat
        </Button>
      </form>
    </div>
  );
}
