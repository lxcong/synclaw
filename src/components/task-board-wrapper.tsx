"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { Task, TaskStatus } from "@/types";
import { TASK_STATUSES } from "@/types";
import { TopBar } from "./top-bar";
import { KanbanColumn } from "./kanban-column";
import { TaskCard } from "./task-card";
import { CreateTaskDialog } from "./create-task-dialog";
import { TaskInspector } from "./task-inspector";
import { AgentPanel } from "./agent-panel";

interface Props {
  workspaceId: string;
  workspaceName: string;
}

export function TaskBoardWrapper({ workspaceId, workspaceName }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [inspectedTask, setInspectedTask] = useState<Task | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [agentPanelOpen, setAgentPanelOpen] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const fetchTasks = useCallback(() => {
    fetch(`/api/workspaces/${workspaceId}/tasks`)
      .then((r) => r.json())
      .then(setTasks);
  }, [workspaceId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    // Persist
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
  }

  async function handleCreateTask(data: {
    title: string;
    description: string;
    assignedAgentId?: string;
  }) {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, workspaceId }),
    });
    const newTask = await res.json();
    setTasks((prev) => [...prev, newTask]);
    setCreateDialogOpen(false);
  }

  function handleTaskClick(task: Task) {
    setInspectedTask(task);
  }

  const handleTaskUpdate = useCallback((updatedTask: Task) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
    );
  }, []);

  return (
    <>
      <TopBar
        title={workspaceName}
        onNewTask={() => setCreateDialogOpen(true)}
        agentPanelOpen={agentPanelOpen}
        onToggleAgentPanel={() => setAgentPanelOpen((v) => !v)}
      />

      <div className="flex-1 flex overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 flex overflow-x-auto p-4 gap-4">
            {TASK_STATUSES.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                tasks={tasks.filter((t) => t.status === status)}
                onTaskClick={handleTaskClick}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask ? <TaskCard task={activeTask} onClick={() => {}} /> : null}
          </DragOverlay>
        </DndContext>

        {agentPanelOpen && (
          <AgentPanel onClose={() => setAgentPanelOpen(false)} />
        )}
      </div>

      <TaskInspector
        task={inspectedTask}
        onClose={() => setInspectedTask(null)}
        onTaskUpdate={handleTaskUpdate}
      />

      <CreateTaskDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        workspaceId={workspaceId}
        onCreate={handleCreateTask}
      />
    </>
  );
}
