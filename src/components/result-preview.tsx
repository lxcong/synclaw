"use client";

import type { TaskResult } from "@/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const typeIcon: Record<string, string> = {
  text: "📄",
  file: "📎",
  link: "🔗",
  email_draft: "✉️",
};

/**
 * Try to extract readable text from content that might be raw JSON.
 * Falls back to the original content if no meaningful text can be extracted.
 */
function extractReadableContent(content: string): { text: string; isJson: boolean } {
  const trimmed = content.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return { text: content, isJson: false };
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null) {
      return { text: content, isJson: false };
    }

    // Try to extract text from OpenClaw-style message payload
    if (parsed.message) {
      const msg = parsed.message;
      if (Array.isArray(msg.content)) {
        const text = msg.content
          .filter((b: Record<string, unknown>) => b.type === "text" && typeof b.text === "string")
          .map((b: Record<string, unknown>) => b.text as string)
          .join("\n")
          .trim();
        if (text) return { text, isJson: false };
      }
      if (typeof msg.content === "string" && msg.content.trim()) {
        return { text: msg.content, isJson: false };
      }
    }

    // Try common text fields
    for (const key of ["text", "result", "output", "content"]) {
      if (typeof parsed[key] === "string" && parsed[key].trim()) {
        return { text: parsed[key], isJson: false };
      }
    }

    // Fallback: display as formatted JSON
    return { text: JSON.stringify(parsed, null, 2), isJson: true };
  } catch {
    return { text: content, isJson: false };
  }
}

interface Props {
  results: TaskResult[];
}

export function ResultPreview({ results }: Props) {
  if (results.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-medium mb-3">{"执行成果"}</h3>
      <div className="space-y-2">
        {results.map((result) => {
          const { text, isJson } = extractReadableContent(result.content);

          return (
            <div
              key={result.id}
              className="p-3 rounded-md border"
              style={{
                borderColor: "var(--border)",
                background: "var(--card)",
                borderLeft: "3px solid var(--success)",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span>{typeIcon[result.type] ?? "📄"}</span>
                <span className="text-sm font-medium">{result.title}</span>
              </div>
              {isJson ? (
                <pre
                  className="text-xs whitespace-pre-wrap break-all overflow-auto max-h-80"
                  style={{
                    color: "var(--muted-foreground)",
                    fontFamily: "monospace",
                    background: "var(--card-hover)",
                    padding: "0.75rem",
                    borderRadius: "0.375rem",
                  }}
                >
                  {text}
                </pre>
              ) : (
                <div className="markdown-body text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
                </div>
              )}
              {result.url && (
                <a
                  href={result.url}
                  className="text-xs mt-2 inline-block"
                  style={{ color: "var(--primary)" }}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {"查看链接 →"}
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
