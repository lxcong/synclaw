import { prisma } from "@/lib/db";
import { gatewayClient } from "@/lib/gateway-client";

/** Shape returned by Gateway RPC `agents.list`. */
interface GatewayAgentListResult {
  defaultId: string;
  mainKey: string;
  scope: string;
  agents: Array<{
    id: string;
    name?: string;
    identity?: {
      name?: string;
      theme?: string;
      emoji?: string;
      avatar?: string;
      avatarUrl?: string;
    };
  }>;
}

/** Shape returned by Gateway RPC `agents.files.get`. */
interface GatewayFileResult {
  agentId: string;
  workspace: string;
  file: {
    name: string;
    path: string;
    missing: boolean;
    content?: string;
    size?: number;
    updatedAtMs?: number;
  };
}

/**
 * Extract a short description from SOUL.md content.
 * Takes the first non-empty, non-heading line (up to 200 chars).
 */
function extractDescription(content: string): string {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("---")) {
      return trimmed.length > 200 ? `${trimmed.slice(0, 197)}...` : trimmed;
    }
  }
  return "";
}

/**
 * Fetch SOUL.md for an agent from Gateway. Returns empty string on failure.
 */
async function fetchAgentDescription(agentId: string): Promise<string> {
  try {
    const result = (await gatewayClient.request("agents.files.get", {
      agentId,
      name: "SOUL.md",
    })) as GatewayFileResult;

    if (result.file.missing || !result.file.content) {
      return "";
    }
    return extractDescription(result.file.content);
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Sync throttle — skip Gateway RPC if last sync was recent
// ---------------------------------------------------------------------------

const SYNC_INTERVAL_MS = 30_000; // 30 seconds
let lastSyncMs = 0;

/**
 * Sync agents from OpenClaw Gateway to local Prisma DB.
 *
 * - Skips if last sync was less than 30s ago (returns cached DB data)
 * - Fetches agent list via `agents.list` RPC
 * - For each agent, fetches SOUL.md for description via `agents.files.get`
 * - Upserts each agent into local DB
 * - Removes agents from DB that no longer exist in Gateway
 *
 * Returns the synced agent list from DB with task counts.
 */
export async function syncAgentsFromGateway(forceSync = false) {
  if (!forceSync && Date.now() - lastSyncMs < SYNC_INTERVAL_MS) {
    return getAgentsWithInferredStatus();
  }
  const result = (await gatewayClient.request(
    "agents.list",
    {}
  )) as GatewayAgentListResult;

  const gatewayAgentIds = new Set<string>();

  // Fetch descriptions in parallel
  const descriptionPromises = result.agents.map(async (ga) => {
    const description = await fetchAgentDescription(ga.id);
    return { ...ga, description };
  });
  const agentsWithDescriptions = await Promise.all(descriptionPromises);

  // Upsert each agent
  for (const ga of agentsWithDescriptions) {
    gatewayAgentIds.add(ga.id);
    const name = ga.identity?.name || ga.name || ga.id;
    const emoji = ga.identity?.emoji || null;
    const avatarUrl = ga.identity?.avatarUrl || null;

    await prisma.agent.upsert({
      where: { id: ga.id },
      create: {
        id: ga.id,
        name,
        description: ga.description,
        emoji,
        avatarUrl,
        capabilities: "[]",
      },
      update: {
        name,
        description: ga.description,
        emoji,
        avatarUrl,
      },
    });
  }

  // Remove agents that no longer exist in Gateway
  // (only those not referenced by tasks)
  if (gatewayAgentIds.size > 0) {
    const staleAgents = await prisma.agent.findMany({
      where: { id: { notIn: [...gatewayAgentIds] } },
      select: { id: true, _count: { select: { tasks: true } } },
    });
    const removableIds = staleAgents
      .filter((a) => a._count.tasks === 0)
      .map((a) => a.id);
    if (removableIds.length > 0) {
      await prisma.agent.deleteMany({
        where: { id: { in: removableIds } },
      });
    }
  }

  lastSyncMs = Date.now();
  return getAgentsWithInferredStatus();
}

/**
 * Get agents from local DB with task counts and status inferred from active tasks.
 * Shared by both sync and fallback paths.
 */
export async function getAgentsWithInferredStatus() {
  const agents = await prisma.agent.findMany({
    include: {
      _count: {
        select: { tasks: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return Promise.all(
    agents.map(async (agent) => {
      const activeTasks = await prisma.task.count({
        where: {
          assignedAgentId: agent.id,
          status: { in: ["acting"] },
        },
      });
      return {
        ...agent,
        status: activeTasks > 0 ? "busy" : "idle",
        capabilities: JSON.parse(agent.capabilities) as string[],
      };
    })
  );
}
