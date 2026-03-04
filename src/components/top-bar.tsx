"use client";

import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  onNewTask?: () => void;
}

export function TopBar({ title, onNewTask }: Props) {
  return (
    <header
      className="h-14 px-6 border-b flex items-center justify-between shrink-0 backdrop-blur-md z-10"
      style={{
        borderColor: "var(--border)",
        background: "rgba(9, 9, 11, 0.8)",
      }}
    >
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="flex items-center gap-3">
        {onNewTask && (
          <Button
            size="sm"
            onClick={onNewTask}
            className="cursor-pointer rounded-lg text-xs font-medium"
            style={{ background: "var(--primary)" }}
          >
            + 新建任务
          </Button>
        )}
      </div>
    </header>
  );
}
