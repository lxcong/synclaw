"use client";

import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  onNewTask?: () => void;
}

export function TopBar({ title, onNewTask }: Props) {
  return (
    <header
      className="h-14 px-6 border-b flex items-center justify-between shrink-0"
      style={{ borderColor: "var(--border)" }}
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="flex items-center gap-2">
        {onNewTask && (
          <Button
            size="sm"
            onClick={onNewTask}
            className="cursor-pointer"
            style={{ background: "var(--primary)" }}
          >
            + 新建任务
          </Button>
        )}
      </div>
    </header>
  );
}
