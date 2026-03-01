import { prisma } from "@/lib/db";
import { gatewayClient, type AgentEvent, type RunSubscriber } from "@/lib/gateway-client";

/**
 * Registers a background subscriber for a dispatched task's Gateway run.
 * This ensures the DB is updated with thoughts, results, and status changes
 * regardless of whether a client SSE stream is connected.
 */
export function trackTaskRun(taskId: string, runId: string, agentId: string): void {
  const subscriber: RunSubscriber = {
    onEvent(event: AgentEvent) {
      handleEvent(taskId, agentId, event).catch((err) =>
        console.error("[task-tracker] Event handling failed:", err)
      );
    },

    async onComplete(_runId: string, payload: unknown) {
      try {
        const content = typeof payload === "string"
          ? payload
          : JSON.stringify(payload);

        await prisma.taskResult.create({
          data: {
            taskId,
            type: "text",
            title: "Execution Result",
            content,
          },
        });

        await prisma.task.update({
          where: { id: taskId },
          data: { status: "done" },
        });
      } catch (err) {
        console.error("[task-tracker] onComplete failed:", err);
      } finally {
        gatewayClient.unsubscribe(runId, subscriber);
      }
    },

    async onError(_runId: string, error: { code: number; message: string }) {
      try {
        await prisma.thoughtEntry.create({
          data: {
            taskId,
            agentId,
            type: "error",
            content: error.message,
          },
        });

        await prisma.task.update({
          where: { id: taskId },
          data: { status: "blocked" },
        });
      } catch (err) {
        console.error("[task-tracker] onError failed:", err);
      } finally {
        gatewayClient.unsubscribe(runId, subscriber);
      }
    },
  };

  gatewayClient.subscribe(runId, subscriber);
}

async function handleEvent(taskId: string, agentId: string, event: AgentEvent): Promise<void> {
  switch (event.stream) {
    case "lifecycle": {
      const phase = event.data.phase as string | undefined;
      if (phase === "start") {
        await prisma.task.update({
          where: { id: taskId },
          data: { status: "thinking" },
        });
      } else if (phase === "error") {
        const errorContent = (event.data.error as string) ?? "Unknown lifecycle error";
        await prisma.thoughtEntry.create({
          data: { taskId, agentId, type: "error", content: errorContent },
        });
        await prisma.task.update({
          where: { id: taskId },
          data: { status: "blocked" },
        });
      }
      break;
    }
    case "assistant": {
      const delta = (event.data.delta as string) ?? (event.data.text as string) ?? "";
      if (delta) {
        await prisma.thoughtEntry.create({
          data: { taskId, agentId, type: "thinking", content: delta },
        });
      }
      break;
    }
    case "tool": {
      const phase = event.data.phase as string | undefined;
      const toolName = (event.data.name as string) ?? "unknown";

      if (phase === "start") {
        await prisma.task.update({
          where: { id: taskId },
          data: { status: "acting" },
        });
        await prisma.thoughtEntry.create({
          data: { taskId, agentId, type: "tool_use", content: `Calling ${toolName}`, toolName },
        });
      } else if (phase === "result") {
        const isError = Boolean(event.data.isError);
        const result = (event.data.result as string) ?? "";
        await prisma.thoughtEntry.create({
          data: {
            taskId,
            agentId,
            type: isError ? "error" : "result",
            content: `${toolName}: ${result}`,
            toolName,
          },
        });
      }
      break;
    }
    case "error": {
      const message = (event.data.message as string) ?? "Unknown error";
      await prisma.thoughtEntry.create({
        data: { taskId, agentId, type: "error", content: message },
      });
      break;
    }
  }
}
