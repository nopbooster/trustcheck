import { useState } from "react";
import { ApprovalDialog } from "./components/ApprovalDialog";
import { ChatPage } from "./components/ChatPage";
import { LogPage } from "./components/LogPage";
import { useApprovals } from "./hooks/useApprovals";
import { cn } from "./lib/utils";

type Tab = "chat" | "log";

export function App() {
  const [tab, setTab] = useState<Tab>("chat");
  const [logVersion, setLogVersion] = useState(0);
  const { pending, connected, remove } = useApprovals();

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-slate-200 bg-white px-4 py-3">
        <h1 className="text-base font-semibold">TrustCheck demo</h1>
        <nav className="flex gap-1">
          {(["chat", "log"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-md px-3 py-1 text-sm capitalize",
                tab === t ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {t === "log" ? "Log" : "Chat"}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-4 text-xs">
          <span className="text-green-700">■ typed by you (trusted)</span>
          <span className="text-red-700">■ came from a tool (untrusted)</span>
          <span className={connected ? "text-slate-500" : "text-amber-700"}>
            {connected ? "live" : "reconnecting…"}
          </span>
        </div>
      </header>

      <main className="min-h-0 flex-1">
        {/* Both pages stay mounted so the chat survives a trip to the log */}
        <div className={cn("h-full", tab !== "chat" && "hidden")}>
          <ChatPage onActivity={() => setLogVersion((v) => v + 1)} />
        </div>
        <div className={cn("h-full", tab !== "log" && "hidden")}>
          <LogPage active={tab === "log"} version={logVersion} />
        </div>
      </main>

      <ApprovalDialog pending={pending} onAnswered={remove} />
    </div>
  );
}
