"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SyncAgentsButton() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      await fetch("/api/agents/sync", { method: "POST" });
      router.refresh();
    } catch {
      // Ignore — page will show stale data
    } finally {
      setSyncing(false);
    }
  }

  return (
    <button
      onClick={handleSync}
      disabled={syncing}
      className="text-sm px-3 py-1.5 rounded-md border transition-colors cursor-pointer disabled:opacity-50"
      style={{
        borderColor: "var(--border)",
        color: "var(--muted-foreground)",
        background: "var(--card)",
      }}
    >
      {syncing ? "同步中..." : "🔄 同步 Agent"}
    </button>
  );
}
