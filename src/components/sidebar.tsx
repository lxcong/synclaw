"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams, usePathname } from "next/navigation";
import type { Workspace } from "@/types";
import { cn } from "@/lib/utils";
import { CreateWorkspaceDialog } from "./create-workspace-dialog";

export function Sidebar() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const activeId = params?.id as string | undefined;
  const isAgentsPage = pathname === "/agents";

  useEffect(() => {
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then(setWorkspaces);
  }, []);

  async function handleCreate(name: string, icon: string) {
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, icon }),
    });
    const ws = await res.json();
    setWorkspaces((prev) => [...prev, ws]);
    setDialogOpen(false);
    router.push(`/workspace/${ws.id}`);
  }

  return (
    <aside
      className="w-60 border-r flex flex-col shrink-0"
      style={{ borderColor: "var(--border)", background: "var(--background)" }}
    >
      <div className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
        <h1 className="text-lg font-bold tracking-tight">
          <span style={{ color: "var(--primary)" }}>Sync</span>Claw
        </h1>
      </div>

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        <div
          className="px-2 py-1.5 text-xs font-medium uppercase tracking-wider"
          style={{ color: "var(--muted)" }}
        >
          工作区
        </div>
        {workspaces.map((ws) => (
          <button
            key={ws.id}
            onClick={() => router.push(`/workspace/${ws.id}`)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200 cursor-pointer"
            )}
            style={{
              background: activeId === ws.id ? "var(--card)" : "transparent",
              color: activeId === ws.id ? "var(--foreground)" : "var(--muted-foreground)",
              borderLeft: activeId === ws.id ? "2px solid var(--primary)" : "2px solid transparent",
            }}
          >
            <span>{ws.icon}</span>
            <span>{ws.name}</span>
          </button>
        ))}
        <button
          onClick={() => setDialogOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer"
          style={{ color: "var(--muted)" }}
        >
          <span>+</span>
          <span>新建工作区</span>
        </button>

        <div
          className="px-2 py-1.5 mt-4 text-xs font-medium uppercase tracking-wider"
          style={{ color: "var(--muted)" }}
        >
          智能体
        </div>
        <button
          onClick={() => router.push("/agents")}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200 cursor-pointer"
          )}
          style={{
            background: isAgentsPage ? "var(--card)" : "transparent",
            color: isAgentsPage ? "var(--foreground)" : "var(--muted-foreground)",
            borderLeft: isAgentsPage ? "2px solid var(--primary)" : "2px solid transparent",
          }}
        >
          <span>🤖</span>
          <span>Agent 中心</span>
        </button>
      </nav>

      <CreateWorkspaceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreate={handleCreate}
      />
    </aside>
  );
}
