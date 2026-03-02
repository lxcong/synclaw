"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import type { Agent } from "@/types";
import type { PixelOfficeHandle } from "@/components/pixel-office/pixel-office";
import { AgentCard } from "@/components/agent-card";
import { SyncAgentsButton } from "@/components/sync-agents-button";
import { POLL_INTERVAL_MS, HIGHLIGHT_DURATION_MS } from "@/components/pixel-office/constants";

const PixelOffice = dynamic(() => import("@/components/pixel-office/pixel-office"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full rounded-lg animate-pulse"
      style={{
        background: "var(--card)",
        maxHeight: "320px",
        aspectRatio: "960 / 320",
      }}
    />
  ),
});

export function AgentSection() {
  const [agents, setAgents] = useState<(Agent & { _count: { tasks: number } })[]>([]);
  const [highlightedAgentId, setHighlightedAgentId] = useState<string | null>(null);
  const pixelOfficeRef = useRef<PixelOfficeHandle>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  // Fetch agents on mount + poll
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/agents");
        if (res.ok) setAgents(await res.json());
      } catch {
        // keep existing
      }
    };
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const handleSpriteClick = useCallback((agentId: string) => {
    setHighlightedAgentId(agentId);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedAgentId(null), HIGHLIGHT_DURATION_MS);
    const cardEl = document.querySelector(`[data-agent-id="${agentId}"]`);
    cardEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const handleCardClick = useCallback((agentId: string) => {
    pixelOfficeRef.current?.highlightAgent(agentId);
    setHighlightedAgentId(agentId);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedAgentId(null), HIGHLIGHT_DURATION_MS);
  }, []);

  return (
    <div className="p-4 pt-0 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium" style={{ color: "var(--muted-foreground)" }}>
          🤖 Agent Hub
        </h3>
        <SyncAgentsButton />
      </div>

      {/* Pixel Office Scene */}
      <div className="max-w-5xl">
        <PixelOffice
          ref={pixelOfficeRef}
          agents={agents}
          onAgentClick={handleSpriteClick}
        />
      </div>

      {/* Agent Cards Grid */}
      {agents.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl">
          {agents.map((agent) => (
            <div
              key={agent.id}
              data-agent-id={agent.id}
              onClick={() => handleCardClick(agent.id)}
              className="cursor-pointer transition-all duration-300"
              style={{
                borderRadius: "0.5rem",
                outline: highlightedAgentId === agent.id
                  ? "2px solid var(--primary)"
                  : "2px solid transparent",
                outlineOffset: "2px",
              }}
            >
              <AgentCard agent={agent} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
