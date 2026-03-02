"use client";

import { useEffect, useRef, useState } from "react";
import type { ThoughtEntry } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  thoughts: ThoughtEntry[];
  connected: boolean;
}

function ThinkingBlock({ thought }: { thought: ThoughtEntry }) {
  const [expanded, setExpanded] = useState(false);
  const lines = thought.content.split("\n");
  const needsCollapse = lines.length > 3;
  const display = needsCollapse && !expanded ? lines.slice(0, 3).join("\n") + "…" : thought.content;

  return (
    <div
      className="rounded-md px-3 py-2 cursor-pointer"
      style={{
        borderLeft: "3px solid var(--primary)",
        background: "color-mix(in srgb, var(--primary) 8%, var(--card))",
      }}
      onClick={() => needsCollapse && setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium" style={{ color: "var(--primary-hover)" }}>
          💭 Thinking
        </span>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {new Date(thought.timestamp).toLocaleTimeString("zh-CN")}
        </span>
      </div>
      <p
        className="text-sm italic whitespace-pre-wrap"
        style={{ color: "var(--muted-foreground)" }}
      >
        {display}
      </p>
      {needsCollapse && (
        <span className="text-xs mt-1 inline-block" style={{ color: "var(--primary-hover)" }}>
          {expanded ? "收起" : `展开全部 (${lines.length} 行)`}
        </span>
      )}
    </div>
  );
}

function ToolUseBlock({ thought }: { thought: ThoughtEntry }) {
  return (
    <div
      className="rounded-md px-3 py-2"
      style={{
        borderLeft: "3px solid var(--acting)",
        background: "var(--card)",
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: "var(--acting)" }}>
            🔧 Tool
          </span>
          {thought.toolName && (
            <code
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: "var(--card-hover)", color: "var(--acting)" }}
            >
              {thought.toolName}
            </code>
          )}
        </div>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {new Date(thought.timestamp).toLocaleTimeString("zh-CN")}
        </span>
      </div>
      <pre
        className="text-sm whitespace-pre-wrap break-all"
        style={{ color: "var(--foreground)", fontFamily: "monospace" }}
      >
        {thought.content}
      </pre>
    </div>
  );
}

function ResultBlock({ thought }: { thought: ThoughtEntry }) {
  return (
    <div
      className="rounded-md px-3 py-2"
      style={{
        borderLeft: "3px solid var(--success)",
        background: "var(--card)",
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium" style={{ color: "var(--success)" }}>
          ✅ Result
        </span>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {new Date(thought.timestamp).toLocaleTimeString("zh-CN")}
        </span>
      </div>
      <div className="markdown-body text-sm">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{thought.content}</ReactMarkdown>
      </div>
    </div>
  );
}

function ErrorBlock({ thought }: { thought: ThoughtEntry }) {
  return (
    <div
      className="rounded-md px-3 py-2"
      style={{
        borderLeft: "3px solid var(--danger)",
        background: "color-mix(in srgb, var(--danger) 8%, var(--card))",
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium" style={{ color: "var(--danger)" }}>
          ❌ Error
        </span>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {new Date(thought.timestamp).toLocaleTimeString("zh-CN")}
        </span>
      </div>
      <pre
        className="text-sm whitespace-pre-wrap break-all"
        style={{ color: "var(--danger)", fontFamily: "monospace" }}
      >
        {thought.content}
      </pre>
    </div>
  );
}

const blockRenderers: Record<string, React.ComponentType<{ thought: ThoughtEntry }>> = {
  thinking: ThinkingBlock,
  tool_use: ToolUseBlock,
  result: ResultBlock,
  error: ErrorBlock,
};

export function ThoughtStream({ thoughts, connected }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thoughts.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-medium">{"脑回路"}</h3>
        {connected && (
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--success)" }} />
        )}
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-2 pr-4">
          {thoughts.length === 0 && (
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {"等待 Agent 开始执行..."}
            </p>
          )}
          {thoughts.map((thought) => {
            const Block = blockRenderers[thought.type] ?? ThinkingBlock;
            return <Block key={thought.id} thought={thought} />;
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
