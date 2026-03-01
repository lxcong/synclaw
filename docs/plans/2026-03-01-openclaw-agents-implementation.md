# OpenClaw Agent Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace mock agent hub with real agents fetched from OpenClaw Gateway via `agents.list` and `agents.files.get` RPC methods, synced to local Prisma DB.

**Architecture:** Agent data flows from OpenClaw Gateway → local Prisma DB → UI. The `GET /api/agents` endpoint calls Gateway RPC to sync agents, then returns them from DB. Task dispatch passes `agentId` to Gateway. Agent status is inferred from active task count.

**Tech Stack:** Next.js 16, Prisma/SQLite, WebSocket RPC (existing gateway-client.ts), TypeScript

---

### Task 1: Update Prisma Schema — Agent.id no longer auto-generated

**Files:**
- Modify: `prisma/schema.prisma:20-31`

**Step 1: Update Agent model**

Change the Agent model so `id` accepts external IDs and add `emoji` field:

```prisma
model Agent {
  id            String         @id
  name          String
  description   String         @default("")
  capabilities  String         @default("[]") // JSON array as string
  status        String         @default("idle") // idle | busy | offline | error
  emoji         String?
  avatarUrl     String?
  lastHeartbeat DateTime?
  tasks         Task[]
  thoughts      ThoughtEntry[]
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
}
```

Key changes:
- `@id` without `@default(cuid())` — ID comes from OpenClaw
- `description` gets `@default("")` — may not exist in OpenClaw
- `capabilities` gets `@default("[]")` — may not exist in OpenClaw
- Add `emoji String?` — from OpenClaw identity
- Add `updatedAt DateTime @updatedAt` — for sync tracking

**Step 2: Regenerate Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client"

**Step 3: Reset the database (dev only)**

Run: `npx prisma db push --force-reset`
Expected: Database schema updated

**Step 4: Commit**

```bash
git add prisma/schema.prisma generated/
git commit -m "feat: update Agent schema for OpenClaw sync"
```

---

### Task 2: Update TypeScript types — add emoji field

**Files:**
- Modify: `src/types/index.ts:24-33`

**Step 1: Update Agent interface**

```typescript
export interface Agent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  status: AgentStatus;
  emoji?: string | null;
  avatarUrl?: string | null;
  lastHeartbeat?: Date | null;
  createdAt: Date;
}
```

Only change: add `emoji?: string | null`.

**Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add emoji field to Agent type"
```

---

### Task 3: Create agent sync service — fetch from Gateway and upsert to DB

**Files:**
- Create: `src/lib/agent-sync.ts`

**Step 1: Create the agent sync module**

This module calls Gateway `agents.list` and `agents.files.get`, then upserts agents to Prisma DB.

```typescript
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

/**
 * Sync agents from OpenClaw Gateway to local Prisma DB.
 *
 * - Fetches agent list via `agents.list` RPC
 * - For each agent, fetches SOUL.md for description via `agents.files.get`
 * - Upserts each agent into local DB
 * - Removes agents from DB that no longer exist in Gateway
 *
 * Returns the synced agent list from DB with task counts.
 */
export async function syncAgentsFromGateway() {
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

  // Return agents from DB with task counts and inferred status
  const agents = await prisma.agent.findMany({
    include: {
      _count: {
        select: { tasks: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // Infer status from active tasks
  const agentsWithStatus = await Promise.all(
    agents.map(async (agent) => {
      const activeTasks = await prisma.task.count({
        where: {
          assignedAgentId: agent.id,
          status: { in: ["thinking", "acting"] },
        },
      });
      return {
        ...agent,
        status: activeTasks > 0 ? "busy" : "idle",
        capabilities: JSON.parse(agent.capabilities) as string[],
      };
    })
  );

  return agentsWithStatus;
}
```

**Step 2: Commit**

```bash
git add src/lib/agent-sync.ts
git commit -m "feat: add agent sync service for OpenClaw Gateway"
```

---

### Task 4: Update GET /api/agents — use sync service

**Files:**
- Modify: `src/app/api/agents/route.ts`

**Step 1: Replace DB-only query with sync-first approach**

```typescript
import { prisma } from "@/lib/db";
import { gatewayClient } from "@/lib/gateway-client";
import { syncAgentsFromGateway } from "@/lib/agent-sync";
import { NextResponse } from "next/server";

export async function GET() {
  // If Gateway is connected, sync agents first
  if (gatewayClient.isConnected) {
    try {
      const agents = await syncAgentsFromGateway();
      return NextResponse.json(agents);
    } catch (err) {
      console.error("[agents/GET] Gateway sync failed, falling back to DB:", err);
    }
  }

  // Fallback: return cached agents from DB
  const agents = await prisma.agent.findMany({
    include: { _count: { select: { tasks: true } } },
    orderBy: { name: "asc" },
  });

  const agentsWithStatus = await Promise.all(
    agents.map(async (agent) => {
      const activeTasks = await prisma.task.count({
        where: {
          assignedAgentId: agent.id,
          status: { in: ["thinking", "acting"] },
        },
      });
      return {
        ...agent,
        status: activeTasks > 0 ? "busy" : "idle",
        capabilities: JSON.parse(agent.capabilities) as string[],
      };
    })
  );

  return NextResponse.json(agentsWithStatus);
}
```

**Step 2: Commit**

```bash
git add src/app/api/agents/route.ts
git commit -m "feat: sync agents from Gateway in GET /api/agents"
```

---

### Task 5: Update POST /api/tasks — pass agentId to Gateway

**Files:**
- Modify: `src/app/api/tasks/route.ts:26-29`

**Step 1: Add agentId to Gateway dispatch params**

Change the `gatewayClient.request("agent", ...)` call to include `agentId`:

```typescript
      const result = (await gatewayClient.request("agent", {
        message,
        sessionKey: `sk:global:syncclaw:${task.id}`,
        idempotencyKey: task.id,
        agentId: task.assignedAgentId,
      })) as { runId: string; status: string };
```

Only change: add `agentId: task.assignedAgentId` to the params object.

**Step 2: Commit**

```bash
git add src/app/api/tasks/route.ts
git commit -m "feat: pass agentId to Gateway on task dispatch"
```

---

### Task 6: Update Agent Card — display emoji from OpenClaw

**Files:**
- Modify: `src/components/agent-card.tsx:29-31`

**Step 1: Use agent emoji instead of hardcoded icon**

Replace the hardcoded `🤖` with `agent.emoji`:

```tsx
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
            style={{ background: "var(--background)" }}
          >
            {agent.emoji || "🤖"}
          </div>
```

Also update the Props interface to include `emoji`:

In the Props type, the `Agent` interface already includes `emoji` after Task 2, so no change needed to Props.

**Step 2: Commit**

```bash
git add src/components/agent-card.tsx
git commit -m "feat: display agent emoji from OpenClaw"
```

---

### Task 7: Update seed data — remove mock agents

**Files:**
- Modify: `prisma/seed.ts`

**Step 1: Remove mock agent creation from seed**

Remove the three `prisma.agent.create()` blocks (lines 31-57) and remove agent assignments from task creation. Keep workspace seed data.

The seed file should:
- Keep workspace creation
- Remove all `prisma.agent.create()` calls
- Remove `assignedAgentId` from task creation (or remove the agent-assigned tasks)
- Keep any unassigned tasks

Updated seed.ts:

```typescript
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // Clean existing data
  await prisma.interventionRequest.deleteMany();
  await prisma.taskResult.deleteMany();
  await prisma.thoughtEntry.deleteMany();
  await prisma.task.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.workspace.deleteMany();

  // Create workspaces
  const csWorkspace = await prisma.workspace.create({
    data: { name: "公司客服", icon: "🎧", description: "客户服务相关任务" },
  });
  const lifeWorkspace = await prisma.workspace.create({
    data: { name: "个人生活", icon: "🏠", description: "个人事务管理" },
  });
  const finWorkspace = await prisma.workspace.create({
    data: { name: "财务自动化", icon: "💰", description: "财务流程自动化" },
  });

  // Create sample tasks (unassigned — agents come from OpenClaw)
  await prisma.task.create({
    data: {
      title: "整理本月财务报表",
      description: "汇总 2 月份所有收支数据",
      status: "todo",
      workspaceId: finWorkspace.id,
    },
  });
  await prisma.task.create({
    data: {
      title: "预约下周牙医",
      description: "周三或周四下午",
      status: "todo",
      workspaceId: lifeWorkspace.id,
    },
  });
  await prisma.task.create({
    data: {
      title: "处理客户咨询邮件",
      description: "回复今日未处理的客户问题",
      status: "todo",
      workspaceId: csWorkspace.id,
    },
  });

  console.log("Seed data created successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**Step 2: Run seed to verify**

Run: `npx prisma db seed`
Expected: "Seed data created successfully!"

**Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "refactor: remove mock agents from seed data"
```

---

### Task 8: Update E2E tests — adapt for dynamic agents

**Files:**
- Modify: `e2e/07-agent-hub.spec.ts`

**Step 1: Update tests for dynamic agent data**

The E2E tests currently assert mock agent names ("CS-Agent", "Life-Agent", "Fin-Agent"). Since agents now come from OpenClaw Gateway (which may not be running in test), update tests to:
- Check that the Agent Hub page loads correctly
- Check structural elements (page title, grid layout)
- Skip agent-specific assertions if no Gateway is available

```typescript
import { test, expect } from "@playwright/test";

test.describe("Agent Hub", () => {
  test("agent hub page renders correctly", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForTimeout(1000);

    // Page title is always present
    await expect(page.getByText("Agent 中心")).toBeVisible();
  });

  test("agent cards render when agents exist", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForTimeout(2000);

    // Check if any agent cards are rendered (from Gateway or DB cache)
    const cards = page.locator("[data-testid='agent-card']");
    const count = await cards.count();

    if (count > 0) {
      // Each card should have a name and status indicator
      const firstCard = cards.first();
      await expect(firstCard).toBeVisible();
    }
  });

  test("sidebar is visible on agent hub page", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForTimeout(1000);

    const sidebar = page.locator("aside");
    await expect(sidebar.getByText("Agent 中心")).toBeVisible();
  });
});
```

Also add `data-testid="agent-card"` to `src/components/agent-card.tsx`:

```tsx
    <div
      data-testid="agent-card"
      className="p-4 rounded-lg border transition-colors"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
```

**Step 2: Commit**

```bash
git add e2e/07-agent-hub.spec.ts src/components/agent-card.tsx
git commit -m "test: update agent hub E2E tests for dynamic agents"
```

---

### Task 9: Build and verify

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run dev server and verify agent sync**

Run: `npm run dev`
Then in another terminal: `curl http://localhost:3000/api/agents | jq .`
Expected: If Gateway is running, returns real agents from OpenClaw. If not, returns empty array or cached agents.

**Step 3: Run E2E tests**

Run: `npx playwright test e2e/07-agent-hub.spec.ts`
Expected: All tests pass

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address any build or test issues"
```
