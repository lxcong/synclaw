"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { Agent, AgentStatus } from "@/types";
import type { PixelOfficeHandle } from "@/components/pixel-office/pixel-office";
import { SyncAgentsButton } from "@/components/sync-agents-button";
import { POLL_INTERVAL_MS, HIGHLIGHT_DURATION_MS } from "@/components/pixel-office/constants";

const PixelOffice = dynamic(() => import("@/components/pixel-office/pixel-office"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full rounded-xl animate-pulse"
      style={{
        background: "var(--card)",
        aspectRatio: "960 / 320",
      }}
    />
  ),
});

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
  const [highlightedAgentId, setHighlightedAgentId] = useState<string | null>(null);
  const pixelOfficeRef = useRef<PixelOfficeHandle>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
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

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  const handleSpriteClick = useCallback((agentId: string) => {
    setHighlightedAgentId(agentId);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedAgentId(null), HIGHLIGHT_DURATION_MS);
    const cardEl = document.querySelector(`[data-panel-agent-id="${agentId}"]`);
    cardEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const handleCardClick = useCallback((agentId: string) => {
    pixelOfficeRef.current?.highlightAgent(agentId);
    setHighlightedAgentId(agentId);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedAgentId(null), HIGHLIGHT_DURATION_MS);
  }, []);

  return (
    <aside
      className="w-1/2 flex flex-col shrink-0 h-full rounded-xl overflow-hidden"
      style={{ background: "var(--kanban-bg)" }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between shrink-0"
        style={{ background: "rgba(24, 24, 27, 0.5)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">🤖</span>
          <h3 className="text-sm font-semibold tracking-tight">Agent Hub</h3>
          <span
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ background: "var(--border)", color: "var(--muted-foreground)" }}
          >
            {agents.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <SyncAgentsButton />
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-md text-xs transition-colors cursor-pointer"
            style={{ color: "var(--muted-foreground)", background: "var(--card)" }}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Pixel Office with glow */}
        <div
          className="rounded-xl overflow-hidden ring-1 ring-indigo-500/20"
          style={{
            boxShadow: "0 0 20px rgba(99, 102, 241, 0.08)",
          }}
        >
          <PixelOffice
            ref={pixelOfficeRef}
            agents={agents}
            onAgentClick={handleSpriteClick}
          />
        </div>

        {/* Section Label */}
        <div className="flex items-center gap-2 px-1">
          <span
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: "var(--muted)" }}
          >
            Agent 列表
          </span>
          <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
        </div>

        {/* Agent Cards */}
        {agents.map((agent) => {
          const status = statusConfig[agent.status];
          const isHighlighted = highlightedAgentId === agent.id;
          return (
            <div
              key={agent.id}
              data-panel-agent-id={agent.id}
              onClick={() => handleCardClick(agent.id)}
              className="relative rounded-xl border overflow-hidden transition-all duration-300 cursor-pointer group"
              style={{
                borderColor: isHighlighted ? "var(--primary)" : "var(--border)",
                background: "var(--card)",
                boxShadow: isHighlighted ? "0 0 12px rgba(99, 102, 241, 0.15)" : "none",
              }}
            >
              {/* Left status bar */}
              <div
                className="absolute left-0 top-0 bottom-0 w-[3px]"
                style={{ background: status.color }}
              />

              <div className="p-3 pl-4">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-sm shrink-0"
                    style={{ background: "var(--background)" }}
                  >
                    {agent.emoji || "🤖"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium truncate">{agent.name}</h4>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full shrink-0 ml-2"
                        style={{
                          background: `color-mix(in srgb, ${status.color} 15%, transparent)`,
                          color: status.color,
                        }}
                      >
                        {status.label}
                      </span>
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
                  <div className="mt-2.5 flex flex-wrap gap-1 pl-[46px]">
                    {agent.capabilities.slice(0, 4).map((cap) => (
                      <span
                        key={cap}
                        className="text-xs px-2 py-0.5 rounded-md"
                        style={{ background: "var(--background)", color: "var(--muted-foreground)" }}
                      >
                        {cap}
                      </span>
                    ))}
                    {agent.capabilities.length > 4 && (
                      <span
                        className="text-xs px-2 py-0.5"
                        style={{ color: "var(--muted)" }}
                      >
                        +{agent.capabilities.length - 4}
                      </span>
                    )}
                  </div>
                )}

                <div
                  className="mt-2 flex items-center justify-between text-xs pl-[46px]"
                  style={{ color: "var(--muted)" }}
                >
                  <span>任务: {agent._count?.tasks ?? 0}</span>
                  {agent.lastHeartbeat && (
                    <span>{new Date(agent.lastHeartbeat).toLocaleTimeString("zh-CN")}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {agents.length === 0 && (
          <div
            className="text-center py-12 text-sm rounded-xl"
            style={{ color: "var(--muted)", background: "var(--card)" }}
          >
            暂无 Agent
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3" style={{ background: "rgba(24, 24, 27, 0.5)" }}>
        <button
          onClick={() => router.push("/agents")}
          className="w-full text-xs py-2.5 rounded-lg transition-all duration-200 cursor-pointer font-medium"
          style={{
            color: "var(--muted-foreground)",
            background: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          查看完整 Agent 中心 →
        </button>
      </div>
    </aside>
  );
}
