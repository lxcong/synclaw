"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import type { Agent } from "@/types";
import type { PixelOfficeHandle } from "@/components/pixel-office/pixel-office";
import { AgentCard } from "@/components/agent-card";
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

interface Props {
  initialAgents: (Agent & { _count: { tasks: number } })[];
}

export function AgentsPageClient({ initialAgents }: Props) {
  const [agents, setAgents] = useState(initialAgents);
  const [highlightedAgentId, setHighlightedAgentId] = useState<string | null>(null);
  const pixelOfficeRef = useRef<PixelOfficeHandle>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Poll for agent updates
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/agents");
        if (res.ok) {
          const data = await res.json();
          setAgents(data);
        }
      } catch {
        // Keep existing data on failure
      }
    };

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Handle click on pixel sprite -> highlight card
  const handleSpriteClick = useCallback((agentId: string) => {
    setHighlightedAgentId(agentId);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedAgentId(null), HIGHLIGHT_DURATION_MS);

    // Scroll card into view
    const cardEl = document.querySelector(`[data-agent-id="${agentId}"]`);
    cardEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  // Handle click on card -> highlight sprite
  const handleCardClick = useCallback((agentId: string) => {
    pixelOfficeRef.current?.highlightAgent(agentId);
    setHighlightedAgentId(agentId);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedAgentId(null), HIGHLIGHT_DURATION_MS);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <header
        className="h-14 px-6 border-b flex items-center shrink-0"
        style={{ borderColor: "var(--border)" }}
      >
        <h2 className="text-lg font-semibold">Agent 中心</h2>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Pixel Office Scene */}
        <div className="max-w-5xl">
          <PixelOffice
            ref={pixelOfficeRef}
            agents={agents}
            onAgentClick={handleSpriteClick}
          />
        </div>

        {/* Agent Cards Grid */}
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
      </div>
    </div>
  );
}
