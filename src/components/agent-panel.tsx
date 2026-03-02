"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Agent, AgentStatus } from "@/types";
import { SyncAgentsButton } from "@/components/sync-agents-button";
import { POLL_INTERVAL_MS } from "@/components/pixel-office/constants";

const statusConfig: Record<AgentStatus, { label: string; color: string }> = {
  idle: { label: "空闲", color: "var(--success)" },
  busy: { label: "忙碌", color: "var(--acting)" },
  offline: { label: "离线", color: "var(--muted)" },
  error: { label: "异常", color: "var(--danger)" },
};

interface Props {
  onClose: () => void;
}

export function AgentPanel({ onClose }: Props) {
  const [agents, setAgents] = useState<(Agent & { _count?: { tasks: number } })[]>([]);
  const router = useRouter();

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      if (res.ok) {
        const data = await res.json();
        setAgents(data);
      }
    } catch {
      // Keep existing data on failure
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  return (
    <aside
      className="w-72 border-l flex flex-col shrink-0 h-full"
      style={{ borderColor: "var(--border)", background: "var(--background)" }}
    >
      <div
        className="h-14 px-4 border-b flex items-center justify-between shrink-0"
        style={{ borderColor: "var(--border)" }}
      >
        <h3 className="text-sm font-semibold">🤖 Agent Hub</h3>
        <div className="flex items-center gap-1">
          <SyncAgentsButton />
          <button
            onClick={onClose}
            className="p-1 rounded text-xs transition-colors cursor-pointer"
            style={{ color: "var(--muted-foreground)" }}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {agents.map((agent) => {
          const status = statusConfig[agent.status];
          return (
            <div
              key={agent.id}
              className="p-3 rounded-lg border transition-colors"
              style={{ borderColor: "var(--border)", background: "var(--card)" }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                  style={{ background: "var(--background)" }}
                >
                  {agent.emoji || "🤖"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium truncate">{agent.name}</h4>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: status.color }}
                      />
                      <span className="text-xs" style={{ color: status.color }}>
                        {status.label}
                      </span>
                    </div>
                  </div>
                  <p
                    className="text-xs truncate mt-0.5"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {agent.description}
                  </p>
                </div>
              </div>

              {agent.capabilities.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {agent.capabilities.slice(0, 3).map((cap) => (
                    <span
                      key={cap}
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: "var(--background)", color: "var(--muted-foreground)" }}
                    >
                      {cap}
                    </span>
                  ))}
                  {agent.capabilities.length > 3 && (
                    <span
                      className="text-xs px-1.5 py-0.5"
                      style={{ color: "var(--muted)" }}
                    >
                      +{agent.capabilities.length - 3}
                    </span>
                  )}
                </div>
              )}

              <div
                className="mt-2 text-xs flex items-center justify-between"
                style={{ color: "var(--muted)" }}
              >
                <span>任务: {agent._count?.tasks ?? 0}</span>
                {agent.lastHeartbeat && (
                  <span>{new Date(agent.lastHeartbeat).toLocaleTimeString("zh-CN")}</span>
                )}
              </div>
            </div>
          );
        })}

        {agents.length === 0 && (
          <div
            className="text-center py-8 text-sm"
            style={{ color: "var(--muted)" }}
          >
            暂无 Agent
          </div>
        )}
      </div>

      <div className="p-3 border-t" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={() => router.push("/agents")}
          className="w-full text-xs py-2 rounded-md transition-colors cursor-pointer"
          style={{ color: "var(--muted-foreground)", background: "var(--card)" }}
        >
          查看完整 Agent 中心 →
        </button>
      </div>
    </aside>
  );
}
