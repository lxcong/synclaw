import { prisma } from "@/lib/db";
import { gatewayClient, type AgentEvent, type RunSubscriber } from "@/lib/gateway-client";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignedAgent: true },
  });

  if (!task) {
    return new Response("Task not found", { status: 404 });
  }

  // If the task has no assigned agent or no runId, return current status and close.
  if (!task.assignedAgentId || !task.runId) {
    const encoder = new TextEncoder();
    const simpleStream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(`event: status_change\ndata: ${JSON.stringify({ status: task.status })}\n\n`)
        );
        controller.close();
      },
    });
    return new Response(simpleStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // If the task is already done, return done status and close.
  if (task.status === "done") {
    const encoder = new TextEncoder();
    const doneStream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(`event: status_change\ndata: ${JSON.stringify({ status: "done" })}\n\n`)
        );
        controller.close();
      },
    });
    return new Response(doneStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Capture validated references for use inside closures
  const runId = task.runId;
  const agentId = task.assignedAgentId;
  let cancelled = false;

  let cleanupFn: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function send(event: string, data: unknown) {
        if (cancelled) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch (err) {
          console.error("[stream] Failed to enqueue SSE event:", err);
        }
      }

      // Heartbeat every 15 seconds
      const heartbeatInterval = setInterval(() => {
        if (cancelled) {
          clearInterval(heartbeatInterval);
          return;
        }
        try {
          send("heartbeat", { timestamp: Date.now() });
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 15_000);

      function cleanup() {
        cancelled = true;
        clearInterval(heartbeatInterval);
        gatewayClient.unsubscribe(runId);
      }

      // Expose cleanup for cancel() to use
      cleanupFn = cleanup;

      function closeStream() {
        cleanup();
        try {
          controller.close();
        } catch {
          // Stream may already be closed
        }
      }

      const subscriber: RunSubscriber = {
        onEvent(event: AgentEvent) {
          if (cancelled) return;

          try {
            switch (event.stream) {
              case "lifecycle":
                handleLifecycleEvent(event.data);
                break;
              case "assistant":
                handleAssistantEvent(event.data);
                break;
              case "tool":
                handleToolEvent(event.data);
                break;
              case "error":
                handleErrorEvent(event.data);
                break;
              default:
                // Unknown stream type -- ignore gracefully
                break;
            }
          } catch (err) {
            console.error("[stream] Error handling event:", err);
          }
        },

        async onComplete(_runId: string, payload: unknown) {
          if (cancelled) return;

          try {
            // Save TaskResult to DB
            const content = typeof payload === "string"
              ? payload
              : JSON.stringify(payload);

            const result = await prisma.taskResult.create({
              data: {
                taskId,
                type: "text",
                title: "Execution Result",
                content,
              },
            });

            send("result", result);

            // Update task status to done
            await prisma.task.update({
              where: { id: taskId },
              data: { status: "done" },
            });

            send("status_change", { status: "done" });
          } catch (err) {
            console.error("[stream] Error in onComplete:", err);
          } finally {
            closeStream();
          }
        },

        async onError(_runId: string, error: { code: number; message: string }) {
          if (cancelled) return;

          try {
            // Save error as ThoughtEntry
            const thought = await prisma.thoughtEntry.create({
              data: {
                taskId,
                agentId,
                type: "error",
                content: error.message,
              },
            });

            send("thought", thought);

            // Update task status to blocked
            await prisma.task.update({
              where: { id: taskId },
              data: { status: "blocked" },
            });

            send("status_change", { status: "blocked" });
          } catch (err) {
            console.error("[stream] Error in onError:", err);
          } finally {
            closeStream();
          }
        },
      };

      // -- Event handlers ------------------------------------------------

      async function handleLifecycleEvent(data: Record<string, unknown>) {
        const phase = data.phase as string | undefined;

        if (phase === "start") {
          send("status_change", { status: "thinking" });
          await prisma.task.update({
            where: { id: taskId },
            data: { status: "thinking" },
          }).catch((err) => console.error("[stream] DB update failed:", err));

        } else if (phase === "error") {
          const errorContent = (data.error as string) ?? "Unknown lifecycle error";

          send("thought", { type: "error", content: errorContent });

          await prisma.thoughtEntry.create({
            data: {
              taskId,
              agentId,
              type: "error",
              content: errorContent,
            },
          }).catch((err) => console.error("[stream] DB insert failed:", err));

          send("status_change", { status: "blocked" });

          await prisma.task.update({
            where: { id: taskId },
            data: { status: "blocked" },
          }).catch((err) => console.error("[stream] DB update failed:", err));
        }
        // phase === "end" is handled by onComplete callback
      }

      async function handleAssistantEvent(data: Record<string, unknown>) {
        const delta = (data.delta as string) ?? (data.text as string) ?? "";
        if (!delta) return;

        const thought = await prisma.thoughtEntry.create({
          data: {
            taskId,
            agentId,
            type: "thinking",
            content: delta,
          },
        }).catch((err) => {
          console.error("[stream] DB insert failed:", err);
          return null;
        });

        send("thought", thought ?? { type: "thinking", content: delta });
      }

      async function handleToolEvent(data: Record<string, unknown>) {
        const phase = data.phase as string | undefined;
        const toolName = (data.name as string) ?? "unknown";

        if (phase === "start") {
          send("status_change", { status: "acting" });

          await prisma.task.update({
            where: { id: taskId },
            data: { status: "acting" },
          }).catch((err) => console.error("[stream] DB update failed:", err));

          const thought = await prisma.thoughtEntry.create({
            data: {
              taskId,
              agentId,
              type: "tool_use",
              content: `Calling ${toolName}`,
              toolName,
            },
          }).catch((err) => {
            console.error("[stream] DB insert failed:", err);
            return null;
          });

          send("thought", thought ?? {
            type: "tool_use",
            content: `Calling ${toolName}`,
            toolName,
          });

        } else if (phase === "result") {
          const isError = Boolean(data.isError);
          const result = (data.result as string) ?? "";
          const content = `${toolName}: ${result}`;
          const type = isError ? "error" : "result";

          const thought = await prisma.thoughtEntry.create({
            data: {
              taskId,
              agentId,
              type,
              content,
              toolName,
            },
          }).catch((err) => {
            console.error("[stream] DB insert failed:", err);
            return null;
          });

          send("thought", thought ?? { type, content, toolName });
        }
        // phase === "update" is ignored for Phase 1
      }

      async function handleErrorEvent(data: Record<string, unknown>) {
        const message = (data.message as string) ?? "Unknown error";

        const thought = await prisma.thoughtEntry.create({
          data: {
            taskId,
            agentId,
            type: "error",
            content: message,
          },
        }).catch((err) => {
          console.error("[stream] DB insert failed:", err);
          return null;
        });

        send("thought", thought ?? { type: "error", content: message });
      }

      // Subscribe to Gateway events
      gatewayClient.subscribe(runId, subscriber);
    },

    cancel() {
      if (cleanupFn) cleanupFn();
      else {
        cancelled = true;
        gatewayClient.unsubscribe(runId);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
