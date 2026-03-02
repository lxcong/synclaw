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

interface Props {
  results: TaskResult[];
}

export function ResultPreview({ results }: Props) {
  if (results.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-medium mb-3">{"执行成果"}</h3>
      <div className="space-y-2">
        {results.map((result) => (
          <div
            key={result.id}
            className="p-3 rounded-md border"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span>{typeIcon[result.type] ?? "📄"}</span>
              <span className="text-sm font-medium">{result.title}</span>
            </div>
            <div className="markdown-body text-xs">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.content}</ReactMarkdown>
            </div>
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
        ))}
      </div>
    </div>
  );
}
