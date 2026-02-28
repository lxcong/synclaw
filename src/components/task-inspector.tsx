"use client";

import type { Task } from "@/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface Props {
  task: Task | null;
  onClose: () => void;
  onTaskUpdate: (task: Task) => void;
}

export function TaskInspector({ task, onClose }: Props) {
  return (
    <Sheet open={!!task} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className="w-[600px] sm:max-w-[600px]"
        style={{ background: "var(--background)", borderColor: "var(--border)" }}
      >
        <SheetHeader>
          <SheetTitle>{task?.title}</SheetTitle>
        </SheetHeader>
        <div className="mt-4" style={{ color: "var(--muted-foreground)" }}>
          任务详情面板（下一步实现）
        </div>
      </SheetContent>
    </Sheet>
  );
}
