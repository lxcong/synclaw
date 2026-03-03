"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "@/types";
import { STATUS_CONFIG } from "@/types";

interface Props {
  task: Task;
  onClick: () => void;
  onDelete?: (taskId: string) => void;
}

export function TaskCard({ task, onClick, onDelete }: Props) {
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
    background: "var(--card)",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="group relative p-3 rounded-lg border transition-all duration-200 cursor-pointer hover:border-[var(--border-hover)] hover:shadow-sm hover:shadow-black/20"
    >
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
          className="absolute top-1.5 right-1.5 w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--background)]"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
          </svg>
        </button>
      )}

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
          className="mt-1.5 text-xs leading-relaxed line-clamp-2"
          style={{ color: "var(--muted-foreground)" }}
        >
          {task.description}
        </p>
      )}

      {task.assignedAgent && (
        <div className="mt-2">
          <span
            className="text-xs px-2 py-0.5 rounded-md inline-flex items-center gap-1"
            style={{ background: "var(--background)", color: "var(--muted-foreground)" }}
          >
            🤖 {task.assignedAgent.name}
          </span>
        </div>
      )}
    </div>
  );
}
