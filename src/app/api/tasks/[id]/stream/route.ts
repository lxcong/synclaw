import { prisma } from "@/lib/db";
import { getMockScenario } from "@/lib/mock-engine";

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

  // Bug 1: If the task has no assigned agent, return a simple stream
  // with the current status and close immediately.
  if (!task.assignedAgentId) {
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

  // Capture non-null reference for use inside closures
  const validTask = task;
  const scenario = getMockScenario();
  let eventIndex = 0;
  let waitingForIntervention = false;
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(event: string, data: unknown) {
        if (cancelled) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

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
      }, 15000);

      async function processNextEvent() {
        if (cancelled) {
          clearInterval(heartbeatInterval);
          return;
        }

        if (eventIndex >= scenario.length) {
          clearInterval(heartbeatInterval);
          if (!cancelled) controller.close();
          return;
        }

        const event = scenario[eventIndex];

        if (event.type === "intervention" && !waitingForIntervention) {
          waitingForIntervention = true;

          const intervention = await prisma.interventionRequest.create({
            data: {
              taskId,
              question: event.data.question as string,
              options: event.data.options as string,
            },
          });

          await prisma.task.update({
            where: { id: taskId },
            data: { status: "blocked" },
          });

          send("status_change", { status: "blocked" });
          send("intervention", {
            id: intervention.id,
            taskId,
            question: intervention.question,
            options: JSON.parse(intervention.options ?? "[]"),
            createdAt: intervention.createdAt,
          });

          // Poll for intervention resolution
          const pollInterval = setInterval(async () => {
            if (cancelled) {
              clearInterval(pollInterval);
              return;
            }
            try {
              const updated = await prisma.interventionRequest.findUnique({
                where: { id: intervention.id },
              });
              if (updated?.resolvedAt) {
                clearInterval(pollInterval);
                waitingForIntervention = false;
                eventIndex++;
                processNextEvent();
              }
            } catch {
              clearInterval(pollInterval);
            }
          }, 1000);

          return;
        }

        await new Promise((resolve) => setTimeout(resolve, event.delay));

        if (cancelled) {
          clearInterval(heartbeatInterval);
          return;
        }

        if (event.type === "status_change") {
          await prisma.task.update({
            where: { id: taskId },
            data: { status: event.data.status as string },
          });
          send("status_change", { status: event.data.status });
        } else if (event.type === "thought") {
          const thought = await prisma.thoughtEntry.create({
            data: {
              taskId,
              agentId: validTask.assignedAgentId!,
              type: event.data.thoughtType as string,
              content: event.data.content as string,
              toolName: (event.data.toolName as string) ?? null,
            },
          });
          send("thought", thought);
        } else if (event.type === "result") {
          const result = await prisma.taskResult.create({
            data: {
              taskId,
              type: event.data.resultType as string,
              title: event.data.title as string,
              content: event.data.content as string,
            },
          });
          send("result", result);
        }

        eventIndex++;
        processNextEvent();
      }

      processNextEvent();
    },
    cancel() {
      cancelled = true;
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
