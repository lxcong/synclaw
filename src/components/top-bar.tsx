"use client";

import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  onNewTask?: () => void;
  agentPanelOpen?: boolean;
  onToggleAgentPanel?: () => void;
}

export function TopBar({ title, onNewTask, agentPanelOpen, onToggleAgentPanel }: Props) {
  return (
    <header
      className="h-14 px-6 border-b flex items-center justify-between shrink-0 backdrop-blur-md z-10"
      style={{
        borderColor: "var(--border)",
        background: "rgba(9, 9, 11, 0.8)",
      }}
    >
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="flex items-center gap-3">
        {onToggleAgentPanel && (
          <button
            onClick={onToggleAgentPanel}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer"
            style={{
              background: agentPanelOpen ? "rgba(99, 102, 241, 0.15)" : "var(--card)",
              color: agentPanelOpen ? "var(--primary-hover)" : "var(--muted-foreground)",
              border: `1px solid ${agentPanelOpen ? "rgba(99, 102, 241, 0.3)" : "var(--border)"}`,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: agentPanelOpen ? "var(--primary)" : "var(--muted)",
              }}
            />
            Agent Hub
          </button>
        )}
        {onNewTask && (
          <Button
            size="sm"
            onClick={onNewTask}
            className="cursor-pointer rounded-lg text-xs font-medium"
            style={{ background: "var(--primary)" }}
          >
            + 新建任务
          </Button>
        )}
      </div>
    </header>
  );
}
