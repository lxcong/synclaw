"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Task, TaskStatus } from "@/types";
import { STATUS_CONFIG } from "@/types";
import { TaskCard } from "./task-card";

interface Props {
  status: TaskStatus;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

export function KanbanColumn({ status, tasks, onTaskClick }: Props) {
  const config = STATUS_CONFIG[status];
  const { setNodeRef } = useDroppable({ id: status });

  return (
    <div className="flex-shrink-0 w-72 flex flex-col rounded-xl overflow-hidden">
      {/* Column header */}
      <div
        className="px-3 py-2.5 flex items-center gap-2"
        style={{ background: "rgba(24, 24, 27, 0.6)" }}
      >
        <span
          className="w-2.5 h-2.5 rounded-md"
          style={{ background: config.color }}
        />
        <span className="text-sm font-semibold tracking-tight">{config.label}</span>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: "var(--border)", color: "var(--muted-foreground)" }}
        >
          {tasks.length}
        </span>
      </div>
      <div ref={setNodeRef} className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px]">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
