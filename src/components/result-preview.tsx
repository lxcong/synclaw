"use client";

import type { TaskResult } from "@/types";

const typeIcon: Record<string, string> = {
  text: "\u{1F4C4}",
  file: "\u{1F4CE}",
  link: "\u{1F517}",
  email_draft: "\u2709\uFE0F",
};

interface Props {
  results: TaskResult[];
}

export function ResultPreview({ results }: Props) {
  if (results.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-medium mb-3">{"\u6267\u884C\u6210\u679C"}</h3>
      <div className="space-y-2">
        {results.map((result) => (
          <div
            key={result.id}
            className="p-3 rounded-md border"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span>{typeIcon[result.type] ?? "\u{1F4C4}"}</span>
              <span className="text-sm font-medium">{result.title}</span>
            </div>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              {result.content}
            </p>
            {result.url && (
              <a
                href={result.url}
                className="text-xs mt-1 inline-block"
                style={{ color: "var(--primary)" }}
                target="_blank"
                rel="noopener noreferrer"
              >
                {"\u67E5\u770B\u94FE\u63A5 \u2192"}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
