"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "@/types";
import { STATUS_CONFIG } from "@/types";

interface Props {
  task: Task;
  onClick: () => void;
}

export function TaskCard({ task, onClick }: Props) {
  const config = STATUS_CONFIG[task.status];
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    borderColor: "var(--border)",
    background: "var(--background)",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="p-3 rounded-md border transition-colors cursor-pointer hover:border-[var(--border-hover)]"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium leading-snug">{task.title}</h3>
        {config.animate && (
          <span
            className="flex-shrink-0 w-2 h-2 rounded-full mt-1 animate-pulse"
            style={{ background: config.color }}
          />
        )}
      </div>

      {task.description && (
        <p
          className="mt-1 text-xs leading-relaxed line-clamp-2"
          style={{ color: "var(--muted-foreground)" }}
        >
          {task.description}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between">
        {task.assignedAgent && (
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: "var(--card)", color: "var(--muted-foreground)" }}
          >
            🤖 {task.assignedAgent.name}
          </span>
        )}
      </div>
    </div>
  );
}
