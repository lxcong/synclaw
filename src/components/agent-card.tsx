"use client";

import type { Agent, AgentStatus } from "@/types";

const statusConfig: Record<AgentStatus, { label: string; color: string }> = {
  idle: { label: "空闲", color: "var(--success)" },
  busy: { label: "忙碌", color: "var(--acting)" },
  offline: { label: "离线", color: "var(--muted)" },
  error: { label: "异常", color: "var(--danger)" },
};

interface Props {
  agent: Agent & { _count?: { tasks: number } };
}

export function AgentCard({ agent }: Props) {
  const status = statusConfig[agent.status];

  return (
    <div
      data-testid="agent-card"
      className="p-4 rounded-lg border transition-colors"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
            style={{ background: "var(--background)" }}
          >
            {agent.emoji || "🤖"}
          </div>
          <div>
            <h3 className="text-sm font-medium">{agent.name}</h3>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              {agent.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: status.color }}
          />
          <span className="text-xs" style={{ color: status.color }}>
            {status.label}
          </span>
        </div>
      </div>

      <div className="mt-3">
        <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>
          能力
        </p>
        <div className="flex flex-wrap gap-1">
          {agent.capabilities.map((cap) => (
            <span
              key={cap}
              className="text-xs px-2 py-0.5 rounded"
              style={{ background: "var(--background)", color: "var(--muted-foreground)" }}
            >
              {cap}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs" style={{ color: "var(--muted)" }}>
        <span>任务数: {agent._count?.tasks ?? 0}</span>
        {agent.lastHeartbeat && (
          <span>
            最后心跳: {new Date(agent.lastHeartbeat).toLocaleTimeString("zh-CN")}
          </span>
        )}
      </div>
    </div>
  );
}
