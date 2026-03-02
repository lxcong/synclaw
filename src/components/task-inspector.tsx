"use client";

import { useEffect, useRef } from "react";
import type { Task } from "@/types";
import { STATUS_CONFIG } from "@/types";
import { useTaskStream } from "@/hooks/use-task-stream";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ThoughtStream } from "./thought-stream";
import { ResultPreview } from "./result-preview";

interface Props {
  task: Task | null;
  onClose: () => void;
  onTaskUpdate: (task: Task) => void;
}

export function TaskInspector({ task, onClose, onTaskUpdate }: Props) {
  const stream = useTaskStream(task?.id ?? null);
  const prevStatusRef = useRef(stream.status);

  const effectiveStatus = stream.status ?? task?.status;

  // Sync stream status changes back to the kanban board
  useEffect(() => {
    if (task && stream.status && stream.status !== prevStatusRef.current) {
      prevStatusRef.current = stream.status;
      onTaskUpdate({ ...task, status: stream.status });
    }
  }, [task, stream.status, onTaskUpdate]);

  return (
    <Sheet open={!!task} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className="w-[600px] sm:max-w-[600px] flex flex-col"
        style={{ background: "var(--background)", borderColor: "var(--border)" }}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <span>{task?.title}</span>
            {effectiveStatus && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: STATUS_CONFIG[effectiveStatus].color,
                  color: "white",
                }}
              >
                {STATUS_CONFIG[effectiveStatus].label}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {task?.description && (
          <p className="text-sm mt-2" style={{ color: "var(--muted-foreground)" }}>
            {task.description}
          </p>
        )}

        <Separator className="my-4" style={{ background: "var(--border)" }} />

        <div className="flex-1 flex flex-col gap-4 overflow-hidden min-h-0">
          <div className="flex-1 overflow-hidden">
            <ThoughtStream thoughts={stream.thoughts} connected={stream.connected} />
          </div>

          {stream.results.length > 0 && (
            <>
              <Separator style={{ background: "var(--border)" }} />
              <ResultPreview results={stream.results} />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
