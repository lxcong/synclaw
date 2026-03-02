import { prisma } from "@/lib/db";
import type { AgentEvent } from "@/lib/gateway-client";

// ---------------------------------------------------------------------------
// In-memory dedup & concurrency control
// ---------------------------------------------------------------------------

const knownRunIds = new Set<string>();
const pendingCreations = new Map<string, Promise<string | null>>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse agent ID from a sessionKey like "agent:{agentId}:..."
 */
function parseAgentIdFromSessionKey(sessionKey: string | undefined): string | null {
  if (!sessionKey) return null;
  const match = sessionKey.match(/^agent:([^:]+):/);
  return match ? match[1] : null;
}

/**
 * Parse task ID from a sessionKey like "agent:{agentId}:syncclaw:{taskId}"
 */
function parseTaskIdFromSessionKey(sessionKey: string | undefined): string | null {
  if (!sessionKey) return null;
  const match = sessionKey.match(/:syncclaw:(.+)$/);
  return match ? match[1] : null;
}

let cachedDefaultWorkspaceId: string | null = null;

async function getDefaultWorkspaceId(): Promise<string> {
  if (cachedDefaultWorkspaceId) return cachedDefaultWorkspaceId;

  const workspace = await prisma.workspace.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (workspace) {
    cachedDefaultWorkspaceId = workspace.id;
    return workspace.id;
  }

  // Create a default workspace if none exists
  const created = await prisma.workspace.create({
    data: { name: "Default", icon: "📁" },
  });
  cachedDefaultWorkspaceId = created.id;
  return created.id;
}

// ---------------------------------------------------------------------------
// Core: ensure a Task exists for a given runId
// ---------------------------------------------------------------------------

/** Maps runId → taskId for fast lookup after first encounter. */
const runIdToTaskId = new Map<string, string>();

async function ensureTaskForRun(
  runId: string,
  event: AgentEvent
): Promise<string | null> {
  // 1. Fast path: already known — return cached taskId
  const cached = runIdToTaskId.get(runId);
  if (cached) return cached;

  // 2. Coalesce concurrent calls for the same runId
  const inflight = pendingCreations.get(runId);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      // 3. DB check (covers server restarts where in-memory cache is empty)
      const existing = await prisma.task.findFirst({ where: { runId } });
      if (existing) {
        knownRunIds.add(runId);
        runIdToTaskId.set(runId, existing.id);
        return existing.id;
      }

      // 3b. Check if sessionKey references a parent task (sub-run detection)
      const parentTaskId = parseTaskIdFromSessionKey(event.sessionKey);
      if (parentTaskId) {
        const parentTask = await prisma.task.findUnique({ where: { id: parentTaskId } });
        if (parentTask) {
          knownRunIds.add(runId);
          runIdToTaskId.set(runId, parentTask.id);
          return parentTask.id;
        }
      }

      // 4. Resolve agent
      const agentId = parseAgentIdFromSessionKey(event.sessionKey);
      let assignedAgentId: string | undefined;
      let agentName = "Unknown Agent";

      if (agentId) {
        const agent = await prisma.agent.findUnique({ where: { id: agentId } });
        if (agent) {
          assignedAgentId = agent.id;
          agentName = agent.name;
        }
      }

      // 5. Create the task
      const workspaceId = await getDefaultWorkspaceId();
      const task = await prisma.task.create({
        data: {
          title: `External Task [${agentName}]`,
          status: "acting",
          runId,
          workspaceId,
          assignedAgentId,
        },
      });

      knownRunIds.add(runId);
      runIdToTaskId.set(runId, task.id);
      return task.id;
    } catch (err) {
      // Unique constraint violation → another path created it first
      if (
        err instanceof Error &&
        err.message.includes("Unique constraint")
      ) {
        knownRunIds.add(runId);
        const existing = await prisma.task.findFirst({ where: { runId } });
        if (existing) {
          runIdToTaskId.set(runId, existing.id);
          return existing.id;
        }
        return null;
      }
      console.error("[task-auto-tracker] Failed to create task:", err);
      return null;
    } finally {
      pendingCreations.delete(runId);
    }
  })();

  pendingCreations.set(runId, promise);
  return promise;
}

// ---------------------------------------------------------------------------
// Accumulate assistant text per run for final TaskResult
// ---------------------------------------------------------------------------

const runAssistantText = new Map<string, string>();

// Track runs whose title has already been refined from assistant text
const titleUpdatedRuns = new Set<string>();

/**
 * Derive a concise task title from assistant response text.
 * Strips markdown formatting, takes the first meaningful line, and truncates.
 */
function deriveTitle(text: string, agentName: string, maxLen = 50): string {
  const cleaned = text
    .replace(/^#+\s*/gm, "")       // strip markdown headings
    .replace(/\*\*|__/g, "")       // strip bold
    .replace(/\*|_/g, "")          // strip italic
    .replace(/`[^`]*`/g, "")       // strip inline code
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // [text](url) → text
    .replace(/\n+/g, " ")          // collapse newlines
    .trim();

  if (!cleaned) return `External Task [${agentName}]`;

  const truncated =
    cleaned.length > maxLen ? cleaned.slice(0, maxLen) + "…" : cleaned;

  return `[${agentName}] ${truncated}`;
}

// ---------------------------------------------------------------------------
// Global event handler
// ---------------------------------------------------------------------------
// NOTE: Gateway only broadcasts lifecycle, assistant, and error events to all
// operators. Tool events are only sent to the operator that initiated the run,
// so external tasks will not have tool_use/result thought entries.

export async function handleGlobalAgentEvent(event: AgentEvent): Promise<void> {
  const { runId } = event;
  if (!runId) return;

  const taskId = await ensureTaskForRun(runId, event);
  if (!taskId) return;

  // Resolve agentId for ThoughtEntry (required field)
  const agentId = parseAgentIdFromSessionKey(event.sessionKey);

  switch (event.stream) {
    case "lifecycle": {
      const phase = event.data.phase as string | undefined;
      // User-created tasks have sessionKey "agent:{id}:syncclaw:{taskId}".
      // Their lifecycle is managed by task-run-tracker; auto-tracker only
      // handles external (non-syncclaw) tasks to avoid duplicate writes.
      const isUserCreatedTask = Boolean(parseTaskIdFromSessionKey(event.sessionKey));

      if (phase === "start") {
        await prisma.task.update({
          where: { id: taskId },
          data: { status: "acting" },
        });
      } else if (phase === "end") {
        if (!isUserCreatedTask) {
          // Atomic guard: only first handler to flip acting→done wins.
          const { count } = await prisma.task.updateMany({
            where: { id: taskId, status: "acting" },
            data: { status: "done" },
          });
          if (count > 0) {
            const resultText = runAssistantText.get(runId);
            if (resultText) {
              await prisma.taskResult.create({
                data: {
                  taskId,
                  type: "text",
                  title: "Execution Result",
                  content: resultText,
                },
              });
            }
          }
        }
        runAssistantText.delete(runId);
        titleUpdatedRuns.delete(runId);
      } else if (phase === "error" && agentId) {
        const { count } = await prisma.task.updateMany({
          where: { id: taskId, status: "acting" },
          data: { status: "done" },
        });
        if (count > 0) {
          const errorContent =
            (event.data.error as string) ?? "Unknown lifecycle error";
          await prisma.thoughtEntry.create({
            data: { taskId, agentId, type: "error", content: errorContent },
          });
        }
        runAssistantText.delete(runId);
        titleUpdatedRuns.delete(runId);
      }
      break;
    }
    case "assistant": {
      // Gateway sends cumulative `text` and incremental `delta`.
      // Use `text` directly as it already contains the full response so far.
      const text = (event.data.text as string) ?? "";
      if (text) {
        runAssistantText.set(runId, text);

        // Refine the generic title once we have enough response text
        if (!titleUpdatedRuns.has(runId) && text.length >= 20) {
          titleUpdatedRuns.add(runId);
          const agentId2 = parseAgentIdFromSessionKey(event.sessionKey);
          let agentName = "Agent";
          if (agentId2) {
            const agent = await prisma.agent.findUnique({ where: { id: agentId2 } });
            if (agent) agentName = agent.name;
          }
          const title = deriveTitle(text, agentName);
          await prisma.task.update({
            where: { id: taskId },
            data: { title },
          });
        }
      }
      break;
    }
    case "error": {
      if (!agentId) break;
      const message = (event.data.message as string) ?? "Unknown error";
      await prisma.thoughtEntry.create({
        data: { taskId, agentId, type: "error", content: message },
      });
      break;
    }
  }
}
