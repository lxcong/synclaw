"use client";

import { useEffect, useRef } from "react";
import type { ThoughtEntry } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";

const typeConfig: Record<string, { icon: string; color: string }> = {
  thinking: { icon: "\u{1F4AD}", color: "var(--thinking)" },
  tool_use: { icon: "\u{1F527}", color: "var(--acting)" },
  result: { icon: "\u2705", color: "var(--success)" },
  error: { icon: "\u274C", color: "var(--danger)" },
};

interface Props {
  thoughts: ThoughtEntry[];
  connected: boolean;
}

export function ThoughtStream({ thoughts, connected }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thoughts.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-medium">{"\u8111\u56DE\u8DEF"}</h3>
        {connected && (
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--success)" }} />
        )}
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-3 pr-4">
          {thoughts.length === 0 && (
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {"\u7B49\u5F85 Agent \u5F00\u59CB\u6267\u884C..."}
            </p>
          )}
          {thoughts.map((thought) => {
            const config = typeConfig[thought.type] ?? typeConfig.thinking;
            return (
              <div key={thought.id} className="flex gap-2">
                <span className="text-sm mt-0.5">{config.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: "var(--foreground)" }}>
                    {thought.content}
                  </p>
                  {thought.toolName && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded mt-1 inline-block"
                      style={{ background: "var(--card)", color: config.color }}
                    >
                      {thought.toolName}
                    </span>
                  )}
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                    {new Date(thought.timestamp).toLocaleTimeString("zh-CN")}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
