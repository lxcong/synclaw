import { prisma } from "@/lib/db";
import { gatewayClient } from "@/lib/gateway-client";
import { trackTaskRun } from "@/lib/task-run-tracker";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  let task = await prisma.task.create({
    data: {
      title: body.title,
      description: body.description,
      workspaceId: body.workspaceId,
      assignedAgentId: body.assignedAgentId,
      status: body.assignedAgentId ? "acting" : "todo",
    },
    include: { assignedAgent: true },
  });

  // Dispatch to OpenClaw Gateway when an agent is assigned and Gateway is reachable
  if (task.assignedAgentId && gatewayClient.isConnected) {
    try {
      const message = task.description
        ? `${task.title}\n\n${task.description}`
        : task.title;

      const result = (await gatewayClient.request("agent", {
        message,
        sessionKey: `agent:${task.assignedAgentId}:syncclaw:${task.id}`,
        idempotencyKey: task.id,
        agentId: task.assignedAgentId,
      })) as { runId: string; status: string };

      // Check if auto-tracker already created a task for this runId
      const autoTracked = await prisma.task.findUnique({
        where: { runId: result.runId },
      });

      if (autoTracked && autoTracked.id !== task.id) {
        // Merge: update user-created task with runId, delete auto-tracked duplicate
        task = await prisma.task.update({
          where: { id: task.id },
          data: { runId: result.runId },
          include: { assignedAgent: true },
        });

        // Move any thought entries from auto-tracked task to user task
        await prisma.thoughtEntry.updateMany({
          where: { taskId: autoTracked.id },
          data: { taskId: task.id },
        });
        await prisma.taskResult.updateMany({
          where: { taskId: autoTracked.id },
          data: { taskId: task.id },
        });

        // Remove the runId from auto-tracked task before deleting (unique constraint)
        await prisma.task.update({
          where: { id: autoTracked.id },
          data: { runId: null },
        });
        await prisma.task.delete({ where: { id: autoTracked.id } });
      } else {
        task = await prisma.task.update({
          where: { id: task.id },
          data: { runId: result.runId },
          include: { assignedAgent: true },
        });
      }

      // Register background subscriber so DB is updated regardless of SSE stream
      trackTaskRun(task.id, result.runId, task.assignedAgentId!);
    } catch (err) {
      console.error("[tasks/POST] Gateway dispatch failed, falling back to todo:", err);
      task = await prisma.task.update({
        where: { id: task.id },
        data: { status: "todo" },
        include: { assignedAgent: true },
      });
    }
  }

  return NextResponse.json(task, { status: 201 });
}
