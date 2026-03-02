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
 * Parse IDENTITY.md content into key-value pairs.
 * Format: `- **Key:** Value` per line.
 */
function parseIdentityMarkdown(content: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const match = line.match(/^-\s*\*{0,2}(.+?)\*{0,2}:\s*(.+)$/);
    if (match) {
      const key = match[1].replace(/\*/g, "").trim().toLowerCase();
      const value = match[2].trim();
      if (value) fields[key] = value;
    }
  }
  return fields;
}

/**
 * Build a short description from IDENTITY.md fields.
 */
function buildDescriptionFromIdentity(fields: Record<string, string>): string {
  const parts: string[] = [];
  if (fields.creature) parts.push(fields.creature);
  if (fields.vibe) parts.push(fields.vibe);
  return parts.join(" · ") || "";
}

/**
 * Fetch IDENTITY.md for an agent from Gateway. Returns parsed identity fields.
 */
async function fetchAgentIdentity(agentId: string): Promise<{ description: string; emoji: string | null }> {
  try {
    const result = (await gatewayClient.request("agents.files.get", {
      agentId,
      name: "IDENTITY.md",
    })) as GatewayFileResult;

    if (result.file.missing || !result.file.content) {
      return { description: "", emoji: null };
    }
    const fields = parseIdentityMarkdown(result.file.content);
    return {
      description: buildDescriptionFromIdentity(fields),
      emoji: fields.emoji || null,
    };
  } catch {
    return { description: "", emoji: null };
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

  let result: GatewayAgentListResult;
  try {
    result = (await gatewayClient.request(
      "agents.list",
      {}
    )) as GatewayAgentListResult;
  } catch {
    // Gateway unavailable — return local DB data
    return getAgentsWithInferredStatus();
  }

  const gatewayAgentIds = new Set<string>();

  // Fetch identity from IDENTITY.md in parallel
  const identityPromises = result.agents.map(async (ga) => {
    const identity = await fetchAgentIdentity(ga.id);
    return { ...ga, parsedIdentity: identity };
  });
  const agentsWithIdentity = await Promise.all(identityPromises);

  // Upsert each agent
  for (const ga of agentsWithIdentity) {
    gatewayAgentIds.add(ga.id);
    const name = ga.identity?.name || ga.name || ga.id;
    const emoji = ga.identity?.emoji || ga.parsedIdentity.emoji || null;
    const avatarUrl = ga.identity?.avatarUrl || null;
    const description = ga.parsedIdentity.description;

    await prisma.agent.upsert({
      where: { id: ga.id },
      create: {
        id: ga.id,
        name,
        description,
        emoji,
        avatarUrl,
        capabilities: "[]",
      },
      update: {
        name,
        description,
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
